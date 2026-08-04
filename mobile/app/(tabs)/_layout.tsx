import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { CircleUserRound, Compass, House, Library, UsersRound } from 'lucide-react-native';
import { colors } from '@/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'rgba(17,21,26,0.98)',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
          elevation: 18,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarActiveTintColor: colors.primarySoft,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trang chủ', headerShown: false, tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="explore" options={{ title: 'Khám phá', headerShown: false, tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }} />
      <Tabs.Screen name="watch-together" options={{ title: 'Xem chung', tabBarIcon: ({ color, size }) => <UsersRound color={color} size={size} /> }} />
      <Tabs.Screen name="library" options={{ title: 'Thư viện', tabBarIcon: ({ color, size }) => <Library color={color} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Tài khoản', tabBarIcon: ({ color, size }) => <CircleUserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
