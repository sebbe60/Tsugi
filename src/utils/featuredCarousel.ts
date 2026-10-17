import type { listElement } from '../_provider/listAbstract';
import type { WatchEvent } from './watchHistory';
import type { PlaybackActivity } from './watchActivity';
import { availableEpisodes } from './featuredAnime';
import { isReleased, orderLibrary } from './releaseDates';

export type HeroSettings = {
  count: number;
  unfinished: boolean;
  watching: boolean;
  planned: boolean;
  priority: 'continue' | 'balanced' | 'planned';
  layout: 'poster' | 'cinematic' | 'compact';
  rotate: boolean;
};
export const heroDefaults: HeroSettings = {
  count: 5,
  unfinished: true,
  watching: true,
  planned: true,
  priority: 'continue',
  layout: 'poster',
  rotate: true,
};
export function normalizeHeroSettings(value: unknown): HeroSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<HeroSettings>;
  return {
    count: Number.isInteger(v.count) ? Math.max(1, Math.min(10, v.count!)) : 5,
    unfinished: typeof v.unfinished === 'boolean' ? v.unfinished : true,
    watching: typeof v.watching === 'boolean' ? v.watching : true,
    planned: typeof v.planned === 'boolean' ? v.planned : true,
    priority: ['continue', 'balanced', 'planned'].includes(v.priority!) ? v.priority! : 'continue',
    layout: ['poster', 'cinematic', 'compact'].includes(v.layout!) ? v.layout! : 'poster',
    rotate: typeof v.rotate === 'boolean' ? v.rotate : true,
  };
}
export type HeroSlide = {
  key: string;
  item: listElement;
  kind: 'unfinished' | 'watching' | 'planned';
  activity?: PlaybackActivity;
};
export function heroSlides(
  watching: listElement[],
  planned: listElement[],
  activities: PlaybackActivity[],
  events: WatchEvent[],
  settings: HeroSettings,
  now = Date.now(),
): HeroSlide[] {
  const all = [...watching, ...planned];
  const groups: HeroSlide[][] = [[], [], []];
  const used = new Set<string>();
  const key = (item: listElement) => `anime/${item.cacheKey}`;
  // Choose the newest checkpoint per series before testing it: an older unfinished
  // checkpoint must not reappear after a later episode has been finished.
  const latest = new Map<string, PlaybackActivity>();
  [...activities]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach(a => {
      if (!latest.has(a.mediaKey)) latest.set(a.mediaKey, a);
    });
  if (settings.unfinished)
    latest.forEach(a => {
      const item = all.find(i => key(i) === a.mediaKey || i.url === a.url);
      if (
        !item ||
        item.type !== 'anime' ||
        ![1, 6].includes(item.status) ||
        a.position < 5 ||
        a.position >= a.duration - 15 ||
        a.rewatchCount !== item.rewatchCount ||
        a.episode < item.watchedEp ||
        a.episode > item.watchedEp + 1
      )
        return;
      groups[0].push({ key: key(item), item, kind: 'unfinished', activity: a });
      used.add(key(item));
    });
  const recent = (i: listElement) =>
    Math.max(
      i.updatedAt || 0,
      ...events.filter(e => e.mediaKey === key(i) || e.url === i.url).map(e => e.watchedAt),
    );
  if (settings.watching)
    watching
      .filter(
        i =>
          i.type === 'anime' &&
          i.status === 1 &&
          availableEpisodes(i, now) > i.watchedEp &&
          !used.has(key(i)),
      )
      .sort((a, b) => recent(b) - recent(a) || a.title.localeCompare(b.title))
      .forEach(item => {
        groups[1].push({ key: key(item), item, kind: 'watching' });
        used.add(key(item));
      });
  if (settings.planned)
    orderLibrary(
      planned.filter(
        i => i.type === 'anime' && i.status === 6 && isReleased(i) && !used.has(key(i)),
      ),
      'planned',
    ).forEach(item => groups[2].push({ key: key(item), item, kind: 'planned' }));
  const order = settings.priority === 'planned' ? [2, 0, 1] : [0, 1, 2];
  if (settings.priority === 'balanced') {
    const result: HeroSlide[] = [];
    while (result.length < settings.count && groups.some(g => g.length))
      order.forEach(n => {
        if (groups[n].length && result.length < settings.count) result.push(groups[n].shift()!);
      });
    return result;
  }
  // Reserve one slot for each enabled source, then fill by priority.
  const selected = new Set(
    order
      .flatMap(n => groups[n].slice(0, 1))
      .slice(0, settings.count)
      .map(s => s.key),
  );
  order.forEach(n =>
    groups[n].forEach(s => {
      if (selected.size < settings.count) selected.add(s.key);
    }),
  );
  return order.flatMap(n => groups[n]).filter(s => selected.has(s.key));
}
