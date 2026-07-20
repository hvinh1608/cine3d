import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { Film, GripHorizontal, Play, X } from 'lucide-react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccessibilityPreferences } from '@/core/accessibility';
import { colors } from '@/theme';

const CARD_WIDTH = 142;
const CARD_HEIGHT = 205;

export function TranslationVoteBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { reduceMotion } = useAccessibilityPreferences();
  const [visible, setVisible] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.ValueXY()).current;
  const dragPosition = useRef({ x: 0, y: 0 });
  const isAuthPage = pathname === '/account/auth' || pathname.startsWith('/account/auth/');
  const rightInset = Math.max(insets.right, 10);
  const baseLeft = width - rightInset - CARD_WIDTH;
  const baseTop = Math.max(insets.top + 64, height * 0.34);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
    onPanResponderGrant: () => {
      drag.stopAnimation();
    },
    onPanResponderMove: (_, gesture) => {
      const minX = insets.left + 8 - baseLeft;
      const maxX = width - insets.right - CARD_WIDTH - 8 - baseLeft;
      const minY = insets.top + 36 - baseTop;
      const maxY = height - insets.bottom - CARD_HEIGHT - 12 - baseTop;
      const x = Math.min(maxX, Math.max(minX, dragPosition.current.x + gesture.dx));
      const y = Math.min(maxY, Math.max(minY, dragPosition.current.y + gesture.dy));
      drag.setValue({ x, y });
    },
    onPanResponderRelease: (_, gesture) => {
      const minX = insets.left + 8 - baseLeft;
      const maxX = width - insets.right - CARD_WIDTH - 8 - baseLeft;
      const minY = insets.top + 36 - baseTop;
      const maxY = height - insets.bottom - CARD_HEIGHT - 12 - baseTop;
      dragPosition.current = {
        x: Math.min(maxX, Math.max(minX, dragPosition.current.x + gesture.dx)),
        y: Math.min(maxY, Math.max(minY, dragPosition.current.y + gesture.dy)),
      };
      drag.setValue(dragPosition.current);
    },
    onPanResponderTerminate: (_, gesture) => {
      dragPosition.current = {
        x: dragPosition.current.x + gesture.dx,
        y: dragPosition.current.y + gesture.dy,
      };
      drag.setValue(dragPosition.current);
    },
  }), [baseLeft, baseTop, drag, height, insets.bottom, insets.left, insets.right, insets.top, width]);

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
      {...panResponder.panHandlers}
      style={[
        styles.overlay,
        {
          left: baseLeft,
          top: baseTop,
          transform: [{ translateX: drag.x }, { translateY: drag.y }, { rotate }],
        },
      ]}
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
          <GripHorizontal pointerEvents="none" size={15} color="rgba(161,161,170,0.55)" style={styles.dragHandle} />
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
  overlay: { position: 'absolute', width: CARD_WIDTH, zIndex: 1000, elevation: 16 },
  close: { position: 'absolute', right: -8, top: -31, width: 44, height: 44, zIndex: 3, alignItems: 'center', justifyContent: 'center' },
  frame: { padding: 1.5, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 9 } },
  ticket: { overflow: 'hidden', borderRadius: 10, backgroundColor: '#09090F' },
  dragHandle: { position: 'absolute', right: 7, top: 5, zIndex: 2 },
  sprockets: { position: 'absolute', zIndex: 2, left: 6, top: 9, bottom: 9, justifyContent: 'space-between' },
  sprocket: { width: 6, height: 6, borderRadius: 2, backgroundColor: '#030307', borderWidth: 1, borderColor: 'rgba(245,158,11,0.28)' },
  topStub: { alignItems: 'center', paddingTop: 14, paddingBottom: 11, paddingLeft: 16, paddingRight: 9 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  brandText: { color: '#D97706', fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 1.2 },
  eyebrow: { color: '#71717A', fontSize: 8, lineHeight: 11, fontWeight: '800', letterSpacing: 0.7 },
  vietsub: { color: '#FBBF24', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  question: { color: '#E4E4E7', fontSize: 12, lineHeight: 15, fontWeight: '900', letterSpacing: 1.7 },
  divider: { marginHorizontal: 12, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(245,158,11,0.5)' },
  bottomStub: { alignItems: 'center', gap: 9, paddingTop: 10, paddingBottom: 11, paddingLeft: 16, paddingRight: 9 },
  admitRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  admit: { color: '#A1A1AA', fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 1 },
  playReverse: { transform: [{ rotate: '180deg' }] },
  voteButton: { width: '100%', minHeight: 36, overflow: 'hidden', borderRadius: 6 },
  votePressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  voteGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  voteText: { color: '#18181B', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.5 },
});
