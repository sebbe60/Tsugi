import type { WatchEvent, WatchProgress } from './watchHistory';

export const PLAYBACK_PREFIX = 'tsugi/playback/';
export const SYNC_QUEUE_PREFIX = 'tsugi/sync-queue/';
export type SyncState = 'partial' | 'pending' | 'synced';
export type PlaybackCheckpoint = {
  mediaKey: string;
  title: string;
  url: string;
  image: string;
  episode: number;
  rewatchCount: number;
  watchUrl: string;
  position: number;
  duration: number;
  sessionId: string;
  startedAt: number;
};
export type PlaybackActivity = PlaybackCheckpoint & {
  updatedAt: number;
  syncState: SyncState;
  confirmedAt?: number;
};
export type SyncIntent = {
  entry: WatchProgress;
  status: number;
  startDate: string | null;
  finishDate: string | null;
};
export type PendingWatchSync = SyncIntent & {
  id: string;
  provider: string;
  account: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  state: 'sending' | 'pending' | 'blocked';
  reason: string;
  playbackSessionId?: string;
};
export type ActivityHistoryEntry = WatchEvent & {
  activity?: PlaybackActivity;
  pending?: PendingWatchSync;
};

export function playbackKey(
  entry: Pick<PlaybackCheckpoint, 'mediaKey' | 'episode' | 'rewatchCount'>,
) {
  return `${PLAYBACK_PREFIX}${entry.mediaKey}/${entry.rewatchCount}/${entry.episode}`;
}
export function isPlaybackCheckpoint(value: unknown): value is PlaybackCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const e = value as PlaybackCheckpoint;
  return (
    /^anime\/.+/.test(e.mediaKey) &&
    typeof e.title === 'string' &&
    typeof e.image === 'string' &&
    typeof e.sessionId === 'string' &&
    e.sessionId.length > 0 &&
    Number.isFinite(e.startedAt) &&
    e.startedAt > 0 &&
    /^(https?:\/\/|local:\/\/)/.test(e.url) &&
    /^https?:\/\//.test(e.watchUrl) &&
    Number.isInteger(e.episode) &&
    e.episode > 0 &&
    Number.isInteger(e.rewatchCount) &&
    e.rewatchCount >= 0 &&
    Number.isFinite(e.position) &&
    e.position >= 0 &&
    Number.isFinite(e.duration) &&
    e.duration > 60 &&
    e.position <= e.duration + 1
  );
}
export function isPlaybackActivity(value: unknown): value is PlaybackActivity {
  const e = value as PlaybackActivity;
  return (
    isPlaybackCheckpoint(e) &&
    Number.isFinite(e.updatedAt) &&
    e.updatedAt > 0 &&
    ['partial', 'pending', 'synced'].includes(e.syncState)
  );
}
export function playbackTime(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return `${minutes}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;
}
export function resumeActivityUrl(entry: PlaybackActivity) {
  const url = new URL(entry.watchUrl);
  url.searchParams.set('tsugi_resume', String(Math.floor(Math.max(0, entry.position - 3))));
  return url.href;
}
export function retryDelay(attempts: number) {
  return Math.min(60 * 60_000, 30_000 * 2 ** Math.min(attempts, 7));
}
export function mergeActivityHistory(
  events: WatchEvent[],
  activities: PlaybackActivity[],
  queue: PendingWatchSync[],
): ActivityHistoryEntry[] {
  const entries: ActivityHistoryEntry[] = [...events];
  activities.filter(isPlaybackActivity).forEach(activity => {
    const matched = events.some(
      event =>
        event.mediaKey === activity.mediaKey &&
        event.rewatchCount === activity.rewatchCount &&
        event.fromEpisode < activity.episode &&
        event.toEpisode >= activity.episode &&
        event.watchedAt >= activity.startedAt,
    );
    if (activity.syncState === 'synced' || matched) return;
    entries.push({
      id: playbackKey(activity),
      mediaKey: activity.mediaKey,
      title: activity.title,
      url: activity.url,
      image: activity.image,
      fromEpisode: activity.episode - 1,
      toEpisode: activity.episode,
      rewatchCount: activity.rewatchCount,
      watchedAt: activity.updatedAt,
      activity,
      pending: queue.find(
        item =>
          item.entry.mediaKey === activity.mediaKey &&
          item.entry.toEpisode === activity.episode &&
          item.entry.rewatchCount === activity.rewatchCount,
      ),
    });
  });
  // A durable sync can survive even if the last playback checkpoint could not be written.
  queue.forEach(item => {
    if (
      entries.some(
        e =>
          e.mediaKey === item.entry.mediaKey &&
          e.toEpisode === item.entry.toEpisode &&
          e.rewatchCount === item.entry.rewatchCount,
      )
    )
      return;
    entries.push({ ...item.entry, id: item.id, watchedAt: item.createdAt, pending: item });
  });
  return entries.sort((a, b) => b.watchedAt - a.watchedAt);
}
