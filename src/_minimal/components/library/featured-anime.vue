<template>
  <Teleport to="#tsugi-featured-header">
    <section
      v-if="slide && !hidden && active"
      ref="hero"
      class="featured-anime"
      :class="`layout-${settings.layout}`"
      role="region"
      aria-roledescription="carousel"
      aria-label="Your next watch"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
      @focusin="focused = true"
      @focusout="focusOut"
      @keydown="onKey"
    >
      <img
        v-if="backdrop && !failedBackdrop"
        :key="backdrop"
        class="hero-backdrop"
        :src="backdrop"
        alt=""
        @error="failedBackdrop = true"
      />
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="hero-content">
        <img
          v-if="cover && !failedCover"
          :key="cover"
          class="hero-cover"
          :src="cover"
          :alt="`${slide.item.title} cover`"
          @error="failedCover = true"
        />
        <div class="hero-copy">
          <span class="hero-context">{{
            slide.kind === 'unfinished'
              ? 'Right where you left off'
              : slide.kind === 'planned'
                ? 'From your planned list'
                : 'Ready when you are'
          }}</span>
          <h2>{{ slide.item.title }}</h2>
          <p v-if="slide.activity">
            Episode {{ slide.activity.episode }} · {{ playbackTime(slide.activity.position) }} of
            {{ playbackTime(slide.activity.duration) }}
          </p>
          <p v-else>
            {{
              slide.kind === 'planned'
                ? 'Your next story starts here.'
                : `Episode ${slide.item.watchedEp + 1} · ${remaining} ${remaining === 1 ? 'episode' : 'episodes'} available to watch`
            }}
          </p>
          <div
            v-if="slide.activity"
            class="resume-progress"
            role="progressbar"
            :aria-valuenow="Math.round((slide.activity.position / slide.activity.duration) * 100)"
            :aria-valuemin="0"
            :aria-valuemax="100"
            aria-label="Episode watched"
          >
            <span
              :style="{
                width: `${Math.min(100, (slide.activity.position / slide.activity.duration) * 100)}%`,
              }"
            ></span>
          </div>
          <button
            type="button"
            class="hero-watch link"
            aria-haspopup="dialog"
            @click="$emit('launch', slide.item, $event, slide.activity)"
          >
            <span class="material-icons" aria-hidden="true">play_arrow</span
            >{{
              slide.kind === 'unfinished'
                ? 'Resume episode'
                : slide.kind === 'planned'
                  ? 'Start watching'
                  : 'Continue watching'
            }}<span class="material-icons arrow" aria-hidden="true">expand_more</span>
          </button>
        </div>
      </div>
      <div v-if="slides.length > 1" class="hero-navigation">
        <button type="button" aria-label="Previous title" @click="step(-1)">
          <span class="material-icons" aria-hidden="true">chevron_left</span>
        </button>
        <div class="hero-dots" role="group" aria-label="Choose featured title">
          <button
            v-for="(entry, n) in slides"
            :key="entry.key"
            type="button"
            :aria-label="`Show ${entry.item.title}`"
            :aria-current="index === n ? 'true' : undefined"
            :title="entry.item.title"
            @click="choose(n)"
          >
            <span></span>
          </button>
        </div>
        <span class="slide-count">{{ index + 1 }} / {{ slides.length }}</span>
        <button type="button" aria-label="Next title" @click="step(1)">
          <span class="material-icons" aria-hidden="true">chevron_right</span>
        </button>
        <button
          v-if="settings.rotate && !reducedMotion"
          type="button"
          :aria-label="paused ? 'Play header rotation' : 'Pause header rotation'"
          :aria-pressed="paused"
          @click="
            paused = !paused;
            resetRotation();
          "
        >
          <span class="material-icons" aria-hidden="true">{{
            paused ? 'play_arrow' : 'pause'
          }}</span>
        </button>
      </div>
      <span class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</span>
    </section>
  </Teleport>
