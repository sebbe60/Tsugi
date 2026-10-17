import type { listElement } from '../_provider/listAbstract';
import { nextRelease } from './libraryHistory';

export function releaseDateParts(value?: string | null) {
  if (!value || !/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(value)) return null;
  const [year, month = 0, day = 0] = value.split('-').map(Number);
  if (year < 100 || month > 12 || day > 31 || (!month && day)) return null;
  if (day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  }
  return { year, month, day, sortKey: year * 10000 + month * 100 + day };
}

export function releaseDateLabel(value?: string | null) {
  const date = releaseDateParts(value);
  if (!date) return 'Release date unavailable';
  if (!date.month) return `${date.year} · Month and day not announced`;
  const timestamp = Date.UTC(date.year, date.month - 1, date.day || 1);
  const label = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: date.day ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(timestamp);
  return date.day ? label : `${label} · Day not announced`;
}

export function isReleased(item: { airingState?: number | string }) {
  return [
    '1',
    '2',
    'releasing',
    'finished',
    'current',
    'currently_airing',
    'finished_airing',
    'currently_publishing',
    'finished_publishing',
    'publishing',
    'ongoing',
  ].includes(String(item.airingState).toLowerCase());
}

export function orderLibrary(
  items: listElement[],
  section: string,
  now = Date.now(),
  predictions = true,
) {
  return items.slice().sort((a, b) => {
    if (section === 'watching') {
      const aRelease = nextRelease(a, now, predictions);
      const bRelease = nextRelease(b, now, predictions);
      const rank = (item: typeof aRelease) => {
        if (item.timestamp) return 0;
        return item.label === 'All episodes released' ? 2 : 1;
      };
      const rankDifference = rank(aRelease) - rank(bRelease);
      if (rankDifference) return rankDifference;
      if (aRelease.timestamp && bRelease.timestamp) return aRelease.timestamp - bRelease.timestamp;
    }
    const aDate = releaseDateParts(a.releaseDate)?.sortKey;
    const bDate = releaseDateParts(b.releaseDate)?.sortKey;
    if (aDate && bDate && aDate !== bDate)
      return section === 'upcoming' ? aDate - bDate : bDate - aDate;
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    return a.title.localeCompare(b.title);
  });
}

export function formatReleaseTime(timestamp: number, timeZone: string, clock24: boolean) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: clock24 ? 'h23' : 'h12',
    timeZone,
    timeZoneName: 'short',
  }).format(timestamp);
}
