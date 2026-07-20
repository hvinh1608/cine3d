import { useEffect, useMemo, useReducer, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ActivityIndicator, Button, Card, Chip, Dialog, Divider, FAB, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { ApiError } from '@/domain/models';
import { useToast } from '@/components/ui';
import { useAppStore } from '@/state/app-store';
import { colors, radius, spacing } from '@/theme';
import { adminAccess, canMutateUser, isAdminForbidden } from '../domain/permissions';
import { adminUiReducer, filterAndPage, initialAdminUiState } from '../domain/reducer';
import type { AdminEpisode, AdminFeedback, AdminMovie, AdminSection, EpisodeInput, MovieInput } from '../domain/types';
import { hasErrors, parseBulkEpisodes } from '../domain/validation';
import { adminRepository } from '../data/admin-repository';
import {
  adminKeys, useAdminDashboard, useAdminFeedback, useAdminMetadata, useAdminMovies, useAdminMutation,
  useAdminOrders, useAdminReports, useAdminSources, useAdminUsers,
} from '../data/admin-queries';
import { EpisodeFormModal, MovieFormModal } from './admin-forms';

const sections: Array<{ key: AdminSection; label: string }> = [
  { key: 'dashboard', label: 'Tổng quan' }, { key: 'movies', label: 'Phim' }, { key: 'episodes', label: 'Tập phim' },
  { key: 'users', label: 'Thành viên' }, { key: 'vip', label: 'Đơn VIP' }, { key: 'reports', label: 'Báo cáo' },
  { key: 'feedback', label: 'Góp ý' }, { key: 'sources', label: 'Nguồn phát' }, { key: 'metadata', label: 'Danh mục' },
];
const statusValues = (items: Array<{ status: string }>) => ['all', ...new Set(items.map((item) => item.status))];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Thao tác thất bại.';
const formatDate = (date?: string | null) => date ? new Date(date).toLocaleString('vi-VN') : '—';
const money = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

function useDebounced(value: string, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}
function Loading() { return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Đang tải dữ liệu quản trị…</Text></View>; }
function ErrorBox({ error, retry }: { error: unknown; retry(): void }) {
  const offline = error instanceof ApiError && error.status === undefined;
  return <View style={styles.center}><Text variant="titleMedium">{offline ? 'Đang ngoại tuyến' : 'Không thể tải dữ liệu'}</Text>
    <Text style={styles.muted}>{errorMessage(error)}</Text><Button mode="contained" onPress={retry}>Thử lại</Button></View>;
}
function PageControls({ page, totalPages, onPage }: { page: number; totalPages: number; onPage(page: number): void }) {
  return <View style={styles.pager}><Button disabled={page <= 1} onPress={() => onPage(page - 1)}>Trang trước</Button><Text>{page}/{totalPages}</Text><Button disabled={page >= totalPages} onPress={() => onPage(page + 1)}>Trang sau</Button></View>;
}
function SearchFilter({ search, onSearch, statuses, status, onStatus }: { search: string; onSearch(value: string): void; statuses?: string[]; status?: string; onStatus?(value: string): void }) {
  return <View style={styles.filters}><TextInput mode="outlined" label="Tìm kiếm" value={search} onChangeText={onSearch} accessibilityLabel="Tìm kiếm danh sách" />
    {statuses && status && onStatus ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{statuses.map((item) => <Chip key={item} selected={status === item} onPress={() => onStatus(item)}>{item === 'all' ? 'Tất cả' : item}</Chip>)}</ScrollView> : null}</View>;
}
function CardList<T>({ data, keyOf, render }: { data: T[]; keyOf(item: T): string; render(item: T): React.ReactElement }) {
  return <FlashList data={data} keyExtractor={keyOf} renderItem={({ item }) => render(item)} ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />} contentContainerStyle={{ paddingBottom: 96 }} />;
}

