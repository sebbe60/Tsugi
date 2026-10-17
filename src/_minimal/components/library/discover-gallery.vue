<template>
  <section class="discover-page" aria-label="Discover unwatched anime">
    <section
      class="discovery-status"
      :class="{ ready: coverage.complete && !loading && !error && !paused }"
      aria-label="Discovery coverage"
    >
      <div class="status-heading">
        <div>
          <p class="status-label">
            <span class="status-dot" aria-hidden="true"></span
            >{{ providerLabel || 'Your library' }} · Discovery coverage
          </p>
          <h2 role="status">{{ statusTitle }}</h2>
          <p class="status-description">{{ statusDescription }}</p>
        </div>
        <div class="status-actions">
          <button
            v-if="loading && phase === 'relations'"
            type="button"
            class="status-secondary"
            @click="stopScan"
          >
            Stop check
          </button>
          <button
            v-else-if="paused || error"
            type="button"
            class="status-primary"
            @click="retryDiscovery"
          >
            {{ paused ? 'Resume check' : 'Retry check' }}
          </button>
          <template v-else-if="!loading && libraryReady && coverage.remaining">
            <button type="button" class="status-primary" @click="checkMore">
              Check next {{ Math.min(40, coverage.remaining) }}
            </button>
            <button
              v-if="coverage.remaining > 40"
              type="button"
              class="status-secondary"
              @click="checkAll"
            >
              Check all {{ coverage.remaining }} remaining
            </button>
          </template>
          <button
            type="button"
            class="status-update"
            :disabled="loading"
            @click="loadLibrary(true)"
          >
            <span class="material-icons" aria-hidden="true">refresh</span
            >{{ loading && phase === 'library' ? 'Reading library…' : 'Update discovery' }}
          </button>
        </div>
      </div>
      <div class="status-metrics">
        <div>
          <strong
            >{{ coverage.checked }}<span> / {{ coverage.total }}</span></strong
          ><span>Watched series checked</span>
        </div>
        <div>
          <strong>{{ coverage.remaining }}</strong
          ><span>Still to check</span>
        </div>
        <div>
          <strong>{{ candidates.length }}</strong
          ><span
            >Unwatched finds
            <small
              >{{ candidates.filter(item => !item.planned).length }} not planned ·
              {{ candidates.filter(item => item.planned).length }} planned</small
            ></span
          >
        </div>
      </div>
      <progress
        class="coverage-progress"
        :value="coverage.checked"
        :max="Math.max(1, coverage.total)"
        :aria-label="`${coverage.checked} of ${coverage.total} watched series checked for related anime`"
      ></progress>
      <div class="status-footer">
        <div class="status-times">
          <span
            >Library read
            <time v-if="lastLibraryRead" :datetime="new Date(lastLibraryRead).toISOString()">{{
              statusTime(lastLibraryRead)
            }}</time
            ><span v-else>Not read yet</span></span
          ><span
            >Oldest relationship check
            <time v-if="oldestCheck" :datetime="new Date(oldestCheck).toISOString()">{{
              statusTime(oldestCheck)
            }}</time
            ><span v-else>Not checked yet</span></span
          >
        </div>
        <Link to="/library/history" class="episode-sync" :class="{ attention: pendingCount > 0 }"
          ><span class="material-icons" aria-hidden="true">{{
            pendingCount ? 'sync_problem' : 'check_circle_outline'
          }}</span
          >{{
            pendingCount
              ? `${pendingCount} episode ${pendingCount === 1 ? 'update' : 'updates'} ${blockedCount ? '· needs attention' : 'waiting to sync'}`
              : 'No pending episode updates'
          }}<span class="material-icons" aria-hidden="true">chevron_right</span></Link
        >
      </div>
      <details v-if="coverage.unavailable" class="matching-details">
        <summary>
          {{ coverage.unavailable }} watched
          {{ coverage.unavailable === 1 ? 'title needs' : 'titles need' }} matching
        </summary>
        <p>
          These titles are in your watch activity, but relationship data couldn’t be matched. They
          aren’t counted as fully covered.
        </p>
        <ul>
          <li v-for="title in unavailableTitles" :key="title">{{ title }}</li>
        </ul>
      </details>
      <p class="status-note">
        Discovery checks related titles; episode syncing is separate. Cached relationship checks are
        reused for up to 24 hours. Update discovery reads your list again and refreshes every series
        included so far.
      </p>
    </section>
    <div class="discover-toolbar">
      <p class="coverage">
        {{ shelves.reduce((total, shelf) => total + shelf.items.length, 0) }} finds match your
        filters
      </p>
      <div class="discover-filters">
        <label
          ><span class="sr-only">Filter by format</span
          ><select v-model="format">
            <option value="all">All formats</option>
            <option value="series">Series</option>
            <option value="MOVIE">Movies</option>
            <option value="OVA">OVAs</option>
            <option value="ONA">ONAs</option>
            <option value="SPECIAL">Specials</option>
          </select></label
        >
        <label
          ><span class="sr-only">Filter by planned status</span
          ><select v-model="planned">
            <option value="all">All unwatched</option>
            <option value="new">Not planned yet</option>
            <option value="planned">Already planned</option>
          </select></label
        >
        <button v-if="dismissed.length" type="button" class="restore-button" @click="restore">
          Restore hidden ({{ dismissed.length }})
        </button>
      </div>
    </div>
    <p v-if="error" class="discover-error" role="alert">
      {{ error }}
    </p>
    <p v-if="actionNotice" class="action-notice" role="status">{{ actionNotice }}</p>
    <nav v-if="shelves.length" class="shelf-links" aria-label="Discover sections">
      <a
        v-for="shelf in shelves"
        :key="shelf.key"
        :href="`#discover-${shelf.key}`"
        @click.prevent="jump(shelf.key)"
        >{{ shelf.title }}<span>{{ shelf.items.length }}</span></a
      >
    </nav>
    <div v-if="!loading && !candidates.length && !error" class="discover-empty">
      <span class="material-icons" aria-hidden="true">explore</span>
      <h2>
        {{
          seeds.length
            ? 'You’re caught up with these stories.'
            : 'Your next discovery starts with what you watch.'
        }}
      </h2>
      <p>
        {{
          seeds.length
            ? 'No unwatched relatives found in the series checked so far. Check more of your library or restore hidden titles.'
            : 'Connect your anime list, or start watching with Tsugi. Related sequels, films and extras will appear here.'
        }}
      </p>
      <Link v-if="!seeds.length" to="/library/watching">Go to Watching</Link>
    </div>
    <p v-else-if="!loading && !shelves.length && candidates.length" class="filter-empty">
      No titles match these filters.
      <button
        type="button"
        @click="
          format = 'all';
          planned = 'all';
        "
      >
        Show all unwatched
      </button>
    </p>
    <section
      v-for="shelf in shelves"
      :id="`discover-${shelf.key}`"
      :key="shelf.key"
      class="discover-shelf"
      :aria-labelledby="`heading-${shelf.key}`"
    >
      <header class="shelf-heading">
        <div>
          <h2 :id="`heading-${shelf.key}`">{{ shelf.title }}</h2>
          <p>{{ shelf.description }}</p>
        </div>
        <span class="shelf-count"
          >{{ shelf.items.length }} {{ shelf.items.length === 1 ? 'title' : 'titles' }}</span
        >
      </header>
      <div class="discover-grid">
        <article
          v-for="item in shelf.items.slice(0, visible[shelf.key] || 12)"
          :key="item.media.id"
          class="discover-card"
        >
          <button
            type="button"
            class="discover-art link"
            aria-haspopup="dialog"
            :aria-label="`Watch options for ${item.title}`"
            @click="launch(item, $event)"
          >
            <img
              v-if="cover(item) && !failed[item.media.id]"
              :src="cover(item)"
              alt=""
              loading="lazy"
              decoding="async"
              @error="failed[item.media.id] = true"
            />
            <span v-else class="art-fallback" aria-hidden="true">{{ item.title.slice(0, 1) }}</span>
            <span class="format-badge">{{ discoveryFormat(item.media) }}</span>
            <span v-if="item.planned" class="planned-badge"
              ><span class="material-icons" aria-hidden="true">bookmark</span>Planned</span
            >
            <span class="art-play" aria-hidden="true"
              ><span class="material-icons">play_arrow</span></span
            >
          </button>
          <div class="discover-copy">
            <button type="button" class="title-button link" @click="launch(item, $event)">
              {{ item.title }}
            </button>
            <p class="relation">{{ discoveryReason(item) }}</p>
            <span
              v-if="item.source.score > 0"
              class="personal-score"
              :title="`Your rating for ${item.source.title}`"
              ><span class="material-icons" aria-hidden="true">favorite</span>Based on your
              {{ item.source.score }}/10 rating</span
            >
            <p class="release">
              <span>{{
                item.releaseDate
                  ? `${item.section === 'upcoming' ? 'Expected' : 'Released'} ${releaseDateLabel(item.releaseDate)}`
                  : 'Release date unavailable'
              }}</span
              ><span v-if="item.media.episodes"
                >{{
                  item.media.episodes === 1 && item.media.duration
                    ? `${item.media.duration} min`
                    : `${item.media.episodes} ${item.media.episodes === 1 ? 'episode' : 'episodes'}`
                }}<span v-if="quickWatch(item)"> · Quick watch</span></span
              >
            </p>
            <p v-if="!item.source.completed && item.relation === 'SEQUEL'" class="unfinished-note">
              You’re still watching the previous story.
            </p>
            <div class="card-actions">
              <button
                type="button"
                class="plan-button"
                :disabled="!!item.listStatus || !!saving[item.media.id]"
                @click="addPlanned(item)"
              >
                <span class="material-icons" aria-hidden="true">{{
                  item.planned ? 'check' : item.listStatus ? 'bookmark' : 'add'
                }}</span
                >{{
                  saving[item.media.id]
                    ? 'Saving…'
                    : item.planned
                      ? 'Planned'
                      : item.listStatus
                        ? 'In your list'
                        : 'Add to Planned'
                }}
              </button>
              <button
                type="button"
                class="dismiss-button"
                :aria-label="`Hide ${item.title} from Discover`"
                title="Hide this title"
                @click="dismiss(item.media.id)"
              >
                <span class="material-icons" aria-hidden="true">close</span>
              </button>
            </div>
          </div>
        </article>
      </div>
      <button
        v-if="shelf.items.length > (visible[shelf.key] || 12)"
        type="button"
        class="show-more"
        @click="visible[shelf.key] = (visible[shelf.key] || 12) + 12"
      >
        Show more {{ shelf.title.toLowerCase() }}
      </button>
    </section>
    <div v-if="libraryReady && seeds.length" class="discover-bottom">
      <p>
        Related anime from AniList, compared with your library and Tsugi watch activity. Your
        highest-rated and completed anime are checked first. Each find appears in one section.
      </p>
    </div>
    <CardSitesMenu ref="siteMenu" />
  </section>
