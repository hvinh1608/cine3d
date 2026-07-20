import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Text } from 'react-native-paper';
import { EmptyState, MovieCard, MovieRailSkeleton, Screen, useToast } from '@/components/ui';
import type { Movie } from '@/domain/models';
import { discoveryRepository } from '@/features/discovery/data/http-discovery-repository';
import { discoveryKeys, type PersonKind } from '@/features/discovery/domain/discovery-repository';
import { useAppStore } from '@/state/app-store';
import { useMovieGridLayout } from '@/core/responsive';
import { colors, radius, spacing } from '@/theme';

export function PersonScreen({ kind, slug }: { kind: PersonKind; slug: string | null }) {
  const { gridColumns, cardWidth } = useMovieGridLayout(spacing.md, spacing.sm);
  const queryClient = useQueryClient();
  const toast = useToast();
  const authenticated = useAppStore((state) => Boolean(state.session.tokens.accessToken));
  const person = useQuery({
    queryKey: discoveryKeys.person(kind, slug ?? ''),
    queryFn: () => discoveryRepository.getPerson(kind, slug!),
    enabled: Boolean(slug),
  });
  const follow = useQuery({
    queryKey: discoveryKeys.personFollow(kind, person.data?.id ?? ''),
    queryFn: () => discoveryRepository.getPersonFollow(kind, person.data!.id),
    enabled: authenticated && Boolean(person.data?.id),
  });
  const toggle = useMutation({
    mutationFn: () => discoveryRepository.togglePersonFollow(kind, person.data!.id),
    onSuccess: (following) => {
      queryClient.setQueryData(discoveryKeys.personFollow(kind, person.data!.id), following);
      toast.show(following ? 'Đã theo dõi nghệ sĩ' : 'Đã bỏ theo dõi nghệ sĩ');
    },
    onError: (error) => toast.show(error.message),
  });
  const followAction = () => {
    if (!authenticated) {
      toast.show('Đăng nhập để theo dõi nghệ sĩ');
      router.push('/(tabs)/account');
      return;
    }
    toggle.mutate();
  };

  return (
    <Screen>
      <FlashList
        data={person.data?.movies ?? []}
        key={`grid-${gridColumns}`}
        numColumns={gridColumns}
        keyExtractor={(movie) => movie.id || movie.slug}
        renderItem={({ item }: { item: Movie }) => <View style={styles.item}><MovieCard movie={item} width={cardWidth} /></View>}
        ListHeaderComponent={
          person.data ? (
            <View style={styles.header}>
              <Image
                source={person.data.avatarUrl || undefined}
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                accessibilityLabel={`Ảnh ${person.data.name}`}
              />
              <Text style={styles.eyebrow}>{kind === 'actor' ? 'Diễn viên' : 'Đạo diễn'}</Text>
              <Text variant="headlineMedium" style={styles.title}>{person.data.name}</Text>
              {person.data.biography ? <Text style={styles.biography}>{person.data.biography}</Text> : null}
              <Button
                mode={follow.data ? 'outlined' : 'contained'}
                loading={toggle.isPending || follow.isPending}
                disabled={toggle.isPending}
                onPress={followAction}
              >
                {follow.data ? 'Đang theo dõi' : 'Theo dõi'}
              </Button>
              <Text variant="titleLarge" style={styles.filmography}>Phim đã tham gia</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={person.isPending
          ? <MovieRailSkeleton />
          : person.error
            ? <EmptyState title="Không thể tải nghệ sĩ" message={person.error.message} />
            : <EmptyState title="Chưa có phim" message="Filmography hiện chưa có nội dung." />}
        contentContainerStyle={styles.content}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  header: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  avatar: { width: 132, height: 132, borderRadius: 66, backgroundColor: colors.surfaceRaised },
  eyebrow: { color: colors.primarySoft, textTransform: 'uppercase' },
  title: { fontWeight: '900', textAlign: 'center' },
  biography: { color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  filmography: { alignSelf: 'flex-start', marginTop: spacing.lg, fontWeight: '700' },
  item: { flex: 1, alignItems: 'center', paddingBottom: spacing.md },
});
