import type { DiscoveryGraph, DiscoveryMedia, DiscoverySeed } from './discovery';
import type { DiscoveryScanDetails } from './discoveryCoverage';

export const DISCOVERY_RELATIONS_PREFIX = 'tsugi/discover/relations/v1/';
const TTL = 24 * 60 * 60_000;
const FIELDS = `id idMal type format status episodes duration averageScore
  title { english romaji } coverImage { large extraLarge } startDate { year month day }`;
export function discoveryQuery(seeds: DiscoverySeed[]) {
  return {
    query: `query (${seeds.map((_, index) => `$id${index}: Int!`).join(', ')}) {
      ${seeds
        .map(
          (seed, index) => `s${index}: Media(${seed.by}: $id${index}, type: ANIME) {
        ${FIELDS} relations { edges { relationType(version: 2) node { ${FIELDS} } } }
      }`,
        )
        .join('\n')}
    }`,
    variables: Object.fromEntries(seeds.map((seed, index) => [`id${index}`, seed.id])),
  };
}
export async function loadDiscoveryGraph(
  seeds: DiscoverySeed[],
  onProgress: (graph: DiscoveryGraph, checked: string[], details: DiscoveryScanDetails) => void,
  signal: AbortSignal,
  options: { refreshAfter?: number } = {},
) {
  const cache = await chrome.storage.local.get(
    seeds.map(seed => DISCOVERY_RELATIONS_PREFIX + seed.key),
  );
  const graph = new Map<string, DiscoveryMedia>();
  const checked = new Set<string>();
  const processed = new Set<string>();
  const unavailable = new Set<string>();
  const checkedAt: Record<string, number> = {};
  const missing: DiscoverySeed[] = [];
  const publish = () => {
    if (!signal.aborted)
      onProgress(
        [...graph].map(([seedKey, media]) => ({ seedKey, media })),
        [...checked],
        { checkedAt: { ...checkedAt }, unavailable: [...unavailable], processed: [...processed] },
      );
  };
  seeds.forEach(seed => {
    const entry = cache[DISCOVERY_RELATIONS_PREFIX + seed.key] as
      { timestamp: number; media?: DiscoveryMedia; unavailable?: boolean } | undefined;
    const valid =
      entry &&
      Number.isFinite(entry.timestamp) &&
      (entry.media?.relations?.edges || entry.unavailable);
    if (valid && entry) {
      if (entry.media?.relations?.edges) graph.set(seed.key, entry.media);
      checkedAt[seed.key] = entry.timestamp;
      if (entry.timestamp >= Date.now() - TTL) {
        checked.add(seed.key);
        if (entry.unavailable) unavailable.add(seed.key);
      }
      if (entry.timestamp >= (options.refreshAfter || Date.now() - TTL)) {
        processed.add(seed.key);
        return;
      }
    }
    missing.push(seed);
  });
  publish();
  for (let offset = 0; offset < missing.length && !signal.aborted; offset += 4) {
    if (offset) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => {
        setTimeout(resolve, 2500);
      });
    }
    if (signal.aborted) break;
    const batch = missing.slice(offset, offset + 4);
    try {
      // Public metadata only: no token or account identifiers are sent to AniList.
      // eslint-disable-next-line no-await-in-loop
      const response = await api.request.xhr('POST', {
        url: 'https://graphql.anilist.co',
        retryRateLimit: false,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        data: JSON.stringify(discoveryQuery(batch)),
      });
      if (signal.aborted) break;
      if (response.status === 429)
        throw new Error('AniList is busy. Your results are kept; try again in a minute.');
      if (response.status >= 400 && response.status !== 404)
        throw new Error('Related anime couldn’t load. Your results are kept; try again.');
      const result = JSON.parse(response.responseText);
      const data = result.data || {};
      const saved: Record<
        string,
        { timestamp: number; media?: DiscoveryMedia; unavailable?: boolean }
      > = {};
      batch.forEach((seed, index) => {
        const media = data[`s${index}`];
        const notFound = result.errors?.some(
          error => error.status === 404 && error.path?.[0] === `s${index}`,
        );
        if (!media?.relations?.edges && !notFound) return;
        const timestamp = Date.now();
        checked.add(seed.key);
        processed.add(seed.key);
        checkedAt[seed.key] = timestamp;
        if (notFound) {
          graph.delete(seed.key);
          unavailable.add(seed.key);
          saved[DISCOVERY_RELATIONS_PREFIX + seed.key] = { timestamp, unavailable: true };
        } else {
          graph.set(seed.key, media);
          unavailable.delete(seed.key);
          saved[DISCOVERY_RELATIONS_PREFIX + seed.key] = { timestamp, media };
        }
      });
      // Keep successful aliases even if a different title in the batch failed.
      // eslint-disable-next-line no-await-in-loop
      await chrome.storage.local.set(saved);
      publish();
      if (
        batch.some(seed => !processed.has(seed.key)) ||
        result.errors?.some(error => error.status !== 404)
      )
        throw new Error(
          'Some related anime couldn’t load. Try again to finish checking your library.',
        );
    } catch (error) {
      if (!signal.aborted)
        return error instanceof Error ? error.message : 'Related anime couldn’t load. Try again.';
    }
  }
  return '';
}
