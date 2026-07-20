import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiClient } from '@/data/http/api-client';
import { config } from '@/core/config';

export interface PushRegistration {
  configured: boolean;
  granted: boolean;
  token?: string;
  reason?: string;
}

export async function registerPushNotifications(): Promise<PushRegistration> {
  if (!config.firebaseProjectId) {
    return { configured: false, granted: false, reason: 'Thiếu EXPO_PUBLIC_FIREBASE_PROJECT_ID và cấu hình google-services.' };
  }
  if (!Device.isDevice) return { configured: true, granted: false, reason: 'Thông báo đẩy cần thiết bị thật.' };
  if (Platform.OS === 'android') {
    await Promise.all([
      Notifications.setNotificationChannelAsync('general', {
        name: 'CINE3D',
        description: 'Thông báo tài khoản và dịch vụ',
        importance: Notifications.AndroidImportance.DEFAULT,
      }),
      Notifications.setNotificationChannelAsync('new-releases', {
        name: 'Phim và tập mới',
        description: 'Cập nhật phim, tập mới và nội dung đang theo dõi',
        importance: Notifications.AndroidImportance.DEFAULT,
      }),
    ]);
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { configured: true, granted: false, reason: 'Bạn chưa cấp quyền thông báo.' };
  const token = (await Notifications.getDevicePushTokenAsync()).data;
  await apiClient.post('/push/fcm', {
    fcmToken: token,
    platform: Platform.OS,
    deviceId: Constants.installationId ?? undefined,
    deviceModel: Device.modelName,
    appVersion: Constants.expoConfig?.version,
  });
  return { configured: true, granted: true, token };
}

export async function updatePushPreference(token: string, enabled: boolean) {
  await apiClient.put('/push/fcm/preferences', { fcmToken: token, notificationsEnabled: enabled });
}
