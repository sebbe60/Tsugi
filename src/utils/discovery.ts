import type { listElement } from '../_provider/listAbstract';

export type DiscoveryLibraryTitle = Pick<
  listElement,
  'title' | 'url' | 'malId' | 'score' | 'watchedEp' | 'status' | 'totalEp' | 'updatedAt'
>;
export type DiscoverySeed = DiscoveryLibraryTitle & {
  key: string;
  id: number;
  by: 'id' | 'idMal';
  completed: boolean;
};
export type DiscoveryMedia = {
  id: number;
  idMal: number | null;
  type: string;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  title: { english?: string | null; romaji?: string | null };
  coverImage?: { large?: string; extraLarge?: string };
  startDate?: { year?: number | null; month?: number | null; day?: number | null };
  relations?: { edges: { relationType: string; node: DiscoveryMedia }[] };
};
export type DiscoveryGraph = { seedKey: string; media: DiscoveryMedia }[];
export type DiscoverySection =
  'sequels' | 'favourites' | 'extras' | 'prequels' | 'alternatives' | 'upcoming';
export const discoverySections: {
  key: DiscoverySection;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    key: 'sequels',
    title: 'Continue the story',
    description: 'Released sequels to anime you’ve watched.',
    icon: 'play_arrow',
  },
  {
    key: 'favourites',
    title: 'More from your highest rated',
    description: 'Unwatched stories connected to the anime you rated best.',
    icon: 'favorite_border',
  },
  {
    key: 'extras',
    title: 'Movies & extras',
    description: 'Films, OVAs, ONAs, specials and side stories you may have missed.',
    icon: 'movie',
  },
  {
    key: 'prequels',
    title: 'Before the story',
    description: 'Go back to where a familiar story began.',
    icon: 'history',
  },
  {
    key: 'alternatives',
    title: 'Another take',
    description: 'Alternate versions, different settings and recaps.',
    icon: 'swap_horiz',
  },
  {
    key: 'upcoming',
    title: 'Coming next',
    description: 'Unreleased follow-ups and extras. Dates appear when announced.',
    icon: 'event',
  },
];
export type DiscoveryCandidate = {
  media: DiscoveryMedia;
  title: string;
  url: string;
  source: DiscoverySeed;
  relation: string;
  section: DiscoverySection;
  planned: boolean;
  listStatus: number;
  score: number;
  releaseDate: string | null;
};

