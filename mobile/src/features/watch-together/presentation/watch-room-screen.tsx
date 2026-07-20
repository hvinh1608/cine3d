import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  ChevronLeft,
  Crown,
  LogOut,
  MessageCircle,
  Pause,
  Play,
  Send,
  Settings,
  SkipForward,
  UsersRound,
  WifiOff,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Divider,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { Screen, useToast } from '@/components/ui';
import { useAccessibilityPreferences } from '@/core/accessibility';
import { useResponsiveLayout } from '@/core/responsive';
import type { Episode, Movie, VideoSource } from '@/domain/models';
import { movieRepository } from '@/features/movies/data/http-movie-repository';
import { movieKeys } from '@/features/movies/domain/movie-repository';
import { checkpointRepository } from '@/features/player/data/player-storage';
import { playerApi } from '@/features/player/data/player-api';
import { useAppStore } from '@/state/app-store';
import { colors, radius, spacing } from '@/theme';
import {
  WATCH_REACTIONS,
  driftCorrection,
  type RoomMessage,
  type RoomPlaybackState,
} from '../domain/watch-room';
import { useWatchRoom } from './watch-room-provider';

interface Props {
  roomId: string;
  password?: string;
  roomAccessToken?: string;
  roomName?: string;
}

export function WatchRoomScreen(props: Props) {
  const { active, status, socketId, joinRoom, retryConnection, ...actions } = useWatchRoom();
  const user = useAppStore((state) => state.session.user);
  const profile = useAppStore((state) => state.session.activeProfile);
  const displayName = profile?.name || user?.username || 'Khách';
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [password, setPassword] = useState(props.password ?? '');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const attemptedRoom = useRef('');

  const performJoin = useCallback(async (nextPassword?: string) => {
    if (!props.roomId || status !== 'connected') return;
    setJoining(true);
    setJoinError('');
    try {
      await joinRoom({
        roomId: props.roomId,
        displayName,
        password: nextPassword || undefined,
        roomAccessToken: props.roomAccessToken,
      });
      setPasswordVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tham gia phòng.';
      setJoinError(message);
      if (/mật khẩu/i.test(message)) setPasswordVisible(true);
    } finally {
      setJoining(false);
    }
  }, [displayName, joinRoom, props.roomAccessToken, props.roomId, status]);

  useEffect(() => {
    if (active.room?.roomId === props.roomId || attemptedRoom.current === props.roomId || status !== 'connected') return;
    attemptedRoom.current = props.roomId;
    void performJoin(props.password);
  }, [active.room?.roomId, performJoin, props.password, props.roomId, status]);

  useEffect(() => {
    if (!active.endedReason) return;
    Alert.alert('Phòng chiếu đã kết thúc', active.endedReason, [
      { text: 'Về sảnh', onPress: () => router.replace('/watch-together') },
    ]);
  }, [active.endedReason]);

  if (!active.room || active.room.roomId !== props.roomId) {
    return (
      <Screen>
        <View style={styles.center}>
          {status === 'connected' && joining ? <ActivityIndicator size="large" /> : <WifiOff size={48} color={colors.textMuted} />}
          <Text variant="titleLarge">{joining ? 'Đang vào phòng…' : status === 'connected' ? 'Không thể vào phòng' : 'Mất kết nối'}</Text>
          <Text style={styles.centerCopy}>{joinError || 'Ứng dụng sẽ tiếp tục khi kết nối máy chủ phòng chiếu.'}</Text>
          {status !== 'connected' ? <Button mode="contained" onPress={retryConnection}>Kết nối lại</Button> : null}
          {joinError && !passwordVisible ? <Button mode="contained" onPress={() => void performJoin(password)}>Thử lại</Button> : null}
          <Button onPress={() => router.replace('/watch-together')}>Về sảnh</Button>
        </View>
        <Portal>
          <Dialog visible={passwordVisible} onDismiss={() => setPasswordVisible(false)}>
            <Dialog.Title>Phòng riêng tư</Dialog.Title>
            <Dialog.Content style={styles.form}>
              <Text>Nhập mật khẩu do chủ phòng cung cấp.</Text>
              <TextInput label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry autoFocus />
              {joinError ? <Text style={styles.error}>{joinError}</Text> : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => router.replace('/watch-together')}>Hủy</Button>
              <Button loading={joining} mode="contained" onPress={() => void performJoin(password)}>Vào phòng</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </Screen>
    );
  }

  return (
    <LoadedRoom
      movieSlug={active.room.slug}
      roomName={props.roomName}
      socketId={socketId}
      status={status}
      active={active}
      actions={actions}
    />
  );
}

