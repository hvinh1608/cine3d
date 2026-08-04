import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Text } from 'react-native-paper';
import { Screen } from '@/components/ui';
import { colors, spacing } from '@/theme';

export function FeatureShell({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <Screen>
      <View style={styles.container}>
        <LinearGradient colors={['rgba(67,17,29,0.96)', 'rgba(12,62,64,0.94)']} style={styles.panel}>
          <View style={styles.icon}><Icon color={colors.accentSoft} size={36} /></View>
          <Text variant="labelLarge" style={styles.eyebrow}>{eyebrow}</Text>
          <Text variant="headlineMedium" style={styles.title}>{title}</Text>
          <Text variant="bodyLarge" style={styles.description}>{description}</Text>
          <Button mode="contained">{action}</Button>
        </LinearGradient>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  panel: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  icon: { padding: spacing.md, borderRadius: 999, backgroundColor: 'rgba(7,9,13,0.48)' },
  eyebrow: { color: colors.accentSoft, textTransform: 'uppercase', letterSpacing: 1.4 },
  title: { fontWeight: '800', textAlign: 'center' },
  description: { color: colors.textMuted, textAlign: 'center', lineHeight: 25 },
});
