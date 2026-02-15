/**
 * Web Worker for terrain elevation and contour processing
 *
 * Offloads heavy terrain computations from the main thread:
 * 1. Fetch and decode Mapbox terrain-RGB tiles (OffscreenCanvas)
 * 2. Build unified elevation grids from multiple tiles
 * 3. Generate contour lines (d3-contour marching squares)
 * 4. Transform contours to 3D world coordinates
 * 5. Simplify contours (Douglas-Peucker)
 *
 * Exposed via Comlink for seamless async communication.
 * Uses Comlink.transfer() for zero-copy Float32Array transfers.
 */

import * as Comlink from 'comlink';
import {
  getTilesForBounds,
  buildElevationGridFromTiles,
  type ElevationGridData,
} from '@/lib/geo/mapboxTiles';
import {
  generateContours,
  contourToWorld,
  simplifyContour,
  type ContourData3D,
} from '@/lib/geo/contourGenerator';
import { geoToLocalPure, SCALE, type RegionCenter } from '@/lib/geo/coordinates';

export interface BuildElevationGridParams {
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  zoom: number;
  accessToken: string;
  regionCenter: RegionCenter;
}

export interface ElevationGridResult {
  /** Raw elevation values in meters */
  elevations: Float32Array;
  /** Scaled elevation values in scene Y units */
  scaledElevations: Float32Array;
  width: number;
  height: number;
  /** Geographic bounds of the grid */
  geoBounds: {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
  };
  /** World-space bounds */
  worldBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  /** Terrain dimensions in world units */
  worldWidth: number;
  worldHeight: number;
  /** World-space center position */
  center: [number, number, number];
  /** Elevation stats */
  minElevation: number;
  maxElevation: number;
}

export interface GenerateContoursParams {
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  zoom: number;
  accessToken: string;
  interval: number;
  simplifyTolerance: number;
  regionCenter: RegionCenter;
}

