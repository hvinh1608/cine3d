import { prisma } from '../lib/prisma';
import { sendPushToUsers } from './push.service';

export const MARKETING_SEGMENTS = ['ALL', 'VIP', 'NON_VIP', 'INACTIVE_7D', 'HAS_PUSH'] as const;
export type MarketingSegment = (typeof MARKETING_SEGMENTS)[number];

export const MARKETING_STATUSES = ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED'] as const;

const BATCH_SIZE = 200;

function withUtm(url: string | null | undefined, campaignId: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const base = trimmed.startsWith('http') ? trimmed : `https://cine3d.id.vn${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
    const parsed = new URL(base);
    if (!parsed.searchParams.get('utm_source')) parsed.searchParams.set('utm_source', 'cine3d');
    if (!parsed.searchParams.get('utm_medium')) parsed.searchParams.set('utm_medium', 'push');
    if (!parsed.searchParams.get('utm_campaign')) parsed.searchParams.set('utm_campaign', `campaign_${campaignId.slice(0, 8)}`);
    if (trimmed.startsWith('http')) return parsed.toString();
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return trimmed;
  }
}

export async function resolveSegmentUserIds(segment: MarketingSegment): Promise<string[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (segment === 'ALL') {
    const users = await prisma.user.findMany({
      where: { isLocked: false },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  if (segment === 'VIP') {
    const users = await prisma.user.findMany({
      where: {
        isLocked: false,
        OR: [
          { vipExpiresAt: { gt: now } },
          { AND: [{ isVip: true }, { vipExpiresAt: null }] },
        ],
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  if (segment === 'NON_VIP') {
    const users = await prisma.user.findMany({
      where: {
        isLocked: false,
        AND: [
          { OR: [{ vipExpiresAt: null }, { vipExpiresAt: { lte: now } }] },
          { OR: [{ isVip: false }, { vipExpiresAt: { lte: now } }] },
        ],
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  if (segment === 'HAS_PUSH') {
    const [web, native] = await Promise.all([
      prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ['userId'] }),
      prisma.nativeDevice.findMany({
        where: { notificationsEnabled: true },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);
    return [...new Set([...web, ...native].map((row) => row.userId))];
  }

  // INACTIVE_7D — registered users with no analytics activity in the last 7 days
  const active = await prisma.analyticsEvent.findMany({
    where: { createdAt: { gte: sevenDaysAgo }, userId: { not: null } },
    distinct: ['userId'],
    select: { userId: true },
  });
  const activeIds = new Set(active.map((row) => row.userId!).filter(Boolean));
  const users = await prisma.user.findMany({
    where: { isLocked: false },
    select: { id: true },
  });
  return users.map((user) => user.id).filter((id) => !activeIds.has(id));
}

export async function runMarketingCampaign(campaignId: string) {
  const campaign = await prisma.marketingCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'SENDING') throw new Error('Campaign is already sending');
  if (campaign.status === 'SENT') throw new Error('Campaign already sent');

  const segment = (MARKETING_SEGMENTS.includes(campaign.segment as MarketingSegment)
    ? campaign.segment
    : 'ALL') as MarketingSegment;

  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING', error: null },
  });

  try {
    const userIds = await resolveSegmentUserIds(segment);
    const targetUrl = withUtm(campaign.url, campaignId);
    let sent = 0;
    let failed = 0;

    for (let index = 0; index < userIds.length; index += BATCH_SIZE) {
      const batch = userIds.slice(index, index + BATCH_SIZE);
      try {
        await prisma.notification.createMany({
          data: batch.map((userId) => ({
            userId,
            title: campaign.title,
            message: campaign.body,
            url: targetUrl,
          })),
        });
        await sendPushToUsers(batch, {
          title: campaign.title,
          body: campaign.body,
          url: targetUrl || undefined,
        });
        sent += batch.length;
      } catch (error) {
        failed += batch.length;
        console.warn('Marketing campaign batch failed.', error);
      }
    }

    return prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: failed > 0 && sent === 0 ? 'FAILED' : 'SENT',
        targeted: userIds.length,
        sent,
        failed,
        sentAt: new Date(),
        error: failed > 0 && sent === 0 ? 'All batches failed' : null,
      },
    });
  } catch (error: any) {
    await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        error: String(error?.message || error).slice(0, 500),
      },
    });
    throw error;
  }
}
