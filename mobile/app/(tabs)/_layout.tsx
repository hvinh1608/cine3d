import { Tabs } from 'expo-router';
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
          backgroundColor: '#0E0E11',
          borderTopColor: 'rgba(250, 250, 250, 0.06)',
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarActiveTintColor: colors.primary,
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
