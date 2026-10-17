<template>
  <main class="library-page">
    <template v-if="section === 'history'">
      <HistoryGallery />
    </template>
    <DiscoverGallery v-else-if="section === 'discover'" />
    <SitesGallery v-else-if="section === 'sites'" />
    <template v-else>
      <Bookmarks
        :key="`${section}-${type}`"
        :type="type"
        :state="section === 'watching' ? '1' : '6'"
        :section="section"
      />
    </template>
  </main>
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import Bookmarks from './bookmarks.vue';
import SitesGallery from '../components/library/sites-gallery.vue';
import HistoryGallery from '../components/library/history-gallery.vue';
import DiscoverGallery from '../components/library/discover-gallery.vue';
import { isLibrarySection } from '../utils/library';
import { setTypeContext } from '../utils/state';

const route = useRoute();
const section = computed(() =>
  isLibrarySection(route.params.section) ? route.params.section : 'watching',
);
const type = computed(() =>
  route.query.type === 'manga' && !['history', 'discover'].includes(section.value)
    ? 'manga'
    : 'anime',
);
watch(type, value => setTypeContext(value), { immediate: true });
</script>

<style lang="less" scoped>
.library-page {
  min-width: 0;
}
</style>