export function discoveryIdentity(item: { malId?: number | null; url: string }) {
  const mal =
    Number(item.malId) ||
    Number(item.url.match(/^https?:\/\/(?:www\.)?myanimelist\.net\/anime\/(\d+)/)?.[1]);
  if (Number.isInteger(mal) && mal > 0) return { key: `mal:${mal}`, id: mal, by: 'idMal' as const };
  const ani = Number(item.url.match(/^https?:\/\/(?:www\.)?anilist\.co\/anime\/(\d+)/)?.[1]);
  if (Number.isInteger(ani) && ani > 0) return { key: `ani:${ani}`, id: ani, by: 'id' as const };
  return null;
}
export function hasWatched(item: Pick<DiscoveryLibraryTitle, 'watchedEp' | 'status'>) {
  return item.watchedEp > 0 || [2, 23].includes(Number(item.status));
}
export function discoverySeeds(library: DiscoveryLibraryTitle[]) {
  const seeds = new Map<string, DiscoverySeed>();
  library.filter(hasWatched).forEach(item => {
    const identity = discoveryIdentity(item);
    if (!identity) return;
    const seed = {
      ...item,
      ...identity,
      completed: Number(item.status) === 2 || (item.totalEp > 0 && item.watchedEp >= item.totalEp),
    };
    const previous = seeds.get(seed.key);
    if (!previous || seed.watchedEp > previous.watchedEp || seed.score > previous.score)
      seeds.set(seed.key, seed);
  });
  return [...seeds.values()].sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.completed) - Number(a.completed) ||
      (b.updatedAt || 0) - (a.updatedAt || 0) ||
      a.title.localeCompare(b.title),
  );
}
/** Local partial watches count as started, even before an account sync succeeds. */
export function mergeDiscoveryActivity(
  library: DiscoveryLibraryTitle[],
  activity: { title: string; url: string; episode: number; updatedAt: number }[],
) {
  const result = library.map(item => ({ ...item }));
  activity.forEach(entry => {
    const identity = discoveryIdentity(entry);
    if (!identity || !(entry.episode > 0)) return;
    const existing = result.find(
      item => discoveryIdentity(item)?.key === identity.key || item.url === entry.url,
    );
    if (existing) {
      existing.watchedEp = Math.max(existing.watchedEp, entry.episode);
      existing.updatedAt = Math.max(existing.updatedAt || 0, entry.updatedAt);
    } else
      result.push({
        title: entry.title,
        url: entry.url,
        malId: identity.by === 'idMal' ? identity.id : null,
        score: 0,
        watchedEp: entry.episode,
        totalEp: 0,
        status: 1,
        updatedAt: entry.updatedAt,
      });
  });
  return result;
}
export function discoveryReleaseDate(media: DiscoveryMedia) {
  const date = media.startDate;
  return date?.year
    ? `${date.year}-${String(date.month || 0).padStart(2, '0')}-${String(date.day || 0).padStart(2, '0')}`
    : null;
}
const relationNames: Record<string, string> = {
  SEQUEL: 'Sequel to',
  PREQUEL: 'Prequel to',
  SIDE_STORY: 'Side story of',
  PARENT: 'Main story of',
  SPIN_OFF: 'Spin-off of',
  ALTERNATIVE: 'Alternate version of',
  ALTERNATIVE_SETTING: 'Alternate setting of',
  ALTERNATIVE_VERSION: 'Alternate version of',
  SUMMARY: 'Recap of',
  COMPILATION: 'Compilation of',
  OTHER: 'Related to',
};
export function discoveryReason(item: DiscoveryCandidate) {
  return `${relationNames[item.relation] || 'Related to'} ${item.source.title}`;
}
export function discoveryFormat(media: DiscoveryMedia) {
  return (
    (
      {
        TV: 'Series',
        TV_SHORT: 'Short series',
        MOVIE: 'Movie',
        OVA: 'OVA',
        ONA: 'ONA',
        SPECIAL: 'Special',
        MUSIC: 'Music',
      } as Record<string, string>
    )[media.format || ''] || 'Anime'
  );
}
export function buildDiscovery(
  library: DiscoveryLibraryTitle[],
  graph: DiscoveryGraph,
  dismissed: number[] = [],
) {
  const seeds = discoverySeeds(library);
  const seedMap = new Map(seeds.map(item => [item.key, item]));
  const topScore = Math.max(0, ...seeds.map(item => item.score));
  const cutoff = Math.max(1, topScore - 1);
  const seen = new Set(dismissed);
  const candidates = new Map<number, DiscoveryCandidate>();
  graph.forEach(({ seedKey, media: parent }) => {
    const source = seedMap.get(seedKey);
    if (!source) return;
    parent.relations?.edges.forEach(({ relationType, node: media }) => {
      if (media.type !== 'ANIME' || !relationNames[relationType] || seen.has(media.id)) return;
      const matches = library.filter(
        item =>
          (media.idMal && discoveryIdentity(item)?.key === `mal:${media.idMal}`) ||
          item.url.match(/^https?:\/\/(?:www\.)?anilist\.co\/anime\/(\d+)/)?.[1] ===
            String(media.id),
      );
      if (matches.some(hasWatched)) return;
      const listItem = matches.find(item => item.status === 6) || matches[0];
      const upcoming = media.status === 'NOT_YET_RELEASED';
      let section: DiscoverySection;
      if (upcoming) section = 'upcoming';
      else if (!['RELEASING', 'FINISHED', 'HIATUS'].includes(media.status || '')) return;
      else if (relationType === 'SEQUEL') section = 'sequels';
      else if (relationType === 'PREQUEL') section = 'prequels';
      else if (
        [
          'ALTERNATIVE',
          'ALTERNATIVE_SETTING',
          'ALTERNATIVE_VERSION',
          'SUMMARY',
          'COMPILATION',
        ].includes(relationType)
      )
        section = 'alternatives';
      else if (source.score >= cutoff) section = 'favourites';
      else section = 'extras';
      const candidate: DiscoveryCandidate = {
        media,
        source,
        section,
        relation: relationType,
        title: media.title.english || media.title.romaji || `Anime ${media.id}`,
        url: media.idMal
          ? `https://myanimelist.net/anime/${media.idMal}`
          : `https://anilist.co/anime/${media.id}`,
        planned: Number(listItem?.status) === 6,
        listStatus: Number(listItem?.status) || 0,
        score: source.score,
        releaseDate: discoveryReleaseDate(media),
      };
      const previous = candidates.get(media.id);
      // Prefer a direct sequel explanation, then the strongest personal rating.
      const preference = previous
        ? Number(relationType === 'SEQUEL') - Number(previous.relation === 'SEQUEL') ||
          source.score - previous.score ||
          Number(source.completed) - Number(previous.source.completed)
        : 1;
      if (preference > 0) candidates.set(media.id, candidate);
    });
  });
  return [...candidates.values()].sort((a, b) => {
    if (a.section === 'favourites' && b.section === 'favourites' && a.score !== b.score)
      return b.score - a.score;
    if (a.section === 'upcoming' && b.section === 'upcoming') {
      if (a.releaseDate && b.releaseDate && a.releaseDate !== b.releaseDate)
        return a.releaseDate.localeCompare(b.releaseDate);
      if (a.releaseDate && !b.releaseDate) return -1;
      if (!a.releaseDate && b.releaseDate) return 1;
    }
    return (
      Number(b.source.completed) - Number(a.source.completed) ||
      b.score - a.score ||
      (b.media.averageScore || 0) - (a.media.averageScore || 0) ||
      a.title.localeCompare(b.title)
    );
  });
}

export function discoveryListItem(item: DiscoveryCandidate): listElement {
  return {
    uid: item.media.id,
    malId: item.media.idMal,
    apiCacheKey: item.media.idMal || `anilist:${item.media.id}`,
    cacheKey: item.media.idMal || `anilist:${item.media.id}`,
    type: 'anime',
    title: item.title,
    url: item.url,
    score: 0,
    watchedEp: 0,
    totalEp: item.media.episodes || 0,
    status: item.listStatus,
    startDate: null,
    finishDate: null,
    rewatchCount: 0,
    image: item.media.coverImage?.large || '',
    imageLarge: item.media.coverImage?.extraLarge,
    tags: '',
    fn: { continueUrl: () => '', initProgress: async () => {}, progress: null },
  };
}
