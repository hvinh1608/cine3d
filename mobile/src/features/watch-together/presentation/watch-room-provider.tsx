import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { apiClient } from '@/data/http/api-client';
import { useAppStore } from '@/state/app-store';
import { roomStorage, type SavedRoomSession } from '../data/room-storage';
import {
  watchRoomService,
  type SocketStatus,
  type WatchRoomEvent,
} from '../data/watch-room-service';
import {
  initialActiveRoomState,
  roomReducer,
  shouldRejoin,
  type ActiveRoomState,
  type JoinedRoom,
  type PublicRoom,
  type WatchReactionEmoji,
} from '../domain/watch-room';

interface CreateRoomInput {
  slug: string;
  movieId: string;
  episode: number;
  displayName: string;
  roomName: string;
  privateRoom: boolean;
  password?: string;
}

interface JoinRoomInput {
  roomId: string;
  displayName: string;
  password?: string;
  roomAccessToken?: string;
}

interface WatchRoomContextValue {
  status: SocketStatus;
  statusMessage?: string;
  rooms: PublicRoom[];
  active: ActiveRoomState;
  socketId?: string;
  refreshRooms(): Promise<void>;
  retryConnection(): void;
  createRoom(input: CreateRoomInput): Promise<JoinedRoom>;
  joinRoom(input: JoinRoomInput): Promise<JoinedRoom>;
  leaveRoom(): Promise<void>;
  closeRoom(): Promise<void>;
  kick(socketId: string): Promise<void>;
  control(type: 'play' | 'pause' | 'seek', currentTime: number): void;
  changeEpisode(episode: number): Promise<void>;
  sendMessage(message: string): void;
  react(emoji: WatchReactionEmoji): void;
}

const WatchRoomContext = createContext<WatchRoomContextValue | null>(null);

async function track(name: 'watch_room_create' | 'watch_room_join', movieId?: string, metadata?: Record<string, unknown>) {
  await apiClient.post('/analytics/events', {
    name,
    ...(movieId ? { movieId } : {}),
    path: '/watch-together',
    metadata,
  }).catch(() => undefined);
}

