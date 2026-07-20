import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { colors, radius, spacing } from '@/theme';
import type { AdminEpisode, AdminMovie, EpisodeInput, MetaEntity, MovieInput, SubtitleInput, VideoSourceInput } from '../domain/types';
import { hasErrors, validateEpisode, validateMovie, type ValidationErrors } from '../domain/validation';
import { useAccessibilityPreferences } from '@/core/accessibility';

const emptyMovie = (): MovieInput => ({
  title: '', englishTitle: '', slug: '', description: '', posterUrl: '', backdropUrl: '', trailerUrl: '',
  releaseYear: new Date().getFullYear(), duration: 120, countryId: '', quality: 'FHD', isSeries: false,
  isDubbed: false, status: 'Completed', isFeatured: false, isTrending: false, isProposed: false, isVip: false,
  vipEarlyAccessUntil: null, genreIds: [],
});
const movieInput = (movie?: AdminMovie | null): MovieInput => movie ? {
  title: movie.title, englishTitle: movie.englishTitle || '', slug: movie.slug, description: movie.description || '',
  posterUrl: movie.posterUrl || '', backdropUrl: movie.backdropUrl || '', trailerUrl: movie.trailerUrl || '',
  releaseYear: movie.releaseYear, duration: movie.duration, countryId: movie.countryId, quality: movie.quality,
  isSeries: movie.isSeries, isDubbed: Boolean(movie.isDubbed), status: movie.status, isFeatured: movie.isFeatured,
  isTrending: movie.isTrending, isProposed: movie.isProposed, isVip: movie.isVip,
  vipEarlyAccessUntil: movie.vipEarlyAccessUntil || null, genreIds: movie.movieGenres.map((item) => item.genreId),
} : emptyMovie();

function Field({ label, value, onChange, error, multiline, keyboardType = 'default' }: {
  label: string; value: string; onChange(value: string): void; error?: string; multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'url';
}) {
  return <View><TextInput mode="outlined" label={label} value={value} onChangeText={onChange} error={Boolean(error)}
    multiline={multiline} keyboardType={keyboardType} autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
    accessibilityLabel={label} style={multiline ? styles.multiline : undefined} />
    {error ? <HelperText accessibilityRole="alert" accessibilityLiveRegion="polite" type="error">{error}</HelperText> : null}</View>;
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <View style={styles.toggle}><Text style={styles.grow}>{label}</Text><Switch accessibilityRole="switch" value={value} onValueChange={onChange} accessibilityLabel={label} /></View>;
}

