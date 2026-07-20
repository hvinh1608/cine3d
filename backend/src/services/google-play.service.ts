import { google } from 'googleapis';

export type VerifiedPlayPurchase = {
  productId: string;
  purchaseToken: string;
  orderId: string | null;
  status: string;
  expiryTime: Date;
  acknowledged: boolean;
  raw: Record<string, unknown>;
};

const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
const credentialsJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();

export function isGooglePlayConfigured(): boolean {
  return Boolean(packageName && credentialsJson);
}

async function client() {
  if (!packageName || !credentialsJson) throw new Error('GOOGLE_PLAY_NOT_CONFIGURED');
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(credentialsJson) as Record<string, unknown>;
  } catch {
    throw new Error('GOOGLE_PLAY_CREDENTIALS_INVALID');
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  return google.androidpublisher({ version: 'v3', auth });
}

export async function verifyGooglePlaySubscription(
  purchaseToken: string,
  expectedProductId?: string
): Promise<VerifiedPlayPurchase> {
  const publisher = await client();
  const response = await publisher.purchases.subscriptionsv2.get({
    packageName: packageName!,
    token: purchaseToken,
  });
  const data = response.data;
  const lineItems = data.lineItems || [];
  const lineItem = expectedProductId
    ? lineItems.find((item) => item.productId === expectedProductId)
    : lineItems[0];
  if (!lineItem?.productId || !lineItem.expiryTime) throw new Error('PLAY_PURCHASE_PRODUCT_MISMATCH');
  const expiryTime = new Date(lineItem.expiryTime);
  if (Number.isNaN(expiryTime.getTime())) throw new Error('PLAY_PURCHASE_EXPIRY_INVALID');

  const state = data.subscriptionState || 'SUBSCRIPTION_STATE_UNSPECIFIED';
  const status = state.replace(/^SUBSCRIPTION_STATE_/, '');
  const acknowledged = data.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
  return {
    productId: lineItem.productId,
    purchaseToken,
    orderId: lineItem.latestSuccessfulOrderId || null,
    status,
    expiryTime,
    acknowledged,
    raw: JSON.parse(JSON.stringify(data)) as Record<string, unknown>,
  };
}

export async function acknowledgeGooglePlaySubscription(
  productId: string,
  purchaseToken: string
): Promise<void> {
  const publisher = await client();
  await publisher.purchases.subscriptions.acknowledge({
    packageName: packageName!,
    subscriptionId: productId,
    token: purchaseToken,
    requestBody: {},
  });
}

export function grantsPlayAccess(status: string, expiryTime: Date, now = new Date()): boolean {
  return ['ACTIVE', 'IN_GRACE_PERIOD'].includes(status) && expiryTime.getTime() > now.getTime();
}
