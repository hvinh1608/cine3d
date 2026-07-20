import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
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
        <View style={styles.icon}><Icon color={colors.primary} size={34} /></View>
        <Text variant="labelLarge" style={styles.eyebrow}>{eyebrow}</Text>
        <Text variant="headlineMedium" style={styles.title}>{title}</Text>
        <Text variant="bodyLarge" style={styles.description}>{description}</Text>
        <Button mode="contained-tonal">{action}</Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  icon: { padding: spacing.md, borderRadius: 999, backgroundColor: colors.surfaceRaised },
  eyebrow: { color: colors.primary, textTransform: 'uppercase', letterSpacing: 1.4 },
  title: { fontWeight: '800', textAlign: 'center' },
  description: { color: colors.textMuted, textAlign: 'center', lineHeight: 25 },
});
