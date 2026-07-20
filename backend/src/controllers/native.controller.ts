import crypto from 'crypto';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { internalError } from '../lib/http-error';
import { hasVipAccess } from '../lib/vip';
import { hashOpaqueToken, isEligibleDownloadSource } from '../lib/native-client';

const cleanOptional = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

export const registerFcmToken = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const fcmToken = cleanOptional(req.body.fcmToken, 4096);
  const platform = cleanOptional(req.body.platform, 20)?.toLowerCase();
  if (!fcmToken || !platform || !['android', 'ios'].includes(platform)) {
    return res.status(400).json({ message: 'A valid fcmToken and platform are required.' });
  }
  try {
    const device = await prisma.nativeDevice.upsert({
      where: { fcmToken },
      update: {
        userId: req.user.id,
        platform,
        deviceId: cleanOptional(req.body.deviceId, 200),
        deviceModel: cleanOptional(req.body.deviceModel, 200),
        appVersion: cleanOptional(req.body.appVersion, 50),
      },
      create: {
        userId: req.user.id,
        fcmToken,
        platform,
        deviceId: cleanOptional(req.body.deviceId, 200),
        deviceModel: cleanOptional(req.body.deviceModel, 200),
        appVersion: cleanOptional(req.body.appVersion, 50),
      },
      select: {
        id: true,
        platform: true,
        deviceId: true,
        deviceModel: true,
        appVersion: true,
        notificationsEnabled: true,
        updatedAt: true,
      },
    });
    return res.status(201).json({ device });
  } catch (error) {
    return internalError(res, 'Could not register FCM token.', error);
  }
};

export const deleteFcmToken = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const fcmToken = cleanOptional(req.body.fcmToken, 4096);
  if (!fcmToken) return res.status(400).json({ message: 'fcmToken is required.' });
  try {
    const result = await prisma.nativeDevice.deleteMany({ where: { userId: req.user.id, fcmToken } });
    return res.json({ deleted: result.count > 0 });
  } catch (error) {
    return internalError(res, 'Could not remove FCM token.', error);
  }
};

export const updateFcmPreferences = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const fcmToken = cleanOptional(req.body.fcmToken, 4096);
  if (!fcmToken || typeof req.body.notificationsEnabled !== 'boolean') {
    return res.status(400).json({ message: 'fcmToken and notificationsEnabled are required.' });
  }
  try {
    const result = await prisma.nativeDevice.updateMany({
      where: { userId: req.user.id, fcmToken },
      data: { notificationsEnabled: req.body.notificationsEnabled },
    });
    if (!result.count) return res.status(404).json({ message: 'Device not found.' });
    return res.json({ notificationsEnabled: req.body.notificationsEnabled });
  } catch (error) {
    return internalError(res, 'Could not update push preferences.', error);
  }
};

export const getAppVersionPolicy = async (req: AuthenticatedRequest, res: Response) => {
  const platform = cleanOptional(req.query.platform, 20)?.toLowerCase();
  if (!platform || !['android', 'ios'].includes(platform)) {
    return res.status(400).json({ message: 'A valid platform is required.' });
  }
  try {
    const policy = await prisma.appVersionPolicy.findUnique({
      where: { platform },
      select: { platform: true, minVersion: true, latestVersion: true, forceUpdate: true, message: true, storeUrl: true, updatedAt: true },
    });
    if (!policy) return res.status(404).json({ message: 'Version policy not configured.' });
    return res.json({ policy });
  } catch (error) {
    return internalError(res, 'Could not load app version policy.', error);
  }
};

export const createDownloadEntitlement = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const episodeId = cleanOptional(req.body.episodeId, 100);
  const sourceId = cleanOptional(req.body.sourceId, 100);
  if (!episodeId || !sourceId) return res.status(400).json({ message: 'episodeId and sourceId are required.' });

  try {
    const [user, source] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { isVip: true, vipExpiresAt: true, isLocked: true, role: { select: { name: true } } },
      }),
      prisma.videoSource.findFirst({
        where: { id: sourceId, episodeId },
        include: { episode: { select: { id: true, movie: { select: { id: true, isVip: true, vipEarlyAccessUntil: true } } } } },
      }),
    ]);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!source) return res.status(404).json({ message: 'Eligible episode source not found.' });
    if (!isEligibleDownloadSource(source)) {
      return res.status(403).json({ message: 'This source is not eligible for native download.' });
    }
    const movieVip = source.episode.movie.isVip
      || (source.episode.movie.vipEarlyAccessUntil?.getTime() ?? 0) > Date.now();
    if ((source.isPremium || movieVip) && !hasVipAccess(user)) {
      return res.status(403).json({ message: 'VIP access is required for this source.' });
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const ttlSeconds = Math.min(24 * 60 * 60, Math.max(60, Number(process.env.DOWNLOAD_ENTITLEMENT_TTL_SECONDS) || 900));
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const entitlement = await prisma.downloadEntitlement.create({
      data: { userId: req.user.id, episodeId, sourceId, expiresAt, tokenHash: hashOpaqueToken(token) },
      select: { id: true, episodeId: true, sourceId: true, expiresAt: true },
    });
    return res.status(201).json({ entitlement: { ...entitlement, token } });
  } catch (error) {
    return internalError(res, 'Could not create download entitlement.', error);
  }
};

export const getDownloadEntitlement = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const token = cleanOptional(req.params.token, 200);
  if (!token) return res.status(400).json({ message: 'Entitlement token is required.' });
  try {
    const entitlement = await prisma.downloadEntitlement.findFirst({
      where: {
        tokenHash: hashOpaqueToken(token),
        userId: req.user.id,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        episodeId: true,
        expiresAt: true,
        source: { select: { id: true, url: true, type: true, quality: true, server: true } },
      },
    });
    if (!entitlement) return res.status(404).json({ message: 'Entitlement not found or expired.' });
    return res.json({ entitlement });
  } catch (error) {
    return internalError(res, 'Could not resolve download entitlement.', error);
  }
};
