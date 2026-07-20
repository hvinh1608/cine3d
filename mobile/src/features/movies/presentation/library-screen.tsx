import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Lock, Play, Plus, Trash2, Unlock } from 'lucide-react-native';
import { Button, Checkbox, IconButton, ProgressBar, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { AsyncState, MovieCard, Screen, useToast } from '@/components/ui';
import type { Movie, Playlist, WatchHistory } from '@/domain/models';
import { movieRepository } from '@/features/movies/data/http-movie-repository';
import { movieKeys } from '@/features/movies/domain/movie-repository';
import { validatePlaylistName } from '@/features/movies/domain/movie-utils';
import { useAppStore } from '@/state/app-store';
import { colors, radius, spacing } from '@/theme';

type LibraryTab = 'favorites' | 'watchlist' | 'history' | 'playlists';

export function LibraryScreen() {
  const authenticated = useAppStore((state) => Boolean(state.session.tokens.accessToken));
  const hydrated = useAppStore((state) => state.session.hydrated);
  const [tab, setTab] = useState<LibraryTab>('favorites');
  if (!hydrated) return <Screen><AsyncState loading onRetry={() => undefined} /></Screen>;
  if (!authenticated) {
    return (
      <Screen>
        <View style={styles.authGate} testID="library-auth-gate">
          <Lock size={42} color={colors.primary} />
          <Text variant="headlineSmall">Thư viện riêng của bạn</Text>
          <Text style={styles.muted}>Đăng nhập để đồng bộ yêu thích, danh sách xem, lịch sử và playlist.</Text>
          <Button testID="library-sign-in" mode="contained" onPress={() => router.push('/account/auth')}>Đăng nhập</Button>
        </View>
      </Screen>
    );
  }
  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.listHeader}>
          <Text variant="headlineMedium" style={styles.title}>Thư viện</Text>
          <Button icon="download" onPress={() => router.push('/downloads')}>Tải xuống</Button>
        </View>
        <SegmentedButtons
          value={tab}
          onValueChange={(value) => setTab(value as LibraryTab)}
          buttons={[
            { value: 'favorites', label: 'Yêu thích' },
            { value: 'watchlist', label: 'Xem sau' },
            { value: 'history', label: 'Lịch sử' },
            { value: 'playlists', label: 'Playlist' },
          ]}
          density="small"
        />
      </View>
      {tab === 'favorites' ? <MovieCollection queryKey={movieKeys.favorites()} queryFn={() => movieRepository.getFavorites()} /> : null}
      {tab === 'watchlist' ? <MovieCollection queryKey={movieKeys.watchlist()} queryFn={() => movieRepository.getWatchlist()} /> : null}
      {tab === 'history' ? <HistoryList /> : null}
      {tab === 'playlists' ? <PlaylistList /> : null}
    </Screen>
  );
}

function MovieCollection({ queryKey, queryFn }: { queryKey: readonly unknown[]; queryFn(): Promise<Movie[]> }) {
  const query = useQuery({ queryKey, queryFn });
  return (
    <AsyncState loading={query.isPending} error={query.error} empty={!query.data?.length} onRetry={() => void query.refetch()}>
      <FlashList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MovieCard movie={item} layout="list" />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
      />
    </AsyncState>
  );
}

