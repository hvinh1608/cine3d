import type { BulkEpisodeInput, EpisodeInput, MovieInput, SubtitleInput, VideoSourceInput } from './types';

export type ValidationErrors = Record<string, string>;
const isUrl = (value: string) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};
const validDate = (value: string | null) => !value || !Number.isNaN(new Date(value).getTime());

export function validateMovie(input: MovieInput): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!input.title.trim()) errors.title = 'Tên phim là bắt buộc.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) errors.slug = 'Slug chỉ gồm chữ thường, số và dấu gạch nối.';
  if (!input.description.trim()) errors.description = 'Mô tả là bắt buộc.';
  if (!isUrl(input.posterUrl)) errors.posterUrl = 'URL poster không hợp lệ.';
  if (!isUrl(input.backdropUrl)) errors.backdropUrl = 'URL backdrop không hợp lệ.';
  if (input.trailerUrl && !isUrl(input.trailerUrl)) errors.trailerUrl = 'URL trailer không hợp lệ.';
  if (!Number.isInteger(input.releaseYear) || input.releaseYear < 1888 || input.releaseYear > 2100) errors.releaseYear = 'Năm phát hành không hợp lệ.';
  if (!Number.isInteger(input.duration) || input.duration < 1) errors.duration = 'Thời lượng phải lớn hơn 0.';
  if (!input.countryId) errors.countryId = 'Hãy chọn quốc gia.';
  if (!validDate(input.vipEarlyAccessUntil)) errors.vipEarlyAccessUntil = 'Ngày xem sớm không hợp lệ.';
  return errors;
}

function validateSources(sources: VideoSourceInput[], subtitles: SubtitleInput[], errors: ValidationErrors) {
  if (!sources.length) errors.videoSources = 'Cần ít nhất một nguồn phát.';
  sources.forEach((source, index) => {
    if (!source.server.trim()) errors[`source.${index}.server`] = 'Tên server là bắt buộc.';
    if (!source.quality.trim()) errors[`source.${index}.quality`] = 'Chất lượng là bắt buộc.';
    if (!isUrl(source.url)) errors[`source.${index}.url`] = 'URL nguồn phát không hợp lệ.';
    if (!['hls', 'mp4'].includes(source.type)) errors[`source.${index}.type`] = 'Loại nguồn không hợp lệ.';
  });
  subtitles.forEach((subtitle, index) => {
    if (!subtitle.language.trim()) errors[`subtitle.${index}.language`] = 'Ngôn ngữ là bắt buộc.';
    if (!isUrl(subtitle.url)) errors[`subtitle.${index}.url`] = 'URL phụ đề không hợp lệ.';
  });
}

export function validateEpisode(input: EpisodeInput): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!input.movieId) errors.movieId = 'Hãy chọn phim.';
  if (!input.title.trim()) errors.title = 'Tên tập là bắt buộc.';
  if (!Number.isInteger(input.episodeOrder) || input.episodeOrder < 1) errors.episodeOrder = 'Số tập phải là số nguyên dương.';
  if (!Number.isInteger(input.seasonNumber) || input.seasonNumber < 1) errors.seasonNumber = 'Phần phải là số nguyên dương.';
  if (!validDate(input.airDate)) errors.airDate = 'Ngày phát không hợp lệ.';
  if (input.introEndSeconds !== null && input.introEndSeconds < 0) errors.introEndSeconds = 'Mốc intro không được âm.';
  if (input.outroStartSeconds !== null && input.outroStartSeconds < 0) errors.outroStartSeconds = 'Mốc outro không được âm.';
  if (input.introEndSeconds !== null && input.outroStartSeconds !== null && input.introEndSeconds >= input.outroStartSeconds) {
    errors.outroStartSeconds = 'Mốc outro phải sau mốc intro.';
  }
  validateSources(input.videoSources, input.subtitles, errors);
  return errors;
}

export function parseBulkEpisodes(text: string, server: string, quality: string, isPremium = false) {
  const errors: ValidationErrors = {};
  const rows: BulkEpisodeInput[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 100) errors.rows = 'Nhập từ 1 đến 100 tập.';
  lines.forEach((line, index) => {
    const [season, order, title, url, airDate = ''] = line.split('|').map((value) => value.trim());
    const row = index + 1;
    if (!Number.isInteger(Number(season)) || Number(season) < 1 || !Number.isInteger(Number(order)) || Number(order) < 1 || !title || !url || !isUrl(url) || !validDate(airDate || null)) {
      errors[`row.${row}`] = `Dòng ${row} không hợp lệ.`;
      return;
    }
    rows.push({ seasonNumber: Number(season), episodeOrder: Number(order), title, url, airDate: airDate || null, server: server.trim() || 'Main Server', quality: quality.trim() || '1080p', type: url.toLowerCase().includes('.mp4') ? 'mp4' : 'hls', isPremium });
  });
  if (new Set(rows.map((row) => row.episodeOrder)).size !== rows.length) errors.duplicates = 'Số tập trong danh sách bị trùng.';
  return { rows, errors };
}

export const hasErrors = (errors: ValidationErrors) => Object.keys(errors).length > 0;
