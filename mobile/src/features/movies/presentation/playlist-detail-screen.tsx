import { Alert, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Share2, Trash2, Unlock } from 'lucide-react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { AsyncState, MovieCard, Screen } from '@/components/ui';
import { movieRepository } from '@/features/movies/data/http-movie-repository';
import { movieKeys } from '@/features/movies/domain/movie-repository';
import { useAppStore } from '@/state/app-store';
import { colors, spacing } from '@/theme';

export function PlaylistDetailScreen({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.session.user);
  const authenticated = useAppStore((state) => Boolean(state.session.tokens.accessToken));
  const query = useQuery({ queryKey: movieKeys.playlist(id), queryFn: () => movieRepository.getPlaylist(id), enabled: Boolean(id) });
  const mine = useQuery({ queryKey: movieKeys.playlists(), queryFn: () => movieRepository.getPlaylists(), enabled: authenticated });
  const playlist = query.data;
  const owner = Boolean((user && playlist?.userId === user.id) || mine.data?.some((item) => item.id === id));
  const remove = useMutation({
    mutationFn: (movieId: string) => movieRepository.removePlaylistMovie(id, movieId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: movieKeys.playlist(id) });
      void queryClient.invalidateQueries({ queryKey: movieKeys.playlists() });
    },
  });
  return (
    <Screen>
      <AsyncState loading={query.isPending} error={query.error} empty={!playlist} onRetry={() => void query.refetch()}>
        {playlist ? (
          <FlashList
            data={playlist.items}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={styles.header}>
                <View style={styles.titleRow}><View style={styles.copy}><Text variant="headlineMedium" style={styles.title}>{playlist.name}</Text><Text style={styles.muted}>bởi {playlist.user?.username ?? 'Cine3D member'}</Text></View>{playlist.isPublic ? <Unlock color={colors.success} /> : <Lock color={colors.textMuted} />}</View>
                {playlist.description ? <Text style={styles.muted}>{playlist.description}</Text> : null}
                <Text>{playlist.items.length} phim · {playlist.isPublic ? 'Công khai' : 'Riêng tư'}</Text>
                {playlist.isPublic ? <Button icon={() => <Share2 size={18} color={colors.text} />} mode="outlined" onPress={() => void Share.share({ title: playlist.name, message: `${playlist.name}\nhttps://cine3d.id.vn/playlists/${playlist.id}` })}>Chia sẻ playlist</Button> : null}
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.item}>
                <View style={styles.copy}><MovieCard movie={item.movie} layout="list" /></View>
                {owner ? <IconButton icon={() => <Trash2 size={19} color={colors.primarySoft} />} accessibilityLabel={`Xóa ${item.movie.title} khỏi playlist`} onPress={() => Alert.alert('Xóa khỏi playlist?', item.movie.title, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate(item.movieId) }])} /> : null}
              </View>
            )}
            ListEmptyComponent={<View style={styles.empty}><Text variant="titleMedium">Playlist chưa có phim</Text><Text style={styles.muted}>{owner ? 'Thêm phim từ trang chi tiết phim.' : 'Chủ playlist chưa thêm nội dung.'}</Text></View>}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
          />
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.md, paddingBottom: 80 },
  header: { gap: spacing.md, paddingVertical: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1 },
  title: { fontWeight: '800' },
  muted: { color: colors.textMuted },
  item: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  empty: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
