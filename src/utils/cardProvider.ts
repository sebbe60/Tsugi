import type { SyncTypes } from '../_provider/helper';
import { urlToSlug } from './slugs';

const providers: Record<SyncTypes, { name: string; home: string }> = {
  ANILIST: { name: 'AniList', home: 'https://anilist.co' },
  MAL: { name: 'MyAnimeList', home: 'https://myanimelist.net' },
  MALAPI: { name: 'MyAnimeList', home: 'https://myanimelist.net' },
  KITSU: { name: 'Kitsu', home: 'https://kitsu.app' },
  SIMKL: { name: 'Simkl', home: 'https://simkl.com' },
  SHIKI: { name: 'Shikimori', home: 'https://shikimori.io' },
  MANGABAKA: { name: 'MangaBaka', home: 'https://mangabaka.org' },
};
/** Never label a MAL URL as AniList just because AniList is selected. */
export function connectedCardProvider(
  item: { url: string; type: 'anime' | 'manga' },
  mode: SyncTypes,
  resolvedUrl = item.url,
) {
  if (/^local:\/\//i.test(item.url) || !providers[mode]) return null;
  const parsed = urlToSlug(resolvedUrl).path;
  const provider = mode === 'MALAPI' ? 'MAL' : mode;
  return {
    ...providers[mode],
    url: parsed?.provider === provider && parsed.type === item.type ? resolvedUrl : null,
  };
}