</template>
<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { getList } from '../../../_provider/listFactory';
import { getSingle } from '../../../_provider/singleFactory';
import type { SingleAbstract } from '../../../_provider/singleAbstract';
import type { ListAbstract } from '../../../_provider/listAbstract';
import {
  buildDiscovery,
  discoveryFormat,
  discoveryIdentity,
  discoveryListItem,
  discoveryReason,
  discoverySections,
  discoverySeeds,
  hasWatched,
  mergeDiscoveryActivity,
} from '../../../utils/discovery';
import type {
  DiscoveryCandidate,
  DiscoveryGraph,
  DiscoveryLibraryTitle,
} from '../../../utils/discovery';
import { discoveryCoverage, restoreDiscoverySelection } from '../../../utils/discoveryCoverage';
import { getSyncMode } from '../../../_provider/helper';
import { loadDiscoveryGraph, DISCOVERY_RELATIONS_PREFIX } from '../../../utils/discoveryLoader';
import type { PendingWatchSync } from '../../../utils/watchActivity';
import {
  isPlaybackActivity,
  PLAYBACK_PREFIX,
  SYNC_QUEUE_PREFIX,
} from '../../../utils/watchActivity';
import { HISTORY_PREFIX, isWatchEvent, isWatchProgress } from '../../../utils/watchHistory';
import { releaseDateLabel, formatReleaseTime } from '../../../utils/releaseDates';
import CardSitesMenu from './card-sites-menu.vue';
import Link from '../link.vue';

