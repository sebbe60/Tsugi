import { getSyncMode } from '../_provider/helper';
import { getSingle } from '../_provider/singleFactory';
import { status } from '../_provider/definitions';
import { recordSiteSync } from './siteHealth';
import { appendWatchHistory } from './watchHistory';
import { isWatchEvent, isWatchProgress, HISTORY_PREFIX } from '../utils/watchHistory';
import {
  isPlaybackCheckpoint,
  playbackKey,
  SYNC_QUEUE_PREFIX,
  PlaybackCheckpoint,
  PlaybackActivity,
  PendingWatchSync,
  SyncIntent,
  retryDelay,
} from '../utils/watchActivity';

let writing = Promise.resolve();
let running: Promise<void> | undefined;
function serialized<T>(fn: () => Promise<T>) {
  const result = writing.then(fn);
  writing = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function savePlayback(checkpoint: PlaybackCheckpoint) {
  return serialized(async () => {
    if (!isPlaybackCheckpoint(checkpoint) || checkpoint.position < 5) return { saved: false };
    const key = playbackKey(checkpoint);
    const previous = (await chrome.storage.local.get(key))[key] as PlaybackActivity | undefined;
    const entry: PlaybackActivity = {
      ...checkpoint,
      updatedAt: Date.now(),
      syncState:
        previous?.sessionId === checkpoint.sessionId || previous?.syncState === 'pending'
          ? previous?.syncState || 'partial'
          : 'partial',
      confirmedAt: previous?.sessionId === checkpoint.sessionId ? previous.confirmedAt : undefined,
    };
    if (
      previous?.sessionId === checkpoint.sessionId &&
      Math.abs(previous.position - entry.position) < 1
    )
      return { saved: true };
    await chrome.storage.local.set({ [key]: entry });
    return { saved: true };
  });
}

async function accountFingerprint(provider: string) {
  const keys = {
    ANILIST: 'anilistToken',
    MAL: 'malToken',
    MALAPI: 'malToken',
    KITSU: 'kitsuToken',
    SIMKL: 'simklToken',
    SHIKI: 'shikiToken',
    MANGABAKA: 'mangabakaToken',
  };
  const credential = await api.settings.getAsync(keys[provider]);
  // Never retry a queued write against a different sign-in. No tokens go into the queue.
  if (!credential) return '';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${provider}:${JSON.stringify(credential)}`),
  );
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}

export async function prepareWatchSync(intent: SyncIntent) {
  if (
    !isWatchProgress(intent?.entry) ||
    !/^anime\//.test(intent.entry.mediaKey) ||
    !/^https:\/\//.test(intent.entry.url) ||
    !Number.isInteger(intent.status)
  )
    return { id: '' };
  if (!api.settings.isInit.value) await api.settings.init();
  const provider = getSyncMode('anime');
  const account = await accountFingerprint(provider);
  if (!account) return { id: '' };
  return serialized(async () => {
    const id = `${provider}/${account}/${intent.entry.mediaKey}/${intent.entry.rewatchCount}/${intent.entry.toEpisode}`;
    const key = `${SYNC_QUEUE_PREFIX}${id}`;
    const existing = (await chrome.storage.local.get(key))[key] as PendingWatchSync | undefined;
    if (existing) {
      await chrome.storage.local.set({
        [key]: { ...existing, state: 'sending', nextAttemptAt: Date.now() + 5 * 60_000 },
      });
      return { id };
    }
    const item: PendingWatchSync = {
      ...intent,
      id,
      provider,
      account,
      createdAt: Date.now(),
      attempts: 0,
      nextAttemptAt: Date.now() + 5 * 60_000,
      state: 'sending',
      reason: '',
    };
    const pkey = playbackKey({ ...intent.entry, episode: intent.entry.toEpisode });
    const activity = (await chrome.storage.local.get(pkey))[pkey] as PlaybackActivity | undefined;
    item.playbackSessionId = activity?.sessionId;
    await chrome.storage.local.set({
      [key]: item,
      ...(activity ? { [pkey]: { ...activity, syncState: 'pending' } } : {}),
    });
    return { id };
  });
}

export function failWatchSync(id: string) {
  return serialized(async () => {
    const key = `${SYNC_QUEUE_PREFIX}${id}`;
    const item = (await chrome.storage.local.get(key))[key] as PendingWatchSync | undefined;
    if (item)
      await chrome.storage.local.set({
        [key]: {
          ...item,
          state: 'pending',
          nextAttemptAt: Date.now() + 30_000,
          reason: 'Waiting for the list service. Retrying automatically.',
        },
      });
    return { queued: !!item };
  });
}

export function cancelWatchSync(id: string) {
  return serialized(async () => {
    const key = `${SYNC_QUEUE_PREFIX}${id}`;
    const item = (await chrome.storage.local.get(key))[key] as PendingWatchSync | undefined;
    if (!item || item.state === 'sending') return { saved: false };
    const pkey = playbackKey({ ...item.entry, episode: item.entry.toEpisode });
    const activity = (await chrome.storage.local.get(pkey))[pkey] as PlaybackActivity | undefined;
    if (activity) await chrome.storage.local.set({ [pkey]: { ...activity, syncState: 'partial' } });
    await chrome.storage.local.remove(key);
    return { saved: true };
  });
}

export function completeWatchSync(id: string) {
  return serialized(async () => {
    const key = `${SYNC_QUEUE_PREFIX}${id}`;
    const store = await chrome.storage.local.get(null);
    const item = store[key] as PendingWatchSync | undefined;
    if (!item) return { saved: true };
    const alreadyRecorded = Object.entries(store).some(
      ([k, e]) =>
        k.startsWith(HISTORY_PREFIX) &&
        isWatchEvent(e) &&
        e.mediaKey === item.entry.mediaKey &&
        e.toEpisode === item.entry.toEpisode &&
        e.rewatchCount === item.entry.rewatchCount &&
        e.watchedAt >= item.createdAt - 1000,
    );
    if (!alreadyRecorded) await appendWatchHistory(item.entry, item.createdAt, `recovered/${id}`);
    const pkey = playbackKey({ ...item.entry, episode: item.entry.toEpisode });
    const activity = store[pkey] as PlaybackActivity | undefined;
    if (activity)
      await chrome.storage.local.set({
        [pkey]: {
          ...activity,
          syncState:
            !item.playbackSessionId || item.playbackSessionId === activity.sessionId
              ? 'synced'
              : 'partial',
          confirmedAt: Date.now(),
        },
      });
    if (activity)
      await recordSiteSync({ url: activity.watchUrl }, item.entry).catch(error =>
        con.error('Could not update site sync status', error),
      );
    await chrome.storage.local.remove(key);
    return { saved: true };
  });
}

async function recoverOne(item: PendingWatchSync) {
  const key = `${SYNC_QUEUE_PREFIX}${item.id}`;
  if (
    getSyncMode('anime') !== item.provider ||
    (await accountFingerprint(item.provider)) !== item.account
  ) {
    await chrome.storage.local.set({
      [key]: {
        ...item,
        state: 'blocked',
        reason: 'Sign-in changed. Kept locally; automatic retry is paused for this account.',
      },
    });
    return;
  }
  const single = getSingle(item.entry.url);
  try {
    await single.update();
    if (
      (single.getRewatchCount() || 0) !== item.entry.rewatchCount ||
      single.getEpisode() < item.entry.fromEpisode
    ) {
      await chrome.storage.local.set({
        [key]: {
          ...item,
          state: 'blocked',
          reason: 'List progress changed. Review this episode before syncing.',
        },
      });
      return;
    }
    if (item.status === Number(status.Rewatching) && single.getStatus() === status.Completed) {
      await chrome.storage.local.set({
        [key]: {
          ...item,
          state: 'blocked',
          reason: 'Rewatch status changed. Review this episode before syncing.',
        },
      });
      return;
    }
    if (single.getEpisode() < item.entry.toEpisode) {
      if (![status.Watching, status.Rewatching, status.PlanToWatch].includes(single.getStatus())) {
        await chrome.storage.local.set({
          [key]: {
            ...item,
            state: 'blocked',
            reason: 'List status changed. Review this episode before syncing.',
          },
        });
        return;
      }
      single.setEpisode(item.entry.toEpisode);
      // Preserve freshly fetched scores, notes, and any newer completion status.
      if (single.getStatus() === status.PlanToWatch || item.status === Number(status.Completed))
        single.setStatus(item.status);
      if (!single.getStartDate() && item.startDate) single.setStartDate(item.startDate);
      if (item.status === Number(status.Completed) && item.finishDate)
        single.setFinishDate(item.finishDate);
      single.setSyncMethod('listSync');
      await single.sync();
    }
    await completeWatchSync(item.id);
  } catch {
    await chrome.storage.local.set({
      [key]: {
        ...item,
        state: 'pending',
        attempts: item.attempts + 1,
        nextAttemptAt: Date.now() + retryDelay(item.attempts + 1),
        reason: 'Waiting for the list service. Retrying automatically.',
      },
    });
  } finally {
    single.destroy();
  }
}

export function retryWatchSyncs(force = false) {
  if (running) return running;
  running = (async () => {
    if (!api.settings.isInit.value) await api.settings.init();
    await writing;
    const store = await chrome.storage.local.get(null);
    const queue = Object.entries(store)
      .filter(([key]) => key.startsWith(SYNC_QUEUE_PREFIX))
      .map(([, value]) => value as PendingWatchSync)
      .filter(item => item?.id && isWatchProgress(item.entry))
      .sort((a, b) => a.createdAt - b.createdAt || a.entry.toEpisode - b.entry.toEpisode);
    await queue.reduce(async (before, item) => {
      await before;
      if (
        (item.state === 'blocked' && !force) ||
        (item.state === 'sending' && item.nextAttemptAt > Date.now()) ||
        (!force && item.nextAttemptAt > Date.now())
      )
        return;
      await recoverOne(item);
    }, Promise.resolve());
  })().finally(() => {
    running = undefined;
  });
  return running;
}

export function initWatchRecovery() {
  chrome.alarms.create('tsugiWatchRecovery', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'tsugiWatchRecovery')
      retryWatchSyncs().catch(error => con.error('Watch recovery failed', error));
  });
  // The periodic alarm survives tab closures; startup also recovers interrupted writes.
  retryWatchSyncs().catch(error => con.error('Watch recovery failed', error));
}
