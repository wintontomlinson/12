import type { BrowseEntity } from '@shared/types';

/**
 * Presentation helpers for the `BrowseEntity` union.
 *
 * Carousel sections are heterogeneous (verified: `new_trending` returned albums,
 * songs and playlists together), so every visual decision has to be derived
 * from the item's own `type`. Centralising that here keeps the switch in one
 * place instead of scattered across card, row and search-result components.
 */

export function entityTitle(entity: BrowseEntity): string {
  return entity.type === 'artist' ? entity.name : entity.title;
}

export function entitySubtitle(entity: BrowseEntity): string {
  switch (entity.type) {
    case 'song':
      return entity.artistNames || entity.subtitle;

    case 'album':
      // Year + artist is more useful than upstream's redundant subtitle, which
      // often just repeats the album title.
      return [entity.year, entity.artistNames].filter(Boolean).join(' • ');

    case 'playlist':
      return entity.subtitle || (entity.songCount > 0 ? `${entity.songCount} songs` : 'Playlist');

    case 'artist':
      return 'Artist';
  }
}

/** Detail route for an entity, or null for songs (which play instead). */
export function entityRoute(entity: BrowseEntity): string | null {
  switch (entity.type) {
    case 'album':
      return `/album/${entity.id}`;
    case 'playlist':
      return `/playlist/${entity.id}`;
    case 'artist':
      return `/artist/${entity.id}`;
    case 'song':
      return null;
  }
}

/** Artists are shown as circles, everything else as rounded squares. */
export function entityIsRound(entity: BrowseEntity): boolean {
  return entity.type === 'artist';
}

/** Accessible label for the play affordance. */
export function entityPlayLabel(entity: BrowseEntity): string {
  return `Play ${entityTitle(entity)}`;
}
