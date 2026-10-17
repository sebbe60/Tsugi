export type LibrarySection = 'watching' | 'upcoming' | 'planned' | 'history' | 'sites' | 'discover';

export const librarySections: { key: LibrarySection; title: string; description: string }[] = [
  { key: 'watching', title: 'Watching', description: 'Pick up where you left off.' },
  { key: 'upcoming', title: 'Upcoming', description: 'Not out yet. Already on your list.' },
  { key: 'planned', title: 'Planned', description: 'Already released. Ready whenever you are.' },
  { key: 'history', title: 'History', description: 'Your watch days, told in covers.' },
  { key: 'discover', title: 'Discover', description: 'Unwatched stories from the anime you know.' },
  { key: 'sites', title: 'My sites', description: 'Your places to watch, all together.' },
];

export function isLibrarySection(value: unknown): value is LibrarySection {
  return librarySections.some(section => section.key === value);
}

export function isUnreleased(item: { airingState?: number | string }) {
  return (
    item.airingState === 3 ||
    [
      'not_yet_aired',
      'not_yet_published',
      'not_yet_released',
      'upcoming',
      'tba',
      'unreleased',
    ].includes(String(item.airingState).toLowerCase())
  );
}
