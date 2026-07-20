import { useEffect, useState } from 'react';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Button, Text } from 'react-native-paper';
import { config } from '@/core/config';
import { accountApi, type AuthSession as CineSession } from '@/features/account/data/account-api';

export function OAuthButtons({ onSession, onError }: { onSession(value: CineSession): void; onError(message: string): void }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!config.googleClientId) return;
    GoogleSignin.configure({
      webClientId: config.googleClientId,
      scopes: ['email', 'profile'],
      offlineAccess: false,
    });
  }, []);

  const signInWithGoogle = async () => {
    if (!config.googleClientId || busy) return;
    setBusy(true);
    onError('');
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (result.type === 'cancelled') return;
      if (!result.data.idToken) throw new Error('Google không trả về mã xác thực.');
      await onSession(await accountApi.google(result.data.idToken, result.data.user.photo));
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) return;
        if (error.code === statusCodes.IN_PROGRESS) {
          onError('Cửa sổ đăng nhập Google đang mở.');
          return;
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          onError('Google Play Services chưa có hoặc cần được cập nhật.');
          return;
        }
        if (error.code === '10' || /developer_error/i.test(error.message)) {
          onError('Google chưa nhận diện ứng dụng. Cần cấu hình đúng package vn.cine3d.app và SHA-1 trên Google Cloud.');
          return;
        }
      }
      onError(error instanceof Error ? error.message : 'Đăng nhập Google thất bại. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        icon="google"
        mode="outlined"
        disabled={busy || !config.googleClientId}
        loading={busy}
        onPress={() => void signInWithGoogle()}
      >
        Tiếp tục với Google
      </Button>
      {!config.googleClientId ? (
        <Text variant="bodySmall">
          Đăng nhập Google chưa được cấu hình cho bản Android này.
        </Text>
      ) : null}
    </>
  );
}
