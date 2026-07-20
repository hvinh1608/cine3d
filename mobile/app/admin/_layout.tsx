import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AdminLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false }}>
    <Stack.Screen name="index" options={{ title: 'Quản trị CINE3D', headerBackTitle: 'Tài khoản' }} />
  </Stack>;
}
