<template>
  <section class="history" :class="`grouping-${grouping}`" aria-label="Watch history">
    <header class="history-heading">
      <div class="history-view-control grouping-control" role="group" aria-label="History type">
        <button type="button" :aria-pressed="!completed" @click="completed = false">
          All activity
        </button>
        <button type="button" :aria-pressed="completed" @click="completed = true">
          Completed series
        </button>
        <button v-if="completed" type="button" aria-label="Refresh completed history" @click="load">
          ↻
        </button>
      </div>
      <div class="grouping-control" role="group" aria-label="Group watch history">
        <button
          v-for="mode in modes"
          :key="mode"
          type="button"
          :aria-pressed="grouping === mode"
          @click="grouping = mode"
        >
          {{ mode[0].toUpperCase() + mode.slice(1) }}
        </button>
      </div>
    </header>

    <div v-if="pendingSyncs.length && !completed" class="pending-syncs" role="status">
      <div>
        <strong
          >{{ pendingSyncs.length }}
          {{ pendingSyncs.length === 1 ? 'episode waiting' : 'episodes waiting' }} to sync</strong
        >
        <span>{{
          pendingSyncs.some(item => item.state === 'blocked')
            ? 'Some updates need attention. Open the episode to review your sign-in or list progress.'
            : 'Saved on this browser. Tsugi retries automatically, even after you close the player.'
        }}</span>
      </div>
      <button type="button" :disabled="retrying" @click="retrySyncs">
        {{ retrying ? 'Retrying…' : 'Retry syncs' }}
      </button>
    </div>
    <div
      v-if="!completed && pendingSyncs.some(item => item.state === 'blocked')"
      class="sync-review"
    >
      <div v-for="item in pendingSyncs.filter(value => value.state === 'blocked')" :key="item.id">
        <p>
          <strong>{{ item.entry.title }} · EP {{ item.entry.toEpisode }}</strong
          ><span>{{ item.reason }}</span>
        </p>
        <button type="button" @click="keepLocal(item.id)">Keep local only</button>
      </div>
    </div>
    <p v-if="error" class="history-message" role="alert">
      History couldn’t load. <button type="button" @click="load">Try again</button>
    </p>
    <p v-else-if="loading" class="history-message" role="status">Loading your watch history…</p>
    <div v-else-if="!entries.length" class="history-empty">
      <span class="material-icons" aria-hidden="true">history</span>
      <h2>
        {{
          completed
            ? 'Your finished series will live here.'
            : 'Your story starts with the next episode.'
        }}
      </h2>
      <p>
        {{
          completed
            ? 'Connect your list account and mark a series completed to see it here.'
            : 'Start watching an episode and it will appear here with a progress bar and a resume link. Earlier list totals don’t include playback positions.'
        }}
      </p>
      <Link to="/library/watching" class="empty-link">Go to Watching</Link>
    </div>

    <section
      v-for="group in loading || error ? [] : groups"
      :key="group.key"
      class="history-group"
      :aria-label="`${group.title} ${group.subtitle}`"
    >
      <header class="date-heading">
        <h2>{{ group.title }}</h2>
        <span class="date-detail">{{ group.subtitle }}</span>
        <span class="group-count"
          >{{ group.events.length }}
          {{ completed ? 'series' : group.events.length === 1 ? 'entry' : 'entries' }}</span
        >
      </header>
      <div class="cover-grid">
        <MediaLink
          v-for="entry in group.events"
          :key="entry.id"
          :href="entry.activity ? resumeActivityUrl(entry.activity) : entry.url"
          :force-link="!!entry.activity"
          class="history-cover"
          :class="{ 'is-partial': !!entry.activity, 'is-pending': !!entry.pending }"
          :title="`${entry.title} — ${entryLabel(entry)}`"
          :aria-label="`${entry.title}, ${entryLabel(entry)}, ${entryDate(entry)}`"
        >
          <img
            v-if="entry.image && !failedImages[entry.id]"
            :src="entry.image"
            :alt="entry.title"
            loading="lazy"
            decoding="async"
            @error="failedImages[entry.id] = true"
          />
          <span v-else class="cover-fallback" aria-hidden="true">{{
            entry.title.slice(0, 1)
          }}</span>
          <span class="cover-caption">
            <strong>{{ entry.title }}</strong>
            <span>{{ entryLabel(entry) }}</span>
            <time v-if="entry.watchedAt" :datetime="entryDatetime(entry)">{{
              entryDate(entry)
            }}</time>
          </span>
          <span class="episode-badge" aria-hidden="true">{{
            completed
              ? '✓ Completed'
              : entry.pending
                ? entry.pending.state === 'blocked'
                  ? 'Review sync'
                  : 'Waiting to sync'
                : entry.activity
                  ? 'Resume'
                  : episodeBadge(entry)
          }}</span>
          <span v-if="entry.activity" class="activity-progress">
            <strong
              >EP {{ entry.activity.episode }} · {{ playbackTime(entry.activity.position) }} /
              {{ playbackTime(entry.activity.duration) }}</strong
            >
            <span>{{ entry.title }}</span>
            <progress
              :value="entry.activity.position"
              :max="entry.activity.duration"
              :aria-label="`${entry.title}, episode ${entry.activity.episode} playback progress`"
            />
          </span>
        </MediaLink>
      </div>
    </section>
    <button
      v-if="visibleCount < entries.length"
      class="load-more"
      type="button"
      @click="visibleCount += 120"
    >
      Show more history
    </button>
    <p v-if="entries.length" class="history-footnote">
      {{
        completed
          ? 'Finish dates from your connected list account. Series without an exact date are grouped separately. Rewatches use the finish date currently saved in your list.'
          : 'Playback positions are saved on this browser while you watch. Unfinished episodes stay resumable; only confirmed list updates count as watched episodes.'
      }}
    </p>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import MediaLink from '../media-link.vue';
