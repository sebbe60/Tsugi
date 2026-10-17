<template>
  <div class="bookmarks">
    <FeaturedAnime
      v-if="props.section === 'watching' && parameters.type === 'anime'"
      :items="list"
      :loading="listRequest.loading"
      @launch="openSiteMenu"
    />
    <Section class="controls">
      <FormSwitch
        v-model="parameters.type"
        :options="[
          {
            value: 'anime',
            title: lang('Anime'),
          },
          {
            value: 'manga',
            title: lang('Manga'),
          },
        ]"
      />
      <MediaStatusDropdown
        v-if="!props.section"
        v-model="parameters.state"
        :type="parameters.type"
        :rewatching="
          listRequest.data
            ? listRequest.data?.seperateRewatching
            : parameters.state === status.Rewatching
        "
        :considering="
          listRequest.data
            ? listRequest.data?.consideringSupport
            : parameters.state === status.Considering
        "
      />
      <FormButton padding="pill" @click="refresh()">
        <div class="material-icons m-pill" :title="lang('updateCheck_Refresh')">refresh</div>
      </FormButton>
      <FormButton
        v-if="parameters.state === 6 || parameters.state === 3"
        padding="pill"
        @click="openRandom(parameters.state, parameters.type)"
      >
        <div class="material-icons m-pill" title="random">shuffle</div>
      </FormButton>
      <div style="flex-grow: 1"></div>
      <FormDropdown
        v-if="!props.section && sortingOptions && sortingOptions.length"
        v-model="sort"
        :options="sortingOptions"
        align-items="left"
        :compare-func="(el, picked) => el.toString() === picked.toString().replace('_asc', '')"
      >
        <template #select="slotProps">
          <div class="select-icon">
            <span
              v-if="slotProps.meta.asc"
              class="material-icons"
              @click.stop="
                sort.endsWith('_asc') ? (sort = sort.replace('_asc', '')) : (sort = sort + '_asc')
              "
            >
              {{ !sort.endsWith('_asc') ? 'arrow_downward' : 'arrow_upward' }}
            </span>
            <span class="material-icons">{{ slotProps.meta.icon || 'filter_list' }}</span>
          </div>
        </template>
        <template #option="slotProps">
          <TextIcon :icon="slotProps.option.meta.icon"> {{ slotProps.option.title }}</TextIcon>
        </template>
      </FormDropdown>
      <span v-else-if="!props.section" class="material-icons sortPlaceholder">filter_list</span>
      <span v-if="props.section" class="release-order">{{
        props.section === 'watching'
          ? 'Next releases first'
          : props.section === 'upcoming'
            ? 'Soonest first'
            : 'Newest releases first'
      }}</span>
      <FormDropdown
        v-model="theme"
        :options="options"
        align-items="left"
        direction="row"
        size="small"
      >
        <template #select>
          <span class="material-icons select-icon">{{ listTheme.icon }}</span>
        </template>
        <template #option="slotProps">
          <span class="material-icons select-icon">{{ slotProps.option.value }}</span>
        </template>
      </FormDropdown>
    </Section>

    <template v-if="!listRequest.error">
      <Section
        v-if="list"
        spacer="double"
        class="grid"
        :class="{ cached: cacheList.length && listRequest.loading }"
      >
        <Grid
          :key="listTheme.name"
          :min-width="
            props.section === 'watching' ? Math.max(280, listTheme.width) : listTheme.width
          "
          :min-width-popup="props.section === 'watching' ? 280 : listTheme.popupWidth"
          class="grid-el"
          :class="`type-${listTheme.name.replace(' ', '-').toLowerCase()}`"
        >
          <TransitionStaggered :delay-duration="listTheme.transition">
            <div
              v-for="item in list!"
              :key="item.uid"
              class="library-card"
              @click.capture="openSiteMenu(item as listElement, $event)"
            >
              <component :is="listTheme.component" :item="formatItem(item as listElement)" />
              <NextRelease
                v-if="props.section === 'watching' && parameters.type === 'anime'"
                :item="item as listElement"
              />
              <ReleaseDate
                v-else-if="props.section === 'upcoming' || props.section === 'planned'"
                :item="item as listElement"
                :upcoming="props.section === 'upcoming'"
              />
            </div>
          </TransitionStaggered>
        </Grid>
      </Section>
      <Section v-if="unknownList.length && !listRequest.loading" class="unknown-releases">
        <h2>Release status unknown</h2>
        <p>These planned titles have no confirmed release status from your list service.</p>
        <Grid :min-width="listTheme.width" :min-width-popup="listTheme.popupWidth"
          ><div
            v-for="item in unknownList"
            :key="item.uid"
            @click.capture="openSiteMenu(item as listElement, $event)"
          >
            <component
              :is="listTheme.component"
              :item="formatItem(item as listElement)"
            /><ReleaseDate :item="item as listElement" :upcoming="false" /></div
        ></Grid>
      </Section>
      <Section
        v-if="!listRequest.loading && list && !list.length && !unknownList.length"
        class="spinner-wrap"
      >
        <div v-if="props.section" class="collection-empty">
          <h2>
            {{
              props.section === 'upcoming'
                ? 'Nothing unreleased on your list yet.'
                : props.section === 'planned'
                  ? 'Your next watch starts here.'
                  : 'Ready for your next episode?'
            }}
          </h2>
          <p>
            {{
              props.section === 'upcoming'
                ? 'Only planned titles confirmed as unreleased by your list service appear here.'
                : 'Add a title from search, or connect your list service in Settings.'
            }}
          </p>
        </div>
        <Empty v-else />
      </Section>
      <Section v-if="listRequest.loading" class="spinner-wrap"><Spinner /></Section>
      <transition :duration="100">
        <Section
          v-if="!listRequest.loading && listRequest.data && !listRequest.data!.isDone()"
          class="spinner-wrap"
        >
          <Spinner />
        </Section>
      </transition>
    </template>

    <ErrorBookmarks :list-request="listRequest" />
    <CardSitesMenu v-if="props.section" ref="siteMenu" />
  </div>
