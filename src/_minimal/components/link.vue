<template>
  <router-link :to="props.to" :href="absolute" rel="noopener">
    <slot />
  </router-link>
</template>

<script lang="ts" setup>
import { computed, PropType } from 'vue';
import { RouteLocationRaw, useRouter } from 'vue-router';

const router = useRouter();

const props = defineProps({
  to: {
    type: [Object, String] as PropType<RouteLocationRaw>,
    required: true,
  },
});

const absolute = computed(() => {
  const href = router.resolve(props.to).href;
  if (api.type === 'webextension' && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return new URL(href, chrome.runtime.getURL('window.html')).href;
  }
  return utils.absoluteLink(href, 'https://malsync.moe/pwa');
});
</script>
