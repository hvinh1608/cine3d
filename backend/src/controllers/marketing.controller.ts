import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { internalError } from '../lib/http-error';
import {
  MARKETING_SEGMENTS,
  MarketingSegment,
  runMarketingCampaign,
} from '../services/marketing.service';
import { facebookPageConfigured, postToFacebookPage } from '../services/facebook-page.service';

function parseSegment(value: unknown): MarketingSegment | null {
  if (typeof value !== 'string') return null;
  const segment = value.trim().toUpperCase();
  return MARKETING_SEGMENTS.includes(segment as MarketingSegment)
    ? (segment as MarketingSegment)
    : null;
}

export const listMarketingCampaigns = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = await prisma.marketingCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        createdBy: { select: { id: true, username: true, email: true } },
      },
    });
    return res.json(campaigns);
  } catch (error) {
    return internalError(res, 'Không thể tải danh sách chiến dịch.', error);
  }
};

export const createMarketingCampaign = async (req: AuthenticatedRequest, res: Response) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  const url = typeof req.body.url === 'string' ? req.body.url.trim().slice(0, 500) : '';
  const segment = parseSegment(req.body.segment) || 'ALL';
  const sendNow = Boolean(req.body.sendNow);
  const scheduledRaw = typeof req.body.scheduledAt === 'string' ? req.body.scheduledAt.trim() : '';
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;

  if (!title || title.length > 120) {
    return res.status(400).json({ message: 'Tiêu đề bắt buộc (tối đa 120 ký tự).' });
  }
  if (!body || body.length > 500) {
    return res.status(400).json({ message: 'Nội dung bắt buộc (tối đa 500 ký tự).' });
  }
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return res.status(400).json({ message: 'Thời gian lên lịch không hợp lệ.' });
  }

  try {
    const campaign = await prisma.marketingCampaign.create({
      data: {
        title,
        body,
        url: url || null,
        segment,
        status: sendNow ? 'DRAFT' : scheduledAt && scheduledAt.getTime() > Date.now() ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null,
        createdById: req.user?.id || null,
      },
    });

    if (sendNow) {
      const sent = await runMarketingCampaign(campaign.id);
      return res.status(201).json(sent);
    }

    return res.status(201).json(campaign);
  } catch (error) {
    return internalError(res, 'Không thể tạo chiến dịch.', error);
  }
};

export const sendMarketingCampaign = async (req: AuthenticatedRequest, res: Response) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!id) return res.status(400).json({ message: 'Thiếu mã chiến dịch.' });
  try {
    const existing = await prisma.marketingCampaign.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy chiến dịch.' });
    if (existing.status === 'SENT') {
      return res.status(409).json({ message: 'Chiến dịch đã được gửi.' });
    }
    if (existing.status === 'SENDING') {
      return res.status(409).json({ message: 'Chiến dịch đang được gửi.' });
    }
    const sent = await runMarketingCampaign(id);
    return res.json(sent);
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.includes('already')) {
      return res.status(409).json({ message: 'Chiến dịch không thể gửi lại.' });
    }
    return internalError(res, 'Không thể gửi chiến dịch.', error);
  }
};

export const getMarketingSummary = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [
      pushWeb,
      pushNative,
      vipUsers,
      inactiveCandidates,
      activeUsers,
      utmEvents,
      campaignStats,
    ] = await Promise.all([
      prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ['userId'] }),
      prisma.nativeDevice.findMany({
        where: { notificationsEnabled: true },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.user.count({
        where: {
          isLocked: false,
          OR: [
            { vipExpiresAt: { gt: now } },
            { AND: [{ isVip: true }, { vipExpiresAt: null }] },
          ],
        },
      }),
      prisma.user.count({ where: { isLocked: false } }),
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: since }, userId: { not: null } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.analyticsEvent.findMany({
        where: {
          createdAt: { gte: since },
          name: { in: ['page_view', 'share_click', 'campaign_open'] },
        },
        select: { name: true, metadata: true },
        take: 5000,
      }),
      prisma.marketingCampaign.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const pushUserIds = new Set([...pushWeb, ...pushNative].map((row) => row.userId));
    const activeUserCount = activeUsers.length;
    const inactiveApprox = Math.max(0, inactiveCandidates - activeUserCount);

    const utmSourceCounts = new Map<string, number>();
    const utmCampaignCounts = new Map<string, number>();
    let shareClicks = 0;
    let campaignOpens = 0;

    for (const event of utmEvents) {
      if (event.name === 'share_click') shareClicks += 1;
      if (event.name === 'campaign_open') campaignOpens += 1;
      const meta = event.metadata && typeof event.metadata === 'object' ? (event.metadata as Record<string, unknown>) : null;
      const source = typeof meta?.utm_source === 'string' ? meta.utm_source.trim() : '';
      const campaign = typeof meta?.utm_campaign === 'string' ? meta.utm_campaign.trim() : '';
      if (source) utmSourceCounts.set(source, (utmSourceCounts.get(source) || 0) + 1);
      if (campaign) utmCampaignCounts.set(campaign, (utmCampaignCounts.get(campaign) || 0) + 1);
    }

    const topUtmSources = [...utmSourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([source, count]) => ({ source, count }));
    const topUtmCampaigns = [...utmCampaignCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([campaign, count]) => ({ campaign, count }));

    return res.json({
      periodDays: 7,
      pushSubscribers: pushUserIds.size,
      vipUsers,
      activeUsers: activeUserCount,
      inactiveApprox,
      shareClicks,
      campaignOpens,
      topUtmSources,
      topUtmCampaigns,
      campaignsByStatus: Object.fromEntries(
        campaignStats.map((row) => [row.status, row._count._all])
      ),
      facebookConfigured: facebookPageConfigured(),
    });
  } catch (error) {
    return internalError(res, 'Không thể tải tóm tắt marketing.', error);
  }
};

export const postMarketingToFacebook = async (req: AuthenticatedRequest, res: Response) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  const url = typeof req.body.url === 'string' ? req.body.url.trim().slice(0, 500) : '';

  if (!title && !body) {
    return res.status(400).json({ message: 'Nhập tiêu đề hoặc nội dung để đăng Facebook.' });
  }
  if (!facebookPageConfigured()) {
    return res.status(503).json({
      message: 'Chưa cấu hình FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN trên server.',
    });
  }

  const message = [title, body].filter(Boolean).join('\n\n').slice(0, 2000);
  try {
    const result = await postToFacebookPage({ message, link: url || '/phim-moi' });
    return res.status(201).json({
      message: 'Đã đăng lên Facebook Page.',
      ...result,
    });
  } catch (error: any) {
    const text = String(error?.message || error);
    if (text.includes('chưa cấu hình')) {
      return res.status(503).json({ message: text });
    }
    return res.status(502).json({ message: text.slice(0, 400) || 'Không đăng được lên Facebook.' });
  }
};