</template>

<script lang="ts" setup>
import {
  computed,
  inject,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  PropType,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';
import Spinner from '../components/spinner.vue';
import ReleaseDate from '../components/library/release-date.vue';
import { isReleased, orderLibrary } from '../../utils/releaseDates';
import FeaturedAnime from '../components/library/featured-anime.vue';
import CardSitesMenu from '../components/library/card-sites-menu.vue';
import NextRelease from '../components/library/next-release.vue';
import FormSwitch from '../components/form/form-switch.vue';
import { setStateContext, setTypeContext } from '../utils/state';
import Section from '../components/section.vue';
import { createRequest } from '../utils/reactive';
import { getList } from '../../_provider/listFactory';
import Grid from '../components/grid.vue';
import TransitionStaggered from '../components/transition-staggered.vue';
import { bookmarkItem } from '../minimalClass';
import { ListAbstract, listElement } from '../../_provider/listAbstract';
import MediaStatusDropdown from '../components/media/media-status-dropdown.vue';
import FormDropdown from '../components/form/form-dropdown.vue';
import { bookmarkFormats } from '../utils/bookmarks';
import ErrorBookmarks from '../components/error/error-bookmarks.vue';
import Empty from '../components/empty.vue';
import TextIcon from '../components/text-icon.vue';
import FormButton from '../components/form/form-button.vue';
import { urlToSlug } from '../../utils/slugs';
import { localStore } from '../../utils/localStore';
import { status } from '../../_provider/definitions';
import { isUnreleased } from '../utils/library';

const siteMenu = ref<InstanceType<typeof CardSitesMenu>>();

const rootWindow = inject('rootWindow') as Window;
const rootDocument = inject('rootDocument') as Document;

const router = useRouter();

const props = defineProps({
  section: { type: String, default: '' },
  type: {
    type: String as PropType<'anime' | 'manga'>,
    default: 'anime',
  },
  state: {
    type: String,
    default: '2',
  },
});

function openSiteMenu(
  item: listElement,
  event: MouseEvent,
  activity?: import('../../utils/watchActivity').PlaybackActivity,
) {
  if (props.section && (event.target as HTMLElement).closest('.link'))
    siteMenu.value?.open(item, event, activity);
}

const parameters = ref({
  state: Number(props.state),
  type: props.type as 'anime' | 'manga',
});
const cacheList = ref([] as listElement[]);
const providers = new Set<ListAbstract>();
let disposed = false;

watch(
  () => props.type,
  value => {
    parameters.value.type = value as 'anime' | 'manga';
  },
);
watch(
  () => parameters.value.type,
  value => {
    router.push(
      props.section
        ? { name: 'Library', params: { section: props.section }, query: { type: value } }
        : { name: 'Bookmarks', params: { type: value } },
    );
    if (value) setTypeContext(value);
  },
);

watch(
  () => props.state,
  value => {
    parameters.value.state = Number(value);
    if (value) setStateContext(Number(value));
  },
);
watch(
  () => parameters.value.state,
  value => {
    if (!props.section) router.push({ name: 'Bookmarks', params: { state: Number(value) } });
  },
);

const getSort = sortingOptions => {
  const curSort = localStore.getItem(`sort/${parameters.value.type}/${parameters.value.state}`);
  if (curSort && sortingOptions.find(el => el.value === curSort.replace('_asc', '')))
    return curSort;
  return 'default';
};

const listRequest = createRequest(parameters, async param => {
  cacheList.value = [];
  const listProvider = await getList(param.value.state, param.value.type);
  if (disposed) return listProvider;
  providers.add(listProvider);

  listProvider.setSort(getSort(listProvider.getSortingOptions()));

  listProvider.modes.cached = true;
  listProvider.getCached().then(list => {
    cacheList.value = list;
  });

  listProvider.modes.initProgress = true;
  if (props.section === 'watching') listProvider.modes.sortAiring = true;
  listProvider.initFrontendMode();

  const request = props.section ? listProvider.getCompleteList() : listProvider.getNextPage();
  await request.catch(e => {
    throw { e, html: listProvider.errorMessage(e) };
  });

  return listProvider;
});

const sortNow = ref(Date.now());
let releaseSortTimer: ReturnType<typeof setInterval> | undefined;
const unknownList = computed(() => {
  if (props.section !== 'planned') return [];
  const items = listRequest.data && !listRequest.loading ? listRequest.data.getTemplist() : [];
  return items.filter(item => !isReleased(item) && !isUnreleased(item));
});
const list = computed(() => {
  let items = listRequest.data && !listRequest.loading ? listRequest.data.getTemplist() : null;
  if (cacheList.value.length && listRequest.loading) items = cacheList.value;
  if (!items) return null;
  if (props.section === 'upcoming') return orderLibrary(items.filter(isUnreleased), props.section);
  if (props.section === 'planned') return orderLibrary(items.filter(isReleased), props.section);
  if (props.section === 'watching')
    return orderLibrary(items, props.section, sortNow.value, api.settings.get('epPredictions'));
  return items;
});

const formatItem = (item: listElement): bookmarkItem => {
  const resItem = { ...item } as bookmarkItem;
  if (props.section && props.section !== 'watching') {
    delete resItem.progress;
    delete resItem.progressEp;
    delete resItem.progressText;
  }
  if (item.options) {
    const overview = item.options.u;
    const resumeUrlObj = item.options.r;
    const continueUrlObj = item.options.c;

    if (continueUrlObj && continueUrlObj.ep === item.watchedEp + 1) {
      resItem.streamUrl = continueUrlObj.url;
    } else if (resumeUrlObj && resumeUrlObj.ep === item.watchedEp) {
      resItem.streamUrl = resumeUrlObj.url;
    } else if (overview) {
      resItem.streamUrl = overview;
    }

    if (resItem.streamUrl) {
      resItem.streamIcon = utils.favicon(resItem.streamUrl.split('/')[2]);
    }
  }
  if (
    (!props.section || props.section === 'watching') &&
    item.fn.progress?.isAiring() &&
    item.fn.progress.progress()
  ) {
    resItem.progressText = item.fn.progress.progress()!.getAutoText();
    resItem.progressEp = item.fn.progress.progress()!.getCurrentEpisode() || undefined;
    resItem.progress = item.fn.progress;
  }
  return resItem;
};

const options = bookmarkFormats.map(format => ({
  value: format.icon,
  title: format.name,
}));

const theme = computed({
  get() {
    return api.settings.get(`bookMarksList${props.type === 'manga' ? 'Manga' : ''}`);
  },
  set(value) {
    api.settings.set(`bookMarksList${props.type === 'manga' ? 'Manga' : ''}`, value);
  },
});

const listTheme = computed(() => {
  const f = bookmarkFormats.find(format => format.icon === theme.value);

  if (!f) {
    return bookmarkFormats[0];
  }

  return f;
});

async function loadNext() {
  if (!listRequest.data || listRequest.data.isLoading()) return;
  await listRequest.data.getNextPage();
}

let scrollDebounce: ReturnType<typeof setTimeout>;

const handleScroll = () => {
  clearTimeout(scrollDebounce);
  scrollDebounce = setTimeout(() => {
    if (
      rootWindow.pageYOffset + rootWindow.innerHeight >
      rootDocument.documentElement.scrollHeight - 600
    ) {
      loadNext();
    }
  }, 100);
};

watch(list, () => handleScroll());

watch(
  () => listRequest.data,
  () => handleScroll(),
);

onActivated(() => {
  rootWindow.addEventListener('scroll', handleScroll);
});

onDeactivated(() => {
  rootWindow.removeEventListener('scroll', handleScroll);
});

onMounted(() => {
  releaseSortTimer = setInterval(() => {
    sortNow.value = Date.now();
  }, 30_000);
  rootWindow.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
  disposed = true;
  clearInterval(releaseSortTimer);
  providers.forEach(provider => provider.destroy());
  providers.clear();
  rootWindow.removeEventListener('scroll', handleScroll);
});

const sortingOptions = computed(() => {
  const temp = listRequest.data ? listRequest.data.getSortingOptions(true) : [];

  return temp.map(option => ({
    value: option.value,
    title: option.title,
    meta: {
      icon: option.icon,
      asc: option.asc,
    },
  }));
});

const sort = computed({
  get() {
    return getSort(sortingOptions.value);
  },
  set(value) {
    localStore.setItem(`sort/${parameters.value.type}/${parameters.value.state}`, value);
    listRequest.execute();
  },
});

const randomListCache = {};
async function openRandom(st, type) {
  const cacheKey = `${st}-${type}`;
  if (typeof randomListCache[cacheKey] === 'undefined' || !randomListCache[cacheKey].length) {
    utils.flashm('Loading');
    const listProvider = await getList(st, type);
    await listProvider
      .getCompleteList()
      .then(async res => {
        randomListCache[cacheKey] = res;
      })
      .catch(e => {
        con.error(e);
      });
  }
  if (typeof randomListCache[cacheKey] !== 'undefined' && randomListCache[cacheKey].length > 1) {
    const currentUrl =
      randomListCache[cacheKey][Math.floor(Math.random() * randomListCache[cacheKey].length)].url;
    const slugObj = urlToSlug(currentUrl);
    router.push({ name: 'Overview', params: slugObj.path });
  } else {
    utils.flashm('List is too small!');
  }
}

function refresh() {
  listRequest.execute();
}
</script>

<style lang="less" scoped>
@import '../less/_globals.less';
.bookmarks {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}
.spinner-wrap {
  flex-grow: 1;
  display: flex;
  align-items: center;
}
.controls {
  display: flex;
  gap: @spacer-half;
  flex-wrap: wrap;
  min-height: 30px;
}

.grid {
  transition:
    filter @normal-transition,
    opacity @normal-transition;
  &.cached {
    opacity: 0.4;
    filter: grayscale(1);
    transition: none;
  }

  .grid-el {
    &.type-tiles {
      gap: 20px;
      .__breakpoint-popup__({
        gap: @spacer;
      });
    }
  }
}

.sortPlaceholder {
  padding-top: 3px;
  pointer-events: not-allowed;
}

.select-icon {
  display: flex;
}

.__breakpoint-popup__({
  .m-pill {
    font-size: 20px;
  }
});
</style>

<style lang="less" scoped>
.release-order {
  font-size: 12px;
  color: var(--cl-light-text);
  align-self: center;
}
.unknown-releases {
  margin-top: 36px;
  h2 {
    font-size: 22px;
  }
  p {
    color: var(--cl-light-text);
    font-size: 13px;
    margin-bottom: 24px;
  }
}
.collection-empty {
  margin: 64px auto;
  max-width: 480px;
  text-align: center;
  h2 {
    font-size: 24px;
    letter-spacing: -0.6px;
  }
  p {
    line-height: 1.7;
    color: var(--cl-light-text);
  }
}
</style>
