<template>
  <div class="release-date">
    <span class="material-icons" aria-hidden="true">event</span>
    <div>
      <span class="date-label">{{ upcoming ? 'Premiere' : 'First released' }}</span
      ><strong>{{ releaseDateLabel(item.releaseDate) }}</strong
      ><time
        v-if="upcoming && item.nextAiring?.episode === 1"
        :datetime="new Date(item.nextAiring.timestamp).toISOString()"
        >{{ premiereTime }}</time
      >
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed } from 'vue';
import type { listElement } from '../../../_provider/listAbstract';
import { formatReleaseTime, releaseDateLabel } from '../../../utils/releaseDates';

const props = defineProps<{ item: listElement; upcoming: boolean }>();
const premiereTime = computed(() =>
  props.item.nextAiring
    ? formatReleaseTime(
        props.item.nextAiring.timestamp,
        api.settings.get('tsugiTimeZone'),
        api.settings.get('tsugiClock24'),
      )
    : '',
);
</script>
<style lang="less" scoped>
.release-date {
  display: flex;
  gap: 10px;
  padding: 14px 4px 18px;
}
.material-icons {
  font-size: 19px;
  color: #d65c45;
}
.release-date div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.date-label {
  font-size: 11px;
  color: var(--cl-light-text);
}
strong {
  font-size: 13px;
  line-height: 1.5;
  font-weight: 500;
}
time {
  font-size: 11px;
  color: var(--cl-light-text);
  line-height: 1.6;
}
</style>