import Link from '../link.vue';
import { getList } from '../../../_provider/listFactory';
import type { ListAbstract } from '../../../_provider/listAbstract';
import { completedEntries, groupCompletedEntries } from '../../../utils/libraryHistory';
import {
  PLAYBACK_PREFIX,
  SYNC_QUEUE_PREFIX,
  isPlaybackActivity,
  mergeActivityHistory,
  resumeActivityUrl,
  playbackTime,
  ActivityHistoryEntry,
  PendingWatchSync,
} from '../../../utils/watchActivity';
import { localStore } from '../../../utils/localStore';
import {
  episodeLabel,
  groupWatchEvents,
  HISTORY_PREFIX,
  HistoryGrouping,
  isWatchEvent,
  WatchEvent,
} from '../../../utils/watchHistory';

const modes: HistoryGrouping[] = ['days', 'months', 'years'];
const savedGrouping = localStore.getItem('tsugi/history/grouping') as HistoryGrouping;
const grouping = ref<HistoryGrouping>(modes.includes(savedGrouping) ? savedGrouping : 'days');
const episodeEntries = ref<ActivityHistoryEntry[]>([]);
const pendingSyncs = ref<PendingWatchSync[]>([]);
const retrying = ref(false);
const seriesEntries = ref<WatchEvent[]>([]);
const completed = ref(localStore.getItem('tsugi/history/completed') === 'true');
const entries = computed(() => (completed.value ? seriesEntries.value : episodeEntries.value));
let requestVersion = 0;
let disposed = false;
let provider: ListAbstract | undefined;
const loading = ref(true);
const error = ref(false);
const visibleCount = ref(120);
const failedImages = ref<Record<string, boolean>>({});
const groups = computed(() =>
  (completed.value ? groupCompletedEntries : groupWatchEvents)(
    entries.value.slice(0, visibleCount.value),
    grouping.value,
  ),
);
const entryLabel = (entry: ActivityHistoryEntry) => {
  if (completed.value) return 'Completed series';
  if (entry.activity)
    return `Episode ${entry.activity.episode} · ${playbackTime(entry.activity.position)} watched${entry.pending ? ' · waiting to sync' : ' · resume'}`;
  return `${episodeLabel(entry)}${entry.pending ? ' · waiting to sync' : ''}`;
};
const episodeBadge = (entry: WatchEvent) =>
  entry.toEpisode - entry.fromEpisode === 1
    ? `EP ${entry.toEpisode}`
    : `${entry.fromEpisode + 1}–${entry.toEpisode}`;
