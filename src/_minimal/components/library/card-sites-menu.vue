<template>
  <div
    ref="panel"
    popover="manual"
    class="card-sites-menu"
    :style="position"
    role="dialog"
    aria-label="Choose where to watch"
    @keydown="onKey"
  >
    <div class="menu-heading">
      <span>Watch on</span
      ><button type="button" aria-label="Close site choices" @click="close(true)">
        <span class="material-icons" aria-hidden="true">close</span>
      </button>
    </div>
    <p class="menu-title">{{ item?.title }}</p>
    <a
      v-if="resume"
      class="destination saved-resume"
      :href="resumeActivityUrl(resume)"
      target="_blank"
      rel="noopener noreferrer"
      @click="close()"
    >
      <span class="favicon"
        ><img :src="favicon(resume.watchUrl)" alt="" @error="hideIcon" /><span aria-hidden="true"
          >▶</span
        ></span
      >
      <span class="destination-text"
        ><strong>Resume episode {{ resume.episode }}</strong
        ><small>Continue at {{ playbackTime(resume.position) }} · {{ resumeHost }}</small></span
      ><span class="material-icons outward" aria-hidden="true">north_east</span>
    </a>
    <a
      v-for="entry in entries"
      :key="entry.site.id"
      :href="entry.url"
      target="_blank"
      rel="noopener noreferrer"
      class="destination"
      @click="close()"
    >
      <span class="favicon"
        ><img :src="favicon(entry.site.url)" alt="" @error="hideIcon" /><span aria-hidden="true">{{
          entry.site.name.slice(0, 1)
        }}</span></span
      >
      <span class="destination-text"
        ><strong>{{ entry.site.name }}</strong
        ><small>{{ entry.detail }}</small></span
      ><span class="material-icons outward" aria-hidden="true">north_east</span>
    </a>
    <p v-if="!entries.length" class="empty-sites">
      Add your favourite streaming sites in My sites.
    </p>
    <a
      v-if="provider?.url"
      class="provider-link"
      :href="provider.url"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="`Open ${item?.title} in ${provider.name} in a new tab`"
      @click="close()"
    >
      <span class="favicon provider-favicon"
        ><img :key="provider.home" :src="favicon(provider.home)" alt="" @error="hideIcon" /><span
          aria-hidden="true"
          >{{ provider.name.slice(0, 1) }}</span
        ></span
      >
      <span>Open in {{ provider.name }}</span
      ><span class="material-icons outward" aria-hidden="true">north_east</span>
    </a>
    <div v-else-if="provider" class="provider-link provider-pending" role="status">
      <span>{{
        providerLoading ? `Finding ${provider.name} link…` : `${provider.name} link unavailable`
      }}</span>
      <button v-if="!providerLoading" type="button" @click="retryProvider">Retry</button>
    </div>
    <MediaLink v-if="item" :href="item.url" class="open-tsugi" @click="close()"
      >Open in Tsugi<span class="material-icons" aria-hidden="true">chevron_right</span></MediaLink
    >
  </div>
</template>
<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { PlaybackActivity, playbackTime, resumeActivityUrl } from '../../../utils/watchActivity';
import { listElement } from '../../../_provider/listAbstract';
import type { SingleAbstract } from '../../../_provider/singleAbstract';
import { getSingle } from '../../../_provider/singleFactory';
import { getSyncMode } from '../../../_provider/helper';
import type { SyncTypes } from '../../../_provider/helper';
import { connectedCardProvider } from '../../../utils/cardProvider';
import { cardDestinations } from '../../../utils/cardSites';
import { defaultSites, isTsugiSite, SITES_KEY, TsugiSite } from '../../../utils/tsugiSites';
import { getMalToKissApi, getQuicklinks, titleSearch } from '../../../utils/quicklinksBuilder';
import MediaLink from '../media-link.vue';

