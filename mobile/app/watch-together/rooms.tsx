import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Text } from 'react-native-paper';
import { Screen } from '@/components/ui';
import { WatchRoomScreen } from '@/features/watch-together/presentation/watch-room-screen';
import { useAppStore } from '@/state/app-store';
import { spacing } from '@/theme';

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function WatchTogetherRoomRoute() {
  const hydrated = useAppStore((state) => state.session.hydrated);
  const authenticated = useAppStore((state) => Boolean(state.session.tokens.accessToken));
  const params = useLocalSearchParams<{
    roomId?: string | string[];
    password?: string | string[];
    roomAccessToken?: string | string[];
    roomName?: string | string[];
  }>();
  if (!hydrated) return null;
  if (!authenticated) {
    return (
      <Screen>
        <View testID="watch-room-auth-gate" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl }}>
          <Text variant="headlineSmall">Cần đăng nhập</Text>
          <Text>Đăng nhập trước khi tham gia phòng chiếu.</Text>
          <Button testID="watch-room-sign-in" mode="contained" onPress={() => router.replace('/account/auth')}>Đăng nhập</Button>
        </View>
      </Screen>
    );
  }
  return (
    <WatchRoomScreen
      roomId={first(params.roomId) ?? ''}
      password={first(params.password)}
      roomAccessToken={first(params.roomAccessToken)}
      roomName={first(params.roomName)}
    />
  );
}
