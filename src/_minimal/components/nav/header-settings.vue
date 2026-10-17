<template>
  <details ref="details" class="header-settings" @keydown.esc="close" @toggle="onToggle">
    <summary aria-label="Header settings" title="Header settings">
      <span class="material-icons" aria-hidden="true">tune</span>
    </summary>
    <div class="header-panel">
      <div class="panel-heading">
        <strong>Your header</strong
        ><button type="button" aria-label="Close header settings" @click="close">
          <span class="material-icons" aria-hidden="true">close</span>
        </button>
      </div>
      <span class="setting-label">Cover layout</span>
      <div class="layout-options" role="group" aria-label="Cover layout">
        <button
          v-for="layout in layouts"
          :key="layout.value"
          type="button"
          :aria-pressed="heroSettings.layout === layout.value"
          @click="heroSettings.layout = layout.value"
        >
          <span class="layout-preview" :class="layout.value" aria-hidden="true"><i></i><b></b></span
          >{{ layout.label }}
        </button>
      </div>
      <fieldset>
        <legend>Include</legend>
        <label
          ><input v-model="heroSettings.unfinished" type="checkbox" />Unfinished episodes
          <small>Resume at your saved position</small></label
        >
        <label
          ><input v-model="heroSettings.watching" type="checkbox" />Watching
          <small>Only with episodes available</small></label
        >
        <label
          ><input v-model="heroSettings.planned" type="checkbox" />Planned
          <small>Released titles only</small></label
        >
      </fieldset>
      <label class="setting-row"
        >Titles
        <select v-model.number="heroSettings.count">
          <option v-for="n in 10" :key="n" :value="n">{{ n }}</option>
        </select></label
      >
      <label class="setting-row"
        >Order
        <select v-model="heroSettings.priority">
          <option value="continue">Continue first</option>
          <option value="balanced">Even mix</option>
          <option value="planned">Planned first</option>
        </select></label
      >
      <label class="rotation-choice"
        ><input v-model="heroSettings.rotate" type="checkbox" />Rotate automatically
        <small>Every 10 seconds; pauses while you interact</small></label
      >
      <p
        v-if="!heroSettings.unfinished && !heroSettings.watching && !heroSettings.planned"
        role="status"
      >
        Select a source to show titles.
      </p>
      <button class="reset-settings" type="button" @click="heroSettings = { ...heroDefaults }">
        Reset to defaults
      </button>
    </div>
  </details>
</template>
<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { heroSettings, heroSettingsOpen } from '../../utils/featuredHeader';
import { heroDefaults } from '../../../utils/featuredCarousel';
const details = ref<HTMLDetailsElement>();
const layouts = [
  { value: 'poster', label: 'Poster' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'compact', label: 'Compact' },
] as const;
function close() {
  if (details.value) details.value.open = false;
  heroSettingsOpen.value = false;
  details.value?.querySelector('summary')?.focus();
}
function onToggle() {
  heroSettingsOpen.value = !!details.value?.open;
}
function outside(event: PointerEvent) {
  if (details.value?.open && !details.value.contains(event.target as Node)) {
    details.value.open = false;
    heroSettingsOpen.value = false;
  }
}
onMounted(() => document.addEventListener('pointerdown', outside));
onUnmounted(() => {
  heroSettingsOpen.value = false;
  document.removeEventListener('pointerdown', outside);
});
</script>
<style lang="less" scoped>
.header-settings {
  position: relative;
}
summary {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  list-style: none;
  color: var(--cl-light-text);
  cursor: pointer;
}
summary::-webkit-details-marker {
  display: none;
}
summary:hover,
.header-settings[open] summary {
  background: var(--cl-backdrop);
  color: var(--cl-text);
}
.material-icons {
  font-size: 20px;
}
.header-panel {
  position: absolute;
  z-index: 20;
  right: 0;
  top: 46px;
  width: 320px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 150px);
  overflow: auto;
  box-sizing: border-box;
  padding: 22px;
  background: var(--cl-background-solid);
  color: var(--cl-text);
  border: 1px solid var(--cl-backdrop);
  border-radius: 16px;
  box-shadow: 0 10px 40px #0003;
}
.panel-heading,
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.panel-heading {
  margin-bottom: 20px;
}
button {
  cursor: pointer;
  color: inherit;
}
.setting-label,
legend {
  font-size: 12px;
  color: var(--cl-light-text);
}
.layout-options {
  display: flex;
  gap: 8px;
  margin: 10px 0 20px;
}
.layout-options button {
  flex: 1;
  font-size: 11px;
  border-radius: 8px;
  padding: 5px;
  border: 1px solid var(--cl-backdrop);
}
.layout-options button[aria-pressed='true'] {
  border-color: #d24734;
  background: var(--cl-backdrop);
}
.layout-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 6px;
  box-sizing: border-box;
  background: #24252d;
  border-radius: 4px;
  margin-bottom: 7px;
}
.layout-preview i {
  display: block;
  width: 15px;
  height: 26px;
  background: #a18171;
  border-radius: 2px;
}
.layout-preview b {
  width: 22px;
  height: 4px;
  background: #ece6e0;
  box-shadow: 0 7px #8b8b93;
}
.layout-preview.cinematic {
  align-items: flex-end;
}
.layout-preview.cinematic i {
  display: none;
}
.layout-preview.cinematic b {
  margin-bottom: 9px;
  width: 32px;
}
.layout-preview.compact {
  height: 28px;
  margin-top: 12px;
}
.layout-preview.compact i {
  height: 18px;
  width: 12px;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0 0 18px;
}
fieldset label,
.rotation-choice {
  display: block;
  font-size: 13px;
  margin-top: 12px;
}
input {
  accent-color: #d24734;
  margin: 0 8px 0 0;
}
small {
  display: block;
  color: var(--cl-light-text);
  font-size: 11px;
  margin: 4px 0 0 22px;
}
.setting-row {
  font-size: 13px;
  margin-top: 12px;
}
select {
  background: var(--cl-background-solid);
  color: var(--cl-text);
  font: inherit;
  padding: 7px;
  border: 1px solid var(--cl-light-text);
  border-radius: 6px;
}
.reset-settings {
  font-size: 12px;
  text-decoration: underline;
  margin-top: 20px;
  color: var(--cl-light-text);
}
p {
  font-size: 12px;
}
button:focus-visible,
summary:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid #d65c45;
  outline-offset: 3px;
}

@media (max-width: 600px) {
  .header-panel {
    position: fixed;
    top: 76px;
    right: 16px;
    max-height: calc(100dvh - 92px);
  }
}
</style>
