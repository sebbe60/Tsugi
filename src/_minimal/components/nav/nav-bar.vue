<template>
  <div id="header" :class="{ scrolled, desktop: desktopTab }">
    <div class="nav">
      <Link v-if="desktopTab" to="/library/watching" class="brand" aria-label="Tsugi home">
        <img :src="brandIcon" alt="" width="36" height="36" />
        <span>Tsugi</span>
      </Link>
      <NavBack />
      <Link
        v-if="!desktopTab"
        class="link library-link"
        aria-label="Library"
        title="Library"
        :to="{
          name: 'Bookmarks',
          params: { type: getTypeContext().value, state: getStateContext().value },
        }"
        @click="!desktopTab && route.name === 'Bookmarks' ? router.go(-1) : null"
      >
        <span class="material-icons">
          {{ route.name === 'Bookmarks' ? 'bookmarks' : 'bookmark' }}
        </span>
      </Link>

      <NavSearch class="flex-grow desktop-search" />

      <DisplayControls v-if="desktopTab" />
      <Link
        to="/settings"
        class="link"
        :aria-label="lang('minimalApp_Settings')"
        :title="lang('minimalApp_Settings')"
      >
        <span class="material-icons">settings</span>
      </Link>
      <span v-if="fullscreenFunction" class="material-icons link" @click="fullscreenFunction()"
        >fullscreen</span
      >
      <span v-if="!desktopTab" class="material-icons link close-fix" @click="closeWindow()"
        >close</span
      >
    </div>
    <nav v-if="desktopTab" class="library-tabs" aria-label="Your library">
      <Link
        v-for="section in librarySections"
        :key="section.key"
        :to="{
          name: 'Library',
          params: { section: section.key },
          query: { type: getTypeContext().value },
        }"
        class="library-tab"
        :class="{ active: activeSection === section.key }"
        :aria-current="
          route.name === 'Library' && activeSection === section.key ? 'page' : undefined
        "
        >{{ section.title }}</Link
      >
    </nav>
  </div>
</template>

<script lang="ts" setup>
import { inject, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getStateContext, getTypeContext } from '../../utils/state';
import DisplayControls from './display-controls.vue';
import NavSearch from './nav-search.vue';
import NavBack from './nav-back.vue';
import Link from '../link.vue';
import { isLibrarySection, librarySections, LibrarySection } from '../../utils/library';

const scrolled = ref(false);

const rootBody = inject('rootBody') as HTMLElement;
const rootHtml = inject('rootHtml') as HTMLElement;
const rootWindow = inject('rootWindow') as Window;
const closeFunction = inject('closeFunction') as () => void;
const fullscreenFunction = inject('fullscreenFunction') as () => void;
const desktopTab =
  api.type === 'webextension' &&
  rootHtml.getAttribute('mode') === 'window' &&
  rootWindow.parent === rootWindow;
const brandIcon = desktopTab ? chrome.runtime.getURL('icons/icon48.png') : '';

const route = useRoute();
const router = useRouter();
const activeSection = ref<LibrarySection>('watching');
watch(
  () => route.params.section,
  value => {
    if (isLibrarySection(value)) activeSection.value = value;
  },
  { immediate: true },
);

function scrollEvent() {
  const scrollPos = rootHtml.scrollTop || rootBody.scrollTop;
  if (scrollPos > 30) {
    scrolled.value = true;
  } else {
    scrolled.value = false;
  }
}
scrollEvent();

onMounted(() => {
  rootWindow.addEventListener('scroll', scrollEvent);
});

onUnmounted(() => {
  rootWindow.removeEventListener('scroll', scrollEvent);
});

const closeWindow = () => {
  closeFunction();
};
</script>

<style lang="less" scoped>
@import '../../less/_globals.less';
#header {
  .block-select();
  .border-radius();

  position: sticky;
  padding: 0 @spacer;
  top: -20px;
  z-index: 10;
  transition: box-shadow 0.1s;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  background-color: var(--cl-background);

  .nav {
    .flex-row();

    padding-top: 30px;
    padding-bottom: 10px;
  }

  .link {
    .click-move-down();
    .link();

    display: flex;
    align-items: center;
  }

  .material-icons {
    font-size: 30px;
    height: 30px;
    width: 30px;

    &.close-fix {
      font-size: 38px;
      position: relative;
      inset-inline-start: -4px;
    }
  }

  .__breakpoint-popup__({
    top: -10px;
    margin-bottom: @spacer-half;
    .nav {
      padding-top: 20px;
    }
  });
}

.custom.backImage #header {
  background-color: transparent;
}

#header.scrolled {
  .big-shadow();
}

.backImage #header.scrolled {
  background-color: var(--cl-background);
  backdrop-filter: blur(15px);
}
</style>

<style lang="less" scoped>
#header.desktop {
  top: 0;
  margin-bottom: 0;
  padding: 0 clamp(20px, 3vw, 56px);
  border-radius: 0;
  border-bottom: 1px solid var(--cl-backdrop);

  .nav {
    min-height: 88px;
    padding: 16px 0;
    gap: 24px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -1px;
  }

  .desktop-search {
    min-width: 0;
    max-width: 640px;
    margin-inline: auto;
  }

  .link {
    justify-content: center;
    min-height: 44px;
    min-width: 44px;
  }

  :deep(a:focus-visible) {
    outline: 2px solid var(--cl-primary);
    outline-offset: 5px;
    border-radius: 8px;
  }

  @media (max-width: 600px) {
    padding: 0 16px;

    .nav {
      gap: 12px;
      min-height: 72px;
    }

    .brand {
      gap: 0;
      span {
        display: none;
      }
    }

    .link {
      min-width: 32px;
    }
  }
}
</style>

<style lang="less" scoped>
.library-tabs {
  display: flex;
  gap: 32px;
  overflow-x: auto;
  scrollbar-width: none;
}
.library-tab {
  padding: 14px 0 16px;
  border-bottom: 3px solid transparent;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  color: var(--cl-light-text);
  &.active {
    color: var(--cl-text);
    border-color: #e63424;
    font-weight: 600;
  }
  &:hover {
    color: var(--cl-text);
  }
}

@media (max-width: 600px) {
  .library-tabs {
    gap: 24px;
  }
  .library-tab {
    font-size: 13px;
  }
}
</style>
