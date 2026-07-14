import { Response } from 'express';
import * as crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { extendVipExpiry, hasVipAccess } from '../lib/vip';
import { internalError } from '../lib/http-error';

const PENDING = 'PENDING';
const PAID = 'PAID';
const CANCELLED = 'CANCELLED';
const EXPIRED = 'EXPIRED';
const ORDER_TTL_MS = 30 * 60 * 1000;
const MANUAL_PAYMENT_ENABLED = (process.env.VIP_PAYMENT_MODE || 'manual').toLowerCase() !== 'disabled';

async function expirePendingOrders() {
  await prisma.vipOrder.updateMany({
    where: { status: PENDING, expiresAt: { lte: new Date() } },
    data: { status: EXPIRED },
  });
}

function createOrderCode() {
  return `VIP${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

const orderInclude = {
  plan: { select: { id: true, code: true, name: true } },
} as const;

export const getVipPlans = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const plans = await prisma.vipPlan.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        price: true,
        durationDays: true,
      },
    });
    return res.json({ plans });
  } catch (error) {
    return internalError(res, 'Không thể tải các gói VIP.', error);
  }
};

export const createVipOrder = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  if (!MANUAL_PAYMENT_ENABLED) return res.status(503).json({ message: 'Thanh toán VIP đang tạm tắt.' });
  const planId = typeof req.body.planId === 'string' ? req.body.planId : '';
  if (!planId) return res.status(400).json({ message: 'Vui lòng chọn gói VIP.' });

  try {
    await expirePendingOrders();
    const [plan, existingOrder] = await Promise.all([
      prisma.vipPlan.findFirst({ where: { id: planId, isActive: true } }),
      prisma.vipOrder.findFirst({
        where: { userId: req.user.id, status: PENDING, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      }),
    ]);

    if (!plan) return res.status(404).json({ message: 'Gói VIP không tồn tại hoặc đã ngừng bán.' });
    if (existingOrder) {
      return res.status(409).json({
        message: 'Bạn đang có một đơn VIP chờ xác nhận.',
        order: existingOrder,
      });
    }

    const order = await prisma.vipOrder.create({
      data: {
        orderCode: createOrderCode(),
        userId: req.user.id,
        planId: plan.id,
        amount: plan.price,
        durationDays: plan.durationDays,
        expiresAt: new Date(Date.now() + ORDER_TTL_MS),
      },
      include: orderInclude,
    });

    return res.status(201).json({
      message: 'Đã tạo đơn thanh toán. Hệ thống đang chờ xác nhận giao dịch.',
      order,
    });
  } catch (error) {
    return internalError(res, 'Không thể tạo đơn VIP.', error);
  }
};

export const getMyVipOrders = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    await expirePendingOrders();
    const [orders, user] = await Promise.all([
      prisma.vipOrder.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: orderInclude,
      }),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { isVip: true, vipExpiresAt: true, isLocked: true, role: { select: { name: true } } },
      }),
    ]);
    return res.json({
      vip: { active: hasVipAccess(user), expiresAt: user?.vipExpiresAt ?? null, permanent: user?.isVip ?? false },
      orders,
    });
  } catch (error) {
    return internalError(res, 'Không thể tải lịch sử VIP.', error);
  }
};

export const cancelMyVipOrder = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const updated = await prisma.vipOrder.updateMany({
      where: { id: req.params.id, userId: req.user.id, status: PENDING },
      data: { status: CANCELLED },
    });
    if (updated.count === 0) return res.status(409).json({ message: 'Đơn không còn ở trạng thái chờ xác nhận.' });
    return res.json({ message: 'Đã hủy đơn VIP.' });
  } catch (error) {
    return internalError(res, 'Không thể hủy đơn VIP.', error);
  }
};

export const getAdminVipOrders = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await expirePendingOrders();
    const orders = await prisma.vipOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        ...orderInclude,
        user: { select: { id: true, username: true, email: true, isVip: true, vipExpiresAt: true } },
        confirmedBy: { select: { id: true, username: true } },
      },
    });
    return res.json(orders);
  } catch (error) {
    return internalError(res, 'Không thể tải danh sách đơn VIP.', error);
  }
};

export const confirmVipOrder = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  if (!MANUAL_PAYMENT_ENABLED) return res.status(503).json({ message: 'Thanh toán VIP đang tạm tắt.' });
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.vipOrder.updateMany({
        where: { id: req.params.id, status: PENDING, expiresAt: { gt: now } },
        data: { status: PAID, paidAt: now, confirmedById: req.user!.id },
      });

      if (claimed.count === 0) {
        const existing = await tx.vipOrder.findUnique({ where: { id: req.params.id }, include: orderInclude });
        return { changed: false, order: existing, vipExpiresAt: null as Date | null };
      }

      const order = await tx.vipOrder.findUnique({
        where: { id: req.params.id },
        include: { ...orderInclude, user: { select: { vipExpiresAt: true } } },
      });
      if (!order) return { changed: false, order: null, vipExpiresAt: null as Date | null };

      const vipExpiresAt = extendVipExpiry(order.user.vipExpiresAt, order.durationDays, now);
      await tx.user.update({ where: { id: order.userId }, data: { vipExpiresAt } });
      await tx.notification.create({
        data: {
          userId: order.userId,
          title: 'Nâng cấp VIP thành công',
          message: `Đơn ${order.orderCode} đã được xác nhận. Tài khoản VIP có hiệu lực đến ${vipExpiresAt.toLocaleDateString('vi-VN')}.`,
          url: '/vip',
        },
      });

      return { changed: true, order, vipExpiresAt };
    });

    if (!result.order) return res.status(404).json({ message: 'Không tìm thấy đơn VIP.' });
    if (!result.changed) {
      if (result.order.status === PAID) return res.json({ message: 'Đơn đã được xác nhận trước đó.', order: result.order });
      return res.status(409).json({ message: 'Đơn đã hết hạn hoặc không còn chờ xác nhận.' });
    }

    return res.json({ message: 'Đã xác nhận thanh toán và kích hoạt VIP.', order: result.order, vipExpiresAt: result.vipExpiresAt });
  } catch (error) {
    return internalError(res, 'Không thể xác nhận đơn VIP.', error);
  }
};

export const cancelAdminVipOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await prisma.vipOrder.updateMany({
      where: { id: req.params.id, status: PENDING },
      data: { status: CANCELLED, confirmedById: req.user?.id },
    });
    if (updated.count === 0) return res.status(409).json({ message: 'Đơn không còn ở trạng thái chờ xác nhận.' });
    return res.json({ message: 'Đã hủy đơn VIP.' });
  } catch (error) {
    return internalError(res, 'Không thể hủy đơn VIP.', error);
  }
};