export function AdminScreen() {
  const { width } = useWindowDimensions();
  const user = useAppStore((state) => state.session.user);
  const hydrated = useAppStore((state) => state.session.hydrated);
  const access = adminAccess(hydrated, user);
  const toast = useToast();
  const [ui, dispatch] = useReducer(adminUiReducer, initialAdminUiState);
  const debouncedSearch = useDebounced(ui.search);
  const [moviePage, setMoviePage] = useState(1);
  const [movieForm, setMovieForm] = useState<AdminMovie | null | undefined>(undefined);
  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [episodeForm, setEpisodeForm] = useState<AdminEpisode | null | undefined>(undefined);
  const [bulkText, setBulkText] = useState('');
  const [bulkServer, setBulkServer] = useState('Main Server');
  const [bulkQuality, setBulkQuality] = useState('1080p');
  const [reply, setReply] = useState<{ item: AdminFeedback; status: 'REVIEWING' | 'RESOLVED' | 'REJECTED'; text: string } | null>(null);
  const [serverForbidden, setServerForbidden] = useState(false);

  useEffect(() => { if (access === 'signed-out') router.replace('/account/auth'); }, [access]);
  useEffect(() => { setMoviePage(1); }, [debouncedSearch]);
  const allowed = access === 'allowed';
  const dashboard = useAdminDashboard(allowed && ui.section === 'dashboard');
  const movies = useAdminMovies(moviePage, ui.section === 'movies' || ui.section === 'episodes' ? debouncedSearch : '', allowed && (ui.section === 'movies' || ui.section === 'episodes'));
  const metadata = useAdminMetadata(allowed && ['movies', 'metadata'].includes(ui.section));
  const users = useAdminUsers(allowed && ui.section === 'users');
  const orders = useAdminOrders(allowed && ui.section === 'vip');
  const reports = useAdminReports(allowed && ui.section === 'reports');
  const feedback = useAdminFeedback(allowed && ui.section === 'feedback');
  const sources = useAdminSources(allowed && ui.section === 'sources');
  const queries = [dashboard.stats, dashboard.analytics, movies, metadata, users, orders, reports, feedback, sources];
  const forbidden = queries.some((query) => isAdminForbidden(query.error));

  const movieMutation = useAdminMutation(async ({ id, input }: { id?: string; input: MovieInput }) =>
    id ? adminRepository.updateMovie(id, input) : adminRepository.createMovie(input), [adminKeys.all]);
  const deleteMovie = useAdminMutation(adminRepository.deleteMovie, [adminKeys.all]);
  const episodeMutation = useAdminMutation(async ({ id, input }: { id?: string; input: EpisodeInput }) =>
    id ? adminRepository.updateEpisode(id, input) : adminRepository.createEpisode(input), [adminKeys.all]);
  const deleteEpisode = useAdminMutation(adminRepository.deleteEpisode, [adminKeys.all]);
  const bulkMutation = useAdminMutation(({ movieId, rows }: { movieId: string; rows: ReturnType<typeof parseBulkEpisodes>['rows'] }) => adminRepository.bulkEpisodes(movieId, rows), [adminKeys.all]);
  const lockMutation = useAdminMutation(adminRepository.toggleLock, [adminKeys.users]);
  const vipMutation = useAdminMutation(adminRepository.toggleVip, [adminKeys.users]);
  const roleMutation = useAdminMutation(({ id, role }: { id: string; role: 'USER' | 'ADMIN' }) => adminRepository.updateRole(id, role), [adminKeys.users]);
  const orderMutation = useAdminMutation(({ id, action }: { id: string; action: 'confirm' | 'cancel' }) => action === 'confirm' ? adminRepository.confirmOrder(id) : adminRepository.cancelOrder(id), [adminKeys.orders, adminKeys.stats]);
  const reportMutation = useAdminMutation(({ id, status }: { id: string; status: 'Resolved' | 'Ignored' }) => adminRepository.resolveReport(id, status), [adminKeys.reports, adminKeys.stats]);
  const feedbackMutation = useAdminMutation(({ id, status, text }: { id: string; status: 'REVIEWING' | 'RESOLVED' | 'REJECTED'; text: string }) => adminRepository.updateFeedback(id, status, text), [adminKeys.feedback]);
  const sourceMutation = useAdminMutation(adminRepository.checkSources, [adminKeys.sources]);
  const busy = [movieMutation, deleteMovie, episodeMutation, deleteEpisode, bulkMutation, lockMutation, vipMutation, roleMutation, orderMutation, reportMutation, feedbackMutation, sourceMutation].some((mutation) => mutation.isPending);

  const act = async (work: Promise<unknown>, success: string) => {
    try { const result = await work; toast.show(typeof result === 'string' ? result : success); } catch (error) {
      if (isAdminForbidden(error)) setServerForbidden(true);
      if (error instanceof ApiError && error.status === 401) router.replace('/account/auth');
      toast.show(errorMessage(error));
    }
  };
  if (access === 'loading') return <Loading />;
  if (access === 'signed-out') return <View testID="admin-auth-gate" style={styles.center}><Text>Phiên đăng nhập đã hết hạn.</Text></View>;
  if (access === 'forbidden' || forbidden || serverForbidden) return <View testID="admin-forbidden" style={styles.center}><Text variant="headlineSmall">403 · Không có quyền</Text><Text style={styles.muted}>API đã từ chối quyền quản trị cho tài khoản này.</Text><Button mode="contained" onPress={() => router.replace('/(tabs)/account')}>Về tài khoản</Button></View>;

  const selectedMovie = movies.data?.movies.find((item) => item.id === selectedMovieId);
  const submitMovie = (input: MovieInput) => void act(movieMutation.mutateAsync({ id: movieForm?.id, input }).then(() => setMovieForm(undefined)), movieForm ? 'Đã cập nhật phim.' : 'Đã tạo phim.');
  const submitEpisode = (input: EpisodeInput) => void act(episodeMutation.mutateAsync({ id: episodeForm?.id, input }).then(() => setEpisodeForm(undefined)), episodeForm ? 'Đã cập nhật tập.' : 'Đã tạo tập.');
  const confirmDelete = (title: string, body: string, action: () => Promise<unknown>) => Alert.alert(title, body, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => void act(action(), 'Đã xóa.') }]);

  const dashboardView = () => {
    if (dashboard.stats.isLoading || dashboard.analytics.isLoading) return <Loading />;
    const error = dashboard.stats.error || dashboard.analytics.error;
    if (error) return <ErrorBox error={error} retry={() => { void dashboard.stats.refetch(); void dashboard.analytics.refetch(); }} />;
    const stats = dashboard.stats.data!;
    const analytics = dashboard.analytics.data!;
    const maxViews = Math.max(...stats.topMovies.map((item) => item.views), 1);
    const cards = [['Thành viên', stats.totalUsers], ['Phim', stats.totalMovies], ['Tập phim', stats.totalEpisodes], ['Lượt xem', stats.totalViews], ['Báo cáo chờ', stats.pendingReports], ['Hoạt động 7 ngày', analytics.activeUsers]];
    return <ScrollView refreshControl={<RefreshControl refreshing={dashboard.stats.isRefetching || dashboard.analytics.isRefetching} onRefresh={() => { void dashboard.stats.refetch(); void dashboard.analytics.refetch(); }} />} contentContainerStyle={styles.scroll}>
      <View style={[styles.kpis, width >= 700 && styles.kpisTablet]}>{cards.map(([label, value]) => <Card key={String(label)} style={styles.kpi}><Card.Content><Text style={styles.muted}>{label}</Text><Text variant="headlineMedium">{Number(value).toLocaleString('vi-VN')}</Text></Card.Content></Card>)}</View>
      <Card><Card.Title title="Analytics 7 ngày" /><Card.Content style={styles.stack}>{Object.entries(analytics.events).map(([name, value]) => <View key={name} style={styles.barRow}><Text style={styles.barLabel}>{name}</Text><View style={styles.barTrack}><View style={[styles.bar, { width: `${Math.min(100, value / Math.max(...Object.values(analytics.events), 1) * 100)}%` }]} /></View><Text>{value}</Text></View>)}{!Object.keys(analytics.events).length ? <Text style={styles.muted}>Chưa có sự kiện.</Text> : null}</Card.Content></Card>
      <Card><Card.Title title="Phim xem nhiều" /><Card.Content style={styles.stack}>{stats.topMovies.map((movie) => <View key={movie.id} style={styles.stack}><View style={styles.between}><Text style={styles.grow}>{movie.title}</Text><Text>{movie.views.toLocaleString('vi-VN')}</Text></View><View style={styles.barTrack}><View style={[styles.bar, { width: `${movie.views / maxViews * 100}%` }]} /></View></View>)}</Card.Content></Card>
      <Card><Card.Title title="Lỗi phát gần đây" /><Card.Content style={styles.stack}>{analytics.recentPlayerErrors.slice(0, 10).map((event) => <View key={event.id}><Text>{event.movieId || event.path || event.name || 'Không xác định'}</Text><Text style={styles.muted}>{formatDate(event.createdAt)} · {JSON.stringify(event.metadata || {})}</Text></View>)}{!analytics.recentPlayerErrors.length ? <Text style={styles.success}>Không ghi nhận lỗi phát.</Text> : null}</Card.Content></Card>
    </ScrollView>;
  };

  const movieView = () => {
    if (movies.isLoading || metadata.isLoading) return <Loading />;
    if (movies.error || metadata.error) return <ErrorBox error={movies.error || metadata.error} retry={() => { void movies.refetch(); void metadata.refetch(); }} />;
    return <View style={styles.listPage}><SearchFilter search={ui.search} onSearch={(search) => dispatch({ type: 'search', search })} />
      <Text style={styles.muted}>{movies.data?.total || 0} phim · tìm kiếm/paging từ máy chủ</Text>
      <CardList data={movies.data?.movies || []} keyOf={(item) => item.id} render={(item) => <Card><Card.Title title={item.title} subtitle={`${item.releaseYear} · ${item.quality} · ${item.episodeCount} tập${item.isVip ? ' · VIP' : ''}`} /><Card.Content><Text numberOfLines={2} style={styles.muted}>{item.description}</Text></Card.Content><Card.Actions><Button onPress={() => { setSelectedMovieId(item.id); dispatch({ type: 'section', section: 'episodes' }); }}>Tập</Button><Button onPress={() => setMovieForm(item)}>Sửa</Button><Button textColor={colors.primarySoft} onPress={() => confirmDelete('Xóa phim?', item.title, () => deleteMovie.mutateAsync(item.id))}>Xóa</Button></Card.Actions></Card>} />
      <PageControls page={movies.data?.page || 1} totalPages={movies.data?.totalPages || 1} onPage={setMoviePage} />
      <FAB icon="plus" label="Tạo phim" style={styles.fab} onPress={() => setMovieForm(null)} accessibilityLabel="Tạo phim mới" />
    </View>;
  };

  const episodeView = () => {
    if (movies.isLoading) return <Loading />;
    if (movies.error) return <ErrorBox error={movies.error} retry={() => void movies.refetch()} />;
    return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <SearchFilter search={ui.search} onSearch={(search) => dispatch({ type: 'search', search })} />
      <Text variant="titleMedium">Chọn phim</Text><View style={styles.chips}>{(movies.data?.movies || []).map((movie) => <Chip key={movie.id} selected={selectedMovieId === movie.id} onPress={() => setSelectedMovieId(movie.id)}>{movie.title}</Chip>)}</View>
      {selectedMovie ? <><View style={styles.between}><Text variant="titleLarge">{selectedMovie.title}</Text><Button mode="contained" onPress={() => setEpisodeForm(null)}>Thêm tập</Button></View>
        {selectedMovie.episodes.map((episode) => <Card key={episode.id}><Card.Title title={`#${episode.episodeOrder} · ${episode.title}`} subtitle={`Phần ${episode.seasonNumber || 1} · ${formatDate(episode.airDate)} · ${episode.videoSources.length} nguồn`} /><Card.Actions><Button onPress={() => setEpisodeForm(episode)}>Sửa đầy đủ</Button><Button textColor={colors.primarySoft} onPress={() => confirmDelete('Xóa tập?', episode.title, () => deleteEpisode.mutateAsync(episode.id))}>Xóa</Button></Card.Actions></Card>)}
        <Card><Card.Title title="Nhập tập hàng loạt" subtitle="Phần | Số tập | Tên | URL | Ngày ISO (tùy chọn), tối đa 100 dòng" /><Card.Content style={styles.stack}><TextInput mode="outlined" multiline numberOfLines={7} value={bulkText} onChangeText={setBulkText} accessibilityLabel="Dữ liệu nhập tập hàng loạt" /><TextInput mode="outlined" label="Server" value={bulkServer} onChangeText={setBulkServer} /><TextInput mode="outlined" label="Chất lượng" value={bulkQuality} onChangeText={setBulkQuality} /><Button mode="contained-tonal" loading={bulkMutation.isPending} onPress={() => { const parsed = parseBulkEpisodes(bulkText, bulkServer, bulkQuality); if (hasErrors(parsed.errors)) return toast.show(Object.values(parsed.errors)[0] || 'Dữ liệu không hợp lệ.'); void act(bulkMutation.mutateAsync({ movieId: selectedMovie.id, rows: parsed.rows }).then(() => setBulkText('')), `Đã nhập ${parsed.rows.length} tập.`); }}>Nhập tất cả</Button></Card.Content></Card>
      </> : <Text style={styles.muted}>Tìm và chọn phim để quản lý tập.</Text>}
      <PageControls page={movies.data?.page || 1} totalPages={movies.data?.totalPages || 1} onPage={setMoviePage} />
    </ScrollView>;
  };

  const userView = () => {
    if (users.isLoading) return <Loading />; if (users.error) return <ErrorBox error={users.error} retry={() => void users.refetch()} />;
    const page = filterAndPage(users.data || [], ui.search, ui.status, (item) => `${item.username} ${item.email}`, (item) => item.role.name, ui.localPage);
    const userAction = (targetId: string, label: string, work: () => Promise<unknown>) => {
      if (!canMutateUser(user!.id, targetId)) return toast.show('Không thể khóa hoặc hạ quyền chính tài khoản đang dùng.');
      Alert.alert('Xác nhận thay đổi', label, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xác nhận', onPress: () => void act(work(), 'Đã cập nhật thành viên.') }]);
    };
    return <View style={styles.listPage}><SearchFilter search={ui.search} onSearch={(search) => dispatch({ type: 'search', search })} statuses={['all', 'ADMIN', 'USER']} status={ui.status} onStatus={(status) => dispatch({ type: 'status', status })} />
      <CardList data={page.items} keyOf={(item) => item.id} render={(item) => <Card><Card.Title title={item.username} subtitle={`${item.email} · ${item.role.name} · ${item.isLocked ? 'Đã khóa' : 'Hoạt động'}`} /><Card.Content><Text style={item.isVip ? styles.warning : styles.muted}>{item.isVip ? `VIP · hết hạn ${formatDate(item.vipExpiresAt)}` : 'Tài khoản thường'}</Text></Card.Content><Card.Actions>
        <Button disabled={item.id === user!.id} onPress={() => userAction(item.id, item.isLocked ? 'Mở khóa tài khoản này?' : 'Khóa tài khoản và thu hồi phiên?', () => lockMutation.mutateAsync(item.id))}>{item.isLocked ? 'Mở khóa' : 'Khóa'}</Button>
        <Button disabled={item.role.name === 'ADMIN'} onPress={() => userAction(item.id, item.isVip ? 'Tắt VIP theo ngữ nghĩa toggle của máy chủ?' : 'Bật VIP theo ngữ nghĩa toggle của máy chủ?', () => vipMutation.mutateAsync(item.id))}>{item.isVip ? 'Tắt VIP' : 'Bật VIP'}</Button>
        <Button disabled={item.id === user!.id} onPress={() => { const role = item.role.name === 'ADMIN' ? 'USER' : 'ADMIN'; userAction(item.id, `Đổi vai trò thành ${role}?`, () => roleMutation.mutateAsync({ id: item.id, role })); }}>{item.role.name === 'ADMIN' ? 'Hạ USER' : 'Nâng ADMIN'}</Button>
      </Card.Actions></Card>} /><PageControls page={page.page} totalPages={page.totalPages} onPage={(value) => dispatch({ type: 'page', page: value })} /></View>;
  };

  const ordersView = () => {
    if (orders.isLoading) return <Loading />; if (orders.error) return <ErrorBox error={orders.error} retry={() => void orders.refetch()} />;
    const page = filterAndPage(orders.data || [], ui.search, ui.status, (item) => `${item.orderCode} ${item.user?.username} ${item.user?.email}`, (item) => item.status, ui.localPage);
    return <View style={styles.listPage}><SearchFilter search={ui.search} onSearch={(search) => dispatch({ type: 'search', search })} statuses={statusValues(orders.data || [])} status={ui.status} onStatus={(status) => dispatch({ type: 'status', status })} /><CardList data={page.items} keyOf={(item) => item.id} render={(item) => <Card><Card.Title title={item.orderCode} subtitle={`${item.user?.username || '—'} · ${item.status}`} /><Card.Content><Text>{item.plan?.name} · {item.durationDays} ngày · {money(item.amount)}</Text><Text style={styles.muted}>{formatDate(item.createdAt)}</Text></Card.Content>{item.status === 'PENDING' ? <Card.Actions><Button textColor={colors.primarySoft} onPress={() => Alert.alert('Hủy đơn VIP?', item.orderCode, [{ text: 'Không' }, { text: 'Hủy đơn', style: 'destructive', onPress: () => void act(orderMutation.mutateAsync({ id: item.id, action: 'cancel' }), 'Đã hủy đơn.') }])}>Hủy</Button><Button mode="contained" onPress={() => Alert.alert('Xác nhận thanh toán?', 'VIP sẽ được cộng tự động và không cộng trùng.', [{ text: 'Không' }, { text: 'Xác nhận', onPress: () => void act(orderMutation.mutateAsync({ id: item.id, action: 'confirm' }), 'Đã xác nhận thanh toán.') }])}>Xác nhận</Button></Card.Actions> : null}</Card>} /><PageControls page={page.page} totalPages={page.totalPages} onPage={(value) => dispatch({ type: 'page', page: value })} /></View>;
  };

  const reportsView = () => {
    if (reports.isLoading) return <Loading />; if (reports.error) return <ErrorBox error={reports.error} retry={() => void reports.refetch()} />;
    const page = filterAndPage(reports.data || [], ui.search, ui.status, (item) => `${item.type} ${item.content} ${item.user?.username} ${item.movie?.title}`, (item) => item.status, ui.localPage);
    return <View style={styles.listPage}><SearchFilter search={ui.search} onSearch={(search) => dispatch({ type: 'search', search })} statuses={statusValues(reports.data || [])} status={ui.status} onStatus={(status) => dispatch({ type: 'status', status })} /><CardList data={page.items} keyOf={(item) => item.id} render={(item) => <Card><Card.Title title={item.type} subtitle={`${item.user?.username || '—'} · ${item.movie?.title || 'Không gắn phim'} · ${item.status}`} /><Card.Content><Text>{item.content}</Text><Text style={styles.muted}>{formatDate(item.createdAt)}</Text></Card.Content><Card.Actions><Button disabled={item.status === 'Resolved'} onPress={() => void act(reportMutation.mutateAsync({ id: item.id, status: 'Resolved' }), 'Đã xử lý báo cáo.')}>Giải quyết</Button><Button disabled={item.status === 'Ignored'} onPress={() => void act(reportMutation.mutateAsync({ id: item.id, status: 'Ignored' }), 'Đã bỏ qua báo cáo.')}>Bỏ qua</Button></Card.Actions></Card>} /><PageControls page={page.page} totalPages={page.totalPages} onPage={(value) => dispatch({ type: 'page', page: value })} /></View>;
  };

  const feedbackView = () => {
    if (feedback.isLoading) return <Loading />; if (feedback.error) return <ErrorBox error={feedback.error} retry={() => void feedback.refetch()} />;
    const page = filterAndPage(feedback.data || [], ui.search, ui.status, (item) => `${item.category} ${item.subject} ${item.content} ${item.user?.username}`, (item) => item.status, ui.localPage);
    return <View style={styles.listPage}><SearchFilter search={ui.search} onSearch={(search) => dispatch({ type: 'search', search })} statuses={statusValues(feedback.data || [])} status={ui.status} onStatus={(status) => dispatch({ type: 'status', status })} /><CardList data={page.items} keyOf={(item) => item.id} render={(item) => <Card><Card.Title title={item.subject} subtitle={`${item.category} · ${item.user?.username || '—'} · ${item.status}`} /><Card.Content><Text>{item.content}</Text>{item.adminReply ? <Text style={styles.success}>Phản hồi: {item.adminReply}</Text> : null}<Text style={styles.muted}>{formatDate(item.createdAt)}</Text></Card.Content><Card.Actions><Button onPress={() => setReply({ item, status: 'REVIEWING', text: item.adminReply || '' })}>Đang xem</Button><Button onPress={() => setReply({ item, status: 'REJECTED', text: item.adminReply || '' })}>Từ chối</Button><Button mode="contained" onPress={() => setReply({ item, status: 'RESOLVED', text: item.adminReply || '' })}>Phản hồi</Button></Card.Actions></Card>} /><PageControls page={page.page} totalPages={page.totalPages} onPage={(value) => dispatch({ type: 'page', page: value })} /></View>;
  };

  const sourcesView = () => {
    if (sources.isLoading) return <Loading />; if (sources.error) return <ErrorBox error={sources.error} retry={() => void sources.refetch()} />;
    const filtered = (sources.data?.sources || []).filter((item) => !ui.search || `${item.episode.movie.title} ${item.server} ${item.url}`.toLowerCase().includes(ui.search.toLowerCase()));
    return <View style={styles.listPage}><SearchFilter search={ui.search} onSearch={(search) => dispatch({ type: 'search', search })} /><View style={styles.between}><Text>{Object.entries(sources.data?.totals || {}).map(([key, value]) => `${key}: ${value}`).join(' · ')}</Text><Button mode="contained" loading={sourceMutation.isPending} onPress={() => void act(sourceMutation.mutateAsync(undefined), 'Đã kiểm tra tối đa 50 nguồn.')}>Kiểm tra tất cả</Button></View><CardList data={filtered} keyOf={(item) => item.id} render={(item) => <Card><Card.Title title={`${item.episode.movie.title} · Tập ${item.episode.episodeOrder}`} subtitle={`${item.server} · ${item.quality} · ${item.healthStatus}`} /><Card.Content><Text numberOfLines={2}>{item.url}</Text><Text style={item.healthStatus === 'healthy' ? styles.success : item.healthStatus === 'failed' ? styles.error : styles.muted}>{item.lastStatusCode || '—'} · {item.lastResponseTimeMs ?? '—'} ms · lỗi liên tiếp {item.consecutiveFailures}</Text>{item.lastError ? <Text style={styles.error}>{item.lastError}</Text> : null}<Text style={styles.muted}>{formatDate(item.lastCheckedAt)}</Text></Card.Content><Card.Actions><Button loading={sourceMutation.isPending} onPress={() => void act(sourceMutation.mutateAsync(item.id), 'Đã kiểm tra nguồn.')}>Kiểm tra</Button></Card.Actions></Card>} /></View>;
  };

  const metadataView = () => {
    if (metadata.isLoading) return <Loading />; if (metadata.error) return <ErrorBox error={metadata.error} retry={() => void metadata.refetch()} />;
    return <ScrollView contentContainerStyle={styles.scroll}><Card><Card.Title title="Quốc gia" subtitle="Chỉ đọc — API không có endpoint ghi" /><Card.Content style={styles.chips}>{metadata.data?.countries.map((item) => <Chip key={item.id}>{item.name} · {item.slug}</Chip>)}</Card.Content></Card><Card><Card.Title title="Thể loại" subtitle="Chỉ đọc — API không có endpoint ghi" /><Card.Content style={styles.chips}>{metadata.data?.genres.map((item) => <Chip key={item.id}>{item.name} · {item.slug}</Chip>)}</Card.Content></Card></ScrollView>;
  };

  const content = { dashboard: dashboardView, movies: movieView, episodes: episodeView, users: userView, vip: ordersView, reports: reportsView, feedback: feedbackView, sources: sourcesView, metadata: metadataView }[ui.section]();
  return <View style={styles.root}>
    <View style={[styles.nav, width >= 900 && styles.navTablet]}><ScrollView horizontal={width < 900} showsHorizontalScrollIndicator={false} contentContainerStyle={width >= 900 ? styles.navColumn : styles.navRow}>{sections.map((item) => <Chip key={item.key} selected={ui.section === item.key} onPress={() => dispatch({ type: 'section', section: item.key })} style={styles.navChip}>{item.label}</Chip>)}</ScrollView></View>
    <View style={[styles.content, width >= 900 && styles.contentTablet]}>{content}</View>
    <MovieFormModal visible={movieForm !== undefined} movie={movieForm} countries={metadata.data?.countries || []} genres={metadata.data?.genres || []} busy={movieMutation.isPending} onDismiss={() => setMovieForm(undefined)} onSubmit={submitMovie} />
    <EpisodeFormModal visible={episodeForm !== undefined} movieId={selectedMovieId} episode={episodeForm} busy={episodeMutation.isPending} onDismiss={() => setEpisodeForm(undefined)} onSubmit={submitEpisode} />
    <Portal><Dialog visible={Boolean(reply)} onDismiss={() => setReply(null)}><Dialog.Title>Cập nhật góp ý</Dialog.Title><Dialog.Content><TextInput mode="outlined" label="Phản hồi quản trị" multiline value={reply?.text || ''} onChangeText={(text) => setReply((current) => current ? { ...current, text } : null)} /></Dialog.Content><Dialog.Actions><Button onPress={() => setReply(null)}>Hủy</Button><Button loading={feedbackMutation.isPending} onPress={() => { if (!reply) return; void act(feedbackMutation.mutateAsync({ id: reply.item.id, status: reply.status, text: reply.text }).then(() => setReply(null)), 'Đã cập nhật góp ý.'); }}>Lưu</Button></Dialog.Actions></Dialog></Portal>
    {busy ? <View pointerEvents="none" style={styles.progress}><ActivityIndicator /></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  contentTablet: { marginLeft: 180 },
  nav: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  navTablet: { position: 'absolute', zIndex: 2, top: 0, bottom: 0, left: 0, width: 180, borderRightWidth: 1, borderRightColor: colors.border, borderBottomWidth: 0 },
  navRow: { padding: spacing.sm, gap: spacing.sm },
  navColumn: { padding: spacing.md, gap: spacing.sm, flexDirection: 'column', width: 180 },
  navChip: { minHeight: 44, justifyContent: 'center' },
  scroll: { padding: spacing.md, paddingBottom: 96, gap: spacing.md },
  listPage: { flex: 1, padding: spacing.md, gap: spacing.sm },
  filters: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  center: { flex: 1, minHeight: 260, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  muted: { color: colors.textMuted },
  error: { color: colors.primarySoft },
  success: { color: colors.success },
  warning: { color: colors.warning },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpisTablet: { gap: spacing.md },
  kpi: { minWidth: 145, flexGrow: 1 },
  stack: { gap: spacing.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 110, fontSize: 12 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  bar: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  pager: { minHeight: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  fab: { position: 'absolute', right: spacing.md, bottom: spacing.md },
  progress: { position: 'absolute', right: spacing.sm, top: spacing.sm, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceRaised },
});