const DISMISSED = 'tsugi/discover/dismissed/v1';
const library = ref<DiscoveryLibraryTitle[]>([]);
const graph = ref<DiscoveryGraph>([]);
const checked = ref<string[]>([]);
const dismissed = ref<number[]>([]);
const loading = ref(true);
const libraryReady = ref(false);
const error = ref('');
const actionNotice = ref('');
const format = ref('all');
const planned = ref('all');
const selectedKeys = ref<string[]>([]);
const providerLabel = ref('');
const lastLibraryRead = ref(0);
const checkedAt = ref<Record<string, number>>({});
const unavailable = ref<string[]>([]);
const processed = ref<string[]>([]);
const paused = ref(false);
const phase = ref<'library' | 'relations' | 'idle'>('library');
const queue = ref<Record<string, PendingWatchSync>>({});
let scopeKey = '';
let refreshAfter = 0;
const visible = ref<Record<string, number>>({});
const failed = ref<Record<number, boolean>>({});
const saving = ref<Record<number, boolean>>({});
const siteMenu = ref<InstanceType<typeof CardSitesMenu>>();
const seeds = computed(() => discoverySeeds(library.value));
const unmatched = computed(
  () => library.value.filter(item => hasWatched(item) && !discoveryIdentity(item)).length,
);
const scanSeeds = computed(() => seeds.value.filter(seed => selectedKeys.value.includes(seed.key)));
const coverage = computed(() =>
  discoveryCoverage(
    seeds.value.map(seed => seed.key),
    checked.value,
    unavailable.value,
    unmatched.value,
  ),
);
const oldestCheck = computed(() => {
  const values = Object.values(checkedAt.value).filter(
    value => Number.isFinite(value) && value > 0,
  );
  return values.length ? Math.min(...values) : 0;
});
const unavailableTitles = computed(() => [
  ...new Set([
    ...library.value
      .filter(item => hasWatched(item) && !discoveryIdentity(item))
      .map(item => item.title),
    ...seeds.value.filter(seed => unavailable.value.includes(seed.key)).map(seed => seed.title),
  ]),
]);
const pendingCount = computed(() => Object.keys(queue.value).length);
const blockedCount = computed(
  () => Object.values(queue.value).filter(item => item.state === 'blocked').length,
);
const statusTime = (timestamp: number) =>
  formatReleaseTime(timestamp, api.settings.get('tsugiTimeZone'), api.settings.get('tsugiClock24'));
