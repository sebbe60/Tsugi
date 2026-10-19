export interface TsugiSite {
  id: string;
  name: string;
  url: string;
}
export interface SiteHealth {
  playerSeenAt?: number;
  progress?: number;
  syncedAt?: number;
  title?: string;
  episode?: number;
}
export const SITES_KEY = 'tsugi/sites';
export const SITE_HEALTH_PREFIX = 'tsugi/site-health/';
export const defaultSites: TsugiSite[] = [
  { id: 'reanime', name: 'Re:Anime', url: 'https://reanime.to/' },
  { id: 'allmanga', name: 'AllManga', url: 'https://allmanga.to/anime?tr=sub&cty=ALL' },
  { id: 'mkissa', name: 'MKissa', url: 'https://mkissa.to/anime' },
  { id: 'anicult', name: 'AniCult', url: 'https://anicult.vercel.app/' },
];
export function normalizeSiteUrl(value: string) {
  const url = new URL(value.includes('://') ? value.trim() : `https://${value.trim()}`);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    !url.hostname.includes('.') ||
    url.username ||
    url.password
  )
    throw new Error('Enter a valid website URL.');
  url.hash = '';
  return url.href;
}
export function isTsugiSite(value: unknown): value is TsugiSite {
  if (!value || typeof value !== 'object') return false;
  const site = value as TsugiSite;
  try {
    return (
      typeof site.id === 'string' &&
      typeof site.name === 'string' &&
      !!site.name.trim() &&
      typeof site.url === 'string' &&
      !!normalizeSiteUrl(site.url)
    );
  } catch {
    return false;
  }
}
