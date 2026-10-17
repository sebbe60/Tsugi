<template>
  <div class="display-controls">
    <div class="theme-switch" role="group" aria-label="Appearance">
      <button
        v-for="mode in themes"
        :key="mode.value"
        type="button"
        :title="mode.title"
        :aria-label="mode.title"
        :aria-pressed="theme === mode.value"
        @click="setTheme(mode.value)"
      >
        <span class="material-icons" aria-hidden="true">{{ mode.icon }}</span>
      </button>
    </div>
    <button
      v-if="showHeaderControl"
      type="button"
      class="header-toggle"
      :aria-label="headerHidden ? 'Show header' : 'Hide header'"
      :title="headerHidden ? 'Show header' : 'Hide header'"
      :aria-expanded="!headerHidden"
      @click="headerHidden = !headerHidden"
    >
      <span class="material-icons" aria-hidden="true">{{
        headerHidden ? 'visibility' : 'visibility_off'
      }}</span>
    </button>
    <HeaderSettings v-if="onWatching" />
    <button
      type="button"
      class="cursor-toggle"
      aria-label="Auto-hide fullscreen cursor"
      :title="`Auto-hide fullscreen cursor: ${cursorHidden ? 'on' : 'off'}`"
      :aria-pressed="cursorHidden"
      @click="toggleCursor"
    >
      <span class="material-icons" aria-hidden="true">mouse</span>
    </button>
    <details class="time-settings">
      <summary :title="`Time zone: ${zone}`" aria-label="Time zone and clock settings">
        <span class="material-icons" aria-hidden="true">public</span
        ><span class="zone-label">{{ zone.split('/').pop()?.replaceAll('_', ' ') }}</span>
      </summary>
      <div class="time-popover">
        <strong>Your release times</strong>
        <label for="tsugi-time-zone">Time zone</label>
        <input
          id="tsugi-time-zone"
          v-model="zoneInput"
          list="tsugi-time-zones"
          placeholder="Europe/Stockholm"
          @change="saveZone"
          @keydown.enter="saveZone"
        />
        <datalist id="tsugi-time-zones">
          <option v-for="item in zones" :key="item" :value="item" />
        </datalist>
        <p v-if="zoneError" role="alert">Use a valid time zone, such as Europe/Stockholm.</p>
        <button class="device-zone" type="button" @click="useDevice">Use device time zone</button>
        <label class="clock-choice"
          ><input type="checkbox" :checked="clock24" @change="setClock" />24-hour clock</label
        >
        <span class="time-example">{{ example }}</span>
      </div>
    </details>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import HeaderSettings from './header-settings.vue';
import {
  featuredHeaderHidden as headerHidden,
  featuredHeaderAvailable,
} from '../../utils/featuredHeader';
import { formatReleaseTime } from '../../../utils/releaseDates';

const route = useRoute();
const onWatching = computed(
  () =>
    route.name === 'Library' && route.params.section === 'watching' && route.query.type !== 'manga',
);
const showHeaderControl = computed(
  () =>
    route.name === 'Library' &&
    route.params.section === 'watching' &&
    route.query.type !== 'manga' &&
    featuredHeaderAvailable.value,
);

const themes = [
  { value: 'light', title: 'Light mode', icon: 'light_mode' },
  { value: 'dark', title: 'Dark mode', icon: 'dark_mode' },
  { value: 'auto', title: 'Use device appearance', icon: 'devices' },
];
const theme = computed(() => api.settings.get('theme'));
const setTheme = (value: string) => api.settings.set('theme', value);
const zone = computed(() => api.settings.get('tsugiTimeZone'));
const cursorHidden = computed(() => api.settings.get('tsugiFullscreenCursor'));
const toggleCursor = () => api.settings.set('tsugiFullscreenCursor', !cursorHidden.value);
const clock24 = computed(() => api.settings.get('tsugiClock24'));
const zoneInput = ref(zone.value);
const zoneError = ref(false);
const zones = [
  'Europe/Stockholm',
  'Europe/London',
  'Europe/Paris',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
];
watch(zone, value => {
  zoneInput.value = value;
});
const example = computed(() => formatReleaseTime(Date.now(), zone.value, clock24.value));
function saveZone() {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zoneInput.value.trim() }).format();
    api.settings.set('tsugiTimeZone', zoneInput.value.trim());
    zoneError.value = false;
  } catch {
    zoneError.value = true;
  }
}
function useDevice() {
  zoneInput.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  saveZone();
}
function setClock(event: Event) {
  api.settings.set('tsugiClock24', (event.target as HTMLInputElement).checked);
}
</script>
<style lang="less" scoped>
.display-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cursor-toggle,
.header-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--cl-light-text);
  background: transparent;
}
.cursor-toggle[aria-pressed='true'] {
  color: var(--cl-text);
  background: var(--cl-backdrop);
}
.cursor-toggle:hover,
.header-toggle:hover {
  background: var(--cl-backdrop);
}
.theme-switch {
  display: flex;
  padding: 3px;
  border-radius: 22px;
  background: var(--cl-backdrop);
}
button,
summary {
  cursor: pointer;
}
.theme-switch button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--cl-light-text);
}
.theme-switch button[aria-pressed='true'] {
  background: var(--cl-background-solid);
  color: var(--cl-text);
}
.material-icons {
  font-size: 20px;
}
.time-settings {
  position: relative;
}
summary {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  list-style: none;
  font-size: 12px;
}
summary::-webkit-details-marker {
  display: none;
}
.time-popover {
  position: absolute;
  top: 48px;
  right: 0;
  width: 260px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--cl-backdrop);
  background: var(--cl-background-solid);
  border-radius: 16px;
  box-shadow: 0 10px 40px #0002;
}
.time-popover input:not([type='checkbox']) {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--cl-light-text);
  border-radius: 7px;
  padding: 9px;
  font: inherit;
  background: var(--cl-background-solid);
  color: var(--cl-text);
}
.time-popover label,
.time-example,
.device-zone {
  font-size: 12px;
}
.device-zone {
  text-align: left;
  text-decoration: underline;
}
.clock-choice {
  display: flex;
  align-items: center;
  gap: 8px;
}
.time-example {
  color: var(--cl-light-text);
}
button:focus-visible,
summary:focus-visible,
input:focus-visible {
  outline: 2px solid #d65c45;
  outline-offset: 3px;
}

@media (max-width: 800px) {
  .zone-label {
    display: none;
  }
  .display-controls {
    gap: 4px;
  }
  .theme-switch button {
    width: 28px;
    height: 32px;
  }
}
</style>
