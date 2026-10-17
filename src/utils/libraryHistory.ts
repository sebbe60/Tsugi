import type { listElement } from '../_provider/listAbstract';
import { groupWatchEvents, HistoryGrouping, WatchEvent } from './watchHistory';

/** Calendar dates stay local; partial or impossible dates never become January 1. */
export function completionTimestamp(value: string | null | undefined): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 0;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (
    year < 100 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return 0;
  return date.getTime();
}

export function completedEntries(items: listElement[]): WatchEvent[] {
  return items
    .filter(item => item.type === 'anime' && item.status === 2)
    .map(item => ({
      id: `completed/${item.uid}`,
      mediaKey: String(item.cacheKey),
      title: item.title,
      url: item.url,
      image: item.imageLarge || item.image,
      watchedAt: completionTimestamp(
        item.completionDate !== undefined ? item.completionDate : item.finishDate,
      ),
      fromEpisode: 0,
      toEpisode: 1,
      rewatchCount: item.rewatchCount || 0,
    }))
    .sort((a, b) => b.watchedAt - a.watchedAt || a.title.localeCompare(b.title));
}

export function groupCompletedEntries(entries: WatchEvent[], grouping: HistoryGrouping) {
  const groups = groupWatchEvents(
    entries.filter(entry => entry.watchedAt > 0),
    grouping,
  );
  const undated = entries.filter(entry => !entry.watchedAt);
  if (undated.length)
    groups.push({
      key: 'undated',
      title: 'Completion date not set',
      subtitle: 'No exact finish date saved in your list',
      episodes: 0,
      events: undated,
    });
  return groups;
}

export function releaseCountdown(timestamp: number, now: number) {
  const minutes = Math.ceil((timestamp - now) / 60_000);
  if (minutes <= 0) return 'Schedule updating';
  if (minutes < 60) return `In ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `In ${hours}h ${minutes % 60}m`;
  return `In ${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function nextRelease(item: listElement, now: number, predictionsEnabled = true) {
  const state = String(item.airingState || '').toLowerCase();
  const finished =
    ['finished', 'finished_airing', '2'].includes(state) || item.fn.progress?.isFinished();
  if (finished)
    return {
      label: 'All episodes released',
      detail: 'Watch at your own pace',
      timestamp: 0,
      episode: null,
      estimated: false,
    };
  const schedule = item.nextAiring;
  if (
    schedule &&
    Number.isFinite(schedule.timestamp) &&
    schedule.timestamp > now &&
    Number.isInteger(schedule.episode) &&
    schedule.episode >= 0
  ) {
    return {
      label: releaseCountdown(schedule.timestamp, now),
      detail: 'Scheduled airing · AniList',
      ...schedule,
      estimated: false,
    };
  }
  const progress = item.fn.progress?.progress();
  const prediction = predictionsEnabled ? progress?.getPredictionTimestamp() : NaN;
  if (prediction && Number.isFinite(prediction) && prediction > now) {
    const current = progress?.getCurrentEpisode();
    return {
      label: releaseCountdown(prediction, now),
      detail: 'Estimated release',
      timestamp: prediction,
      episode: current ? current + 1 : null,
      estimated: true,
    };
  }
  return {
    label: 'Date not announced',
    detail: 'Next episode',
    timestamp: 0,
    episode: null,
    estimated: false,
  };
}
