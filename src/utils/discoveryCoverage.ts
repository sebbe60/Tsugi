export type DiscoveryScanDetails = {
  checkedAt: Record<string, number>;
  unavailable: string[];
  processed: string[];
};
export function restoreDiscoverySelection(keys: string[], saved: unknown) {
  const valid = new Set(keys);
  const previous = Array.isArray(saved)
    ? [...new Set(saved.filter(key => typeof key === 'string' && valid.has(key)))]
    : [];
  return previous.length ? previous : keys.slice(0, 40);
}
export function discoveryCoverage(
  keys: string[],
  checked: string[],
  unavailable: string[],
  unmatched: number,
) {
  const valid = new Set(keys);
  const done = new Set(checked.filter(key => valid.has(key)));
  const missing = new Set(unavailable.filter(key => done.has(key)));
  const total = valid.size + unmatched;
  return {
    total,
    checked: done.size,
    matched: done.size - missing.size,
    remaining: valid.size - done.size,
    unavailable: unmatched + missing.size,
    percent: total ? Math.round((done.size / total) * 100) : 0,
    complete: total > 0 && done.size === total && missing.size === 0,
  };
}