function LoadedRoom({
  movieSlug,
  roomName,
  socketId,
  status,
  active,
  actions,
}: {
  movieSlug: string;
  roomName?: string;
  socketId?: string;
  status: ReturnType<typeof useWatchRoom>['status'];
  active: ReturnType<typeof useWatchRoom>['active'];
  actions: Omit<ReturnType<typeof useWatchRoom>, 'active' | 'status' | 'socketId' | 'joinRoom' | 'retryConnection' | 'rooms' | 'refreshRooms' | 'createRoom'>;
}) {
  const query = useQuery({ queryKey: movieKeys.detail(movieSlug), queryFn: () => movieRepository.getMovie(movieSlug) });
  if (query.isPending) return <View style={styles.center}><ActivityIndicator size="large" /><Text>Đang tải phim…</Text></View>;
  if (query.error || !query.data) {
    return <View style={styles.center}><Text variant="titleLarge">Không thể tải phim</Text><Text style={styles.error}>{query.error?.message}</Text><Button onPress={() => void query.refetch()}>Thử lại</Button></View>;
  }
  return <RoomExperience movie={query.data} roomName={roomName} socketId={socketId} status={status} active={active} actions={actions} />;
}

function resolveEpisode(movie: Movie, number: number): Episode | undefined {
  return movie.episodes?.find((item) => item.episodeOrder === number) ?? movie.episodes?.[Math.max(0, number - 1)];
}

function chooseSource(episode: Episode | undefined): VideoSource | undefined {
  return episode?.videoSources.find((item) => item.type === 'hls')
    ?? episode?.videoSources.find((item) => item.type === 'mp4')
    ?? episode?.videoSources[0];
}