const statusTitle = computed(() => {
  if (loading.value)
    return phase.value === 'library' ? 'Reading your library' : 'Checking for more to watch';
  if (error.value) return 'Discovery check needs attention';
  if (paused.value) return 'Discovery check paused';
  if (!coverage.value.total) return 'Your next discovery starts with what you watch';
  if (coverage.value.remaining) return 'More of your library to explore';
  if (coverage.value.unavailable) return 'Some titles still need matching';
  return 'All watched series checked';
});
const statusDescription = computed(() => {
  if (loading.value)
    return phase.value === 'library'
      ? 'Reading your connected list and local watch activity.'
      : `Checking ${processed.value.length} of ${scanSeeds.value.length} selected series. Your existing finds stay available.`;
  if (error.value || paused.value)
    return 'Your existing finds and completed checks are kept. Continue when you’re ready.';
  if (coverage.value.remaining)
    return `${coverage.value.remaining} watched ${coverage.value.remaining === 1 ? 'series is' : 'series are'} still unchecked. More sequels, films and extras may be waiting.`;
  if (coverage.value.unavailable)
    return 'Every matchable series has been checked. Review the titles below that have no matching relationship data.';
  if (!coverage.value.total)
    return 'Watch an anime or connect your list to start finding its related stories.';
  return 'Your current watched library is covered. Update discovery to look for new relationships and list changes.';
});
function isQueued(value: unknown): value is PendingWatchSync {
  const entry = value as PendingWatchSync;
  return (
    !!entry &&
    typeof entry.id === 'string' &&
    ['sending', 'pending', 'blocked'].includes(entry.state) &&
    isWatchProgress(entry.entry)
  );
}
async function rememberCoverage() {
  if (scopeKey)
    await chrome.storage.local.set({
      [scopeKey]: {
        includedKeys: selectedKeys.value.slice(),
        libraryReadAt: lastLibraryRead.value,
      },
    });
}
const candidates = computed(() => buildDiscovery(library.value, graph.value, dismissed.value));
const shelves = computed(() =>
  discoverySections
    .map(section => ({
      ...section,
      items: candidates.value.filter(
        item =>
          item.section === section.key &&
          (planned.value === 'all' ||
            (planned.value === 'planned' ? item.planned : !item.planned)) &&
          (format.value === 'all' ||
            (format.value === 'series'
              ? ['TV', 'TV_SHORT'].includes(item.media.format || '')
              : item.media.format === format.value)),
      ),
    }))
    .filter(shelf => shelf.items.length),
);
const cover = (item: DiscoveryCandidate) =>
  item.media.coverImage?.extraLarge || item.media.coverImage?.large || '';
