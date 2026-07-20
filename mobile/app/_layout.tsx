import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/core/providers';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="movie/[slug]" options={{ title: 'Chi tiết phim' }} />
        <Stack.Screen name="movies/[slug]" options={{ title: 'Chi tiết phim' }} />
        <Stack.Screen name="search" options={{ title: 'Tìm kiếm', headerShown: false }} />
        <Stack.Screen name="the-loai/[slug]" options={{ title: 'Thể loại' }} />
        <Stack.Screen name="quoc-gia/[slug]" options={{ title: 'Quốc gia' }} />
        <Stack.Screen name="nam/[year]" options={{ title: 'Năm phát hành' }} />
        <Stack.Screen name="schedule" options={{ title: 'Lịch phát hành', headerShown: false }} />
        <Stack.Screen name="actors/[slug]" options={{ title: 'Diễn viên', headerShown: false }} />
        <Stack.Screen name="directors/[slug]" options={{ title: 'Đạo diễn', headerShown: false }} />
        <Stack.Screen name="playlists/[id]" options={{ title: 'Playlist' }} />
        <Stack.Screen name="watch/[slug]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="watch-together/rooms" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="downloads" options={{ title: 'Tải xuống' }} />
        <Stack.Screen name="downloads/[id]" options={{ title: 'Phát ngoại tuyến', headerShown: false }} />
        <Stack.Screen name="account/auth" options={{ title: 'CINE3D ID' }} />
        <Stack.Screen name="account/profile" options={{ title: 'Hồ sơ tài khoản' }} />
        <Stack.Screen name="account/profiles" options={{ title: 'Hồ sơ người xem' }} />
        <Stack.Screen name="account/sessions" options={{ title: 'Thiết bị đăng nhập' }} />
        <Stack.Screen name="account/notifications" options={{ title: 'Thông báo' }} />
        <Stack.Screen name="account/feedback" options={{ title: 'Góp ý và hỗ trợ' }} />
        <Stack.Screen name="account/settings" options={{ title: 'Cài đặt' }} />
        <Stack.Screen name="account/vip" options={{ title: 'CINE3D VIP' }} />
        <Stack.Screen name="account/legal" options={{ title: 'Pháp lý' }} />
        <Stack.Screen name="account/legal/[document]" options={{ title: 'Thông tin pháp lý' }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
    </AppProviders>
  );
}