export function MovieFormModal({ visible, movie, countries, genres, busy, onDismiss, onSubmit }: {
  visible: boolean; movie?: AdminMovie | null; countries: MetaEntity[]; genres: MetaEntity[]; busy: boolean;
  onDismiss(): void; onSubmit(input: MovieInput): void;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [form, setForm] = useState(emptyMovie);
  const [errors, setErrors] = useState<ValidationErrors>({});
  useEffect(() => { if (visible) { const next = movieInput(movie); if (!next.countryId) next.countryId = countries[0]?.id || ''; setForm(next); setErrors({}); } }, [visible, movie, countries]);
  const patch = <K extends keyof MovieInput>(key: K, value: MovieInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => { if (busy) return; const next = validateMovie(form); setErrors(next); if (!hasErrors(next)) onSubmit(form); };
  return <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onDismiss}>
    <KeyboardAvoidingView accessibilityViewIsModal style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}><Text variant="titleLarge">{movie ? 'Sửa phim' : 'Tạo phim'}</Text><Button onPress={onDismiss}>Đóng</Button></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
        <Field label="Tên phim *" value={form.title} onChange={(v) => patch('title', v)} error={errors.title} />
        <Field label="Tên tiếng Anh" value={form.englishTitle} onChange={(v) => patch('englishTitle', v)} />
        <Field label="Slug *" value={form.slug} onChange={(v) => patch('slug', v.toLowerCase())} error={errors.slug} />
        <Field label="Mô tả *" value={form.description} onChange={(v) => patch('description', v)} error={errors.description} multiline />
        <Field label="Poster URL *" value={form.posterUrl} onChange={(v) => patch('posterUrl', v)} error={errors.posterUrl} keyboardType="url" />
        <Field label="Backdrop URL *" value={form.backdropUrl} onChange={(v) => patch('backdropUrl', v)} error={errors.backdropUrl} keyboardType="url" />
        <Field label="Trailer URL" value={form.trailerUrl} onChange={(v) => patch('trailerUrl', v)} error={errors.trailerUrl} keyboardType="url" />
        <View style={styles.row}>
          <View style={styles.grow}><Field label="Năm *" value={String(form.releaseYear)} onChange={(v) => patch('releaseYear', Number(v))} error={errors.releaseYear} keyboardType="numeric" /></View>
          <View style={styles.grow}><Field label="Phút *" value={String(form.duration)} onChange={(v) => patch('duration', Number(v))} error={errors.duration} keyboardType="numeric" /></View>
        </View>
        <Text variant="labelLarge">Quốc gia *</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {countries.map((item) => <Chip key={item.id} selected={form.countryId === item.id} onPress={() => patch('countryId', item.id)}>{item.name}</Chip>)}
        </ScrollView>{errors.countryId ? <HelperText type="error">{errors.countryId}</HelperText> : null}
        <Text variant="labelLarge">Thể loại</Text><View style={styles.chips}>{genres.map((item) => <Chip key={item.id} selected={form.genreIds.includes(item.id)} onPress={() => patch('genreIds', form.genreIds.includes(item.id) ? form.genreIds.filter((id) => id !== item.id) : [...form.genreIds, item.id])}>{item.name}</Chip>)}</View>
        <Text variant="labelLarge">Trạng thái</Text><SegmentedButtons value={form.status} onValueChange={(v) => patch('status', v)} buttons={[{ value: 'Completed', label: 'Xong' }, { value: 'Ongoing', label: 'Đang phát' }, { value: 'Upcoming', label: 'Sắp chiếu' }]} />
        <Text variant="labelLarge">Chất lượng</Text><SegmentedButtons value={form.quality} onValueChange={(v) => patch('quality', v)} buttons={['HD', 'FHD', '2K', '4K'].map((value) => ({ value, label: value }))} />
        <Toggle label="Phim bộ" value={form.isSeries} onChange={(v) => patch('isSeries', v)} />
        <Toggle label="Thuyết minh" value={form.isDubbed} onChange={(v) => patch('isDubbed', v)} />
        <Toggle label="Nổi bật" value={form.isFeatured} onChange={(v) => patch('isFeatured', v)} />
        <Toggle label="Xu hướng" value={form.isTrending} onChange={(v) => patch('isTrending', v)} />
        <Toggle label="Đề xuất" value={form.isProposed} onChange={(v) => patch('isProposed', v)} />
        <Toggle label="VIP" value={form.isVip} onChange={(v) => patch('isVip', v)} />
        <Field label="VIP xem sớm đến (ISO 8601)" value={form.vipEarlyAccessUntil || ''} onChange={(v) => patch('vipEarlyAccessUntil', v || null)} error={errors.vipEarlyAccessUntil} />
        <Button mode="contained" loading={busy} disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={submit}>{movie ? 'Lưu thay đổi' : 'Tạo phim'}</Button>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

const emptySource = (): VideoSourceInput => ({ server: 'Main Server', quality: '1080p', url: '', type: 'hls', isPremium: false });
const emptySubtitle = (): SubtitleInput => ({ language: 'Vietnamese', url: '' });
const episodeInput = (movieId: string, episode?: AdminEpisode | null): EpisodeInput => ({
  movieId, title: episode?.title || '', episodeOrder: episode?.episodeOrder || 1, seasonNumber: episode?.seasonNumber || 1,
  airDate: episode?.airDate || null, introEndSeconds: episode?.introEndSeconds ?? null, outroStartSeconds: episode?.outroStartSeconds ?? null,
  videoSources: episode?.videoSources?.map((item) => ({ ...item, type: item.type === 'mp4' ? 'mp4' : 'hls', isPremium: Boolean(item.isPremium) })) || [emptySource()],
  subtitles: episode?.subtitles?.map((item) => ({ ...item })) || [],
});

export function EpisodeFormModal({ visible, movieId, episode, busy, onDismiss, onSubmit }: {
  visible: boolean; movieId: string; episode?: AdminEpisode | null; busy: boolean; onDismiss(): void; onSubmit(input: EpisodeInput): void;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [form, setForm] = useState(() => episodeInput(movieId));
  const [errors, setErrors] = useState<ValidationErrors>({});
  useEffect(() => { if (visible) { setForm(episodeInput(movieId, episode)); setErrors({}); } }, [visible, movieId, episode]);
  const patch = <K extends keyof EpisodeInput>(key: K, value: EpisodeInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => { if (busy) return; const next = validateEpisode(form); setErrors(next); if (!hasErrors(next)) onSubmit(form); };
  const sourcePatch = <K extends keyof VideoSourceInput>(index: number, key: K, value: VideoSourceInput[K]) => patch('videoSources', form.videoSources.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const subtitlePatch = <K extends keyof SubtitleInput>(index: number, key: K, value: SubtitleInput[K]) => patch('subtitles', form.subtitles.map((item, i) => i === index ? { ...item, [key]: value } : item));
  return <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onDismiss}>
    <KeyboardAvoidingView accessibilityViewIsModal style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}><Text variant="titleLarge">{episode ? 'Sửa tập phim' : 'Tạo tập phim'}</Text><Button onPress={onDismiss}>Đóng</Button></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
        <Field label="Tên tập *" value={form.title} onChange={(v) => patch('title', v)} error={errors.title} />
        <View style={styles.row}><View style={styles.grow}><Field label="Số tập *" value={String(form.episodeOrder)} onChange={(v) => patch('episodeOrder', Number(v))} error={errors.episodeOrder} keyboardType="numeric" /></View><View style={styles.grow}><Field label="Phần *" value={String(form.seasonNumber)} onChange={(v) => patch('seasonNumber', Number(v))} error={errors.seasonNumber} keyboardType="numeric" /></View></View>
        <Field label="Ngày phát (ISO 8601)" value={form.airDate || ''} onChange={(v) => patch('airDate', v || null)} error={errors.airDate} />
        <View style={styles.row}><View style={styles.grow}><Field label="Kết thúc intro (giây)" value={form.introEndSeconds === null ? '' : String(form.introEndSeconds)} onChange={(v) => patch('introEndSeconds', v === '' ? null : Number(v))} error={errors.introEndSeconds} keyboardType="numeric" /></View><View style={styles.grow}><Field label="Bắt đầu outro (giây)" value={form.outroStartSeconds === null ? '' : String(form.outroStartSeconds)} onChange={(v) => patch('outroStartSeconds', v === '' ? null : Number(v))} error={errors.outroStartSeconds} keyboardType="numeric" /></View></View>
        <Text variant="titleMedium">Nguồn phát</Text>{errors.videoSources ? <HelperText type="error">{errors.videoSources}</HelperText> : null}
        {form.videoSources.map((source, index) => <View key={source.id || index} style={styles.nested}>
          <Field label="Server *" value={source.server} onChange={(v) => sourcePatch(index, 'server', v)} error={errors[`source.${index}.server`]} />
          <Field label="Chất lượng *" value={source.quality} onChange={(v) => sourcePatch(index, 'quality', v)} error={errors[`source.${index}.quality`]} />
          <Field label="URL *" value={source.url} onChange={(v) => sourcePatch(index, 'url', v)} error={errors[`source.${index}.url`]} keyboardType="url" />
          <SegmentedButtons value={source.type} onValueChange={(v) => sourcePatch(index, 'type', v as 'hls' | 'mp4')} buttons={[{ value: 'hls', label: 'HLS' }, { value: 'mp4', label: 'MP4' }]} />
          <Toggle label="Nguồn Premium" value={source.isPremium} onChange={(v) => sourcePatch(index, 'isPremium', v)} />
          {form.videoSources.length > 1 ? <Button textColor={colors.primarySoft} onPress={() => patch('videoSources', form.videoSources.filter((_, i) => i !== index))}>Xóa nguồn</Button> : null}
        </View>)}
        <Button mode="outlined" onPress={() => patch('videoSources', [...form.videoSources, emptySource()])}>Thêm nguồn phát</Button>
        <Text variant="titleMedium">Phụ đề</Text>{form.subtitles.map((subtitle, index) => <View key={subtitle.id || index} style={styles.nested}>
          <Field label="Ngôn ngữ *" value={subtitle.language} onChange={(v) => subtitlePatch(index, 'language', v)} error={errors[`subtitle.${index}.language`]} />
          <Field label="URL phụ đề *" value={subtitle.url} onChange={(v) => subtitlePatch(index, 'url', v)} error={errors[`subtitle.${index}.url`]} keyboardType="url" />
          <Button textColor={colors.primarySoft} onPress={() => patch('subtitles', form.subtitles.filter((_, i) => i !== index))}>Xóa phụ đề</Button>
        </View>)}
        <Button mode="outlined" onPress={() => patch('subtitles', [...form.subtitles, emptySubtitle()])}>Thêm phụ đề</Button>
        <Button mode="contained" loading={busy} disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={submit}>{episode ? 'Lưu tập phim' : 'Tạo tập phim'}</Button>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  form: { padding: spacing.md, paddingBottom: 64, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  multiline: { minHeight: 100 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  nested: { padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
});