const quickWatch = (item: DiscoveryCandidate) =>
  !!item.media.episodes && !!item.media.duration && item.media.episodes * item.media.duration <= 60;
const launch = (item: DiscoveryCandidate, event: MouseEvent) =>
  siteMenu.value?.open(discoveryListItem(item), event);
function jump(key: string) {
  document.getElementById(`discover-${key}`)?.scrollIntoView({ block: 'start' });
}
let provider: ListAbstract | undefined;
let controller = new AbortController();
let disposed = false;
async function scan() {
  controller.abort();
  controller = new AbortController();
  const current = controller;
  loading.value = true;
  paused.value = false;
  phase.value = 'relations';
  error.value = '';
  try {
    await rememberCoverage();
    if (current.signal.aborted) return;
    const warning = await loadDiscoveryGraph(
      scanSeeds.value,
      (value, done, details) => {
        if (!disposed && !current.signal.aborted) {
          graph.value = value;
          checked.value = done;
          checkedAt.value = details.checkedAt;
          unavailable.value = details.unavailable;
          processed.value = details.processed;
        }
      },
      current.signal,
      { refreshAfter },
    );
    if (!disposed && !current.signal.aborted) error.value = warning;
  } catch {
    if (!disposed && !current.signal.aborted) error.value = 'Discovery couldn’t load. Try again.';
  } finally {
    if (!disposed && !current.signal.aborted) {
      loading.value = false;
      phase.value = 'idle';
    }
  }
}
async function loadLibrary(refresh = false) {
  controller.abort();
  phase.value = 'library';
  paused.value = false;
  loading.value = true;
  error.value = '';
  try {
    provider?.destroy();
    provider = await getList(7, 'anime');
    const values = await provider.getCompleteList();
    const username = await provider.getUsername();
    const nextScope = `tsugi/discover/coverage/v1/${getSyncMode('anime')}/${encodeURIComponent(username)}`;
    const sameAccount = scopeKey === nextScope;
    scopeKey = nextScope;
    providerLabel.value = provider.name;
    const store = await chrome.storage.local.get(null);
    if (disposed) return;
    const local = Object.entries(store).flatMap(([key, value]) => {
      if (key.startsWith(PLAYBACK_PREFIX) && isPlaybackActivity(value))
        return [
          {
            title: value.title,
            url: value.url,
            episode: value.episode,
            updatedAt: value.updatedAt,
          },
        ];
      if (key.startsWith(HISTORY_PREFIX) && isWatchEvent(value))
        return [
          {
            title: value.title,
            url: value.url,
            episode: value.toEpisode,
            updatedAt: value.watchedAt,
          },
        ];
      return [];
    });
    library.value = mergeDiscoveryActivity(values, local);
    dismissed.value = Array.isArray(store[DISMISSED])
      ? store[DISMISSED].filter(value => Number.isInteger(value) && value > 0)
      : [];
    libraryReady.value = true;
    const previous = store[scopeKey] as { includedKeys?: unknown } | undefined;
    const existing = (sameAccount ? selectedKeys.value : []).filter(key =>
      seeds.value.some(seed => seed.key === key),
    );
    selectedKeys.value = restoreDiscoverySelection(
      seeds.value.map(seed => seed.key),
      existing.length
        ? existing
        : (previous?.includedKeys ??
            seeds.value
              .filter(seed => {
                const cached = store[DISCOVERY_RELATIONS_PREFIX + seed.key] as
                  | {
                      timestamp?: number;
                      media?: { relations?: { edges?: unknown[] } };
                      unavailable?: boolean;
                    }
                  | undefined;
                return (
                  cached &&
                  Number.isFinite(cached.timestamp) &&
                  (cached.media?.relations?.edges || cached.unavailable)
                );
              })
              .map(seed => seed.key)),
    );
    queue.value = Object.fromEntries(
      Object.entries(store).filter(
        ([key, value]) => key.startsWith(SYNC_QUEUE_PREFIX) && isQueued(value),
      ),
    ) as Record<string, PendingWatchSync>;
    lastLibraryRead.value = Date.now();
    refreshAfter = refresh ? Date.now() : 0;
    await scan();
  } catch {
    if (!disposed) {
      error.value = 'Your anime library couldn’t load. Check your connected account and try again.';
      loading.value = false;
    }
  }
}
function retryDiscovery() {
  if (!libraryReady.value || phase.value === 'library') loadLibrary(true);
  else scan();
}
function checkMore() {
  const next = seeds.value
    .filter(seed => !checked.value.includes(seed.key))
    .slice(0, 40)
    .map(seed => seed.key);
  selectedKeys.value = [...new Set([...selectedKeys.value, ...next])];
  refreshAfter = 0;
  scan();
}
function checkAll() {
  selectedKeys.value = seeds.value.map(seed => seed.key);
  refreshAfter = 0;
  scan();
}
function stopScan() {
  controller.abort();
  loading.value = false;
  paused.value = true;
  phase.value = 'idle';
}
async function dismiss(id: number) {
  try {
    const next = [...new Set([...dismissed.value, id])];
    await chrome.storage.local.set({ [DISMISSED]: next });
    dismissed.value = next;
  } catch {
    actionNotice.value = 'This title couldn’t be hidden. Try again.';
  }
}
async function restore() {
  try {
    await chrome.storage.local.set({ [DISMISSED]: [] });
    dismissed.value = [];
  } catch {
    actionNotice.value = 'Hidden titles couldn’t be restored. Try again.';
  }
}
async function addPlanned(item: DiscoveryCandidate) {
  if (saving.value[item.media.id]) return;
  saving.value[item.media.id] = true;
  actionNotice.value = '';
  let single: SingleAbstract | undefined;
  try {
    single = getSingle(item.url);
    await single.update();
    if (single.getEpisode() > 0 || [2, 23].includes(Number(single.getStatus()))) {
      library.value.push({
        ...discoveryListItem(item),
        watchedEp: Math.max(1, single.getEpisode()),
        status: single.getStatus(),
      });
      actionNotice.value = `${item.title} is already watched or started. It’s been removed from Discover.`;
      return;
    }
    if (!single.isOnList()) {
      single.setStatus(6);
      await single.sync();
    }
    const saved = { ...discoveryListItem(item), status: single.getStatus() };
    library.value.push(saved);
    actionNotice.value =
      single.getStatus() === 6
        ? `${item.title} added to Planned.`
        : `${item.title} is already in your list.`;
  } catch {
    actionNotice.value = `${item.title} couldn’t be saved. Check your list account and try again.`;
  } finally {
    single?.destroy();
    saving.value[item.media.id] = false;
  }
}
function storageChanged(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  if (area !== 'local' || disposed) return;
  Object.entries(changes).forEach(([key, change]) => {
    if (!key.startsWith(SYNC_QUEUE_PREFIX)) return;
    if (isQueued(change.newValue)) queue.value[key] = change.newValue;
    else delete queue.value[key];
  });
  const started = Object.entries(changes).flatMap(([key, change]) => {
    const value = change.newValue;
    if (key.startsWith(PLAYBACK_PREFIX) && isPlaybackActivity(value))
      return [
        { title: value.title, url: value.url, episode: value.episode, updatedAt: value.updatedAt },
      ];
    if (key.startsWith(HISTORY_PREFIX) && isWatchEvent(value))
      return [
        {
          title: value.title,
          url: value.url,
          episode: value.toEpisode,
          updatedAt: value.watchedAt,
        },
      ];
    return [];
  });
  if (started.length) library.value = mergeDiscoveryActivity(library.value, started);
}
onMounted(() => {
  chrome.storage.onChanged.addListener(storageChanged);
  loadLibrary();
});
onUnmounted(() => {
  disposed = true;
  chrome.storage.onChanged.removeListener(storageChanged);
  controller.abort();
  provider?.destroy();
});
</script>
<style lang="less" scoped>
.discovery-status {
  border: 1px solid var(--cl-backdrop);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  background: var(--cl-background-solid);
}
.status-heading {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
}
.status-heading > div:first-child {
  max-width: 62ch;
}
.status-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--cl-light-text);
  margin: 0 0 10px;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d6aa5d;
  flex: none;
}
.ready .status-dot {
  background: #57c989;
}
.status-heading h2 {
  font-size: 23px;
  line-height: 1.25;
  letter-spacing: -0.5px;
  margin: 0 0 8px;
}
.status-description {
  color: var(--cl-light-text);
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
}
.status-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  max-width: 530px;
}
.status-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 9px 12px;
  cursor: pointer;
}
.status-primary {
  background: var(--cl-text);
  color: var(--cl-background-solid);
  border: 1px solid var(--cl-text);
}
.status-secondary {
  background: transparent;
  color: var(--cl-text);
  border: 1px solid var(--cl-backdrop);
}
.status-update {
  background: transparent;
  color: var(--cl-light-text);
  border: 1px solid transparent;
}
.status-update .material-icons {
  font-size: 17px;
}
.status-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin: 25px 0 17px;
}
.status-metrics > div {
  display: grid;
  gap: 6px;
}
.status-metrics strong {
  font-size: 31px;
  font-weight: 650;
  letter-spacing: -1px;
  line-height: 1.15;
}
.status-metrics strong span {
  font-size: 21px;
  color: var(--cl-light-text);
  font-weight: 400;
}
.status-metrics > div > span {
  font-size: 12px;
  color: var(--cl-light-text);
  line-height: 1.5;
}
.status-metrics small {
  display: inline;
  font-size: 11px;
  margin-left: 8px;
}
.coverage-progress {
  display: block;
  appearance: none;
  border: 0;
  height: 4px;
  width: 100%;
  border-radius: 3px;
  background: var(--cl-backdrop);
  color: var(--cl-text);
}
.coverage-progress::-moz-progress-bar {
  background: var(--cl-text);
  border-radius: 3px;
}
.coverage-progress::-webkit-progress-bar {
  background: var(--cl-backdrop);
  border-radius: 3px;
}
.coverage-progress::-webkit-progress-value {
  background: var(--cl-text);
  border-radius: 3px;
}
.ready .coverage-progress::-moz-progress-bar {
  background: #57c989;
}
.ready .coverage-progress::-webkit-progress-value {
  background: #57c989;
}
.status-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding-top: 16px;
}
.status-times {
  display: grid;
  gap: 5px;
  color: var(--cl-light-text);
  font-size: 11px;
  line-height: 1.5;
}
.status-times time,
.status-times > span > span {
  margin-left: 9px;
  color: var(--cl-text);
}
.episode-sync {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  text-decoration: none;
  color: var(--cl-light-text);
  font-size: 11px;
}
.episode-sync.attention {
  color: #cc9e51;
}
.episode-sync .material-icons {
  font-size: 17px;
}
.status-note {
  font-size: 10px;
  line-height: 1.6;
  color: var(--cl-light-text);
  margin: 15px 0 0;
  max-width: 105ch;
}
.matching-details {
  margin-top: 16px;
  font-size: 12px;
  line-height: 1.6;
}
.matching-details summary {
  cursor: pointer;
}
.matching-details p,
.matching-details ul {
  color: var(--cl-light-text);
}

