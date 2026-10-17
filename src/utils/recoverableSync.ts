import type { SingleAbstract } from '../_provider/singleAbstract';

export class PendingWatchSyncError extends Error {
  constructor() {
    super('Playback saved. Waiting to sync with the list service.');
    this.name = 'PendingWatchSyncError';
  }
}
export async function syncWithRecovery(single: SingleAbstract) {
  let id = '';
  const previous = single.getHistoryStartEpisode();
  if (
    api.type === 'webextension' &&
    single.getType() === 'anime' &&
    previous !== undefined &&
    single.getEpisode() > previous
  ) {
    try {
      const result = await chrome.runtime.sendMessage({
        name: 'prepareWatchSync',
        intent: {
          entry: {
            mediaKey: `anime/${single.getCacheKey()}`,
            title: single.getTitle(),
            url: single.getUrl(),
            image: single.getImage(),
            fromEpisode: previous,
            toEpisode: single.getEpisode(),
            rewatchCount: single.getRewatchCount() || 0,
          },
          status: single.getStatus(),
          startDate: single.getStartDate(),
          finishDate: single.getFinishDate(),
        },
      });
      id = result?.id || '';
    } catch (error) {
      con.error('Could not persist sync recovery', error);
    }
  }
  try {
    await single.sync();
  } catch (error) {
    if (id) {
      const result = await chrome.runtime
        .sendMessage({ name: 'failWatchSync', id })
        .catch(() => null);
      if (result?.queued) throw new PendingWatchSyncError();
    }
    throw error;
  }
  if (id)
    await chrome.runtime
      .sendMessage({ name: 'completeWatchSync', id })
      .catch(error => con.error('Could not acknowledge synced episode', error));
}
