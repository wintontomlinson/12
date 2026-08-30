import { Router } from 'express';
import type { HomeFeed, HomeSection, HomeSectionId } from '../../../shared/types.js';
import { call } from '../lib/saavnClient.js';
import { ok } from '../lib/respond.js';
import { asRecord } from '../lib/text.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { normalizeEntityList } from '../normalizers/entity.js';

/**
 * GET /api/home — the four homepage carousels from a single upstream call.
 */

/** Maps upstream keys to our section ids and display labels. */
const SECTION_MAP: ReadonlyArray<{
  id: HomeSectionId;
  title: string;
  upstreamKey: string;
}> = [
  { id: 'trending', title: 'Trending Now', upstreamKey: 'new_trending' },
  { id: 'newReleases', title: 'New Releases', upstreamKey: 'new_albums' },
  { id: 'topCharts', title: 'Top Charts', upstreamKey: 'charts' },
  { id: 'madeForYou', title: 'Made For You', upstreamKey: 'top_playlists' },
];

export const homeRouter = Router();

homeRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    // One call supplies every section — `getLaunchData` returns all four keys.
    const payload = await call<Record<string, unknown>>('webapi.getLaunchData');
    const root = asRecord(payload);

    const sections: HomeSection[] = [];

    for (const { id, title, upstreamKey } of SECTION_MAP) {
      let items: HomeSection['items'] = [];

      try {
        items = normalizeEntityList(root[upstreamKey]);
      } catch (error) {
        // Requirement R8.3: a malformed section degrades that carousel only,
        // never the whole homepage.
        console.error(`[sur] failed to normalize home section "${upstreamKey}":`, error);
        continue;
      }

      // Requirement R1.6: omit empty carousels rather than render a blank row.
      if (items.length > 0) {
        sections.push({ id, title, items });
      }
    }

    // Editorial content changes on the order of hours, so a short edge cache is
    // safe and hides cold starts for the most-visited route.
    return ok<HomeFeed>(res, { sections }, 300);
  }),
);