const api = {
  /**
   * Fetch terrain tiles and build a unified elevation grid.
   *
   * Returns both raw elevations (meters) and scaled elevations (scene units).
   * Float32Arrays are transferred (zero-copy) back to the main thread.
   */
  async buildElevationGrid(params: BuildElevationGridParams): Promise<ElevationGridResult> {
    const { bounds, zoom, accessToken, regionCenter } = params;

    console.log('[TerrainWorker] Building elevation grid...');

    // 1. Calculate tiles needed
    const tiles = getTilesForBounds(
      bounds.minLat,
      bounds.maxLat,
      bounds.minLon,
      bounds.maxLon,
      zoom
    );
    console.log(`[TerrainWorker] Fetching ${tiles.length} tiles at zoom ${zoom}`);

    // 2. Fetch and decode all terrain tiles
    const elevationResult: ElevationGridData = await buildElevationGridFromTiles(
      tiles,
      accessToken,
      (loaded, total) => {
        console.log(`[TerrainWorker] Elevation tiles: ${loaded}/${total}`);
      }
    );

    // 3. Convert geographic bounds to world coordinates
    const [minX, , maxZ] = geoToLocalPure(
      elevationResult.bounds.minLat,
      elevationResult.bounds.minLon,
      regionCenter
    );
    const [maxX, , minZ] = geoToLocalPure(
      elevationResult.bounds.maxLat,
      elevationResult.bounds.maxLon,
      regionCenter
    );

    const worldWidth = maxX - minX;
    const worldHeight = maxZ - minZ;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // 4. Compute elevation stats
    let minElevation = Infinity;
    let maxElevation = -Infinity;
    for (const e of elevationResult.elevations) {
      if (e < minElevation) minElevation = e;
      if (e > maxElevation) maxElevation = e;
    }

    // 5. Create scaled elevations (meters -> scene Y units)
    const scaledElevations = new Float32Array(elevationResult.elevations.length);
    for (let i = 0; i < elevationResult.elevations.length; i++) {
      scaledElevations[i] = (elevationResult.elevations[i]! - regionCenter.elevation) * SCALE;
    }

    console.log(
      `[TerrainWorker] Grid ${elevationResult.width}x${elevationResult.height}, ` +
        `elevation ${minElevation.toFixed(0)}m - ${maxElevation.toFixed(0)}m`
    );

    const result: ElevationGridResult = {
      elevations: elevationResult.elevations,
      scaledElevations,
      width: elevationResult.width,
      height: elevationResult.height,
      geoBounds: elevationResult.bounds,
      worldBounds: { minX, maxX, minZ, maxZ },
      worldWidth,
      worldHeight,
      center: [centerX, 0, centerZ],
      minElevation,
      maxElevation,
    };

    // Transfer Float32Arrays (zero-copy)
    return Comlink.transfer(result, [result.elevations.buffer, result.scaledElevations.buffer]);
  },

  /**
   * Fetch terrain tiles, generate contour lines, transform to 3D,
   * and simplify — all off the main thread.
   */
  async generateContourLines(params: GenerateContoursParams): Promise<ContourData3D[]> {
    const { bounds, zoom, accessToken, interval, simplifyTolerance, regionCenter } = params;

    console.log('[TerrainWorker] Generating contour lines...');

    // 1. Calculate tiles needed
    const tiles = getTilesForBounds(
      bounds.minLat,
      bounds.maxLat,
      bounds.minLon,
      bounds.maxLon,
      zoom
    );
    console.log(`[TerrainWorker] Fetching ${tiles.length} terrain tiles at zoom ${zoom}`);

    // 2. Fetch and decode tiles
    const {
      elevations,
      width,
      height,
      bounds: gridBounds,
    } = await buildElevationGridFromTiles(tiles, accessToken, (loaded, total) => {
      console.log(`[TerrainWorker] Contour tiles: ${loaded}/${total}`);
    });
    console.log(`[TerrainWorker] Built elevation grid: ${width}x${height}`);

    // 3. Generate contour lines
    const contours = generateContours(elevations, width, height, interval);
    console.log(`[TerrainWorker] Generated ${contours.length} contour levels`);

    // 4. Convert to 3D world coordinates
    let worldContours = contourToWorld(
      contours,
      gridBounds,
      width,
      height,
      1, // yOffset above terrain
      true, // useElevationForY
      regionCenter.elevation, // centerElevation
      SCALE, // scale
      regionCenter // for geoToLocalPure
    );

    // 5. Simplify contours
    if (simplifyTolerance > 0) {
      let totalPointsBefore = 0;
      let totalPointsAfter = 0;

      worldContours = worldContours.map((contour) => ({
        elevation: contour.elevation,
        rings: contour.rings
          .map((ring) => {
            totalPointsBefore += ring.length;
            const simplified = simplifyContour(ring, simplifyTolerance);
            totalPointsAfter += simplified.length;
            return simplified;
          })
          .filter((ring) => ring.length >= 3),
      }));

      worldContours = worldContours.filter((c) => c.rings.length > 0);

      console.log(
        `[TerrainWorker] Simplified: ${totalPointsBefore} -> ${totalPointsAfter} points ` +
          `(${((1 - totalPointsAfter / totalPointsBefore) * 100).toFixed(1)}% reduction)`
      );
    }

    // 6. Final validation — ensure all points are finite
    worldContours = worldContours
      .map((contour) => ({
        elevation: contour.elevation,
        rings: contour.rings.filter((ring) =>
          ring.every(([x, y, z]) => isFinite(x) && isFinite(y) && isFinite(z))
        ),
      }))
      .filter((c) => c.rings.length > 0);

    console.log(`[TerrainWorker] Final: ${worldContours.length} contour levels with valid rings`);

    return worldContours;
  },
};

export type TerrainWorkerApi = typeof api;

Comlink.expose(api);
