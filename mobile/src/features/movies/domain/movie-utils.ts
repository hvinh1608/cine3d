import type { Comment, Episode } from '@/domain/models';

export function toggleMovieInCollection<T extends { id: string }>(items: T[], movie: T): T[] {
  return items.some((item) => item.id === movie.id)
    ? items.filter((item) => item.id !== movie.id)
    : [movie, ...items];
}

export function updateCommentTree(
  comments: Comment[],
  id: string,
  update: (comment: Comment) => Comment,
): Comment[] {
  return comments.map((comment) => {
    if (comment.id === id) return update(comment);
    return comment.replies?.some((reply) => reply.id === id)
      ? { ...comment, replies: updateCommentTree(comment.replies, id, update) }
      : comment;
  });
}

export function removeCommentFromTree(comments: Comment[], id: string): Comment[] {
  return comments
    .filter((comment) => comment.id !== id)
    .map((comment) => ({ ...comment, replies: removeCommentFromTree(comment.replies ?? [], id) }));
}

export function groupEpisodes(episodes: Episode[]): Map<number, Episode[]> {
  const grouped = new Map<number, Episode[]>();
  [...episodes]
    .sort((a, b) => (a.seasonNumber ?? 1) - (b.seasonNumber ?? 1) || a.episodeOrder - b.episodeOrder)
    .forEach((episode) => {
      const season = episode.seasonNumber ?? 1;
      grouped.set(season, [...(grouped.get(season) ?? []), episode]);
    });
  return grouped;
}

export function searchEpisodes(episodes: Episode[], query: string): Episode[] {
  const normalized = query.trim().toLocaleLowerCase('vi');
  if (!normalized) return episodes;
  return episodes.filter((episode) =>
    episode.title.toLocaleLowerCase('vi').includes(normalized)
    || String(episode.episodeOrder) === normalized,
  );
}

export function validateComment(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return 'Vui lòng nhập nội dung bình luận.';
  if (trimmed.length > 2000) return 'Bình luận không được vượt quá 2.000 ký tự.';
  return null;
}

export function validatePlaylistName(name: string): string | null {
  const length = name.trim().length;
  if (!length) return 'Vui lòng nhập tên playlist.';
  if (length > 60) return 'Tên playlist không được vượt quá 60 ký tự.';
  return null;
}
