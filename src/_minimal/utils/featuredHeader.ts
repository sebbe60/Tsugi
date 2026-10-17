import { ref, watch } from 'vue';
import { localStore } from '../../utils/localStore';
import { normalizeHeroSettings } from '../../utils/featuredCarousel';

export const featuredHeaderHidden = ref(localStore.getItem('tsugi/header/hidden') === 'true');
export const featuredHeaderAvailable = ref(false);
const settingsKey = 'tsugi/header/settings/v1';
function readSettings() {
  try {
    return normalizeHeroSettings(JSON.parse(localStore.getItem(settingsKey) || '{}'));
  } catch {
    return normalizeHeroSettings(null);
  }
}
export const heroSettings = ref(readSettings());
watch(featuredHeaderHidden, value => localStore.setItem('tsugi/header/hidden', String(value)));
watch(heroSettings, value => localStore.setItem(settingsKey, JSON.stringify(value)), {
  deep: true,
});
window.addEventListener('storage', event => {
  if (event.key === settingsKey) heroSettings.value = readSettings();
  if (event.key === 'tsugi/header/hidden') featuredHeaderHidden.value = event.newValue === 'true';
});
export const heroSettingsOpen = ref(false);
