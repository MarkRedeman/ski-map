/**
 * Web Worker for ski data processing
 *
 * Offloads the expensive ski data pipeline from the main thread:
 * 1. Fetch raw OSM data from Overpass API
 * 2. Parse pistes, lifts, peaks, villages, restaurants, ski areas
 * 3. Assign ski areas via spatial containment (point-in-polygon)
 * 4. Merge fragmented piste segments
 *
 * Exposed via Comlink for seamless async communication.
 */

import * as Comlink from 'comlink';
import { fetchAllSkiData } from '@/lib/api/overpass';
import { assignSkiAreas } from '@/lib/api/assignSkiAreas';
import { mergePisteSegments } from '@/lib/api/mergePistes';
import type { RegionBbox } from '@/stores/useAppConfigStore';
import type { ProcessedSkiData } from '@/hooks/useSkiData';

const api = {
  /**
   * Run the full ski data processing pipeline off the main thread.
   *
   * @param bbox - Geographic bounding box for the Overpass API query
   * @returns Fully processed ski data ready for rendering
   */
  async processSkiData(bbox: RegionBbox): Promise<ProcessedSkiData> {
    // 1. Fetch raw data from Overpass API
    const data = await fetchAllSkiData(bbox);

    // 2. Assign ski areas to pistes, lifts, and restaurants using spatial containment
    const {
      pistes: pistesWithAreas,
      lifts: liftsWithAreas,
      restaurants: restaurantsWithAreas,
    } = assignSkiAreas(data.pistes, data.lifts, data.restaurants, data.skiAreaPolygons);

    // 3. Merge fragmented piste segments
    const mergedPistes = mergePisteSegments(pistesWithAreas);

    return {
      pistes: mergedPistes,
      lifts: liftsWithAreas,
      skiAreas: data.skiAreaPolygons,
      peaks: data.peaks,
      villages: data.villages,
      restaurants: restaurantsWithAreas,
    };
  },
};

export type SkiDataWorkerApi = typeof api;

Comlink.expose(api);
