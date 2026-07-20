import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text } from 'react-native-paper';
import { colors, spacing } from '@/theme';

type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

function visiblePages(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 3) return [1, 2, 3, 4, 'ellipsis-end', totalPages];
  if (page >= totalPages - 2) return [1, 'ellipsis-start', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, 'ellipsis-start', page - 1, page, page + 1, 'ellipsis-end', totalPages];
}

export function PaginationControls({ page, totalPages, disabled = false, onPage }: {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onPage(page: number): void;
}) {
  if (totalPages <= 1) return <View style={styles.spacer} />;
  const changePage = (nextPage: number) => {
    if (!disabled && nextPage !== page && nextPage >= 1 && nextPage <= totalPages) onPage(nextPage);
  };

  return (
    <View style={styles.container} accessibilityRole="tablist" accessibilityLabel="Phân trang phim">
      <Pressable accessibilityRole="button" accessibilityLabel="Trang trước" disabled={disabled || page <= 1} onPress={() => changePage(page - 1)} style={({ pressed }) => [styles.arrow, (disabled || page <= 1) && styles.disabled, pressed && styles.pressed]}>
        <ChevronLeft size={18} color={colors.text} />
      </Pressable>
      {visiblePages(page, totalPages).map((item) => typeof item === 'number' ? (
        <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Trang ${item}`} accessibilityState={{ selected: item === page, disabled }} disabled={disabled} onPress={() => changePage(item)} style={({ pressed }) => [styles.page, item === page && styles.active, disabled && styles.disabled, pressed && styles.pressed]}>
          <Text style={[styles.pageText, item === page && styles.activeText]}>{item}</Text>
        </Pressable>
      ) : <Text key={item} style={styles.ellipsis}>…</Text>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Trang sau" disabled={disabled || page >= totalPages} onPress={() => changePage(page + 1)} style={({ pressed }) => [styles.arrow, (disabled || page >= totalPages) && styles.disabled, pressed && styles.pressed]}>
        <ChevronRight size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 68, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  page: { minWidth: 34, height: 34, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  active: { borderColor: colors.primary, backgroundColor: colors.primary },
  pageText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  activeText: { color: '#FFFFFF' },
  arrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.surfaceRaised },
  ellipsis: { width: 18, textAlign: 'center', color: colors.textMuted, fontWeight: '800' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  spacer: { height: spacing.xl },
});
