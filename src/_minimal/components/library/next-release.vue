<template>
  <div class="next-release" :class="{ scheduled: release.timestamp }">
    <span class="release-icon material-icons" aria-hidden="true">{{
      release.timestamp ? 'schedule' : 'event'
    }}</span>
    <div class="release-copy">
      <span class="release-eyebrow"
        >{{ release.episode !== null ? `EPISODE ${release.episode}` : 'NEXT EPISODE'
        }}<span v-if="release.estimated"> · ESTIMATED</span></span
      >
      <strong>{{ release.label }}</strong>
      <time v-if="release.timestamp" :datetime="new Date(release.timestamp).toISOString()">{{
        dateText
      }}</time>
      <span v-else class="release-detail">{{ release.detail }}</span>
      <span v-if="release.timestamp" class="release-source"
        >{{ release.detail }} · {{ timeZone }}</span
      >
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { listElement } from '../../../_provider/listAbstract';
import { formatReleaseTime } from '../../../utils/releaseDates';
import { nextRelease } from '../../../utils/libraryHistory';

const props = defineProps<{ item: listElement }>();
const now = ref(Date.now());
const timeZone = computed(() => api.settings.get('tsugiTimeZone'));
let timer: ReturnType<typeof setInterval> | undefined;
const release = computed(() =>
  nextRelease(props.item, now.value, api.settings.get('epPredictions')),
);
const dateText = computed(() =>
  release.value.timestamp
    ? formatReleaseTime(
        release.value.timestamp,
        api.settings.get('tsugiTimeZone'),
        api.settings.get('tsugiClock24'),
      )
    : '',
);
const tick = () => {
  now.value = Date.now();
};
onMounted(() => {
  timer = setInterval(tick, 30_000);
  document.addEventListener('visibilitychange', tick);
});
onUnmounted(() => {
  clearInterval(timer);
  document.removeEventListener('visibilitychange', tick);
});
</script>

<style lang="less" scoped>
.next-release {
  display: flex;
  gap: 12px;
  margin-top: 10px;
  padding: 16px;
  border-radius: 12px;
  background: var(--cl-backdrop);
  color: var(--cl-light-text);
  min-height: 102px;
  box-sizing: border-box;
}
.scheduled {
  border-left: 3px solid #d65c45;
  .release-icon {
    color: #d65c45;
  }
  strong {
    color: var(--cl-text);
  }
}
.release-icon {
  font-size: 21px;
  margin-top: 2px;
}
.release-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.release-eyebrow {
  font-size: 10px;
  letter-spacing: 1.2px;
  font-weight: 600;
}
strong {
  font-size: 22px;
  letter-spacing: -0.6px;
  line-height: 1.2;
}
time,
.release-detail {
  font-size: 12px;
  line-height: 1.5;
}
.release-source {
  font-size: 10px;
  line-height: 1.4;
}
</style>
