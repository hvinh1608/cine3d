import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { Film, Play, X } from 'lucide-react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccessibilityPreferences } from '@/core/accessibility';
import { colors } from '@/theme';

export function TranslationVoteBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { reduceMotion } = useAccessibilityPreferences();
  const [visible, setVisible] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  const isAuthPage = pathname === '/account/auth' || pathname.startsWith('/account/auth/');

  useEffect(() => {
    if (isAuthPage) return;
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [isAuthPage]);

  useEffect(() => {
    if (!visible || isAuthPage || reduceMotion) {
      rotation.stopAnimation();
      rotation.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(rotation, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: -1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isAuthPage, reduceMotion, rotation, visible]);

  if (!visible || isAuthPage) return null;

  const rotate = rotation.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] });
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.overlay, { right: Math.max(insets.right, 10), top: Math.max(insets.top + 64, height * 0.34), transform: [{ rotate }] }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đóng banner yêu cầu phim"
        hitSlop={10}
        onPress={() => setVisible(false)}
        style={styles.close}
      >
        <X size={23} strokeWidth={3} color={colors.warning} />
      </Pressable>

      <LinearGradient colors={['#FBBF24', '#F97316', '#D97706']} style={styles.frame}>
        <View style={styles.ticket}>
          <View style={styles.sprockets} pointerEvents="none">
            {Array.from({ length: 8 }, (_, index) => <View key={index} style={styles.sprocket} />)}
          </View>

          <View style={styles.topStub}>
            <View style={styles.brand}>
              <Film size={11} color="#D97706" />
              <Text style={styles.brandText}>CINE3D</Text>
            </View>
            <Text style={styles.eyebrow}>TÌM KHÔNG THẤY</Text>
            <Text style={styles.vietsub}>VIETSUB</Text>
            <Text style={styles.question}>BẠN CẦN?</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.bottomStub}>
            <View style={styles.admitRow}>
              <Play size={10} fill="#F59E0B" color="#F59E0B" />
              <Text style={styles.admit}>ADMIT ONE</Text>
              <Play size={10} fill="#F59E0B" color="#F59E0B" style={styles.playReverse} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yêu cầu Vietsub cho phim"
              onPress={() => router.push({ pathname: '/account/feedback', params: { category: 'MOVIE_REQUEST' } })}
              style={({ pressed }) => [styles.voteButton, pressed && styles.votePressed]}
            >
              <LinearGradient colors={['#FBBF24', '#F97316']} style={styles.voteGradient}>
                <Text style={styles.voteText}>VOTE PHIM »</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', width: 158, zIndex: 1000, elevation: 16 },
  close: { position: 'absolute', right: -8, top: -34, width: 48, height: 48, zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  frame: { padding: 2, borderRadius: 13, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 10 } },
  ticket: { overflow: 'hidden', borderRadius: 11, backgroundColor: '#09090F' },
  sprockets: { position: 'absolute', zIndex: 2, left: 7, top: 10, bottom: 10, justifyContent: 'space-between' },
  sprocket: { width: 7, height: 7, borderRadius: 2, backgroundColor: '#030307', borderWidth: 1, borderColor: 'rgba(245,158,11,0.28)' },
  topStub: { alignItems: 'center', paddingTop: 17, paddingBottom: 14, paddingLeft: 18, paddingRight: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  brandText: { color: '#D97706', fontSize: 9, lineHeight: 11, fontWeight: '900', letterSpacing: 1.4 },
  eyebrow: { color: '#71717A', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.8 },
  vietsub: { color: '#FBBF24', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  question: { color: '#E4E4E7', fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: 2 },
  divider: { marginHorizontal: 14, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(245,158,11,0.5)' },
  bottomStub: { alignItems: 'center', gap: 11, paddingTop: 12, paddingBottom: 14, paddingLeft: 18, paddingRight: 10 },
  admitRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  admit: { color: '#A1A1AA', fontSize: 9, lineHeight: 11, fontWeight: '900', letterSpacing: 1.1 },
  playReverse: { transform: [{ rotate: '180deg' }] },
  voteButton: { width: '100%', minHeight: 40, overflow: 'hidden', borderRadius: 6 },
  votePressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  voteGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  voteText: { color: '#18181B', fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.6 },
});