@media (max-width: 1000px) {
  .status-heading {
    flex-direction: column;
    gap: 18px;
  }
  .status-actions {
    max-width: none;
    justify-content: flex-start;
  }
}

@media (max-width: 650px) {
  .discovery-status {
    padding: 18px;
  }
  .status-metrics {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .status-metrics > div:last-child {
    grid-column: 1 / -1;
  }
  .status-footer {
    align-items: flex-start;
    flex-direction: column;
  }
  .status-heading h2 {
    font-size: 21px;
  }
  .status-actions button {
    font-size: 11px;
  }
}

.discover-page {
  padding: 28px clamp(20px, 3vw, 56px) 56px;
}
.discover-toolbar,
.discover-filters,
.shelf-heading,
.card-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.discover-toolbar {
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.coverage {
  margin: 0;
  color: var(--cl-light-text);
  font-size: 13px;
}
.discover-filters {
  flex-wrap: wrap;
}
select,
button {
  font: inherit;
}
.discover-filters select {
  padding: 9px 32px 9px 12px;
  border: 1px solid var(--cl-backdrop);
  border-radius: 9px;
  background: var(--cl-foreground-solid);
  color: var(--cl-text);
  font-size: 13px;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.6;
}
button:focus-visible,
a:focus-visible,
select:focus-visible {
  outline: 2px solid var(--cl-primary);
  outline-offset: 4px;
}
.icon-button,
.dismiss-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--cl-light-text);
}
.restore-button,
.discover-error button,
.filter-empty button {
  background: transparent;
  border: 0;
  color: var(--cl-text);
  text-decoration: underline;
  padding: 5px;
}
.shelf-links {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 0 0 24px;
  margin-bottom: 10px;
}
.shelf-links a {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
  padding: 9px 13px;
  border: 1px solid var(--cl-backdrop);
  border-radius: 24px;
  font-size: 12px;
  color: var(--cl-text);
  text-decoration: none;
}
.shelf-links a:hover {
  background: var(--cl-backdrop);
}
.shelf-links span {
  color: var(--cl-light-text);
}
.discover-shelf {
  margin-bottom: 48px;
  scroll-margin-top: 180px;
}
.shelf-heading {
  justify-content: space-between;
  margin-bottom: 22px;
  align-items: flex-start;
}
.shelf-heading h2 {
  font-size: clamp(23px, 2.4vw, 32px);
  letter-spacing: -0.8px;
  font-weight: 700;
  margin: 0 0 6px;
}
.shelf-heading p {
  font-size: 13px;
  color: var(--cl-light-text);
  margin: 0;
}
.shelf-count {
  color: var(--cl-light-text);
  font-size: 12px;
  white-space: nowrap;
  padding-top: 9px;
}
.discover-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 28px 22px;
}
.discover-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.discover-art {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: 12px;
  border: 0;
  padding: 0;
  background: var(--cl-backdrop);
  color: white;
  text-align: left;
}
.discover-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.art-fallback {
  display: grid;
  place-items: center;
  height: 100%;
  font-size: 56px;
  color: var(--cl-light-text);
}
.format-badge,
.planned-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 5px 9px;
  background: #111d;
  color: #fff;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}
