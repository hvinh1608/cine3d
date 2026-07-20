import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { internalError } from '../lib/http-error';
import { parseProductPlanMap } from '../lib/native-client';
import { mergeVipExpiry } from '../lib/vip';
import {
  acknowledgeGooglePlaySubscription,
  grantsPlayAccess,
  isGooglePlayConfigured,
  verifyGooglePlaySubscription,
  VerifiedPlayPurchase,
} from '../services/google-play.service';

function secureEqual(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function mappedPlan(productId: string) {
  const planRef = parseProductPlanMap()[productId];
  if (!planRef) return null;
  return prisma.vipPlan.findFirst({
    where: { isActive: true, OR: [{ id: planRef }, { code: planRef }] },
  });
}

async function persistVerifiedPurchase(userId: string, verified: VerifiedPlayPurchase) {
  const existing = await prisma.playPurchase.findUnique({
    where: { purchaseToken: verified.purchaseToken },
    select: { userId: true },
  });
  if (existing && existing.userId !== userId) throw new Error('PLAY_PURCHASE_OWNED_BY_ANOTHER_USER');

  const plan = await mappedPlan(verified.productId);
  if (!plan) throw new Error('PLAY_PRODUCT_NOT_MAPPED');

  let acknowledged = verified.acknowledged;
  let acknowledgedAt: Date | null = acknowledged ? new Date() : null;
  if (!acknowledged && process.env.GOOGLE_PLAY_ACKNOWLEDGE_PURCHASES !== 'false') {
    await acknowledgeGooglePlaySubscription(verified.productId, verified.purchaseToken);
    acknowledged = true;
    acknowledgedAt = new Date();
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.playPurchase.upsert({
      where: { purchaseToken: verified.purchaseToken },
      update: {
        planId: plan.id,
        productId: verified.productId,
        orderId: verified.orderId,
        status: verified.status,
        expiryTime: verified.expiryTime,
        acknowledged,
        acknowledgedAt,
        providerPayload: verified.raw as Prisma.InputJsonValue,
      },
      create: {
        userId,
        planId: plan.id,
        productId: verified.productId,
        purchaseToken: verified.purchaseToken,
        orderId: verified.orderId,
        status: verified.status,
        expiryTime: verified.expiryTime,
        acknowledged,
        acknowledgedAt,
        providerPayload: verified.raw as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        productId: true,
        orderId: true,
        status: true,
        expiryTime: true,
        acknowledged: true,
        updatedAt: true,
      },
    });

    if (grantsPlayAccess(verified.status, verified.expiryTime, now)) {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { vipExpiresAt: true } });
      if (!user) throw new Error('USER_NOT_FOUND');
      const vipExpiresAt = mergeVipExpiry(user.vipExpiresAt, verified.expiryTime);
      await tx.user.update({ where: { id: userId }, data: { vipExpiresAt } });
    }
    return purchase;
  });
}

function providerError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'PLAY_PURCHASE_OWNED_BY_ANOTHER_USER') {
    return res.status(409).json({ message: 'This Google Play purchase belongs to another account.' });
  }
  if (message === 'PLAY_PRODUCT_NOT_MAPPED') {
    return res.status(400).json({ message: 'Google Play product is not mapped to an active VIP plan.' });
  }
  if (message === 'PLAY_PURCHASE_PRODUCT_MISMATCH' || message === 'PLAY_PURCHASE_EXPIRY_INVALID') {
    return res.status(400).json({ message: 'Google Play purchase is invalid.' });
  }
  return internalError(res, 'Google Play verification failed.', error, 502);
}

export const verifyGooglePlayPurchase = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  if (!isGooglePlayConfigured()) {
    return res.status(503).json({ message: 'Google Play verification is not configured.' });
  }
  const productId = typeof req.body.productId === 'string' ? req.body.productId.trim() : '';
  const purchaseToken = typeof req.body.purchaseToken === 'string' ? req.body.purchaseToken.trim() : '';
  if (!productId || !purchaseToken) return res.status(400).json({ message: 'productId and purchaseToken are required.' });

  try {
    const verified = await verifyGooglePlaySubscription(purchaseToken, productId);
    const purchase = await persistVerifiedPurchase(req.user.id, verified);
    return res.json({ message: 'Google Play purchase verified.', purchase });
  } catch (error) {
    return providerError(res, error);
  }
};

export const handleGooglePlayRtdn = async (req: AuthenticatedRequest, res: Response) => {
  const expectedSecret = process.env.GOOGLE_PLAY_RTDN_SECRET?.trim();
  const headerName = process.env.GOOGLE_PLAY_RTDN_SECRET_HEADER?.trim() || 'x-google-rtdn-secret';
  if (!expectedSecret) return res.status(503).json({ message: 'Google Play RTDN is not configured.' });
  if (!secureEqual(req.get(headerName), expectedSecret)) return res.status(401).json({ message: 'Invalid RTDN secret.' });
  if (!isGooglePlayConfigured()) return res.status(503).json({ message: 'Google Play verification is not configured.' });

  try {
    const encoded = typeof req.body?.message?.data === 'string' ? req.body.message.data : '';
    if (!encoded) return res.status(400).json({ message: 'RTDN message data is required.' });
    const event = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as {
      subscriptionNotification?: { purchaseToken?: string };
    };
    const purchaseToken = event.subscriptionNotification?.purchaseToken;
    if (!purchaseToken) return res.json({ acknowledged: true });

    const existing = await prisma.playPurchase.findUnique({
      where: { purchaseToken },
      select: { userId: true, productId: true },
    });
    if (!existing) return res.json({ acknowledged: true });
    const verified = await verifyGooglePlaySubscription(purchaseToken, existing.productId);
    await persistVerifiedPurchase(existing.userId, verified);
    return res.json({ acknowledged: true });
  } catch (error) {
    return providerError(res, error);
  }
};