const entryDate = (entry: WatchEvent) => {
  if (!entry.watchedAt) return 'Completion date not set';
  return new Intl.DateTimeFormat(
    undefined,
    completed.value
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { hour: 'numeric', minute: '2-digit' },
  ).format(entry.watchedAt);
};
const entryDatetime = (entry: WatchEvent) => {
  const date = new Date(entry.watchedAt);
  if (!completed.value) return date.toISOString();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

async function load() {
  const version = ++requestVersion;
  const series = completed.value;
  loading.value = series || episodeEntries.value.length === 0;
  error.value = false;
  provider?.destroy();
  provider = undefined;
  try {
    if (series) {
      const listProvider = await getList(2, 'anime');
      if (disposed || version !== requestVersion) {
        listProvider.destroy();
        return;
      }
      provider = listProvider;
      const items = await listProvider.getCompleteList();
      if (!disposed && version === requestVersion) seriesEntries.value = completedEntries(items);
    } else {
      const store = await chrome.storage.local.get(null);
      if (!disposed && version === requestVersion) {
        const events = Object.entries(store)
          .filter(([key, value]) => key.startsWith(HISTORY_PREFIX) && isWatchEvent(value))
          .map(([, value]) => value as WatchEvent);
        const activities = Object.entries(store)
          .filter(([key, value]) => key.startsWith(PLAYBACK_PREFIX) && isPlaybackActivity(value))
          .map(([, value]) => value as import('../../../utils/watchActivity').PlaybackActivity);
        pendingSyncs.value = Object.entries(store)
          .filter(([key]) => key.startsWith(SYNC_QUEUE_PREFIX))
          .map(([, value]) => value as PendingWatchSync)
          .filter(value => value?.id && value.entry);
        episodeEntries.value = mergeActivityHistory(events, activities, pendingSyncs.value);
      }
    }
  } catch {
    if (!disposed && version === requestVersion) error.value = true;
  } finally {
    if (!disposed && version === requestVersion) loading.value = false;
  }
}

async function keepLocal(id: string) {
  await chrome.runtime.sendMessage({ name: 'cancelWatchSync', id });
  await load();
}

async function retrySyncs() {
  retrying.value = true;
  try {
    await chrome.runtime.sendMessage({ name: 'retryWatchSyncs' });
    await load();
  } finally {
    retrying.value = false;
  }
}

function storageChanged(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  if (
    !completed.value &&
    area === 'local' &&
    Object.keys(changes).some(key =>
      [HISTORY_PREFIX, PLAYBACK_PREFIX, SYNC_QUEUE_PREFIX].some(prefix => key.startsWith(prefix)),
    )
  )
    load();
}

watch(completed, value => {
  localStore.setItem('tsugi/history/completed', String(value));
  visibleCount.value = 120;
  load();
});
watch(grouping, value => {
  localStore.setItem('tsugi/history/grouping', value);
  visibleCount.value = 120;
});
onMounted(() => {
  load();
  chrome.storage.onChanged.addListener(storageChanged);
});
onUnmounted(() => {
  disposed = true;
  requestVersion += 1;
  provider?.destroy();
  chrome.storage.onChanged.removeListener(storageChanged);
});
</script>

<style lang="less" scoped>
.sync-review {
  margin-bottom: 24px;
  > div {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 0;
  }
  p {
    margin: 0;
    display: grid;
    gap: 4px;
    flex: 1;
    min-width: 200px;
  }
  strong {
    font-size: 13px;
  }
  span {
    font-size: 12px;
    color: var(--cl-light-text);
  }
  button {
    cursor: pointer;
    border-bottom: 1px solid currentcolor;
    padding: 4px 0;
    font-size: 12px;
  }
}

.pending-syncs {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 18px;
  margin-bottom: 24px;
  border: 1px solid var(--cl-light-text);
  border-radius: 12px;
  div {
    flex: 1;
    display: grid;
    gap: 5px;
  }
  strong {
    font-size: 14px;
  }
  span {
    font-size: 12px;
    line-height: 1.5;
    color: var(--cl-light-text);
  }
  button {
    cursor: pointer;
    padding: 9px 12px;
    background: var(--cl-backdrop);
    border-radius: 7px;
    white-space: nowrap;
  }
  button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
}
.history-cover .activity-progress {
  position: absolute;
  inset: auto 0 0;
  padding: 36px 10px 12px;
  display: grid;
  gap: 6px;
  background: linear-gradient(transparent, rgb(0 0 0 / 90%) 50%);
  color: white;
  strong {
    font-size: 11px;
    font-weight: 600;
  }
  > span {
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  progress {
    width: 100%;
    height: 4px;
    border: 0;
    appearance: none;
    background: #ffffff40;
    border-radius: 3px;
    overflow: hidden;
  }
  progress::-moz-progress-bar {
    background: white;
  }
  progress::-webkit-progress-bar {
    background: #ffffff40;
  }
  progress::-webkit-progress-value {
    background: white;
  }
}
.history-cover.is-partial .episode-badge,
.history-cover.is-pending .episode-badge {
  top: 8px;
  bottom: auto;
}
.history-cover.is-partial:hover .activity-progress,
.history-cover.is-partial:focus-visible .activity-progress {
  opacity: 0;
}

@media (max-width: 600px) {
  .pending-syncs {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
}

.history-view-control {
  width: fit-content;
  margin: 0;
}

.history-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 30px;
}

.grouping-control {
  display: flex;
  padding: 4px;
  border-radius: 24px;
  background: var(--cl-backdrop);
  flex-shrink: 0;
  button {
    padding: 9px 16px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 13px;
    color: var(--cl-light-text);
  }
  button[aria-pressed='true'] {
    background: var(--cl-background-solid);
    color: var(--cl-text);
  }
}
.history-group {
  margin-bottom: 36px;
}
.date-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
  h2 {
    margin: 0;
    font-size: 23px;
    font-weight: 600;
    letter-spacing: -0.65px;
  }
  .date-detail,
  .group-count {
    font-size: 12px;
    color: var(--cl-light-text);
  }
  .group-count {
    margin-inline-start: auto;
    white-space: nowrap;
  }
}
.cover-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
  gap: 6px;
}
.history-cover {
  position: relative;
  aspect-ratio: 2/3;
  overflow: hidden;
  border-radius: 5px;
  background: var(--cl-backdrop);
  min-width: 0;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .cover-fallback {
    display: grid;
    height: 100%;
    place-items: center;
    font-size: 64px;
    font-weight: 700;
    color: var(--cl-light-text);
  }
  .cover-caption {
    position: absolute;
    inset: 0;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    justify-content: end;
    gap: 6px;
    background: linear-gradient(transparent 15%, rgb(0 0 0 / 88%));
    color: white;
    opacity: 0;
  }
  .cover-caption strong {
    font-size: 14px;
    line-height: 1.3;
  }
  .cover-caption span,
  .cover-caption time {
    font-size: 11px;
    line-height: 1.4;
  }
  .episode-badge {
    position: absolute;
    bottom: 8px;
    inset-inline-end: 8px;
    padding: 4px 6px;
    border-radius: 4px;
    background: rgb(0 0 0 / 72%);
    color: white;
    font-size: 10px;
    font-weight: 600;
  }
  &:hover .cover-caption,
  &:focus-visible .cover-caption {
    opacity: 1;
  }
  &:hover .episode-badge,
  &:focus-visible .episode-badge {
    opacity: 0;
  }
  &:focus-visible {
    outline: 3px solid var(--cl-primary);
    outline-offset: 2px;
    z-index: 1;
  }
}
.grouping-months .cover-grid {
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 4px;
}
.grouping-years .cover-grid {
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 3px;
}
.history-empty {
  padding: 80px 24px;
  text-align: center;
  max-width: 540px;
  margin: auto;
  .material-icons {
    font-size: 46px;
    color: var(--cl-light-text);
  }
  h2 {
    font-size: 24px;
    letter-spacing: -0.6px;
  }
  p {
    color: var(--cl-light-text);
    line-height: 1.7;
  }
  .empty-link {
    display: inline-block;
    margin-top: 16px;
    padding-bottom: 5px;
    border-bottom: 2px solid #e63424;
    font-weight: 600;
  }
}
.history-message {
  padding: 48px 0;
  color: var(--cl-light-text);
  button {
    cursor: pointer;
    text-decoration: underline;
  }
}
.history-footnote {
  font-size: 12px;
  line-height: 1.6;
  color: var(--cl-light-text);
  padding-top: 12px;
}
.load-more {
  display: block;
  margin: 24px auto;
  padding: 12px 20px;
  background: var(--cl-backdrop);
  cursor: pointer;
}

@media (max-width: 600px) {
  .history-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 32px;
  }
  .date-heading {
    flex-wrap: wrap;
    row-gap: 4px;
    h2 {
      font-size: 20px;
    }
  }
  .cover-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  }
  .grouping-months .cover-grid {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  }
  .grouping-years .cover-grid {
    grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
  }
}

@media (hover: none) {
  .history-cover .cover-caption {
    opacity: 1;
    padding: 8px;
    strong {
      font-size: 11px;
    }
    time {
      display: none;
    }
  }
  .history-cover .episode-badge {
    display: none;
  }
}
</style>