.planned-badge {
  top: auto;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.planned-badge .material-icons {
  font-size: 15px;
}
.art-play {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: #0003;
  opacity: 0;
  transition: opacity 0.15s;
}
.art-play .material-icons {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  background: #fffffff0;
  color: #111;
  border-radius: 50%;
}
.discover-art:hover .art-play,
.discover-art:focus-visible .art-play {
  opacity: 1;
}
.discover-copy {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding-top: 14px;
}
.title-button {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--cl-text);
  text-align: left;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.4;
}
.relation {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cl-light-text);
  margin: 8px 0;
}
.personal-score {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--cl-text);
  margin-bottom: 9px;
}
.personal-score .material-icons {
  font-size: 13px;
  color: var(--cl-secondary);
}
.release {
  display: grid;
  gap: 4px;
  margin: 0 0 12px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--cl-light-text);
}
.unfinished-note {
  font-size: 11px;
  line-height: 1.4;
  margin: 0 0 12px;
  color: var(--cl-text);
}
.card-actions {
  justify-content: space-between;
  margin-top: auto;
  padding-top: 4px;
  gap: 5px;
}
.plan-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
  padding: 6px 9px;
  border: 1px solid var(--cl-backdrop);
  border-radius: 8px;
  background: transparent;
  color: var(--cl-text);
  font-size: 11px;
  font-weight: 600;
}
.plan-button .material-icons {
  font-size: 17px;
}
.plan-button:hover:not(:disabled),
.dismiss-button:hover {
  background: var(--cl-backdrop);
}
.show-more,
.scan-more {
  padding: 11px 18px;
  margin-top: 24px;
  background: transparent;
  color: var(--cl-text);
  border: 1px solid var(--cl-backdrop);
  border-radius: 9px;
  font-size: 13px;
}
.discover-bottom {
  border-top: 1px solid var(--cl-backdrop);
  padding-top: 4px;
}
.discover-bottom p {
  color: var(--cl-light-text);
  font-size: 12px;
  line-height: 1.6;
  max-width: 80ch;
}
.discover-error,
.action-notice {
  font-size: 13px;
  line-height: 1.6;
  padding: 12px 16px;
  background: var(--cl-backdrop);
  border-radius: 9px;
}
.discover-empty {
  text-align: center;
  padding: 80px 20px;
}
.discover-empty > .material-icons {
  font-size: 48px;
  color: var(--cl-light-text);
}
.discover-empty h2 {
  font-size: 24px;
}
.discover-empty p,
.filter-empty {
  color: var(--cl-light-text);
  font-size: 14px;
  max-width: 60ch;
  margin: 15px auto;
  line-height: 1.6;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 650px) {
  .discover-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 14px;
  }
  .shelf-count {
    display: none;
  }
  .discover-toolbar {
    align-items: flex-start;
  }
  .discover-filters {
    gap: 8px;
  }
  .discover-page {
    padding: 20px 16px 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .art-play {
    transition: none;
  }
}
</style>