const provider = ref<ReturnType<typeof connectedCardProvider>>(null);
const providerLoading = ref(false);
const providerCache = new Map<string, string>();
const resume = ref<PlaybackActivity>();
const resumeHost = computed(() => (resume.value ? new URL(resume.value.watchUrl).hostname : ''));
const panel = ref<HTMLElement>();
const item = ref<listElement>();
const sites = ref<TsugiSite[]>([]);
const mapped = ref<string[]>([]);
const position = ref({ left: '0px', top: '0px' });
const entries = computed(() =>
  item.value
    ? cardDestinations(item.value, sites.value, getQuicklinks(), titleSearch, mapped.value)
    : [],
);
let trigger: HTMLElement | null = null;
let generation = 0;
const favicon = (url: string) => utils.favicon(new URL(url).hostname);
function hideIcon(event: Event) {
  const image = event.target as HTMLImageElement;
  image.style.visibility = 'hidden';
  (image.nextElementSibling as HTMLElement).style.visibility = 'visible';
}
function close(restore = false) {
  generation += 1;
  panel.value?.hidePopover();
  trigger?.setAttribute('aria-expanded', 'false');
  if (restore) trigger?.focus({ preventScroll: true });
}
async function open(value: listElement, event: MouseEvent, activity?: PlaybackActivity) {
  event.preventDefault();
  event.stopPropagation();
  close();
  const current = generation;
  trigger = (event.target as HTMLElement).closest('.link') as HTMLElement;
  const rect = trigger!.getBoundingClientRect();
  item.value = value;
  resume.value = activity;
  mapped.value = [];
  const mode = getSyncMode(value.type);
  provider.value = connectedCardProvider(value, mode, providerCache.get(`${mode}/${value.url}`));
  providerLoading.value = !!provider.value && !provider.value.url;
  sites.value = defaultSites;
  const store = await chrome.storage.local.get(SITES_KEY).catch(() => ({}));
  if (current !== generation) return;
  if (Array.isArray(store[SITES_KEY])) sites.value = store[SITES_KEY].filter(isTsugiSite);
  await nextTick();
  const el = panel.value!;
  el.showPopover();
  trigger?.setAttribute('aria-haspopup', 'dialog');
  trigger?.setAttribute('aria-expanded', 'true');
  const width = el.getBoundingClientRect().width;
  const height = el.getBoundingClientRect().height;
  position.value = {
    left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`,
    top: `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - height - 12))}px`,
  };
  await nextTick();
  el.querySelector<HTMLElement>('.destination, .open-tsugi')?.focus({ preventScroll: true });
  if (providerLoading.value) resolveProvider(value, mode, current);
  if (value.malId) {
    try {
      const result = await getMalToKissApi(value.type, value.malId);
      if (current === generation)
        mapped.value = Object.values(result).flatMap(group =>
          Object.values(group as object)
            .map((entry: any) => entry.url)
            .filter(url => typeof url === 'string'),
        );
    } catch {
      /* Saved links and site searches remain available while offline. */
    }
  }
}
async function resolveProvider(value: listElement, mode: SyncTypes, current: number) {
  let single: SingleAbstract | undefined;
  try {
    single = getSingle(value.url);
    await single.update();
    const result = connectedCardProvider(value, mode, single.getDisplayUrl());
    if (result?.url) providerCache.set(`${mode}/${value.url}`, result.url);
    if (current === generation) provider.value = result;
  } catch {
    // Streaming choices still work if the connected service cannot resolve the title.
  } finally {
    single?.destroy();
    if (current === generation) providerLoading.value = false;
  }
}
function retryProvider() {
  if (!item.value) return;
  providerLoading.value = true;
  resolveProvider(item.value, getSyncMode(item.value.type), generation);
}
function outside(event: PointerEvent) {
  if (panel.value?.matches(':popover-open') && !event.composedPath().includes(panel.value)) close();
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    close(true);
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const links = Array.from(panel.value!.querySelectorAll<HTMLElement>('a, button'));
    const index = links.indexOf(document.activeElement as HTMLElement);
    links[(index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus({
      preventScroll: true,
    });
  }
}
function closeMenu(event: Event) {
  if (!panel.value?.contains(event.target as Node)) close();
}
onMounted(() => {
  document.addEventListener('pointerdown', outside);
  window.addEventListener('resize', closeMenu);
  document.addEventListener('scroll', closeMenu, true);
});

onUnmounted(() => {
  generation += 1;
  document.removeEventListener('pointerdown', outside);
  window.removeEventListener('resize', closeMenu);
  document.removeEventListener('scroll', closeMenu, true);
});
defineExpose({ open });
</script>
<style lang="less" scoped>
.card-sites-menu {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: 12px;
  width: 304px;
  max-width: calc(100vw - 24px);
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  box-sizing: border-box;
  color: var(--cl-text);
  background: var(--cl-background-solid);
  border: 1px solid var(--cl-backdrop);
  border-radius: 16px;
  box-shadow:
    0 4px 10px rgb(0 0 0 / 10%),
    0 18px 48px rgb(0 0 0 / 24%);
  font: inherit;
}
.menu-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 8px;
  font-size: 13px;
  color: var(--cl-light-text);
}
.menu-heading button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
}
.menu-heading .material-icons {
  font-size: 18px;
}
.menu-title {
  margin: 4px 8px 14px;
  font-weight: 600;
  font-size: 15px;
  line-height: 1.4;
}
.destination {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 8px;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
}
.destination:hover,
.destination:focus-visible,
.open-tsugi:hover,
.provider-link:hover {
  background: var(--cl-backdrop);
}
.destination:focus-visible,
button:focus-visible,
.open-tsugi:focus-visible,
.provider-link:focus-visible {
  outline: 2px solid var(--cl-primary);
  outline-offset: 2px;
}
.favicon {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  height: 36px;
  background: var(--cl-backdrop);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
}
.favicon > span {
  visibility: hidden;
}
.favicon img {
  position: absolute;
  width: 22px;
  height: 22px;
  z-index: 1;
}
.destination-text {
  display: grid;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.destination-text strong {
  font-size: 14px;
  font-weight: 600;
}
.destination-text small {
  font-size: 12px;
  color: var(--cl-light-text);
}
.outward {
  font-size: 17px;
  color: var(--cl-light-text);
}
.open-tsugi {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  border-top: 1px solid var(--cl-backdrop);
  padding: 14px 8px 4px;
  font-size: 13px;
}
.open-tsugi .material-icons {
  font-size: 18px;
}
.provider-link {
  display: flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  text-decoration: none;
  margin-top: 10px;
  border-top: 1px solid var(--cl-backdrop);
  padding: 12px 8px;
  font-size: 13px;
}
.provider-link > span:nth-child(2) {
  flex: 1;
}
.provider-favicon {
  flex-basis: 28px;
  height: 28px;
  border-radius: 7px;
}
.provider-favicon img {
  width: 18px;
  height: 18px;
}
.provider-pending {
  min-height: 28px;
  justify-content: space-between;
  color: var(--cl-light-text);
}
.provider-pending button {
  font: inherit;
  color: var(--cl-text);
  border: 0;
  background: transparent;
  text-decoration: underline;
  cursor: pointer;
}
.provider-link + .open-tsugi {
  margin-top: 0;
  padding-top: 10px;
}
.empty-sites {
  padding: 8px;
  font-size: 13px;
  color: var(--cl-light-text);
}
</style>