function formatTime(value: number) {
  const safe = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function RoomExperience({
  movie,
  roomName,
  socketId,
  status,
  active,
  actions,
}: {
  movie: Movie;
  roomName?: string;
  socketId?: string;
  status: ReturnType<typeof useWatchRoom>['status'];
  active: ReturnType<typeof useWatchRoom>['active'];
  actions: Omit<ReturnType<typeof useWatchRoom>, 'active' | 'status' | 'socketId' | 'joinRoom' | 'retryConnection' | 'rooms' | 'refreshRooms' | 'createRoom'>;
}) {
  const room = active.room!;
  const { isLandscape, isTablet } = useResponsiveLayout();
  const landscape = isLandscape && isTablet;
  const { reduceMotion } = useAccessibilityPreferences();
  const isHost = Boolean(socketId && room.hostId === socketId);
  const episode = useMemo(() => resolveEpisode(movie, room.episode), [movie, room.episode]);
  const source = useMemo(() => chooseSource(episode), [episode]);
  const { show } = useToast();
  const profileKey = useAppStore((state) => state.session.activeProfile?.id ?? 'account');
  const authenticated = useAppStore((state) => Boolean(state.session.tokens.accessToken));
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [message, setMessage] = useState('');
  const [usersVisible, setUsersVisible] = useState(false);
  const [episodesVisible, setEpisodesVisible] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const lastCheckpoint = useRef(0);
  const loadedSource = useRef('');
  const chatListRef = useRef<FlatList<RoomMessage>>(null);
  const latestRoomState = useRef(room.state);
  latestRoomState.current = room.state;
  const player = useVideoPlayer(null, (instance) => {
    instance.timeUpdateEventInterval = 0.5;
    instance.keepScreenOnWhilePlaying = true;
    instance.staysActiveInBackground = false;
    instance.audioMixingMode = 'doNotMix';
  });

  const applyRemoteState = useCallback((remote: RoomPlaybackState) => {
    if (!source || loadedSource.current !== source.id) return;
    const correction = driftCorrection(player.currentTime, remote, Date.now(), 1.5);
    if (correction.seekTo != null) player.currentTime = correction.seekTo;
    if (correction.shouldPlay && !player.playing) player.play();
    if (!correction.shouldPlay && player.playing) player.pause();
  }, [player, source]);

  useEffect(() => {
    if (!source || !episode) return;
    let active = true;
    loadedSource.current = '';
    setBuffering(true);
    setPosition(0);
    setDuration(0);
    void player.replaceAsync({
      uri: source.url,
      contentType: source.type === 'hls' ? 'hls' : 'progressive',
      useCaching: source.type === 'mp4',
      metadata: { title: `${movie.title} · ${episode.title}`, artist: 'Phòng chiếu CINE3D', artwork: movie.posterUrl },
    }).then(() => {
      if (!active) return;
      loadedSource.current = source.id;
      applyRemoteState(latestRoomState.current);
    }).catch((error) => {
      if (active) show(error instanceof Error ? error.message : 'Không thể tải nguồn phát.');
    });
    return () => { active = false; };
  }, [applyRemoteState, episode, movie.posterUrl, movie.title, player, show, source]);

  useEffect(() => {
    applyRemoteState(room.state);
    const timer = setInterval(() => applyRemoteState(room.state), 2_000);
    return () => clearInterval(timer);
  }, [applyRemoteState, room.state]);

  useEffect(() => {
    const subscriptions = [
      player.addListener('timeUpdate', ({ currentTime }) => {
        setPosition(currentTime);
        const now = Date.now();
        if (!episode || now - lastCheckpoint.current < 15_000 || player.duration <= 0) return;
        lastCheckpoint.current = now;
        void checkpointRepository.save({
          profileKey,
          movieId: movie.id,
          episodeId: episode.id,
          position: currentTime,
          duration: player.duration,
          updatedAt: now,
        });
        if (authenticated) void playerApi.saveProgress(movie.id, episode.id, currentTime, player.duration).catch(() => undefined);
      }),
      player.addListener('sourceLoad', ({ duration: nextDuration }) => setDuration(nextDuration)),
      player.addListener('statusChange', ({ status: nextStatus }) => setBuffering(nextStatus === 'loading')),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [authenticated, episode, movie.id, player, profileKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') applyRemoteState(room.state);
    });
    return () => subscription.remove();
  }, [applyRemoteState, room.state]);

  const togglePlayback = () => {
    if (!isHost) return show('Chỉ chủ phòng có thể điều khiển phát phim.');
    if (!reduceMotion) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const nextPlaying = !player.playing;
    if (nextPlaying) player.play(); else player.pause();
    actions.control(nextPlaying ? 'play' : 'pause', player.currentTime);
  };

  const seek = (next: number) => {
    if (!isHost) return;
    player.currentTime = next;
    setPosition(next);
    actions.control('seek', next);
  };

  const submitMessage = () => {
    if (!message.trim()) return;
    actions.sendMessage(message);
    setMessage('');
  };

  const exit = () => {
    Alert.alert(
      isHost ? 'Rời hay đóng phòng?' : 'Rời phòng?',
      isHost ? 'Nếu chỉ rời, quyền chủ phòng sẽ được chuyển sau vài giây.' : 'Bạn có thể tham gia lại nếu phòng vẫn mở.',
      [
        { text: 'Hủy', style: 'cancel' },
        ...(isHost ? [{ text: 'Đóng phòng', style: 'destructive' as const, onPress: () => void actions.closeRoom().then(() => router.replace('/watch-together')).catch((error) => show(error.message)) }] : []),
        { text: 'Rời phòng', onPress: () => void actions.leaveRoom().then(() => router.replace('/watch-together')) },
      ],
    );
  };

  if (movie.requiresVip) {
    return (
      <Screen>
        <View style={styles.center}><Crown size={48} color={colors.warning} /><Text variant="headlineSmall">Nội dung dành cho VIP</Text><Text style={styles.centerCopy}>Tài khoản hiện tại không có quyền phát nguồn của phim này.</Text><Button mode="contained" onPress={() => router.push('/account/vip')}>Xem gói VIP</Button><Button onPress={() => void actions.leaveRoom().then(() => router.replace('/watch-together'))}>Rời phòng</Button></View>
      </Screen>
    );
  }

  if (!episode || !source) {
    return <Screen><View style={styles.center}><Text variant="titleLarge">Tập chưa có nguồn phát</Text><Text style={styles.centerCopy}>Tập {room.episode} hiện không có nguồn tương thích với tài khoản này.</Text><Button onPress={exit}>Rời phòng</Button></View></Screen>;
  }

  const playerPane = (
    <View style={[styles.playerPane, landscape && styles.playerLandscape]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Rời phòng" onPress={exit} style={styles.roundButton}><ChevronLeft color={colors.text} /></Pressable>
        <View style={styles.topTitle}><Text variant="titleMedium" numberOfLines={1}>{roomName || movie.title}</Text><Text style={styles.muted}>Phòng {room.roomId} · Tập {room.episode}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Danh sách người xem" onPress={() => setUsersVisible(true)} style={styles.roundButton}><UsersRound color={colors.text} /></Pressable>
      </View>
      {status !== 'connected' ? (
        <View style={styles.connectionBanner}><WifiOff size={16} color={colors.warning} /><Text>{status === 'reconnecting' ? 'Đang kết nối lại và đồng bộ phòng…' : 'Mất kết nối phòng chiếu'}</Text></View>
      ) : null}
      <View style={[styles.videoStage, landscape && { flex: 1 }]}>
        <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" surfaceType="surfaceView" />
        {buffering ? <View accessibilityRole="progressbar" accessibilityLiveRegion="polite" style={styles.videoLoading}><ActivityIndicator size="large" /><Text>Đang tải {source.server}…</Text></View> : null}
        <View pointerEvents="none" style={styles.reactionsOverlay}>
          {active.reactions.map((reaction, index) => <Text key={reaction.id} style={[styles.floatingReaction, { right: 18 + (index % 3) * 52, bottom: 24 + index * 30 }]}>{reaction.emoji}</Text>)}
        </View>
      </View>
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={player.playing ? 'Tạm dừng' : 'Phát'} disabled={!isHost} onPress={togglePlayback} style={[styles.playButton, !isHost && styles.disabled]}>
            {player.playing ? <Pause color={colors.text} fill={colors.text} /> : <Play color={colors.text} fill={colors.text} />}
          </Pressable>
          <View style={styles.timeline}>
            <Slider
              value={position}
              minimumValue={0}
              maximumValue={Math.max(1, duration)}
              disabled={!isHost}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={isHost ? colors.primarySoft : colors.textMuted}
              onSlidingComplete={seek}
              accessibilityLabel="Tiến trình phòng chiếu"
              accessibilityRole="adjustable"
              accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(position) }}
            />
            <View style={styles.timeRow}><Text variant="labelSmall">{formatTime(position)}</Text><Text variant="labelSmall">{formatTime(duration)}</Text></View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Chọn tập" accessibilityState={{ disabled: !isHost }} disabled={!isHost} onPress={() => setEpisodesVisible(true)} style={[styles.roundButton, !isHost && styles.disabled]}><SkipForward color={colors.text} /></Pressable>
        </View>
        <Text style={styles.hostHint}>{isHost ? 'Bạn là chủ phòng · Điều khiển sẽ đồng bộ cho mọi người' : 'Đang xem theo điều khiển của chủ phòng'}</Text>
        <View style={styles.reactionRow}>
          {WATCH_REACTIONS.map((emoji) => <Pressable key={emoji} accessibilityLabel={`Thả cảm xúc ${emoji}`} onPress={() => {
            if (!reduceMotion) void Haptics.selectionAsync().catch(() => undefined);
            actions.react(emoji);
          }} style={styles.emojiButton}><Text variant="titleLarge">{emoji}</Text></Pressable>)}
        </View>
      </View>
    </View>
  );

  const chatPane = (
    <KeyboardAvoidingView style={[styles.chatPane, !chatVisible && styles.chatCollapsed]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={40}>
      <View style={styles.chatHeader}>
        <MessageCircle size={20} color={colors.primarySoft} />
        <Text variant="titleMedium">Trò chuyện</Text>
        <Text style={styles.muted}>{room.users.length} người</Text>
        {!landscape ? <Pressable onPress={() => setChatVisible(!chatVisible)}><Settings size={20} color={colors.textMuted} /></Pressable> : null}
      </View>
      {chatVisible ? (
        <>
          <FlatList
            ref={chatListRef}
            data={active.messages}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => <View style={styles.message}><Text variant="labelMedium" style={styles.messageName}>{item.name}</Text><Text selectable>{item.message}</Text></View>}
            ListEmptyComponent={<Text style={styles.emptyChat}>Chưa có tin nhắn. Hãy chào mọi người!</Text>}
          />
          <View style={styles.composer}>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Nhắn cho phòng…"
              maxLength={300}
              dense
              onSubmitEditing={submitMessage}
            />
            <Pressable accessibilityLabel="Gửi tin nhắn" onPress={submitMessage} style={styles.sendButton}><Send size={20} color={colors.text} /></Pressable>
          </View>
        </>
      ) : null}
    </KeyboardAvoidingView>
  );

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.roomLayout, landscape && styles.roomLandscape]}>
        {playerPane}
        {chatPane}
      </View>
      <Portal>
        <Dialog visible={usersVisible} onDismiss={() => setUsersVisible(false)} style={styles.dialog}>
          <Dialog.Title>Người trong phòng ({room.users.length})</Dialog.Title>
          <Dialog.ScrollArea>
            <FlatList
              data={room.users}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <Divider />}
              renderItem={({ item }) => (
                <View style={styles.userRow}>
                  <View style={styles.avatar}><Text>{item.name.slice(0, 1).toUpperCase()}</Text></View>
                  <Text style={styles.userName}>{item.name}</Text>
                  {item.id === room.hostId ? <View style={styles.hostBadge}><Crown size={14} color={colors.warning} /><Text variant="labelSmall">Chủ phòng</Text></View> : null}
                  {isHost && item.id !== socketId ? <Button compact textColor={colors.primarySoft} onPress={() => Alert.alert('Mời khỏi phòng?', item.name, [{ text: 'Hủy' }, { text: 'Mời ra', style: 'destructive', onPress: () => void actions.kick(item.id).catch((error) => show(error.message)) }])}>Mời ra</Button> : null}
                </View>
              )}
            />
          </Dialog.ScrollArea>
          <Dialog.Actions><Button icon={() => <LogOut size={17} color={colors.primarySoft} />} textColor={colors.primarySoft} onPress={exit}>Rời phòng</Button><Button onPress={() => setUsersVisible(false)}>Đóng</Button></Dialog.Actions>
        </Dialog>
        <Dialog visible={episodesVisible} onDismiss={() => setEpisodesVisible(false)} style={styles.dialog}>
          <Dialog.Title>Chọn tập</Dialog.Title>
          <Dialog.ScrollArea>
            <FlatList
              data={movie.episodes ?? []}
              keyExtractor={(item) => item.id}
              numColumns={4}
              contentContainerStyle={styles.episodeGrid}
              renderItem={({ item }) => <Button mode={item.episodeOrder === room.episode ? 'contained' : 'outlined'} style={styles.episodeButton} onPress={() => void actions.changeEpisode(item.episodeOrder).then(() => setEpisodesVisible(false)).catch((error) => show(error.message))}>{item.episodeOrder}</Button>}
            />
          </Dialog.ScrollArea>
          <Dialog.Actions><Button onPress={() => setEpisodesVisible(false)}>Đóng</Button></Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  centerCopy: { color: colors.textMuted, textAlign: 'center', maxWidth: 480 },
  error: { color: colors.primarySoft },
  form: { gap: spacing.md },
  roomLayout: { flex: 1, backgroundColor: colors.background },
  roomLandscape: { flexDirection: 'row' },
  playerPane: { backgroundColor: '#050506' },
  playerLandscape: { flex: 1.8 },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  topTitle: { flex: 1 },
  muted: { color: colors.textMuted },
  roundButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  connectionBanner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: '#3A2A0D' },
  videoStage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  videoLoading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#0009' },
  reactionsOverlay: { position: 'absolute', inset: 0 },
  floatingReaction: { position: 'absolute', fontSize: 34, textShadowColor: '#000', textShadowRadius: 8 },
  controls: { padding: spacing.md, gap: spacing.sm },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  disabled: { opacity: 0.42 },
  timeline: { flex: 1 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  hostHint: { color: colors.textMuted, textAlign: 'center', fontSize: 12 },
  reactionRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  emojiButton: { minWidth: 42, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surface },
  chatPane: { flex: 1, minHeight: 220, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  chatCollapsed: { minHeight: 58, flex: 0 },
  chatHeader: { minHeight: 54, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  messageList: { padding: spacing.md, gap: spacing.sm },
  message: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  messageName: { color: colors.primarySoft, marginBottom: 2 },
  emptyChat: { color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  composer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  messageInput: { flex: 1, maxHeight: 100 },
  sendButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  dialog: { width: '94%', maxWidth: 600, maxHeight: '88%', alignSelf: 'center' },
  userRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  userName: { flex: 1 },
  hostBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: '#3A2A0D' },
  episodeGrid: { gap: spacing.sm, paddingVertical: spacing.md },
  episodeButton: { flex: 1, margin: spacing.xs, minWidth: 54 },
});
