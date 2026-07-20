import { io, type Socket } from 'socket.io-client';
import { config } from '@/core/config';
import {
  WATCH_REACTIONS,
  isPublicRoom,
  isRoomPlaybackState,
  isRoomUser,
  normalizeSocketError,
  type JoinedRoom,
  type PublicRoom,
  type RoomPlaybackState,
  type RoomReaction,
  type RoomUser,
  type WatchReactionEmoji,
} from '../domain/watch-room';

export type SocketStatus = 'offline' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type WatchRoomEvent =
  | { type: 'status'; status: SocketStatus; message?: string }
  | { type: 'rooms'; rooms: PublicRoom[] }
  | { type: 'users'; users: RoomUser[]; hostId: string; episode: number; isPrivate: boolean }
  | { type: 'state'; state: RoomPlaybackState }
  | { type: 'episode'; episode: number; state: RoomPlaybackState }
  | { type: 'message'; name: string; message: string }
  | { type: 'reaction'; reaction: RoomReaction }
  | { type: 'kicked' | 'closed'; message: string }
  | { type: 'reconnected' };

interface JoinInput {
  roomId: string;
  name: string;
  password?: string;
  roomAccessToken?: string;
}

interface CreateInput {
  slug: string;
  episode: number;
  name: string;
  privateRoom: boolean;
  password?: string;
}

type Ack = Record<string, unknown> & { error?: string; passwordRequired?: boolean };

function socketUrl(): string {
  return config.apiUrl.replace(/\/api\/?$/, '');
}

function parseJoinedRoom(value: unknown): JoinedRoom {
  if (!value || typeof value !== 'object') throw new Error('Máy chủ trả về dữ liệu phòng không hợp lệ.');
  const item = value as Ack;
  if (item.error) {
    const error = normalizeSocketError(item);
    Object.assign(error, { passwordRequired: Boolean(item.passwordRequired) });
    throw error;
  }
  const state = item.state;
  const users = item.users;
  if (
    typeof item.roomId !== 'string'
    || typeof item.slug !== 'string'
    || !Number.isFinite(item.episode)
    || typeof item.hostId !== 'string'
    || typeof item.isPrivate !== 'boolean'
    || !Array.isArray(users)
    || !users.every(isRoomUser)
    || !isRoomPlaybackState(state)
  ) throw new Error('Máy chủ trả về dữ liệu phòng không hợp lệ.');
  return {
    roomId: item.roomId,
    slug: item.slug,
    episode: Number(item.episode),
    hostId: item.hostId,
    isPrivate: item.isPrivate,
    users,
    state,
    ...(typeof item.roomAccessToken === 'string' ? { roomAccessToken: item.roomAccessToken } : {}),
  };
}

class WatchRoomService {
  private readonly socket: Socket;
  private readonly subscribers = new Set<(event: WatchRoomEvent) => void>();
  private token = '';
  private status: SocketStatus = 'offline';
  private shouldSignalReconnected = false;

  constructor() {
    this.socket = io(socketUrl(), {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 600,
      reconnectionDelayMax: 5_000,
      timeout: 10_000,
      transports: ['websocket', 'polling'],
    });
    this.registerSocketListeners();
  }

  private publish(event: WatchRoomEvent) {
    if (event.type === 'status') this.status = event.status;
    this.subscribers.forEach((subscriber) => subscriber(event));
  }

