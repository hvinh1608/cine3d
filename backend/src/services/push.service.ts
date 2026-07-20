import webPush from 'web-push';
import { prisma } from '../lib/prisma';
import { sendFcmToUsers } from './fcm.service';

const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@cine3d.id.vn';

export const pushConfigured = Boolean(publicKey && privateKey);

if (publicKey && privateKey) {
  webPush.setVapidDetails(subject, publicKey, privateKey);
}

export function getPushPublicKey() {
  return publicKey || null;
}

export async function sendPushToUsers(
  userIds: string[],
  payload: { title: string; body: string; url?: string; icon?: string }
) {
  if (userIds.length === 0) return;
  const nativeDelivery = sendFcmToUsers(userIds, payload)
    .catch((error) => console.warn('FCM delivery failed.', error));
  if (!pushConfigured) {
    await nativeDelivery;
    return;
  }
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: [...new Set(userIds)] } },
  });

  await Promise.all([
    nativeDelivery,
    Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 }
      );
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        return;
      }
      console.warn('Web Push delivery failed.', error?.message || error);
    }
    })),
  ]);
}