</template>
<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { listElement, ListAbstract } from '../../../_provider/listAbstract';
import { getList } from '../../../_provider/listFactory';
import { availableEpisodes } from '../../../utils/featuredAnime';
import { heroSlides } from '../../../utils/featuredCarousel';
import { HISTORY_PREFIX, isWatchEvent, WatchEvent } from '../../../utils/watchHistory';
import {
  PLAYBACK_PREFIX,
  isPlaybackActivity,
  PlaybackActivity,
  playbackTime,
} from '../../../utils/watchActivity';
import {
  featuredHeaderHidden as hidden,
  featuredHeaderAvailable,
  heroSettings as settings,
  heroSettingsOpen,
} from '../../utils/featuredHeader';
const props = defineProps<{ items: listElement[] | null; loading: boolean }>();
defineEmits<{ launch: [item: listElement, event: MouseEvent, activity?: PlaybackActivity] }>();
const route = useRoute();
const active = computed(
  () =>
    route.name === 'Library' && route.params.section === 'watching' && route.query.type !== 'manga',
);
const events = ref<WatchEvent[]>([]);
const activities = ref<PlaybackActivity[]>([]);
const plannedItems = ref<listElement[]>([]);
const now = ref(Date.now());
const slides = computed(() =>
  heroSlides(
    props.items || [],
    plannedItems.value,
    activities.value,
    events.value,
    settings.value,
    now.value,
  ),
);
const index = ref(0);
const slide = computed(() => slides.value[index.value]);
watch(
  slides,
  (value, old) => {
    const key = old?.[index.value]?.key;
    index.value = Math.max(
      0,
      value.findIndex(s => s.key === key),
    );
    featuredHeaderAvailable.value = !!value.length;
  },
  { immediate: true },
);
const remaining = computed(() =>
  slide.value
    ? Math.max(0, availableEpisodes(slide.value.item, now.value) - slide.value.item.watchedEp)
    : 0,
);
const cover = computed(() => slide.value?.item.imageLarge || slide.value?.item.image || '');
const backdrop = computed(() => slide.value?.item.imageBanner || cover.value);
const failedBackdrop = ref(false);
const failedCover = ref(false);
watch(
  () => slide.value?.key,
  () => {
    failedBackdrop.value = false;
    failedCover.value = false;
  },
);
const hero = ref<HTMLElement>();
const hovered = ref(false);
const focused = ref(false);
const paused = ref(false);
const announcement = ref('');
const reducedMotion = ref(false);
let lastRotation = Date.now();
function resetRotation() {
  lastRotation = Date.now();
}
function choose(n: number) {
  index.value = n;
  resetRotation();
  announcement.value = `${n + 1} of ${slides.value.length}: ${slide.value?.item.title}`;
}
function step(direction: number) {
  choose((index.value + direction + slides.value.length) % slides.value.length);
}
function focusOut(event: FocusEvent) {
  focused.value = !!hero.value?.contains(event.relatedTarget as Node);
  resetRotation();
}
function onKey(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  step(event.key === 'ArrowRight' ? 1 : -1);
}
let provider: ListAbstract | undefined;
let disposed = false;
let fetching = false;
let fetched = false;
let timer: ReturnType<typeof setInterval>;
async function loadPlanned() {
  if (
    props.loading ||
    (!settings.value.planned && !settings.value.unfinished) ||
    fetching ||
    fetched
  )
    return;
  fetching = true;
  try {
    provider?.destroy();
    provider = await getList(6, 'anime');
    if (disposed) {
      provider?.destroy();
      return;
    }
    const items = await provider!.getCompleteList();
    if (!disposed) {
      plannedItems.value = items;
      fetched = true;
    }
  } catch (error) {
    con.error('Featured planned anime could not load', error);
  } finally {
    fetching = false;
  }
}
watch(
  () => props.loading,
  (value, previous) => {
    if (value && !previous) fetched = false;
    loadPlanned();
  },
  { immediate: true },
);
watch(() => settings.value.planned || settings.value.unfinished, loadPlanned);
async function loadHistory() {
  const store = await chrome.storage.local.get(null);
  if (disposed) return;
  events.value = Object.entries(store)
    .filter(([key, value]) => key.startsWith(HISTORY_PREFIX) && isWatchEvent(value))
    .map(([, value]) => value as WatchEvent);
  activities.value = Object.entries(store)
    .filter(([key, value]) => key.startsWith(PLAYBACK_PREFIX) && isPlaybackActivity(value))
    .map(([, value]) => value as PlaybackActivity);
}
function storageChanged(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  if (
    area === 'local' &&
    Object.keys(changes).some(
      key => key.startsWith(HISTORY_PREFIX) || key.startsWith(PLAYBACK_PREFIX),
    )
  )
    loadHistory().catch(error => con.error('Featured history could not load', error));
}
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
function motionChanged() {
  reducedMotion.value = motion.matches;
  resetRotation();
}
function visibilityChanged() {
  resetRotation();
}
onMounted(() => {
  loadHistory().catch(error => con.error('Featured history could not load', error));
  chrome.storage.onChanged.addListener(storageChanged);
  motionChanged();
  motion.addEventListener('change', motionChanged);
  document.addEventListener('visibilitychange', visibilityChanged);
  timer = setInterval(() => {
    now.value = Date.now();
    if (
      !active.value ||
      hidden.value ||
      !settings.value.rotate ||
      paused.value ||
      hovered.value ||
      focused.value ||
      heroSettingsOpen.value ||
      reducedMotion.value ||
      document.hidden ||
      document.querySelector('.card-sites-menu:popover-open')
    ) {
      resetRotation();
      return;
    }
    if (slides.value.length > 1 && Date.now() - lastRotation >= 10_000) {
      index.value = (index.value + 1) % slides.value.length;
      resetRotation();
    }
  }, 1000);
});
onUnmounted(() => {
  disposed = true;
  featuredHeaderAvailable.value = false;
  provider?.destroy();
  clearInterval(timer);
  chrome.storage.onChanged.removeListener(storageChanged);
  motion.removeEventListener('change', motionChanged);
  document.removeEventListener('visibilitychange', visibilityChanged);
});
</script>
<style lang="less" scoped>
.featured-anime {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 360px;
  background: #15161b;
}
.hero-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
  z-index: -2;
}
.hero-shade {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(90deg, rgb(0 0 0 / 60%), rgb(0 0 0 / 30%) 70%);
}
.hero-content {
  display: flex;
  align-items: center;
  gap: 28px;
  min-height: 360px;
  padding: 32px clamp(20px, 3vw, 56px) 66px;
  max-width: 1600px;
  margin-inline: auto;
  box-sizing: border-box;
}
.hero-cover {
  width: 140px;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: 10px;
  box-shadow:
    0 3px 6px rgb(0 0 0 / 12%),
    0 12px 28px rgb(0 0 0 / 20%);
}
.hero-copy {
  max-width: 530px;
  color: #fff;
  text-shadow: 0 1px 4px rgb(0 0 0 / 85%);
}
.hero-context {
  font-size: 12px;
  color: rgb(255 255 255 / 85%);
}
h2 {
  margin: 10px 0 12px;
  font-size: clamp(24px, 3.2vw, 40px);
  line-height: 1.12;
  letter-spacing: -1px;
  text-wrap: balance;
}
.hero-copy p {
  margin: 0 0 22px;
  font-size: 14px;
  line-height: 1.6;
}
.hero-watch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  background: #d24734;
  color: #fff;
  border: 0;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-shadow: none;
}
.hero-watch:hover {
  background: #b93625;
}
.hero-watch .arrow {
  font-size: 18px;
  margin-left: 8px;
}
.resume-progress {
  width: 180px;
  max-width: 100%;
  height: 3px;
  border-radius: 2px;
  background: #ffffff40;
  overflow: hidden;
  margin: -9px 0 20px;
}
.resume-progress span {
  display: block;
  height: 100%;
  background: #fff;
}
.hero-navigation {
  position: absolute;
  bottom: 17px;
  right: clamp(20px, 3vw, 56px);
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}
.hero-navigation > button {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0006;
  color: #fff;
  cursor: pointer;
}
.hero-navigation > button:hover {
  background: #000a;
}
.hero-dots {
  display: flex;
  align-items: center;
}
.hero-dots button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 32px;
  cursor: pointer;
}
.hero-dots span {
  width: 5px;
  height: 5px;
  border-radius: 5px;
  background: #fff8;
}
.hero-dots [aria-current='true'] span {
  width: 16px;
  background: #fff;
}
.slide-count {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  min-width: 32px;
  text-align: center;
}
button:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
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
.layout-cinematic {
  min-height: 410px;
}
.layout-cinematic .hero-content {
  min-height: 410px;
  align-items: flex-end;
}
.layout-cinematic .hero-cover {
  display: none;
}
.layout-cinematic h2 {
  font-size: clamp(28px, 3.8vw, 48px);
}
.layout-cinematic .hero-shade {
  background:
    linear-gradient(0deg, rgb(0 0 0 / 72%), rgb(0 0 0 / 15%) 100%),
    linear-gradient(90deg, rgb(0 0 0 / 35%), transparent);
}
.layout-compact,
.layout-compact .hero-content {
  min-height: 245px;
}
.layout-compact .hero-content {
  padding-top: 24px;
  padding-bottom: 56px;
  gap: 22px;
}
.layout-compact .hero-cover {
  width: 92px;
  border-radius: 6px;
}
.layout-compact h2 {
  font-size: clamp(22px, 2.4vw, 30px);
  margin: 8px 0;
}
.layout-compact .hero-copy p {
  margin-bottom: 14px;
}
.layout-compact .hero-watch {
  padding: 9px 15px;
  font-size: 12px;
}

@media (max-width: 600px) {
  .featured-anime,
  .hero-content {
    min-height: 320px;
  }
  .hero-content {
    padding: 26px 18px 66px;
    gap: 16px;
  }
  .hero-cover {
    width: 84px;
  }
  h2 {
    font-size: 24px;
  }
  .hero-copy p {
    font-size: 12px;
    margin-bottom: 16px;
  }
  .hero-watch {
    font-size: 12px;
    padding: 10px 12px;
    gap: 4px;
  }
  .hero-watch .arrow {
    margin-left: 0;
  }
  .hero-navigation {
    right: 16px;
    gap: 3px;
  }
  .layout-cinematic,
  .layout-cinematic .hero-content {
    min-height: 360px;
  }
  .layout-compact .hero-content {
    gap: 14px;
  }
  .layout-compact .hero-cover {
    width: 66px;
  }
}
</style>
