<template>
  <section class="sites-page">
    <header class="sites-heading">
      <button class="add-site" type="button" @click="openForm()">
        <span class="material-icons" aria-hidden="true">add</span>Add a site
      </button>
    </header>
    <form v-if="formOpen" class="site-form" @submit.prevent="saveSite">
      <label
        >Site name<input v-model="nameInput" required maxlength="80" placeholder="My anime site"
      /></label>
      <label
        >Website URL<input v-model="urlInput" required placeholder="https://example.com"
      /></label>
      <button type="submit">{{ editing ? 'Save changes' : 'Save site' }}</button
      ><button type="button" @click="formOpen = false">Cancel</button>
    </form>
    <p v-if="error" role="alert" class="site-error">{{ error }}</p>
    <p v-if="loading" role="status">Loading your sites…</p>
    <div v-else class="site-grid">
      <article v-for="site in sites" :key="site.id" class="site-card">
        <a
          :href="site.url"
          target="_blank"
          rel="noopener noreferrer"
          class="site-art"
          :class="siteTone(site.url)"
          :aria-label="`Open ${site.name} in a new tab`"
          ><span class="art-orbit" aria-hidden="true"></span
          ><span class="site-monogram" aria-hidden="true">{{ site.name.slice(0, 2) }}</span
          ><span class="visit-icon material-icons" aria-hidden="true">north_east</span
          ><span class="site-domain">{{ hostname(site.url) }}</span></a
        >
        <div class="site-content">
          <h2>
            <a :href="site.url" target="_blank" rel="noopener noreferrer">{{ site.name }}</a>
          </h2>
          <span class="tracking-state" :class="{ ready: adapter(site) && permissions[site.id] }"
            ><span class="status-dot"></span
            >{{
              adapter(site)
                ? permissions[site.id]
                  ? 'Tracking access enabled'
                  : 'Tracking needs site access'
                : 'Saved link · tracking unavailable'
            }}</span
          >
          <p v-if="health(site)?.syncedAt" class="health-message">
            Last tracked: {{ health(site)?.title }} · Episode {{ health(site)?.episode
            }}<time>{{ healthTime(health(site)!.syncedAt!) }}</time>
          </p>
          <p v-else-if="health(site)?.playerSeenAt" class="health-message">
            Player detected · {{ Math.round((health(site)?.progress || 0) * 100) }}% playback<time
              >Last seen {{ healthTime(health(site)!.playerSeenAt!) }}</time
            >
          </p>
          <p v-else class="health-message">
            {{
              adapter(site)
                ? 'Playback and account sync have not been verified in this browser yet.'
                : 'You can open this site here. It needs a tracking adapter before Tsugi can sync it.'
            }}
          </p>
          <div class="site-actions">
            <button
              v-if="adapter(site) && !permissions[site.id]"
              class="enable-site"
              type="button"
              @click="enable(site)"
            >
              Enable tracking</button
            ><a v-else :href="site.url" target="_blank" rel="noopener noreferrer">Open site</a
            ><button type="button" :aria-label="`Edit ${site.name}`" @click="openForm(site)">
              <span class="material-icons" aria-hidden="true">edit</span></button
            ><button
              type="button"
              :aria-label="`Remove ${site.name} from My sites`"
              @click="remove(site)"
            >
              <span class="material-icons" aria-hidden="true">close</span>
            </button>
          </div>
        </div>
      </article>
    </div>
    <p v-if="!loading && !sites.length" class="sites-note">Add the first site you watch from.</p>
    <p class="sites-note">
      Auto-tracking follows your <Link to="/settings/tracking">tracking settings</Link> (currently
      {{ trackingThreshold }}% playback). Enable tracking, accept Firefox’s site access request,
      then reload that site. A title must be matched to your connected list account before an
      episode can sync.
    </p>
    <p v-if="notice" class="sites-notice" role="status">{{ notice }}</p>
  </section>
</template>
<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { patternToRegex } from 'webext-patterns';
import {
  defaultSites,
  isTsugiSite,
  normalizeSiteUrl,
  SITES_KEY,
  SITE_HEALTH_PREFIX,
  TsugiSite,
  SiteHealth,
} from '../../../utils/tsugiSites';
import { formatReleaseTime } from '../../../utils/releaseDates';
import Link from '../link.vue';

