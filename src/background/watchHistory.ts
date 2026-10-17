import {
  HISTORY_PREFIX,
  isWatchEvent,
  isWatchProgress,
  sameRecentProgress,
  WatchEvent,
} from '../utils/watchHistory';

let pending = Promise.resolve();

/** One writer serializes duplicate checks; each event has its own atomic storage key. */
export function appendWatchHistory(value: unknown, watchedAt = Date.now(), eventId?: string) {
  const result = pending.then(async () => {
    if (!isWatchProgress(value)) return { recorded: false };
    const now = watchedAt;
    if (
      eventId &&
      (await chrome.storage.local.get(`${HISTORY_PREFIX}${eventId}`))[`${HISTORY_PREFIX}${eventId}`]
    )
      return { recorded: false };
    const headKey = `tsugi/history/head/${value.mediaKey}`;
    const previous = await api.storage.get(headKey);
    if (isWatchEvent(previous) && sameRecentProgress(previous, value, now)) {
      return { recorded: false };
    }
    const entry: WatchEvent = { ...value, id: eventId || crypto.randomUUID(), watchedAt: now };
    await chrome.storage.local.set({ [`${HISTORY_PREFIX}${entry.id}`]: entry, [headKey]: entry });
    return { recorded: true };
  });
  pending = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
