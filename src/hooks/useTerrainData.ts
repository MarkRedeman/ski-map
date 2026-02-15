/**
 * Combined hook for fetching terrain elevation data and satellite imagery
 *
 * Returns both the elevation grid (for 3D mesh displacement) and
 * satellite texture (for terrain material).
 *
 * Elevation grid building (tile fetch + decode + scaling) is offloaded
 * to a Web Worker via Comlink. Satellite imagery stays on the main thread
 * because it requires HTMLCanvasElement and THREE.CanvasTexture.
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as THREE from 'three';
import { getTilesForBounds, buildSatelliteImageFromTiles } from '@/lib/geo/mapboxTiles';
import { getMapboxToken, getRegionCenter, getRegionBounds } from '@/stores/useAppConfigStore';
import type { ElevationGrid } from '@/lib/geo/elevationGrid';
import { useMapStore } from '@/stores/useMapStore';
import { getTerrainWorker } from '@/workers/terrainWorkerClient';

interface UseTerrainDataOptions {
  /** Tile zoom level (default 12) */
  zoom?: number;
  /** Mesh segments for terrain geometry (default 256) */
  meshSegments?: number;
  enabled?: boolean;
}

export interface TerrainData {
  /** Elevation grid for height sampling */
  elevationGrid: ElevationGrid;
  /** Satellite texture for terrain material */
  satelliteTexture: THREE.CanvasTexture;
  /** World-space bounds of the terrain */
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  /** Terrain dimensions in world units */
  width: number;
  height: number;
  /** Center position */
  center: [number, number, number];
  /** Raw elevation data (1024x1024 from tiles) */
  rawElevations: Float32Array;
  /** Raw elevation grid dimensions */
  rawWidth: number;
  rawHeight: number;
}

/**
 * Singleton terrain worker instance — created once, reused across queries.
 * Shared with useContourLines via terrainWorkerClient.
 */

export function useTerrainData({
  zoom = 12,
  // meshSegments reserved for future LOD support
  enabled = true,
}: UseTerrainDataOptions = {}) {
  const accessToken = getMapboxToken();
  const setElevationGrid = useMapStore((s) => s.setElevationGrid);
  const setIsLoading = useMapStore((s) => s.setIsLoadingTerrain);

  const query = useQuery({
    queryKey: ['terrain-data', zoom],
    queryFn: async (): Promise<TerrainData> => {
      if (!accessToken) {
        throw new Error('Mapbox token not configured');
      }

      console.log('[TerrainData] Starting terrain data fetch...');

      const bounds = getRegionBounds();
      const regionCenter = getRegionCenter();

      // Calculate tiles needed (for satellite fetch on main thread)
      const tiles = getTilesForBounds(
        bounds.minLat,
        bounds.maxLat,
        bounds.minLon,
        bounds.maxLon,
        zoom
      );
      console.log(`[TerrainData] Fetching ${tiles.length} tiles at zoom ${zoom}`);

      // Run elevation grid (worker) and satellite imagery (main thread) in parallel
      const worker = getTerrainWorker();

      const [elevationResult, satelliteResult] = await Promise.all([
        // Elevation grid built entirely in the worker
        worker.buildElevationGrid({
          bounds,
          zoom,
          accessToken,
          regionCenter,
        }),
        // Satellite imagery stays on main thread (requires HTMLCanvasElement)
        buildSatelliteImageFromTiles(tiles, accessToken, (loaded, total) => {
          console.log(`[TerrainData] Satellite tiles: ${loaded}/${total}`);
        }),
      ]);

      const { worldBounds, worldWidth, worldHeight, center } = elevationResult;
      const { minX, maxX, minZ, maxZ } = worldBounds;

      console.log(
        `[TerrainData] World bounds: X [${minX.toFixed(0)} to ${maxX.toFixed(0)}], Z [${minZ.toFixed(0)} to ${maxZ.toFixed(0)}]`
      );
      console.log(
        `[TerrainData] Terrain size: ${worldWidth.toFixed(0)} x ${worldHeight.toFixed(0)} units`
      );
      console.log(
        `[TerrainData] Elevation range: ${elevationResult.minElevation.toFixed(0)}m - ${elevationResult.maxElevation.toFixed(0)}m`
      );

      // Create satellite texture (main thread only — requires THREE.js)
      const satelliteTexture = new THREE.CanvasTexture(satelliteResult.canvas);
      satelliteTexture.minFilter = THREE.LinearFilter;
      satelliteTexture.magFilter = THREE.LinearFilter;
      satelliteTexture.colorSpace = THREE.SRGBColorSpace;

      // Assemble elevation grid from worker results
      const elevationGrid: ElevationGrid = {
        data: elevationResult.scaledElevations,
        cols: elevationResult.width,
        rows: elevationResult.height,
        minX,
        maxX,
        minZ,
        maxZ,
        cellWidth: worldWidth / (elevationResult.width - 1),
        cellDepth: worldHeight / (elevationResult.height - 1),
      };

      return {
        elevationGrid,
        satelliteTexture,
        bounds: { minX, maxX, minZ, maxZ },
        width: worldWidth,
        height: worldHeight,
        center,
        rawElevations: elevationResult.elevations,
        rawWidth: elevationResult.width,
        rawHeight: elevationResult.height,
      };
    },
    enabled: enabled && !!accessToken,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    // Keep previous data visible while fetching new resolution
    placeholderData: keepPreviousData,
  });

  // Update store when data changes
  // Note: With keepPreviousData, isLoading is only true for initial load
  // Use isFetching to detect when refetching for a new resolution
  useEffect(() => {
    setIsLoading(query.isFetching);
  }, [query.isFetching, setIsLoading]);

  // Separate effect for elevation grid to avoid retriggering on isFetching changes
  useEffect(() => {
    if (query.data && !query.isPlaceholderData) {
      setElevationGrid(query.data.elevationGrid);
      console.log('[TerrainData] Elevation grid stored for other components');
    }
  }, [query.data, query.isPlaceholderData, setElevationGrid]);

  return query;
}