const trackingThreshold = computed(() => api.settings.get('videoDuration'));
const sites = ref<TsugiSite[]>([]);
const healthData = ref<Record<string, SiteHealth>>({});
const permissions = ref<Record<string, boolean>>({});
const loading = ref(true);
const error = ref('');
const notice = ref('');
const formOpen = ref(false);
const nameInput = ref('');
const urlInput = ref('');
const editing = ref('');
const hostname = (url: string) => new URL(url).hostname;
const health = (site: TsugiSite) => {
  const host = hostname(site.url);
  return host === 'allmanga.to'
    ? [healthData.value[host], healthData.value['mkissa.to']]
        .filter(Boolean)
        .sort(
          (a, b) => (b.syncedAt || b.playerSeenAt || 0) - (a.syncedAt || a.playerSeenAt || 0),
        )[0]
    : healthData.value[host];
};
const healthTime = (timestamp: number) =>
  formatReleaseTime(timestamp, api.settings.get('tsugiTimeZone'), api.settings.get('tsugiClock24'));
const siteTone = (url: string) => {
  const host = hostname(url);
  if (host.includes('reanime')) return 'reanime';
  if (host.includes('allmanga')) return 'allmanga';
  if (host.includes('anicult')) return 'anicult';
  return 'custom-site';
};
function adapter(site: TsugiSite) {
  return Object.values(api.settings.getStaticChibi()).find(page => {
    try {
      return patternToRegex(...page.urls.match).test(site.url);
    } catch {
      return false;
    }
  });
}
function origins(site: TsugiSite) {
  const page = adapter(site);
  const pages = page ? [page] : [];
  if (hostname(site.url) === 'allmanga.to') {
    const handoff = Object.values(api.settings.getStaticChibi()).find(item =>
      item.urls.match.includes('*://mkissa.to/*'),
    );
    if (handoff) pages.push(handoff);
  }
  return [
    ...new Set(
      pages.flatMap(item => [...item.urls.match, ...Object.values(item.urls.player || {}).flat()]),
    ),
  ];
}
async function checkAccess() {
  const results = await Promise.all(
    sites.value.map(
      async site =>
        [
          site.id,
          await chrome.permissions.contains({ permissions: ['scripting'], origins: origins(site) }),
        ] as const,
    ),
  );
  permissions.value = Object.fromEntries(results);
}
async function load() {
  try {
    const store = await chrome.storage.local.get(null);
    sites.value = Array.isArray(store[SITES_KEY])
      ? store[SITES_KEY].filter(isTsugiSite)
      : defaultSites.map(site => ({ ...site }));
    const data: Record<string, SiteHealth> = {};
    Object.entries(store)
      .filter(([key]) => key.startsWith(SITE_HEALTH_PREFIX))
      .forEach(([key, value]) => {
        data[key.slice(SITE_HEALTH_PREFIX.length)] = value;
      });
    healthData.value = data;
    await checkAccess();
  } catch {
    error.value = 'Your sites could not load. Reopen My sites to try again.';
  } finally {
    loading.value = false;
  }
}
function openForm(site?: TsugiSite) {
  editing.value = site?.id || '';
  nameInput.value = site?.name || '';
  urlInput.value = site?.url || '';
  formOpen.value = true;
  error.value = '';
}
async function persist(value: TsugiSite[]) {
  const stored = value.map(site => ({ id: site.id, name: site.name, url: site.url }));
  await chrome.storage.local.set({ [SITES_KEY]: stored });
  sites.value = value;
  await checkAccess();
}
async function saveSite() {
  try {
    const url = normalizeSiteUrl(urlInput.value);
    if (sites.value.some(site => site.id !== editing.value && hostname(site.url) === hostname(url)))
      throw new Error('This site is already in My sites.');
    const site = { id: editing.value || crypto.randomUUID(), name: nameInput.value.trim(), url };
    if (!site.name) throw new Error('Enter a site name.');
    await persist(
      editing.value
        ? sites.value.map(value => (value.id === editing.value ? site : value))
        : [...sites.value, site],
    );
    formOpen.value = false;
    error.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Your site could not be saved.';
  }
}
async function remove(site: TsugiSite) {
  try {
    await persist(sites.value.filter(value => value.id !== site.id));
  } catch {
    error.value = 'Your site could not be removed.';
  }
}
async function enable(site: TsugiSite) {
  try {
    const granted = await chrome.permissions.request({
      permissions: ['scripting'],
      origins: origins(site),
    });
    await checkAccess();
    notice.value = granted
      ? `Access enabled for ${site.name}. Reload its watch page to start tracking.`
      : `Firefox did not grant access for ${site.name}. You can try Enable tracking again.`;
  } catch {
    error.value = 'Firefox could not enable tracking. Check extension permissions and try again.';
  }
}
function changed(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  if (
    area === 'local' &&
    Object.keys(changes).some(key => key === SITES_KEY || key.startsWith(SITE_HEALTH_PREFIX))
  )
    load();
}
onMounted(() => {
  load();
  chrome.storage.onChanged.addListener(changed);
  chrome.permissions.onAdded.addListener(checkAccess);
  chrome.permissions.onRemoved.addListener(checkAccess);
});
onUnmounted(() => {
  chrome.storage.onChanged.removeListener(changed);
  chrome.permissions.onAdded.removeListener(checkAccess);
  chrome.permissions.onRemoved.removeListener(checkAccess);
});
</script>
<style lang="less" scoped>
.sites-heading {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 24px;
}