  private registerSocketListeners() {
    this.socket.on('connect', () => {
      const reconnected = this.status === 'reconnecting' || this.shouldSignalReconnected;
      this.shouldSignalReconnected = false;
      this.publish({ type: 'status', status: 'connected' });
      if (reconnected) this.publish({ type: 'reconnected' });
    });
    this.socket.on('disconnect', (reason) => {
      this.publish({
        type: 'status',
        status: this.token && (reason !== 'io client disconnect' || this.shouldSignalReconnected) ? 'reconnecting' : 'offline',
      });
    });
    this.socket.io.on('reconnect_attempt', () => this.publish({ type: 'status', status: 'reconnecting' }));
    this.socket.on('connect_error', (error) => {
      this.publish({ type: 'status', status: 'error', message: normalizeSocketError(error).message });
    });
    this.socket.on('rooms:update', (value: unknown) => {
      if (Array.isArray(value)) this.publish({ type: 'rooms', rooms: value.filter(isPublicRoom) });
    });
    this.socket.on('room:users', (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const item = value as Record<string, unknown>;
      if (!Array.isArray(item.users) || !item.users.every(isRoomUser) || typeof item.hostId !== 'string'
        || !Number.isFinite(item.episode) || typeof item.isPrivate !== 'boolean') return;
      this.publish({
        type: 'users',
        users: item.users,
        hostId: item.hostId,
        episode: Number(item.episode),
        isPrivate: item.isPrivate,
      });
    });
    this.socket.on('room:state', (state: unknown) => {
      if (isRoomPlaybackState(state)) this.publish({ type: 'state', state });
    });
    this.socket.on('room:episode', (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const item = value as Record<string, unknown>;
      if (Number.isFinite(item.episode) && isRoomPlaybackState(item.state)) {
        this.publish({ type: 'episode', episode: Number(item.episode), state: item.state });
      }
    });
    this.socket.on('room:message', (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const item = value as Record<string, unknown>;
      if (typeof item.name === 'string' && typeof item.message === 'string') {
        this.publish({ type: 'message', name: item.name.slice(0, 30), message: item.message.slice(0, 300) });
      }
    });
    this.socket.on('room:reaction', (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const item = value as Record<string, unknown>;
      if (
        typeof item.id === 'string'
        && typeof item.emoji === 'string'
        && WATCH_REACTIONS.includes(item.emoji as WatchReactionEmoji)
        && typeof item.name === 'string'
        && Number.isFinite(item.createdAt)
      ) {
        this.publish({ type: 'reaction', reaction: item as unknown as RoomReaction });
      }
    });
    this.socket.on('room:kicked', (value: unknown) => this.publish({
      type: 'kicked',
      message: normalizeSocketError(value, 'Bạn đã bị mời khỏi phòng.').message,
    }));
    this.socket.on('room:closed', (value: unknown) => this.publish({
      type: 'closed',
      message: normalizeSocketError(value, 'Phòng đã đóng.').message,
    }));
  }

  subscribe(subscriber: (event: WatchRoomEvent) => void): () => void {
    this.subscribers.add(subscriber);
    subscriber({ type: 'status', status: this.status });
    return () => this.subscribers.delete(subscriber);
  }

  setToken(token?: string) {
    const next = token?.trim() ?? '';
    if (next === this.token && (next ? this.socket.connected || this.socket.active : true)) return;
    this.shouldSignalReconnected = Boolean(this.token && next && this.token !== next);
    this.token = next;
    this.socket.auth = { token: next };
    if (!next) {
      this.socket.disconnect();
      this.publish({ type: 'status', status: 'offline' });
      return;
    }
    this.publish({ type: 'status', status: this.shouldSignalReconnected ? 'reconnecting' : 'connecting' });
    if (this.socket.connected) this.socket.disconnect();
    this.socket.connect();
  }

  connect() {
    if (!this.token) return;
    if (!this.socket.connected) {
      this.publish({ type: 'status', status: 'connecting' });
      this.socket.connect();
    }
  }

  get socketId(): string | undefined {
    return this.socket.id;
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  private async ack<T = Ack>(event: string, ...args: unknown[]): Promise<T> {
    if (!this.socket.connected) throw new Error('Chưa kết nối máy chủ phòng chiếu.');
    try {
      const result = await this.socket.timeout(8_000).emitWithAck(event, ...args) as T;
      if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') {
        throw normalizeSocketError(result);
      }
      return result;
    } catch (error) {
      throw normalizeSocketError(error, 'Máy chủ phòng chiếu không phản hồi.');
    }
  }

  async listRooms(): Promise<PublicRoom[]> {
    const result = await this.ack<unknown>('rooms:list');
    if (!Array.isArray(result)) throw new Error('Danh sách phòng không hợp lệ.');
    const rooms = result.filter(isPublicRoom);
    this.publish({ type: 'rooms', rooms });
    return rooms;
  }

  async createRoom(input: CreateInput): Promise<JoinedRoom> {
    return parseJoinedRoom(await this.ack('room:create', input));
  }

  async joinRoom(input: JoinInput): Promise<JoinedRoom> {
    return parseJoinedRoom(await this.ack('room:join', input));
  }

  control(type: 'play' | 'pause' | 'seek', currentTime: number) {
    if (this.socket.connected) this.socket.emit('room:control', { type, currentTime });
  }

  sendMessage(message: string) {
    if (this.socket.connected && message.trim()) this.socket.emit('room:message', message.trim().slice(0, 300));
  }

  react(emoji: WatchReactionEmoji) {
    if (this.socket.connected) this.socket.emit('room:reaction', emoji);
  }

  changeEpisode(episode: number) {
    return this.ack<{ ok?: boolean }>('room:episode', episode);
  }

  kick(socketId: string) {
    return this.ack<{ ok?: boolean }>('room:kick', socketId);
  }

  leave() {
    if (this.socket.connected) this.socket.emit('room:leave');
  }

  closeRoom() {
    return this.ack<{ ok?: boolean }>('room:close');
  }
}

export const watchRoomService = new WatchRoomService();
