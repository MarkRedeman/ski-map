/**
 * Combined hook for fetching terrain elevation data and satellite imagery
 * 
 * Returns both the elevation grid (for 3D mesh displacement) and
 * satellite texture (for terrain material).
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useEffect } from 'react'
import * as THREE from 'three'
import {
  getTilesForBounds,
  buildElevationGridFromTiles,
  buildSatelliteImageFromTiles,
} from '@/lib/geo/mapboxTiles'
import { geoToLocal, SOLDEN_CENTER } from '@/lib/geo/coordinates'
import type { ElevationGrid } from '@/lib/geo/elevationGrid'
import { useTerrainStore } from '@/store/terrainStore'

// Sölden ski area bounds (includes Rettenbach & Tiefenbach glaciers)
const SOLDEN_BOUNDS = {
  minLat: 46.84,
  maxLat: 47.01,
  minLon: 10.86,
  maxLon: 11.2,
}

interface UseTerrainDataOptions {
  /** Tile zoom level (default 12) */
  zoom?: number
  /** Mesh segments for terrain geometry (default 256) */
  meshSegments?: number
  enabled?: boolean
}

export interface TerrainData {
  /** Elevation grid for height sampling */
  elevationGrid: ElevationGrid
  /** Satellite texture for terrain material */
  satelliteTexture: THREE.CanvasTexture
  /** World-space bounds of the terrain */
  bounds: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
  }
  /** Terrain dimensions in world units */
  width: number
  height: number
  /** Center position */
  center: [number, number, number]
  /** Raw elevation data (1024x1024 from tiles) */
  rawElevations: Float32Array
  /** Raw elevation grid dimensions */
  rawWidth: number
  rawHeight: number
}

// Scale factor matching coordinates.ts
const SCALE = 0.1

export function useTerrainData({
  zoom = 12,
  // meshSegments reserved for future LOD support
  enabled = true,
}: UseTerrainDataOptions = {}) {
  const accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string
  const setElevationGrid = useTerrainStore((s) => s.setElevationGrid)
  const setIsLoading = useTerrainStore((s) => s.setIsLoading)

  const query = useQuery({
    queryKey: ['terrain-data', zoom],
    queryFn: async (): Promise<TerrainData> => {
      if (!accessToken) {
        throw new Error('VITE_MAPBOX_TOKEN not set')
      }

      console.log('[TerrainData] Starting terrain data fetch...')

      // 1. Calculate tiles needed
      const tiles = getTilesForBounds(
        SOLDEN_BOUNDS.minLat,
        SOLDEN_BOUNDS.maxLat,
        SOLDEN_BOUNDS.minLon,
        SOLDEN_BOUNDS.maxLon,
        zoom
      )
      console.log(`[TerrainData] Fetching ${tiles.length} tiles at zoom ${zoom}`)

      // 2. Fetch elevation and satellite tiles in parallel
      const [elevationResult, satelliteResult] = await Promise.all([
        buildElevationGridFromTiles(tiles, accessToken, (loaded, total) => {
          console.log(`[TerrainData] Elevation tiles: ${loaded}/${total}`)
        }),
        buildSatelliteImageFromTiles(tiles, accessToken, (loaded, total) => {
          console.log(`[TerrainData] Satellite tiles: ${loaded}/${total}`)
        }),
      ])

      // 3. Convert geographic bounds to world coordinates
      const [minX, , maxZ] = geoToLocal(elevationResult.bounds.minLat, elevationResult.bounds.minLon)
      const [maxX, , minZ] = geoToLocal(elevationResult.bounds.maxLat, elevationResult.bounds.maxLon)

      const width = maxX - minX
      const height = maxZ - minZ
      const centerX = (minX + maxX) / 2
      const centerZ = (minZ + maxZ) / 2

      console.log(`[TerrainData] World bounds: X [${minX.toFixed(0)} to ${maxX.toFixed(0)}], Z [${minZ.toFixed(0)} to ${maxZ.toFixed(0)}]`)
      console.log(`[TerrainData] Terrain size: ${width.toFixed(0)} x ${height.toFixed(0)} units`)

      // Log elevation range
      let minElev = Infinity, maxElev = -Infinity
      for (const e of elevationResult.elevations) {
        if (e < minElev) minElev = e
        if (e > maxElev) maxElev = e
      }
      console.log(`[TerrainData] Elevation range: ${minElev.toFixed(0)}m - ${maxElev.toFixed(0)}m`)

      // 4. Create satellite texture
      const satelliteTexture = new THREE.CanvasTexture(satelliteResult.canvas)
      satelliteTexture.minFilter = THREE.LinearFilter
      satelliteTexture.magFilter = THREE.LinearFilter
      satelliteTexture.colorSpace = THREE.SRGBColorSpace

      // 5. Create elevation grid for sampling
      // Convert raw elevations to scene Y coordinates
      const scaledElevations = new Float32Array(elevationResult.elevations.length)
      for (let i = 0; i < elevationResult.elevations.length; i++) {
        // Convert meters to scene units, relative to center elevation
        scaledElevations[i] = (elevationResult.elevations[i]! - SOLDEN_CENTER.elevation) * SCALE
      }

      const elevationGrid: ElevationGrid = {
        data: scaledElevations,
        cols: elevationResult.width,
        rows: elevationResult.height,
        minX,
        maxX,
        minZ,
        maxZ,
        cellWidth: width / (elevationResult.width - 1),
        cellDepth: height / (elevationResult.height - 1),
      }

      return {
        elevationGrid,
        satelliteTexture,
        bounds: { minX, maxX, minZ, maxZ },
        width,
        height,
        center: [centerX, 0, centerZ],
        rawElevations: elevationResult.elevations,
        rawWidth: elevationResult.width,
        rawHeight: elevationResult.height,
      }
    },
    enabled: enabled && !!accessToken,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    // Keep previous data visible while fetching new resolution
    placeholderData: keepPreviousData,
  })

  // Update store when data changes
  // Note: With keepPreviousData, isLoading is only true for initial load
  // Use isFetching to detect when refetching for a new resolution
  useEffect(() => {
    setIsLoading(query.isFetching)
    if (query.data && !query.isPlaceholderData) {
      setElevationGrid(query.data.elevationGrid)
      console.log('[TerrainData] Elevation grid stored for other components')
    }
  }, [query.data, query.isFetching, query.isPlaceholderData, setElevationGrid, setIsLoading])

  return query
}