.add-site,
.site-form button[type='submit'],
.enable-site {
  background: #d24734;
  color: white;
  border-radius: 22px;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
}
.add-site .material-icons {
  font-size: 19px;
}
.site-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 310px), 1fr));
  gap: 28px;
}
.site-card {
  min-width: 0;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--cl-backdrop);
  background: var(--cl-background-solid);
}
.site-art {
  position: relative;
  isolation: isolate;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: white;
  background: #3a4f66;
}
.reanime {
  background: #a62c36;
}
.allmanga {
  background: #174e69;
}
.anicult {
  background: #474172;
}
.art-orbit {
  position: absolute;
  width: 220px;
  height: 220px;
  border: 35px solid #ffffff0b;
  border-radius: 50%;
  transform: rotate(-25deg) scaleX(1.7);
  right: -55px;
  top: -65px;
}
.site-monogram {
  font-size: 82px;
  font-weight: 700;
  letter-spacing: -5px;
  text-transform: uppercase;
}
.visit-icon {
  position: absolute;
  right: 20px;
  top: 20px;
  font-size: 22px;
}
.site-domain {
  position: absolute;
  left: 24px;
  bottom: 20px;
  font-size: 12px;
  opacity: 0.85;
}
.site-content {
  padding: 24px;
  h2 {
    font-size: 23px;
    margin: 0 0 15px;
    letter-spacing: -0.7px;
  }
}
.tracking-state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--cl-light-text);
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9b8e78;
}
.ready .status-dot {
  background: #64aa7d;
}
.health-message {
  min-height: 58px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--cl-light-text);
  margin: 16px 0 20px;
  time {
    display: block;
    font-size: 11px;
  }
}
.site-actions {
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 12px;
  > :first-child {
    margin-right: auto;
  }
  button {
    cursor: pointer;
  }
  .material-icons {
    font-size: 18px;
  }
}
.site-form {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 16px;
  padding: 22px;
  border-radius: 14px;
  background: var(--cl-backdrop);
  margin-bottom: 30px;
  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
    flex: 1 1 220px;
  }
  input {
    border: 1px solid var(--cl-light-text);
    border-radius: 7px;
    padding: 11px;
    color: var(--cl-text);
    background: var(--cl-background-solid);
  }
  button {
    cursor: pointer;
  }
}
.sites-note {
  font-size: 12px;
  line-height: 1.8;
  color: var(--cl-light-text);
  margin-top: 30px;
  max-width: 850px;
  a {
    text-decoration: underline;
  }
}
.sites-notice,
.site-error {
  padding: 15px;
  background: var(--cl-backdrop);
  border-radius: 10px;
  font-size: 13px;
}
a:focus-visible,
button:focus-visible,
input:focus-visible {
  outline: 2px solid #d65c45;
  outline-offset: 4px;
}

@media (max-width: 600px) {
  .sites-heading {
    align-items: start;
  }
  .add-site {
    padding: 10px 12px;
    font-size: 12px;
    white-space: nowrap;
  }
}
</style>
