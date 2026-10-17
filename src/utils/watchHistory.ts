export const HISTORY_PREFIX = 'tsugi/history/event/';

export interface WatchEvent {
  id: string;
  mediaKey: string;
  title: string;
  url: string;
  image: string;
  fromEpisode: number;
  toEpisode: number;
  watchedAt: number;
  rewatchCount: number;
}

export type WatchProgress = Omit<WatchEvent, 'id' | 'watchedAt'>;

export function isWatchProgress(value: unknown): value is WatchProgress {
  if (!value || typeof value !== 'object') return false;
  const entry = value as WatchProgress;
  return (
    typeof entry.mediaKey === 'string' &&
    entry.mediaKey.length > 0 &&
    typeof entry.title === 'string' &&
    typeof entry.url === 'string' &&
    /^(https?:\/\/|local:\/\/)/.test(entry.url) &&
    typeof entry.image === 'string' &&
    Number.isInteger(entry.fromEpisode) &&
    Number.isInteger(entry.toEpisode) &&
    entry.fromEpisode >= 0 &&
    entry.toEpisode > entry.fromEpisode &&
    Number.isInteger(entry.rewatchCount) &&
    entry.rewatchCount >= 0
  );
}

export function isWatchEvent(value: unknown): value is WatchEvent {
  if (!isWatchProgress(value)) return false;
  const entry = value as WatchEvent;
  return (
    typeof entry.id === 'string' &&
    Number.isFinite(new Date(entry.watchedAt).getTime()) &&
    entry.watchedAt > 0
  );
}

export function sameRecentProgress(
  previous: WatchEvent | undefined,
  next: WatchProgress,
  now: number,
) {
  return !!(
    previous &&
    previous.mediaKey === next.mediaKey &&
    previous.fromEpisode === next.fromEpisode &&
    previous.toEpisode === next.toEpisode &&
    previous.rewatchCount === next.rewatchCount &&
    now >= previous.watchedAt &&
    now - previous.watchedAt < 60_000
  );
}

export function episodeLabel(entry: WatchProgress) {
  return entry.toEpisode - entry.fromEpisode === 1
    ? `Episode ${entry.toEpisode}`
    : `Episodes ${entry.fromEpisode + 1}–${entry.toEpisode} · progress update`;
}

export type HistoryGrouping = 'days' | 'months' | 'years';

export function groupWatchEvents(
  events: WatchEvent[],
  grouping: HistoryGrouping,
  locale?: string,
  today = new Date(),
) {
  const dayKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map<
    string,
    {
      key: string;
      title: string;
      subtitle: string;
      episodes: number;
      events: WatchEvent[];
    }
  >();
  const sorted = events
    .filter(isWatchEvent)
    .slice()
    .sort((a, b) => b.watchedAt - a.watchedAt);
  sorted.forEach(entry => {
    const date = new Date(entry.watchedAt);
    let key = dayKey(date);
    if (grouping === 'years') key = String(date.getFullYear());
    else if (grouping === 'months') key = key.slice(0, 7);
    if (!groups.has(key)) {
      let title: string;
      let subtitle = '';
      if (grouping === 'years') title = key;
      else if (grouping === 'months') {
        title = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
        subtitle = String(date.getFullYear());
      } else {
        if (key === dayKey(today)) title = 'Today';
        else if (key === dayKey(yesterday)) title = 'Yesterday';
        else title = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
        subtitle = new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(date);
      }
      groups.set(key, { key, title, subtitle, episodes: 0, events: [] });
    }
    const group = groups.get(key)!;
    group.events.push(entry);
    if (!('activity' in entry) && !('pending' in entry))
      group.episodes += entry.toEpisode - entry.fromEpisode;
  });
  return [...groups.values()];
}
