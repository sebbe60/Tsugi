import { defaultSites, isTsugiSite, SITES_KEY } from '../utils/tsugiSites';

/** Add the newly supported site once, preserving the user's own list and removals. */
export async function upgradeTsugiSites() {
  const marker = 'tsugi/sites-added/mkissa-v1';
  const store = await chrome.storage.local.get([SITES_KEY, marker]);
  if (store[marker]) return;
  const sites = store[SITES_KEY];
  const update: Record<string, unknown> = { [marker]: true };
  if (
    Array.isArray(sites) &&
    !sites.some(
      site => isTsugiSite(site) && new URL(site.url).hostname.replace(/^www\./, '') === 'mkissa.to',
    )
  ) {
    update[SITES_KEY] = [...sites, defaultSites.find(site => site.id === 'mkissa')!];
  }
  await chrome.storage.local.set(update);
}
