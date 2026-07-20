import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { DoorOpen, LockKeyhole, Play, Plus, RadioTower, Search, UsersRound } from 'lucide-react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Divider,
  Portal,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { Screen, useToast } from '@/components/ui';
import { discoveryRepository } from '@/features/discovery/data/http-discovery-repository';
import { useWatchRoom } from '@/features/watch-together/presentation/watch-room-provider';
import type { Movie } from '@/domain/models';
import type { PublicRoom } from '@/features/watch-together/domain/watch-room';
import { colors, radius, spacing } from '@/theme';
import { useAppStore } from '@/state/app-store';
import { useAccessibilityPreferences } from '@/core/accessibility';

export default function WatchTogetherRoute() {
  const { reduceMotion } = useAccessibilityPreferences();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ roomId?: string; password?: string; roomAccessToken?: string }>();
  const { show } = useToast();
  const user = useAppStore((state) => state.session.user);
  const profile = useAppStore((state) => state.session.activeProfile);
  const authenticated = useAppStore((state) => Boolean(state.session.tokens.accessToken));
  const { rooms, status, statusMessage, refreshRooms, retryConnection, createRoom, joinRoom } = useWatchRoom();
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [joinVisible, setJoinVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [movie, setMovie] = useState<Movie | null>(null);
  const [episode, setEpisode] = useState('1');
  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [privateRoom, setPrivateRoom] = useState(false);
  const [password, setPassword] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinAccessToken, setJoinAccessToken] = useState('');
  const [formError, setFormError] = useState('');

  const defaultName = profile?.name || user?.username || '';
  useEffect(() => {
    if (!displayName && defaultName) setDisplayName(defaultName);
  }, [defaultName, displayName]);

  useEffect(() => {
    if (!authenticated || status !== 'connected') return;
    void refreshRooms().catch(() => undefined);
  }, [authenticated, refreshRooms, status]);

  useEffect(() => {
    if (!params.roomId) return;
    setJoinRoomId(params.roomId);
    setJoinPassword(params.password ?? '');
    setJoinAccessToken(params.roomAccessToken ?? '');
    setJoinVisible(true);
  }, [params.password, params.roomAccessToken, params.roomId]);

  const search = useQuery({
    queryKey: ['watch-room', 'movie-search', query.trim()],
    queryFn: ({ signal }) => discoveryRepository.getMovies(
      { page: 1, limit: 8, search: query.trim() },
      { signal },
    ),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });

  const columns = width >= 900 ? 3 : width >= 600 ? 2 : 1;
  const connectionCopy = useMemo(() => {
    if (!authenticated) return 'Đăng nhập để xem và tham gia phòng chiếu.';
    if (status === 'connected') return 'Đang trực tuyến';
    if (status === 'reconnecting') return 'Đang kết nối lại…';
    if (status === 'connecting') return 'Đang kết nối…';
    return statusMessage || 'Ngoại tuyến';
  }, [authenticated, status, statusMessage]);

  const openJoin = (room?: PublicRoom) => {
    setFormError('');
    setJoinRoomId(room?.id ?? '');
    setJoinPassword('');
    setJoinAccessToken('');
    setJoinVisible(true);
  };

  const submitJoin = async () => {
    if (busy) return;
    if (!authenticated) {
      router.push('/account/auth');
      return;
    }
    if (!joinRoomId.trim()) return setFormError('Nhập mã phòng.');
    if (!displayName.trim()) return setFormError('Nhập tên hiển thị.');
    setBusy(true);
    setFormError('');
    try {
      const room = await joinRoom({
        roomId: joinRoomId,
        displayName: displayName.trim(),
        password: joinPassword || undefined,
        roomAccessToken: joinAccessToken || undefined,
      });
      setJoinVisible(false);
      if (!reduceMotion) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.push({ pathname: '/watch-together/rooms', params: { roomId: room.roomId } });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể tham gia phòng.');
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = async () => {
    if (busy) return;
    if (!authenticated) {
      router.push('/account/auth');
      return;
    }
    if (!movie) return setFormError('Chọn phim cho phòng chiếu.');
    const parsedEpisode = Math.floor(Number(episode));
    if (!Number.isFinite(parsedEpisode) || parsedEpisode < 1) return setFormError('Tập phim không hợp lệ.');
    if (!displayName.trim()) return setFormError('Nhập tên hiển thị.');
    if (roomName.trim().length < 3 || roomName.trim().length > 60) return setFormError('Tên phòng phải từ 3 đến 60 ký tự.');
    if (privateRoom && !user?.isVip) return setFormError('Chỉ thành viên VIP mới được tạo phòng riêng tư.');
    if (privateRoom && (password.length < 4 || password.length > 50)) return setFormError('Mật khẩu phòng phải từ 4 đến 50 ký tự.');
    setBusy(true);
    setFormError('');
    try {
      const room = await createRoom({
        slug: movie.slug,
        movieId: movie.id,
        episode: parsedEpisode,
        displayName: displayName.trim(),
        roomName: roomName.trim(),
        privateRoom,
        password: privateRoom ? password : undefined,
      });
      setCreateVisible(false);
      if (!reduceMotion) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.push({
        pathname: '/watch-together/rooms',
        params: { roomId: room.roomId, roomName: roomName.trim() },
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể tạo phòng.');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try { await refreshRooms(); } catch (error) {
      show(error instanceof Error ? error.message : 'Không thể tải danh sách phòng.');
    } finally { setRefreshing(false); }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.icon}><RadioTower color={colors.primarySoft} size={24} /></View>
          <View style={styles.titleCopy}>
            <Text variant="headlineSmall" style={styles.title}>Xem chung</Text>
            <Text style={styles.muted}>Phát phim đồng bộ cùng bạn bè</Text>
          </View>
          <Button mode="contained" icon="plus" onPress={() => {
            if (!authenticated) return router.push('/account/auth');
            setFormError('');
            setCreateVisible(true);
          }}>Tạo phòng</Button>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${connectionCopy}. Chạm để thử kết nối lại`}
          onPress={retryConnection}
          style={[styles.status, status === 'connected' ? styles.online : styles.offline]}
        >
          <View style={[styles.dot, { backgroundColor: status === 'connected' ? colors.success : colors.warning }]} />
          <Text variant="labelMedium">{connectionCopy}</Text>
        </Pressable>
        <Button mode="outlined" icon="login" onPress={() => openJoin()}>Nhập mã phòng</Button>
      </View>

      {!authenticated ? (
        <View style={styles.center}>
          <LockKeyhole color={colors.textMuted} size={42} />
          <Text variant="titleLarge">Cần đăng nhập</Text>
          <Text style={styles.centerCopy}>Phòng chiếu dùng tài khoản CINE3D để giữ an toàn và đồng bộ phiên xem.</Text>
          <Button mode="contained" onPress={() => router.push('/account/auth')}>Đăng nhập</Button>
        </View>
      ) : (
        <FlatList
          key={columns}
          data={rooms}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
          contentContainerStyle={rooms.length ? styles.roomGrid : styles.emptyList}
          columnWrapperStyle={columns > 1 ? styles.columns : undefined}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Tham gia phòng ${item.slug}, ${item.viewerCount} người`}
              onPress={() => openJoin(item)}
              style={styles.roomCard}
            >
              <View style={styles.cardTop}>
                <View style={[styles.roomIcon, item.isPrivate && styles.privateIcon]}>
                  {item.isPrivate ? <LockKeyhole color={colors.warning} size={20} /> : <UsersRound color={colors.primarySoft} size={20} />}
                </View>
                <View style={styles.cardCopy}>
                  <Text variant="titleMedium" numberOfLines={1}>{item.slug.replace(/-/g, ' ')}</Text>
                  <Text style={styles.muted}>Tập {item.episode} · Chủ phòng {item.hostName}</Text>
                </View>
                <DoorOpen color={colors.textMuted} size={20} />
              </View>
              <Divider />
              <View style={styles.cardMeta}>
                <Text variant="labelMedium">{item.isPrivate ? 'Phòng riêng tư' : 'Phòng công khai'}</Text>
                <View style={styles.metaItem}><UsersRound size={15} color={colors.textMuted} /><Text>{item.viewerCount}</Text></View>
                <View style={styles.metaItem}><Play size={15} color={item.playing ? colors.success : colors.textMuted} /><Text>{item.playing ? 'Đang phát' : 'Tạm dừng'}</Text></View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={(
            <View style={styles.center}>
              <RadioTower color={colors.textMuted} size={48} />
              <Text variant="titleLarge">Chưa có phòng đang mở</Text>
              <Text style={styles.centerCopy}>Tạo phòng đầu tiên hoặc kéo xuống để làm mới.</Text>
              {status !== 'connected' ? <Button mode="outlined" onPress={retryConnection}>Thử kết nối lại</Button> : null}
            </View>
          )}
        />
      )}

      <Portal>
        <Dialog visible={joinVisible} onDismiss={() => !busy && setJoinVisible(false)} style={styles.dialog}>
          <Dialog.Title>Tham gia phòng</Dialog.Title>
          <Dialog.ScrollArea>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
              <TextInput label="Mã phòng" value={joinRoomId} onChangeText={setJoinRoomId} autoCapitalize="none" />
              <TextInput label="Tên hiển thị" value={displayName} onChangeText={setDisplayName} maxLength={30} />
              {profile ? <Text style={styles.muted}>Hồ sơ đang dùng: {profile.name}</Text> : null}
              <TextInput label="Mật khẩu (nếu có)" value={joinPassword} onChangeText={setJoinPassword} secureTextEntry maxLength={50} />
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
            </KeyboardAvoidingView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button disabled={busy} onPress={() => setJoinVisible(false)}>Hủy</Button>
            <Button loading={busy} mode="contained" onPress={() => void submitJoin()}>Vào phòng</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={createVisible} onDismiss={() => !busy && setCreateVisible(false)} style={styles.dialog}>
          <Dialog.Title>Tạo phòng chiếu</Dialog.Title>
          <Dialog.ScrollArea>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
              <TextInput
                label="Tìm phim"
                value={query}
                onChangeText={setQuery}
                left={<TextInput.Icon icon={() => <Search size={19} color={colors.textMuted} />} />}
              />
              {search.isFetching ? <ActivityIndicator /> : null}
              {query.trim().length >= 2 && !movie ? search.data?.movies.map((item) => (
                <Pressable key={item.id} onPress={() => {
                  setMovie(item);
                  setRoomName(`Cùng xem ${item.title}`);
                  setQuery(item.title);
                }} style={styles.movieResult}>
                  <Image source={item.posterUrl} style={styles.poster} />
                  <View style={styles.titleCopy}><Text variant="labelLarge">{item.title}</Text><Text style={styles.muted}>{item.releaseYear} · {item.episodeCount} tập</Text></View>
                </Pressable>
              )) : null}
              {movie ? <Text style={styles.selected}>Đã chọn: {movie.title}</Text> : null}
              <View style={styles.row}>
                <TextInput style={styles.flex} label="Tập" value={episode} onChangeText={setEpisode} keyboardType="number-pad" />
                <TextInput style={styles.flexWide} label="Tên hiển thị" value={displayName} onChangeText={setDisplayName} maxLength={30} />
              </View>
              <TextInput label="Tên phòng" value={roomName} onChangeText={setRoomName} maxLength={60} />
              <View style={styles.switchRow}>
                <View style={styles.titleCopy}><Text variant="labelLarge">Phòng riêng tư</Text><Text style={styles.muted}>Yêu cầu VIP và mật khẩu</Text></View>
                <Switch value={privateRoom} onValueChange={(value) => {
                  if (value && !user?.isVip) {
                    setFormError('Chỉ thành viên VIP mới được tạo phòng riêng tư.');
                    return;
                  }
                  setPrivateRoom(value);
                }} />
              </View>
              {privateRoom ? <TextInput label="Mật khẩu phòng" value={password} onChangeText={setPassword} secureTextEntry maxLength={50} /> : null}
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
            </KeyboardAvoidingView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button disabled={busy} onPress={() => setCreateVisible(false)}>Hủy</Button>
            <Button loading={busy} mode="contained" icon={() => <Plus size={18} color={colors.text} />} onPress={() => void submitCreate()}>Tạo phòng</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.md, gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#351216' },
  titleCopy: { flex: 1, gap: 2 },
  title: { fontWeight: '800' },
  muted: { color: colors.textMuted },
  status: { minHeight: 38, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  online: { backgroundColor: '#12351F' },
  offline: { backgroundColor: '#3A2A0D' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  roomGrid: { padding: spacing.md, gap: spacing.md, paddingBottom: 120 },
  columns: { gap: spacing.md },
  roomCard: { flex: 1, minWidth: 0, padding: spacing.md, gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  roomIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#351216' },
  privateIcon: { backgroundColor: '#3A2A0D' },
  cardCopy: { flex: 1, gap: spacing.xs },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  emptyList: { flexGrow: 1 },
  center: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerCopy: { color: colors.textMuted, textAlign: 'center', maxWidth: 420 },
  dialog: { maxWidth: 620, width: '94%', alignSelf: 'center', maxHeight: '92%' },
  form: { paddingVertical: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 0.45 },
  flexWide: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  error: { color: colors.primarySoft },
  selected: { color: colors.success, fontWeight: '700' },
  movieResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  poster: { width: 44, height: 66, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
});
