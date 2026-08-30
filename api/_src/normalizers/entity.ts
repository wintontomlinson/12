import type { BrowseEntity } from '../../../shared/types.js';
import { asRecord, toStringOrNull } from '../lib/text.js';
import { normalizeAlbum } from './album.js';
import { normalizeArtistCard } from './artist.js';
import { normalizePlaylist } from './playlist.js';
import { normalizeSong } from './song.js';

/**
 * Polymorphic carousel normalizer.
 *
 * Homepage sections are **heterogeneous**: `new_albums` was verified to contain
 * a `song` as its first element. Dispatching on each item's own `type` — rather
 * than assuming a section is uniform — is what keeps a card from rendering the
 * wrong template or linking to the wrong route.
 *
 * Returns null for entity kinds outside our scope (`show`, `episode`,
 * `radio_station`, ...) so callers can filter them out instead of rendering a
 * card that leads nowhere.
 */
export function normalizeEntity(raw: unknown): BrowseEntity | null {
  const record = asRecord(raw);
  const type = toStringOrNull(record['type']);

  switch (type) {
    case 'song':
      return normalizeSong(raw);

    case 'album':
      return normalizeAlbum(raw);

    // `mix` is a curated playlist variant and resolves through the same
    // playlist detail endpoint, so it is presented as a playlist.
    case 'playlist':
    case 'mix':
      return normalizePlaylist(raw);

    case 'artist':
      return normalizeArtistCard(raw);

    default:
      // Podcasts, episodes, radio stations and anything new upstream adds.
      return null;
  }
}

/**
 * Normalizes a section, dropping unsupported and identity-less entries.
 *
 * An entity without an id cannot be navigated to or played, so it is discarded
 * rather than rendered as a dead card.
 */
export function normalizeEntityList(raw: unknown): BrowseEntity[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map(normalizeEntity)
    .filter((entity): entity is BrowseEntity => entity !== null && entity.id !== '');
}
