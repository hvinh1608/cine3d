import type { Episode, VideoSource } from '@/domain/models';
import {
  getNextEpisode,
  nextSource,
  orderSources,
  resolveEpisode,
  shouldAutoNext,
  shouldSaveProgress,
  transitionDownload,
} from './player-utils';

const source = (id: string, quality: string, type: VideoSource['type'] = 'hls'): VideoSource => ({
  id, quality, type, server: id, url: `https://video.test/${id}`,
});
const episode = (id: string, episodeOrder: number, sources: VideoSource[] = []): Episode => ({
  id, episodeOrder, title: `Tập ${episodeOrder}`, videoSources: sources,
});

describe('native player decisions', () => {
  test('resolves canonical episode number with ordered fallback', () => {
    const episodes = [episode('third', 3), episode('first', 1), episode('second', 2)];
    expect(resolveEpisode(episodes, 2)?.id).toBe('second');
    expect(resolveEpisode(episodes, 9)?.id).toBe('first');
    expect(resolveEpisode([], 1)).toBeNull();
  });

  test('orders sources by data preference and falls back exactly once per source', () => {
    const sources = [source('720', '720p'), source('1080', '1080p'), source('480', '480p', 'mp4')];
    expect(orderSources(sources, false).map((item) => item.id)).toEqual(['1080', '720', '480']);
    expect(orderSources(sources, true).map((item) => item.id)).toEqual(['720', '1080', '480']);
    expect(nextSource(sources, '720')?.id).toBe('1080');
    expect(nextSource(sources, '480')).toBeNull();
  });

  test('throttles remote progress saves', () => {
    expect(shouldSaveProgress(10_000, 39_999)).toBe(false);
    expect(shouldSaveProgress(10_000, 40_000)).toBe(true);
  });

  test('enforces valid download state transitions', () => {
    expect(transitionDownload('idle', 'queue')).toBe('queued');
    expect(transitionDownload('queued', 'start')).toBe('downloading');
    expect(transitionDownload('downloading', 'pause')).toBe('paused');
    expect(transitionDownload('paused', 'resume')).toBe('downloading');
    expect(transitionDownload('downloading', 'complete')).toBe('completed');
    expect(() => transitionDownload('completed', 'resume')).toThrow('Invalid download transition');
  });

  test('auto-next requires preference, next episode, and end threshold', () => {
    expect(shouldAutoNext(97, 100, true, true)).toBe(true);
    expect(shouldAutoNext(96, 100, true, true)).toBe(false);
    expect(shouldAutoNext(100, 100, false, true)).toBe(false);
    expect(shouldAutoNext(100, 100, true, false)).toBe(false);
    expect(getNextEpisode([episode('2', 2), episode('1', 1)], '1')?.id).toBe('2');
  });
});
