import type { PlayerTime } from '../utils/player';
import type { WatchProgress } from '../utils/watchHistory';
import { SITE_HEALTH_PREFIX } from '../utils/tsugiSites';

const seen = new Map<string, number>();
let pending = Promise.resolve();
function hostname(sender: chrome.runtime.MessageSender) {
  try {
    const url = new URL(sender.tab?.url || sender.url || '');
    return /^https?:$/.test(url.protocol) ? url.hostname : '';
  } catch {
    return '';
  }
}
function save(host: string, update: object) {
  const task = pending.then(async () => {
    const key = `${SITE_HEALTH_PREFIX}${host}`;
    const previous = (await chrome.storage.local.get(key))[key] || {};
    await chrome.storage.local.set({ [key]: { ...previous, ...update } });
  });
  pending = task.catch(error => con.error('Site status could not save', error));
  return task;
}
export function recordSitePlayer(sender: chrome.runtime.MessageSender, item: PlayerTime) {
  const host = hostname(sender);
  if (
    !host ||
    !Number.isFinite(item.duration) ||
    item.duration <= 60 ||
    !Number.isFinite(item.current) ||
    item.current < 0
  )
    return Promise.resolve();
  const now = Date.now();
  if (now - (seen.get(host) || 0) < 15_000) return Promise.resolve();
  seen.set(host, now);
  return save(host, { playerSeenAt: now, progress: Math.min(1, item.current / item.duration) });
}
export function recordSiteSync(sender: chrome.runtime.MessageSender, entry: WatchProgress) {
  const host = hostname(sender);
  if (!host) return Promise.resolve();
  return save(host, { syncedAt: Date.now(), title: entry.title, episode: entry.toEpisode });
}
