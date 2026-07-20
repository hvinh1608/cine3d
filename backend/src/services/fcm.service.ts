import type { App } from 'firebase-admin/app';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from '../lib/prisma';

let firebaseApp: App | null | undefined;
let warned = false;

function getFirebaseApp(): App | null {
  if (firebaseApp !== undefined) return firebaseApp;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    if (!warned) {
      warned = true;
      console.warn('Firebase Admin is not configured; native push delivery is disabled.');
    }
    firebaseApp = null;
    return null;
  }
  try {
    const credentials = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
      throw new Error('Firebase service account JSON is incomplete.');
    }
    firebaseApp = getApps()[0] || initializeApp({
      credential: cert({
        projectId: credentials.project_id,
        clientEmail: credentials.client_email,
        privateKey: credentials.private_key.replace(/\\n/g, '\n'),
      }),
    });
    return firebaseApp;
  } catch (error) {
    console.warn('Firebase Admin initialization failed; native push delivery is disabled.', error);
    firebaseApp = null;
    return null;
  }
}

export async function sendFcmToUsers(
  userIds: string[],
  payload: { title: string; body: string; url?: string; icon?: string }
): Promise<void> {
  const app = getFirebaseApp();
  if (!app || !userIds.length) return;
  const devices = await prisma.nativeDevice.findMany({
    where: { userId: { in: [...new Set(userIds)] }, notificationsEnabled: true },
    select: { id: true, fcmToken: true },
  });
  if (!devices.length) return;

  const response = await getMessaging(app).sendEachForMulticast({
    tokens: devices.map((device) => device.fcmToken),
    notification: { title: payload.title, body: payload.body, imageUrl: payload.icon },
    data: payload.url ? { url: payload.url } : undefined,
    android: { priority: 'high' },
  });
  const invalidIds = response.responses
    .map((item, index) => {
      const code = item.error?.code;
      return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token'
        ? devices[index]?.id
        : undefined;
    })
    .filter((id): id is string => Boolean(id));
  if (invalidIds.length) {
    await prisma.nativeDevice.deleteMany({ where: { id: { in: invalidIds } } });
  }
}
