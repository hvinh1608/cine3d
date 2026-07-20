import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Bookmark,
  Flag,
  Heart,
  ListPlus,
  MessageCircle,
  Pin,
  Play,
  Share2,
  Star,
  ThumbsUp,
  Trash2,
} from 'lucide-react-native';
import { Button, Checkbox, Chip, Divider, IconButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { AsyncState, MovieRail, Screen, useToast } from '@/components/ui';
import type { Comment, Episode, Movie, Playlist, WatchHistory } from '@/domain/models';
import { movieRepository } from '@/features/movies/data/http-movie-repository';
import { movieKeys, type CommentSort } from '@/features/movies/domain/movie-repository';
import {
  groupEpisodes,
  removeCommentFromTree,
  searchEpisodes,
  toggleMovieInCollection,
  updateCommentTree,
  validateComment,
  validatePlaylistName,
} from '@/features/movies/domain/movie-utils';
import { useAppStore } from '@/state/app-store';
import { colors, radius, spacing } from '@/theme';

export function MovieDetailScreen({ slug }: { slug: string }) {
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const toast = useToast();
  const authenticated = useAppStore((state) => Boolean(state.session.tokens.accessToken));
  const detail = useQuery({ queryKey: movieKeys.detail(slug), queryFn: () => movieRepository.getMovie(slug), enabled: Boolean(slug) });
  const movie = detail.data;
  const favorites = useQuery({ queryKey: movieKeys.favorites(), queryFn: () => movieRepository.getFavorites(), enabled: authenticated });
  const watchlist = useQuery({ queryKey: movieKeys.watchlist(), queryFn: () => movieRepository.getWatchlist(), enabled: authenticated });
  const history = useQuery({ queryKey: movieKeys.history(), queryFn: () => movieRepository.getHistory(), enabled: authenticated });
  const follow = useQuery({ queryKey: movieKeys.follow(movie?.id ?? ''), queryFn: () => movieRepository.getFollowStatus(movie!.id), enabled: authenticated && Boolean(movie?.id) });
  const rating = useQuery({ queryKey: movieKeys.rating(movie?.id ?? ''), queryFn: () => movieRepository.getRating(movie!.id), enabled: authenticated && Boolean(movie?.id) });
  const playlists = useQuery({ queryKey: movieKeys.playlists(), queryFn: () => movieRepository.getPlaylists(), enabled: authenticated });
  const related = useQuery({ queryKey: [...movieKeys.detail(slug), 'related'], queryFn: () => movieRepository.getRelated(movie!), enabled: Boolean(movie) });
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  useEffect(() => {
    if (!movie) return;
    setSelectedEpisode((current) => current ?? movie.episodes?.[0] ?? null);
    void movieRepository.incrementView(movie.id).catch(() => undefined);
  }, [movie]);

  const requireAuth = () => {
    if (authenticated) return true;
    Alert.alert('Cần đăng nhập', 'Đăng nhập để đồng bộ thao tác này trên mọi thiết bị.', [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Đăng nhập', onPress: () => router.push('/(tabs)/account') },
    ]);
    return false;
  };
  const favoriteMutation = useCollectionToggle(movieKeys.favorites(), movie, () => movieRepository.toggleFavorite(movie!.id), toast.show);
  const watchlistMutation = useCollectionToggle(movieKeys.watchlist(), movie, () => movieRepository.toggleWatchlist(movie!.id), toast.show);
  const followMutation = useMutation({
    mutationFn: () => movieRepository.toggleFollow(movie!.id),
    onMutate: async () => {
      const key = movieKeys.follow(movie!.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData(key, !previous);
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(movieKeys.follow(movie!.id), context?.previous),
    onSuccess: (data) => queryClient.setQueryData(movieKeys.follow(movie!.id), data.following),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: movieKeys.follow(movie!.id) }),
  });
  const ratingMutation = useMutation({
    mutationFn: (score: number) => movieRepository.rateMovie(movie!.id, score),
    onMutate: async (score) => {
      const key = movieKeys.rating(movie!.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<number | null>(key);
      queryClient.setQueryData(key, score);
      return { previous };
    },
    onError: (_error, _score, context) => queryClient.setQueryData(movieKeys.rating(movie!.id), context?.previous),
    onSuccess: (average) => queryClient.setQueryData<Movie>(movieKeys.detail(slug), (old) => old ? { ...old, ratingAvg: average } : old),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: movieKeys.rating(movie!.id) }),
  });
  const currentHistory = history.data?.find((item) => item.movieId === movie?.id);
  const isFavorite = Boolean(movie && favorites.data?.some((item) => item.id === movie.id));
  const inWatchlist = Boolean(movie && watchlist.data?.some((item) => item.id === movie.id));

  const play = () => {
    if (!movie || !selectedEpisode) return;
    if (movie.requiresVip) {
      Alert.alert('Nội dung VIP', 'Nâng cấp VIP để xem phim hoặc tập đang trong giai đoạn truy cập sớm.');
      return;
    }
    if (!selectedEpisode.videoSources.length) {
      Alert.alert('Chưa thể phát', 'Tập này hiện chưa có nguồn phát khả dụng.');
      return;
    }
    router.push({
      pathname: '/watch/[slug]',
      params: { slug: movie.slug, ep: String(selectedEpisode.episodeOrder) },
    });
  };

  return (
    <Screen testID="movie-detail-screen" edges={['left', 'right']}>
      <AsyncState loading={detail.isPending} error={detail.error} empty={!movie} onRetry={() => void detail.refetch()}>
        {movie ? (
          <ScrollView
            refreshControl={<RefreshControl refreshing={detail.isRefetching} onRefresh={() => void detail.refetch()} tintColor={colors.primary} />}
            contentContainerStyle={styles.page}
          >
            <View style={[styles.hero, { height: width >= 768 ? 430 : 260 }]}>
              <Image source={movie.backdropUrl || movie.posterUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              <View style={styles.heroShade} />
              <Image source={movie.posterUrl} style={styles.poster} contentFit="cover" />
            </View>
            <View style={[styles.content, width >= 768 && styles.tabletContent]}>
              <View style={styles.titleRow}>
                <View style={styles.titleCopy}>
                  <Text variant="headlineMedium" style={styles.title}>{movie.title}</Text>
                  {movie.englishTitle ? <Text style={styles.muted}>{movie.englishTitle}</Text> : null}
                </View>
                {(movie.isVip || movie.isEarlyAccess) ? <Chip icon="crown" compact>{movie.isEarlyAccess ? 'TRUY CẬP SỚM' : 'VIP'}</Chip> : null}
              </View>
              <View style={styles.meta}>
                <Text>{movie.releaseYear}</Text><Text>•</Text>
                <Text>{movie.duration ? `${movie.duration} phút` : `${movie.episodeCount} tập`}</Text><Text>•</Text>
                <Text>{movie.quality}</Text><Text>•</Text><Text>{movie.status}</Text><Text>•</Text>
                <Star size={16} color={colors.warning} fill={colors.warning} /><Text>{movie.ratingAvg.toFixed(1)}</Text>
              </View>
              {movie.country ? <Link href={{ pathname: '/quoc-gia/[slug]', params: { slug: movie.country.slug } }} asChild><Chip style={styles.linkChip}>{movie.country.name}</Chip></Link> : null}
              <View style={styles.chips}>
                {movie.movieGenres?.map(({ genre }) => (
                  <Link key={genre.slug} href={{ pathname: '/the-loai/[slug]', params: { slug: genre.slug } }} asChild>
                    <Chip compact style={styles.linkChip}>{genre.name}</Chip>
                  </Link>
                ))}
              </View>
              <Text style={styles.description}>{movie.description}</Text>
              <Button mode="contained" icon="play" onPress={play} disabled={!selectedEpisode}>
                {currentHistory?.watchedTime ? `Tiếp tục · ${selectedEpisode?.title}` : `Phát · ${selectedEpisode?.title ?? 'Chưa có tập'}`}
              </Button>
              {movie.requiresVip ? <Text style={styles.vipGate}>Nguồn phát đang khóa cho tài khoản VIP.</Text> : null}
              <View style={styles.actions}>
                <Action icon={<Heart color={isFavorite ? colors.primary : colors.text} fill={isFavorite ? colors.primary : 'transparent'} />} label="Yêu thích" onPress={() => requireAuth() && favoriteMutation.mutate()} />
                <Action icon={<Bookmark color={inWatchlist ? colors.primary : colors.text} fill={inWatchlist ? colors.primary : 'transparent'} />} label="Xem sau" onPress={() => requireAuth() && watchlistMutation.mutate()} />
                <Action icon={<Bell color={follow.data ? colors.primary : colors.text} />} label="Tập mới" onPress={() => requireAuth() && followMutation.mutate()} />
                <Action icon={<ListPlus color={colors.text} />} label="Playlist" onPress={() => requireAuth() && setPlaylistOpen(true)} />
                <Action icon={<Share2 color={colors.text} />} label="Chia sẻ" onPress={() => void Share.share({ title: movie.title, message: `${movie.title}\nhttps://cine3d.app/movie/${movie.slug}` })} />
                {movie.trailerUrl ? <Action icon={<Play color={colors.text} />} label="Trailer" onPress={() => void Linking.openURL(movie.trailerUrl!)} /> : null}
              </View>
              <PeopleLinks movie={movie} />
              <EpisodeSelector episodes={movie.episodes ?? []} selected={selectedEpisode} onSelect={setSelectedEpisode} />
              <RatingPanel score={rating.data ?? null} disabled={!authenticated || ratingMutation.isPending} onRate={(score) => requireAuth() && ratingMutation.mutate(score)} />
              <MovieRail title="Có thể bạn sẽ thích" movies={related.data ?? []} />
              <Comments movieId={movie.id} authenticated={authenticated} />
            </View>
          </ScrollView>
        ) : null}
      </AsyncState>
      <PlaylistPicker visible={playlistOpen} movie={movie} playlists={playlists.data ?? []} onClose={() => setPlaylistOpen(false)} />
    </Screen>
  );
}

function useCollectionToggle(
  key: readonly unknown[],
  movie: Movie | undefined,
  mutationFn: () => Promise<unknown>,
  showToast: (message: string) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Movie[]>(key);
      if (movie) queryClient.setQueryData<Movie[]>(key, (old = []) => toggleMovieInCollection(old, movie));
      return { previous };
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous);
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật.');
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

function Action({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}><View style={styles.actionIcon}>{icon}</View><Text variant="labelSmall">{label}</Text></Pressable>;
}

function PeopleLinks({ movie }: { movie: Movie }) {
  return (
    <View style={styles.section}>
      {movie.movieDirectors?.length ? <Text variant="titleMedium">Đạo diễn</Text> : null}
      <View style={styles.chips}>{movie.movieDirectors?.map(({ director }) => <Link key={director.slug} href={{ pathname: '/directors/[slug]', params: { slug: director.slug } }} asChild><Chip>{director.name}</Chip></Link>)}</View>
      {movie.movieActors?.length ? <Text variant="titleMedium">Diễn viên</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
        {movie.movieActors?.map(({ actor }) => (
          <Link key={actor.slug} href={{ pathname: '/actors/[slug]', params: { slug: actor.slug } }} asChild>
            <Pressable style={styles.person} accessibilityLabel={`Diễn viên ${actor.name}`}>
              <Image source={actor.avatarUrl || undefined} style={styles.avatar} contentFit="cover" />
              <Text numberOfLines={2} variant="labelSmall">{actor.name}</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

function EpisodeSelector({ episodes, selected, onSelect }: { episodes: Episode[]; selected: Episode | null; onSelect(episode: Episode): void }) {
  const grouped = useMemo(() => groupEpisodes(episodes), [episodes]);
  const seasons = [...grouped.keys()];
  const [season, setSeason] = useState(seasons[0] ?? 1);
  const [search, setSearch] = useState('');
  useEffect(() => { if (!grouped.has(season)) setSeason(seasons[0] ?? 1); }, [grouped, season, seasons]);
  const filtered = searchEpisodes(grouped.get(season) ?? [], search);
  if (!episodes.length) return <Text style={styles.muted}>Chưa có tập phim.</Text>;
  return (
    <View style={styles.section}>
      <Text variant="titleLarge">Tập phim</Text>
      {seasons.length > 1 ? <ScrollView horizontal contentContainerStyle={styles.chips}>{seasons.map((item) => <Chip key={item} selected={season === item} onPress={() => setSeason(item)}>Mùa {item}</Chip>)}</ScrollView> : null}
      <TextInput value={search} onChangeText={setSearch} mode="outlined" dense placeholder="Tìm tên hoặc số tập" accessibilityLabel="Tìm tập phim" />
      <View style={styles.episodeGrid}>{filtered.map((episode) => <Chip key={episode.id} selected={selected?.id === episode.id} onPress={() => onSelect(episode)} style={styles.episodeChip}>{episode.title}</Chip>)}</View>
      {!filtered.length ? <Text style={styles.muted}>Không tìm thấy tập phù hợp.</Text> : null}
    </View>
  );
}

function RatingPanel({ score, disabled, onRate }: { score: number | null; disabled: boolean; onRate(score: number): void }) {
  return (
    <View style={styles.section}>
      <Text variant="titleLarge">Đánh giá của bạn {score ? `· ${score}/10` : ''}</Text>
      <View style={styles.ratingRow}>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <Pressable key={value} disabled={disabled} accessibilityLabel={`Đánh giá ${value} trên 10`} onPress={() => onRate(value)} style={[styles.rating, score === value && styles.ratingActive]}><Text>{value}</Text></Pressable>)}</View>
    </View>
  );
}

function PlaylistPicker({ visible, movie, playlists, onClose }: { visible: boolean; movie?: Movie; playlists: Playlist[]; onClose(): void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const mutate = useMutation({
    mutationFn: async ({ playlist, included }: { playlist: Playlist; included: boolean }) => included ? movieRepository.removePlaylistMovie(playlist.id, movie!.id) : movieRepository.addPlaylistMovie(playlist.id, movie!.id),
    onMutate: async ({ playlist, included }) => {
      await queryClient.cancelQueries({ queryKey: movieKeys.playlists() });
      const previous = queryClient.getQueryData<Playlist[]>(movieKeys.playlists());
      queryClient.setQueryData<Playlist[]>(movieKeys.playlists(), (old = []) => old.map((item) => {
        if (item.id !== playlist.id || !movie) return item;
        const items = included
          ? item.items.filter((entry) => entry.movieId !== movie.id)
          : [...item.items, { id: `optimistic-${movie.id}`, playlistId: item.id, movieId: movie.id, position: item.items.length, createdAt: new Date().toISOString(), movie }];
        return { ...item, items, _count: { items: items.length } };
      }));
      return { previous };
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(movieKeys.playlists(), context?.previous);
      toast.show(error instanceof Error ? error.message : 'Không thể cập nhật playlist.');
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: movieKeys.playlists() }),
  });
  const create = useMutation({
    mutationFn: () => movieRepository.createPlaylist({ name: name.trim(), isPublic: false }),
    onSuccess: async (playlist) => {
      await movieRepository.addPlaylistMovie(playlist.id, movie!.id);
      setName('');
      void queryClient.invalidateQueries({ queryKey: movieKeys.playlists() });
    },
    onError: (error) => toast.show(error instanceof Error ? error.message : 'Không thể tạo playlist.'),
  });
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalShade} onPress={onClose} />
      <View style={styles.sheet}>
        <Text variant="headlineSmall">Thêm vào playlist</Text>
        <ScrollView style={styles.sheetList}>{playlists.map((playlist) => {
          const included = Boolean(movie && playlist.items.some((item) => item.movieId === movie.id));
          return <Pressable key={playlist.id} style={styles.playlistOption} onPress={() => mutate.mutate({ playlist, included })}><Checkbox status={included ? 'checked' : 'unchecked'} /><View><Text>{playlist.name}</Text><Text style={styles.muted}>{playlist._count?.items ?? playlist.items.length} phim</Text></View></Pressable>;
        })}</ScrollView>
        <TextInput value={name} onChangeText={setName} mode="outlined" label="Playlist mới" maxLength={60} />
        <Button mode="contained" disabled={Boolean(validatePlaylistName(name)) || create.isPending} onPress={() => create.mutate()}>Tạo và thêm phim</Button>
        <Button onPress={onClose}>Đóng</Button>
      </View>
    </Modal>
  );
}

function Comments({ movieId, authenticated }: { movieId: string; authenticated: boolean }) {
  const [sort, setSort] = useState<CommentSort>('newest');
  const query = useQuery({ queryKey: movieKeys.comments(movieId, sort), queryFn: () => movieRepository.getComments(movieId, sort) });
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.section}>
      <View style={styles.commentHeader}><Text variant="titleLarge">Bình luận</Text><SegmentedButtons value={sort} onValueChange={(value) => setSort(value as CommentSort)} buttons={[{ value: 'newest', label: 'Mới nhất' }, { value: 'popular', label: 'Phổ biến' }]} style={styles.sort} /></View>
      <CommentComposer movieId={movieId} authenticated={authenticated} sort={sort} />
      <AsyncState loading={query.isPending} error={query.error} empty={!query.data?.length} onRetry={() => void query.refetch()}>
        <View>{query.data?.map((comment) => <CommentCard key={comment.id} comment={comment} movieId={movieId} sort={sort} authenticated={authenticated} />)}</View>
      </AsyncState>
    </KeyboardAvoidingView>
  );
}

function CommentComposer({ movieId, authenticated, sort, parentId, onDone }: { movieId: string; authenticated: boolean; sort: CommentSort; parentId?: string; onDone?(): void }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const mutation = useMutation({
    mutationFn: () => movieRepository.createComment(movieId, { content: content.trim(), parentId, isSpoiler: spoiler }),
    onSuccess: () => {
      setContent(''); setSpoiler(false); onDone?.();
      void queryClient.invalidateQueries({ queryKey: [...movieKeys.all, 'comments', movieId] });
    },
  });
  if (!authenticated) return <Button mode="outlined" onPress={() => router.push('/(tabs)/account')}>Đăng nhập để bình luận</Button>;
  const error = content ? validateComment(content) : null;
  return (
    <View style={styles.composer}>
      <TextInput value={content} onChangeText={setContent} mode="outlined" multiline numberOfLines={parentId ? 2 : 3} maxLength={2000} label={parentId ? 'Viết câu trả lời' : 'Chia sẻ cảm nhận'} error={Boolean(error)} />
      <View style={styles.composerFooter}><Pressable style={styles.checkbox} onPress={() => setSpoiler(!spoiler)}><Checkbox status={spoiler ? 'checked' : 'unchecked'} /><Text>Có nội dung tiết lộ</Text></Pressable><Text style={styles.muted}>{content.length}/2000</Text><Button mode="contained" compact disabled={Boolean(validateComment(content)) || mutation.isPending} onPress={() => mutation.mutate()}>Gửi</Button></View>
      {mutation.error ? <Text style={styles.error}>{mutation.error.message}</Text> : null}
    </View>
  );
}

function CommentCard({ comment, movieId, sort, authenticated, nested = false }: { comment: Comment; movieId: string; sort: CommentSort; authenticated: boolean; nested?: boolean }) {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.session.user);
  const [revealed, setRevealed] = useState(!comment.isSpoiler);
  const [replying, setReplying] = useState(false);
  const key = movieKeys.comments(movieId, sort);
  const like = useMutation({
    mutationFn: () => movieRepository.toggleCommentLike(comment.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      queryClient.setQueryData<Comment[]>(key, (old = []) => updateCommentTree(old, comment.id, (item) => ({ ...item, isLiked: !item.isLiked, likesCount: Math.max(0, item.likesCount + (item.isLiked ? -1 : 1)) })));
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: () => movieRepository.deleteComment(comment.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      queryClient.setQueryData<Comment[]>(key, (old = []) => removeCommentFromTree(old, comment.id));
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
  const pin = useMutation({ mutationFn: () => movieRepository.togglePinComment(comment.id), onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }) });
  const report = () => Alert.alert('Báo cáo bình luận', 'Chọn lý do phù hợp nhất.', [
    { text: 'Hủy', style: 'cancel' },
    { text: 'Tiết lộ nội dung', onPress: () => void movieRepository.report({ movieId, commentId: comment.id, type: 'spoiler', content: 'Bình luận tiết lộ nội dung nhưng không được đánh dấu.' }) },
    { text: 'Quấy rối / spam', onPress: () => void movieRepository.report({ movieId, commentId: comment.id, type: 'abusive_comment', content: 'Bình luận có nội dung quấy rối, xúc phạm hoặc spam.' }) },
  ]);
  const canDelete = user?.id === comment.user.id || user?.role === 'ADMIN';
  return (
    <View style={[styles.comment, nested && styles.reply]}>
      <View style={styles.commentUser}><Image source={comment.user.avatar || undefined} style={styles.commentAvatar} /><View style={styles.titleCopy}><Text variant="labelLarge">{comment.user.username} {comment.user.isVip ? '◆' : ''}</Text><Text variant="labelSmall" style={styles.muted}>{formatRelativeTime(comment.createdAt)}{comment.timestampSeconds != null ? ` · ${formatTimestamp(comment.timestampSeconds)}` : ''}</Text></View>{comment.isPinned ? <Pin size={16} color={colors.warning} /> : null}</View>
      {comment.isSpoiler && !revealed ? <Pressable accessibilityRole="button" onPress={() => setRevealed(true)} style={styles.spoiler}><Text>Ẩn nội dung tiết lộ · Nhấn để xem</Text></Pressable> : <Text style={styles.commentBody}>{comment.content}</Text>}
      <View style={styles.commentActions}>
        <Button compact icon={() => <ThumbsUp size={15} color={comment.isLiked ? colors.primary : colors.textMuted} />} disabled={!authenticated} onPress={() => like.mutate()}>{comment.likesCount}</Button>
        {!nested ? <Button compact icon={() => <MessageCircle size={15} color={colors.textMuted} />} onPress={() => authenticated ? setReplying(!replying) : router.push('/(tabs)/account')}>Trả lời</Button> : null}
        {authenticated ? <IconButton icon={() => <Flag size={15} color={colors.textMuted} />} accessibilityLabel="Báo cáo bình luận" size={17} onPress={report} /> : null}
        {user?.role === 'ADMIN' && !nested ? <IconButton icon={() => <Pin size={15} color={colors.textMuted} />} accessibilityLabel="Ghim bình luận" size={17} onPress={() => pin.mutate()} /> : null}
        {canDelete ? <IconButton icon={() => <Trash2 size={15} color={colors.primarySoft} />} accessibilityLabel="Xóa bình luận" size={17} onPress={() => Alert.alert('Xóa bình luận?', 'Thao tác này không thể hoàn tác.', [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate() }])} /> : null}
      </View>
      {replying ? <CommentComposer movieId={movieId} authenticated={authenticated} sort={sort} parentId={comment.id} onDone={() => setReplying(false)} /> : null}
      {comment.replies?.map((reply) => <CommentCard key={reply.id} comment={reply} movieId={movieId} sort={sort} authenticated={authenticated} nested />)}
      <Divider />
    </View>
  );
}

function formatTimestamp(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function formatRelativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed < 60_000) return 'Vừa xong';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} phút trước`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} giờ trước`;
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)} ngày trước`;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

const styles = StyleSheet.create({
  page: { paddingBottom: 80 },
  hero: { backgroundColor: colors.surface, justifyContent: 'flex-end', padding: spacing.md },
  heroShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,.42)' },
  poster: { width: 112, height: 168, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border },
  content: { gap: spacing.md, padding: spacing.md },
  tabletContent: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleCopy: { flex: 1 },
  title: { fontWeight: '800' },
  muted: { color: colors.textMuted },
  error: { color: colors.primarySoft },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  linkChip: { alignSelf: 'flex-start' },
  description: { color: colors.textMuted, lineHeight: 22 },
  vipGate: { color: colors.warning, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: spacing.sm },
  action: { width: 72, alignItems: 'center', gap: spacing.xs, minHeight: 64 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing.md, marginTop: spacing.md },
  people: { gap: spacing.md },
  person: { width: 74, alignItems: 'center', gap: spacing.xs },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surfaceRaised },
  episodeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  episodeChip: { minWidth: 72 },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rating: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  ratingActive: { backgroundColor: colors.primary },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,.65)' },
  sheet: { maxHeight: '72%', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  sheetList: { maxHeight: 300 },
  playlistOption: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  commentHeader: { gap: spacing.sm },
  sort: { maxWidth: 360 },
  composer: { gap: spacing.sm },
  composerFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  checkbox: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  comment: { gap: spacing.sm, paddingVertical: spacing.md },
  reply: { marginLeft: spacing.lg, paddingLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.border },
  commentUser: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  commentAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceRaised },
  commentBody: { lineHeight: 21 },
  commentActions: { minHeight: 40, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  spoiler: { padding: spacing.md, backgroundColor: colors.surfaceRaised, borderRadius: radius.sm },
});
