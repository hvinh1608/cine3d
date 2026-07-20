import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type ProductOrSubscription,
  type Purchase,
} from 'expo-iap';
import { config } from '@/core/config';
import { accountApi } from './account-api';

type BillingListener = (state: { processing: boolean; message?: string; verified?: boolean }) => void;

export class GooglePlayBilling {
  products: ProductOrSubscription[] = [];
  private listeners = new Set<BillingListener>();
  private purchaseSubscription?: { remove(): void };
  private errorSubscription?: { remove(): void };

  get configured() {
    return Platform.OS === 'android' && config.googlePlayProducts.length > 0;
  }

  subscribe(listener: BillingListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit(value: Parameters<BillingListener>[0]) { this.listeners.forEach((listener) => listener(value)); }

  async connect() {
    if (!this.configured) return [];
    await initConnection();
    this.purchaseSubscription = purchaseUpdatedListener((purchase) => void this.verify(purchase));
    this.errorSubscription = purchaseErrorListener((error) => this.emit({ processing: false, message: error.message }));
    this.products = await fetchProducts({ skus: config.googlePlayProducts, type: 'subs' }) || [];
    return this.products;
  }

  async purchase(productId: string) {
    if (!this.configured) throw new Error('Google Play Billing chưa được cấu hình cho bản dựng này.');
    this.emit({ processing: true, message: 'Đang chờ Google Play…' });
    await requestPurchase({
      type: 'subs',
      request: { google: { skus: [productId] }, apple: { sku: productId } },
    });
  }

  private async verify(purchase: Purchase) {
    try {
      const token = purchase.purchaseToken;
      if (!token) throw new Error('Google Play không trả về purchase token.');
      await accountApi.verifyGooglePurchase(purchase.productId, token);
      // Server verification is the only point at which access is considered granted.
      await finishTransaction({ purchase, isConsumable: false });
      this.emit({ processing: false, verified: true, message: 'Google Play đã xác minh giao dịch.' });
    } catch (error) {
      this.emit({ processing: false, verified: false, message: error instanceof Error ? error.message : 'Không thể xác minh giao dịch.' });
    }
  }

  async disconnect() {
    this.purchaseSubscription?.remove();
    this.errorSubscription?.remove();
    await endConnection().catch(() => undefined);
  }
}

export const googlePlayBilling = new GooglePlayBilling();
