/**
 * React Query hook for loading contour lines from Mapbox terrain tiles
 *
 * All heavy computation (tile fetching, contour generation, coordinate transforms,
 * simplification) is delegated to the shared terrain Web Worker via Comlink.
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { ContourData3D } from '@/lib/geo/contourGenerator';
import { getMapboxToken, getRegionCenter } from '@/stores/useAppConfigStore';
import { getTerrainWorker } from '@/workers/terrainWorkerClient';

interface UseContourLinesOptions {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  /** Tile zoom level (12 = ~16 tiles, 13 = ~64 tiles) */
  zoom?: number;
  /** Contour interval in meters (default 50) */
  interval?: number;
  /** Simplification tolerance (default 1, set to 0 to disable) */
  simplifyTolerance?: number;
  enabled?: boolean;
}

export function useContourLines({
  minLat,
  maxLat,
  minLon,
  maxLon,
  zoom = 12,
  interval = 50,
  simplifyTolerance = 1,
  enabled = true,
}: UseContourLinesOptions) {
  const accessToken = getMapboxToken();

  return useQuery({
    queryKey: ['contours', minLat, maxLat, minLon, maxLon, zoom, interval],
    queryFn: async (): Promise<ContourData3D[]> => {
      if (!accessToken) {
        throw new Error('VITE_MAPBOX_TOKEN not set');
      }

      console.log('[Contours] Delegating contour generation to worker...');

      const regionCenter = getRegionCenter();
      const worker = getTerrainWorker();

      const worldContours = await worker.generateContourLines({
        bounds: { minLat, maxLat, minLon, maxLon },
        zoom,
        accessToken,
        interval,
        simplifyTolerance,
        regionCenter,
      });

      console.log(`[Contours] Worker returned ${worldContours.length} contour levels`);

      // Debug: log sample coordinates from first contour
      if (worldContours.length > 0 && worldContours[0]!.rings.length > 0) {
        const sampleRing = worldContours[0]!.rings[0]!;
        const samplePoint = sampleRing[0];
        console.log(`[Contours] Sample contour at elevation ${worldContours[0]!.elevation}m:`);
        console.log(`  - First ring has ${sampleRing.length} points`);
        console.log(
          `  - First point: x=${samplePoint?.[0]?.toFixed(1)}, y=${samplePoint?.[1]?.toFixed(1)}, z=${samplePoint?.[2]?.toFixed(1)}`
        );

        // Log coordinate bounds
        let minX = Infinity,
          maxX = -Infinity,
          minZ = Infinity,
          maxZ = -Infinity;
        for (const contour of worldContours) {
          for (const ring of contour.rings) {
            for (const [x, , z] of ring) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (z < minZ) minZ = z;
              if (z > maxZ) maxZ = z;
            }
          }
        }
        console.log(
          `[Contours] World bounds: X [${minX.toFixed(0)} to ${maxX.toFixed(0)}], Z [${minZ.toFixed(0)} to ${maxZ.toFixed(0)}]`
        );
      }

      return worldContours;
    },
    enabled: enabled && !!accessToken,
    staleTime: Infinity, // Terrain data doesn't change
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    // Keep previous contours visible while fetching new resolution
    placeholderData: keepPreviousData,
  });
}
