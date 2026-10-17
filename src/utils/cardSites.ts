import { TsugiSite } from './tsugiSites';
import { listElement } from '../_provider/listAbstract';

export interface CardDestination {
  site: TsugiSite;
  url: string;
  detail: string;
}
export function siteMatches(siteUrl: string, url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const site = new URL(siteUrl).hostname.replace(/^www\./, '');
    return host === site || (site === 'allmanga.to' && host === 'mkissa.to');
  } catch {
    return false;
  }
}
export function cardDestinations(
  item: listElement,
  sites: TsugiSite[],
  quicklinks: { domain: string; search: { anime: string | null; manga: string | null } }[],
  search: (url: string, title: string, id: any) => string,
  mapped: string[] = [],
): CardDestination[] {
  return sites.map(site => {
    const candidates = [
      {
        url: item.options?.c?.ep === item.watchedEp + 1 ? item.options.c.url : '',
        detail: `Episode ${item.watchedEp + 1}`,
      },
      {
        url: item.options?.r?.ep === item.watchedEp ? item.options.r.url : '',
        detail: `Resume episode ${item.watchedEp}`,
      },
      { url: item.options?.u, detail: 'Show page' },
      ...mapped.map(url => ({ url, detail: 'Show page' })),
    ];
    const match = candidates.find(
      candidate =>
        candidate.url && /^https?:\/\//.test(candidate.url) && siteMatches(site.url, candidate.url),
    );
    if (match) return { site, url: match.url, detail: match.detail };
    const quick = quicklinks.find(link => siteMatches(site.url, link.domain));
    const template = quick?.search?.[item.type];
    if (template && template !== 'home')
      return {
        site,
        url: search(template, item.title, item.malId || ''),
        detail: 'Search for this title',
      };
    return { site, url: site.url, detail: 'Open site · no title link yet' };
  });
}