function HistoryList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: movieKeys.history(), queryFn: () => movieRepository.getHistory() });
  const remove = useMutation({
    mutationFn: (id: string) => movieRepository.deleteHistory(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: movieKeys.history() });
      const previous = queryClient.getQueryData<WatchHistory[]>(movieKeys.history());
      queryClient.setQueryData<WatchHistory[]>(movieKeys.history(), (old = []) => old.filter((item) => item.id !== id));
      return { previous };
    },
    onError: (error, _id, context) => {
      queryClient.setQueryData(movieKeys.history(), context?.previous);
      toast.show(error instanceof Error ? error.message : 'Không thể xóa lịch sử.');
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: movieKeys.history() }),
  });
  const clear = useMutation({
    mutationFn: () => movieRepository.deleteHistoryBulk(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: movieKeys.history() });
      const previous = queryClient.getQueryData<WatchHistory[]>(movieKeys.history());
      queryClient.setQueryData(movieKeys.history(), []);
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(movieKeys.history(), context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: movieKeys.history() }),
  });
  return (
    <AsyncState loading={query.isPending} error={query.error} empty={!query.data?.length} onRetry={() => void query.refetch()}>
      <FlashList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<View style={styles.listHeader}><Text style={styles.muted}>{query.data?.length ?? 0} mục</Text><Button textColor={colors.primarySoft} onPress={() => Alert.alert('Xóa toàn bộ lịch sử?', 'Dữ liệu này không thể khôi phục.', [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa tất cả', style: 'destructive', onPress: () => clear.mutate() }])}>Xóa tất cả</Button></View>}
        renderItem={({ item }) => <HistoryCard item={item} onDelete={() => Alert.alert('Xóa khỏi lịch sử?', item.movie?.title, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate(item.id) }])} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
      />
    </AsyncState>
  );
}

function HistoryCard({ item, onDelete }: { item: WatchHistory; onDelete(): void }) {
  const watched = item.watchedTime ?? item.progressSeconds ?? 0;
  const duration = item.duration ?? item.durationSeconds ?? 0;
  const progress = duration > 0 ? Math.min(1, watched / duration) : 0;
  const episode = item.movie?.episodes?.find((entry) => entry.id === item.episodeId);
  if (!item.movie) return null;
  return (
    <Pressable style={styles.historyCard} onPress={() => router.push({ pathname: '/movie/[slug]', params: { slug: item.movie!.slug } })} accessibilityLabel={`Tiếp tục ${item.movie.title}`}>
      <Image source={item.movie.backdropUrl || item.movie.posterUrl} style={styles.historyImage} contentFit="cover" />
      <View style={styles.historyBody}>
        <Text variant="titleMedium" numberOfLines={2}>{item.movie.title}</Text>
        <Text style={styles.muted}>{episode?.title ?? 'Tiếp tục xem'} · {Math.round(progress * 100)}%</Text>
        <ProgressBar progress={progress} color={colors.primary} />
        <Text style={styles.muted}>{formatDuration(watched)} / {formatDuration(duration)}</Text>
      </View>
      <IconButton icon={() => <Play size={20} color={colors.text} />} accessibilityLabel="Tiếp tục xem" onPress={() => router.push({ pathname: '/movie/[slug]', params: { slug: item.movie!.slug } })} />
      <IconButton icon={() => <Trash2 size={19} color={colors.primarySoft} />} accessibilityLabel="Xóa lịch sử" onPress={onDelete} />
    </Pressable>
  );
}

function PlaylistList() {
  const query = useQuery({ queryKey: movieKeys.playlists(), queryFn: () => movieRepository.getPlaylists() });
  const [editing, setEditing] = useState<Playlist | 'new' | null>(null);
  return (
    <View style={styles.flex}>
      <View style={styles.listHeader}><Text style={styles.muted}>{query.data?.length ?? 0} playlist</Text><Button icon={() => <Plus size={18} color={colors.text} />} mode="contained" onPress={() => setEditing('new')}>Tạo mới</Button></View>
      <AsyncState loading={query.isPending} error={query.error} empty={!query.data?.length} onRetry={() => void query.refetch()}>
        <FlashList
          data={query.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PlaylistCard playlist={item} onEdit={() => setEditing(item)} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
        />
      </AsyncState>
      <PlaylistEditor playlist={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function PlaylistCard({ playlist, onEdit }: { playlist: Playlist; onEdit(): void }) {
  const cover = playlist.items[0]?.movie.posterUrl;
  return (
    <Pressable style={styles.playlistCard} onPress={() => router.push({ pathname: '/playlists/[id]', params: { id: playlist.id } })} accessibilityLabel={`Mở playlist ${playlist.name}`}>
      <Image source={cover} style={styles.playlistCover} contentFit="cover" />
      <View style={styles.historyBody}><Text variant="titleMedium">{playlist.name}</Text><Text style={styles.muted}>{playlist._count?.items ?? playlist.items.length} phim · {playlist.isPublic ? 'Công khai' : 'Riêng tư'}</Text><Text style={styles.muted} numberOfLines={2}>{playlist.description}</Text></View>
      {playlist.isPublic ? <Unlock size={18} color={colors.success} /> : <Lock size={18} color={colors.textMuted} />}
      <IconButton icon={() => <Edit3 size={18} color={colors.text} />} accessibilityLabel="Sửa playlist" onPress={onEdit} />
    </Pressable>
  );
}

function PlaylistEditor({ playlist, onClose }: { playlist: Playlist | 'new' | null; onClose(): void }) {
  const queryClient = useQueryClient();
  const editing = playlist && playlist !== 'new' ? playlist : null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setPublic] = useState(false);
  useEffect(() => {
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setPublic(editing?.isPublic ?? false);
  }, [editing]);
  const close = () => { setName(''); setDescription(''); setPublic(false); onClose(); };
  const save = useMutation({
    mutationFn: () => editing
      ? movieRepository.updatePlaylist(editing.id, { name, description, isPublic })
      : movieRepository.createPlaylist({ name, description, isPublic }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: movieKeys.playlists() }); close(); },
  });
  const remove = useMutation({
    mutationFn: () => movieRepository.deletePlaylist(editing!.id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: movieKeys.playlists() }); close(); },
  });
  return (
    <Modal visible={Boolean(playlist)} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.modalShade} onPress={close} />
      <View style={styles.sheet}>
        <Text variant="headlineSmall">{editing ? 'Sửa playlist' : 'Playlist mới'}</Text>
        <TextInput value={name} onChangeText={setName} mode="outlined" label="Tên" maxLength={60} />
        <TextInput value={description} onChangeText={setDescription} mode="outlined" label="Mô tả" multiline maxLength={500} />
        <Pressable style={styles.publicToggle} onPress={() => setPublic((value) => !value)}><Checkbox status={isPublic ? 'checked' : 'unchecked'} /><Text>Cho phép mọi người xem qua liên kết</Text></Pressable>
        {save.error ? <Text style={styles.error}>{save.error.message}</Text> : null}
        <Button mode="contained" disabled={Boolean(validatePlaylistName(name)) || save.isPending} onPress={() => save.mutate()}>Lưu</Button>
        {editing ? <Button textColor={colors.primarySoft} onPress={() => Alert.alert('Xóa playlist?', 'Các phim sẽ không bị xóa khỏi thư viện.', [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate() }])}>Xóa playlist</Button> : null}
        <Button onPress={close}>Hủy</Button>
      </View>
    </Modal>
  );
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: spacing.md, padding: spacing.md },
  title: { fontWeight: '800' },
  muted: { color: colors.textMuted },
  error: { color: colors.primarySoft },
  authGate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  list: { paddingHorizontal: spacing.md, paddingBottom: 80 },
  listHeader: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyCard: { minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md },
  historyImage: { width: 112, height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  historyBody: { flex: 1, gap: spacing.xs },
  playlistCard: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md },
  playlistCover: { width: 72, height: 104, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,.65)' },
  sheet: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  publicToggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
});