export function WatchRoomProvider({ children }: PropsWithChildren) {
  const accessToken = useAppStore((state) => state.session.tokens.accessToken);
  const authenticated = Boolean(accessToken);
  const [status, setStatus] = useState<SocketStatus>('offline');
  const [statusMessage, setStatusMessage] = useState<string>();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [active, dispatch] = useReducer(roomReducer, initialActiveRoomState);
  const savedSession = useRef<SavedRoomSession | null>(null);
  const joining = useRef<Promise<JoinedRoom> | null>(null);
  const intentionallyLeft = useRef(false);
  const reactionTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const applyJoinedRoom = useCallback(async (room: JoinedRoom, displayName: string) => {
    dispatch({ type: 'joined', room });
    const saved = {
      roomId: room.roomId,
      displayName,
      ...(room.roomAccessToken ? { roomAccessToken: room.roomAccessToken } : {}),
    };
    savedSession.current = saved;
    intentionallyLeft.current = false;
    await roomStorage.save(saved);
    return room;
  }, []);

  const rejoin = useCallback(async () => {
    const saved = savedSession.current ?? await roomStorage.load();
    savedSession.current = saved;
    if (!shouldRejoin({
      connected: watchRoomService.connected,
      authenticated,
      roomId: saved?.roomId,
      intentionallyLeft: intentionallyLeft.current,
    }) || !saved) return;
    if (joining.current) return joining.current;
    joining.current = watchRoomService.joinRoom({
      roomId: saved.roomId,
      name: saved.displayName,
      roomAccessToken: saved.roomAccessToken,
    });
    try {
      await applyJoinedRoom(await joining.current, saved.displayName);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/không tồn tại|đã đóng|mật khẩu/i.test(message)) {
        savedSession.current = null;
        await roomStorage.clear();
        dispatch({ type: 'ended', reason: message });
      }
    } finally {
      joining.current = null;
    }
  }, [applyJoinedRoom, authenticated]);

  useEffect(() => {
    let mounted = true;
    void roomStorage.load().then((saved) => {
      if (mounted) savedSession.current = saved;
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    watchRoomService.setToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    const handleEvent = (event: WatchRoomEvent) => {
      switch (event.type) {
        case 'status':
          setStatus(event.status);
          setStatusMessage(event.message);
          break;
        case 'rooms':
          setRooms(event.rooms);
          break;
        case 'users':
          dispatch({
            type: 'users',
            users: event.users,
            hostId: event.hostId,
            episode: event.episode,
            isPrivate: event.isPrivate,
          });
          break;
        case 'state':
          dispatch({ type: 'playback', state: event.state });
          break;
        case 'episode':
          dispatch({ type: 'episode', episode: event.episode, state: event.state });
          break;
        case 'message':
          dispatch({
            type: 'message',
            message: { ...event, id: `${Date.now()}-${Math.random()}`, createdAt: Date.now() },
          });
          break;
        case 'reaction':
          dispatch({ type: 'reaction', reaction: event.reaction });
          {
            const timer = setTimeout(() => {
              reactionTimers.current.delete(timer);
              dispatch({ type: 'expire-reaction', id: event.reaction.id });
            }, 2_800);
            reactionTimers.current.add(timer);
          }
          break;
        case 'kicked':
        case 'closed':
          intentionallyLeft.current = true;
          savedSession.current = null;
          void roomStorage.clear();
          dispatch({ type: 'ended', reason: event.message });
          break;
        case 'reconnected':
          void rejoin();
          break;
      }
    };
    const unsubscribe = watchRoomService.subscribe(handleEvent);
    return () => {
      unsubscribe();
      reactionTimers.current.forEach(clearTimeout);
      reactionTimers.current.clear();
    };
  }, [rejoin]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !authenticated) return;
      if (!watchRoomService.connected) watchRoomService.connect();
      else void rejoin();
    });
    return () => subscription.remove();
  }, [authenticated, rejoin]);

  const refreshRooms = useCallback(async () => {
    if (!watchRoomService.connected) {
      watchRoomService.connect();
      throw new Error('Đang kết nối lại máy chủ phòng chiếu.');
    }
    await watchRoomService.listRooms();
  }, []);

  const createRoom = useCallback(async (input: CreateRoomInput) => {
    intentionallyLeft.current = false;
    const room = await watchRoomService.createRoom({
      slug: input.slug,
      episode: input.episode,
      name: input.displayName,
      privateRoom: input.privateRoom,
      password: input.password,
    });
    await applyJoinedRoom(room, input.displayName);
    void track('watch_room_create', input.movieId, {
      roomId: room.roomId,
      roomName: input.roomName,
      episode: room.episode,
      privateRoom: room.isPrivate,
    });
    return room;
  }, [applyJoinedRoom]);

  const joinRoom = useCallback(async (input: JoinRoomInput) => {
    intentionallyLeft.current = false;
    const room = await watchRoomService.joinRoom({
      roomId: input.roomId.trim(),
      name: input.displayName,
      password: input.password,
      roomAccessToken: input.roomAccessToken,
    });
    await applyJoinedRoom(room, input.displayName);
    void track('watch_room_join', undefined, { roomId: room.roomId, slug: room.slug });
    return room;
  }, [applyJoinedRoom]);

  const leaveRoom = useCallback(async () => {
    intentionallyLeft.current = true;
    watchRoomService.leave();
    savedSession.current = null;
    await roomStorage.clear();
    dispatch({ type: 'clear' });
  }, []);

  const closeRoom = useCallback(async () => {
    await watchRoomService.closeRoom();
    intentionallyLeft.current = true;
    savedSession.current = null;
    await roomStorage.clear();
    dispatch({ type: 'clear' });
  }, []);

  const value = useMemo<WatchRoomContextValue>(() => ({
    status,
    statusMessage,
    rooms,
    active,
    socketId: watchRoomService.socketId,
    refreshRooms,
    retryConnection: () => watchRoomService.connect(),
    createRoom,
    joinRoom,
    leaveRoom,
    closeRoom,
    kick: async (socketId) => { await watchRoomService.kick(socketId); },
    control: (type, currentTime) => watchRoomService.control(type, currentTime),
    changeEpisode: async (episode) => { await watchRoomService.changeEpisode(episode); },
    sendMessage: (message) => watchRoomService.sendMessage(message),
    react: (emoji) => watchRoomService.react(emoji),
  }), [active, closeRoom, createRoom, joinRoom, leaveRoom, refreshRooms, rooms, status, statusMessage]);

  return <WatchRoomContext.Provider value={value}>{children}</WatchRoomContext.Provider>;
}

export function useWatchRoom(): WatchRoomContextValue {
  const value = useContext(WatchRoomContext);
  if (!value) throw new Error('useWatchRoom must be used inside WatchRoomProvider');
  return value;
}
