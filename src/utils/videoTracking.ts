import type { PlayerTime } from './player';

export function qualifiesForTracking(item: PlayerTime, threshold: number) {
  return (
    Number.isFinite(item.duration) &&
    item.duration > 60 &&
    Number.isFinite(item.current) &&
    item.current >= 0 &&
    Number.isFinite(threshold) &&
    threshold > 0 &&
    threshold <= 1 &&
    item.current / item.duration >= threshold &&
    (!item.paused || item.ended === true)
  );
}
