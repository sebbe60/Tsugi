import type { listElement } from '../_provider/listAbstract';
import type { WatchEvent } from './watchHistory';
import { isReleased, orderLibrary } from './releaseDates';

/** Only known released episodes qualify; a season total is not an airing count. */
export function availableEpisodes(item: listElement, now = Date.now()): number {
  if (item.type !== 'anime' || !isReleased(item)) return 0;
  const finished =
    ['2', 'finished', 'finished_airing'].includes(String(item.airingState).toLowerCase()) ||
    item.fn.progress?.isFinished();
  if (finished && Number.isFinite(item.totalEp) && item.totalEp > 0) return item.totalEp;
  const schedule = item.nextAiring;
  if (
    schedule &&
    Number.isInteger(schedule.episode) &&
    schedule.episode > 0 &&
    Number.isFinite(schedule.timestamp)
  ) {
    // A past schedule proves that scheduled episode aired; it does not prove any later episodes did.
    return Math.max(0, schedule.episode - (schedule.timestamp > now ? 1 : 0));
  }
  const released = item.fn.progress?.progress()?.getCurrentEpisode();
  return Number.isFinite(released) && Number(released) > 0 ? Number(released) : 0;
}
export function featuredWatching(items: listElement[], events: WatchEvent[], now = Date.now()) {
  const recent = (item: listElement) =>
    Math.max(
      0,
      ...events
        .filter(event => event.mediaKey === `anime/${item.cacheKey}` || event.url === item.url)
        .map(event => event.watchedAt),
    );
  return (
    items
      .filter(item => item.status === 1 && availableEpisodes(item, now) > item.watchedEp)
      .sort(
        (a, b) =>
          recent(b) - recent(a) ||
          (b.updatedAt || 0) - (a.updatedAt || 0) ||
          a.title.localeCompare(b.title),
      )[0] || null
  );
}
export function featuredPlanned(items: listElement[]) {
  return (
    orderLibrary(
      items.filter(item => item.type === 'anime' && item.status === 6 && isReleased(item)),
      'planned',
    )[0] || null
  );
}
