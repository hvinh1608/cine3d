import type { Comment, Episode, Movie } from '@/domain/models';
import { groupEpisodes, searchEpisodes, toggleMovieInCollection, updateCommentTree, validateComment, validatePlaylistName } from './movie-utils';

const movie = (id: string): Movie => ({
  id, slug: id, title: id, posterUrl: '', backdropUrl: '', releaseYear: 2026,
  quality: 'HD', ratingAvg: 0, isSeries: false, episodeCount: 1,
});
const episode = (id: string, order: number, seasonNumber: number, title = `Tập ${order}`): Episode => ({
  id, episodeOrder: order, seasonNumber, title, videoSources: [],
});

describe('movie optimistic helpers', () => {
  it('adds and removes a movie without mutating the source', () => {
    const source = [movie('a')];
    expect(toggleMovieInCollection(source, movie('b')).map((item) => item.id)).toEqual(['b', 'a']);
    expect(toggleMovieInCollection(source, movie('a'))).toEqual([]);
    expect(source).toHaveLength(1);
  });

  it('updates a nested reply', () => {
    const reply = { id: 'reply', content: 'x', movieId: 'm', user: { id: 'u', username: 'u', isVip: false }, isSpoiler: false, isPinned: false, likesCount: 0, isLiked: false, createdAt: '' } as Comment;
    const root = { ...reply, id: 'root', replies: [reply] };
    const result = updateCommentTree([root], 'reply', (item) => ({ ...item, isLiked: true, likesCount: 1 }));
    expect(result[0]?.replies?.[0]).toMatchObject({ isLiked: true, likesCount: 1 });
    expect(root.replies?.[0]?.isLiked).toBe(false);
  });
});

describe('episode grouping and search', () => {
  const episodes = [episode('s2e2', 2, 2), episode('s1e2', 2, 1), episode('s1e1', 1, 1, 'Khởi đầu')];

  it('groups and sorts by season and order', () => {
    const grouped = groupEpisodes(episodes);
    expect([...grouped.keys()]).toEqual([1, 2]);
    expect(grouped.get(1)?.map((item) => item.id)).toEqual(['s1e1', 's1e2']);
  });

  it('searches title or exact episode number', () => {
    expect(searchEpisodes(episodes, 'khởi').map((item) => item.id)).toEqual(['s1e1']);
    expect(searchEpisodes(episodes, '2')).toHaveLength(2);
  });
});

describe('validation', () => {
  expect(validateComment('   ')).toBeTruthy();
  expect(validateComment('a'.repeat(2001))).toBeTruthy();
  expect(validateComment('Nội dung hợp lệ')).toBeNull();
  expect(validatePlaylistName('')).toBeTruthy();
  expect(validatePlaylistName('a'.repeat(61))).toBeTruthy();
  expect(validatePlaylistName('Cuối tuần')).toBeNull();
});
