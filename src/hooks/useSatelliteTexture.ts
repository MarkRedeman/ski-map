/**
 * React Query hook for loading satellite imagery from Mapbox tiles
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import * as THREE from 'three'
import { getTilesForBounds, buildSatelliteImageFromTiles } from '@/lib/geo/mapboxTiles'
import { geoToLocal } from '@/lib/geo/coordinates'

interface UseSatelliteTextureOptions {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
  /** Tile zoom level (12 = ~16 tiles, 13 = ~64 tiles) */
  zoom?: number
  enabled?: boolean
}

export interface SatelliteTextureData {
  texture: THREE.CanvasTexture
  /** World coordinates for the plane corners */
  bounds: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
  }
  /** Size in world units */
  width: number
  height: number
  /** Center position in world coordinates */
  center: [number, number, number]
}

export function useSatelliteTexture({
  minLat,
  maxLat,
  minLon,
  maxLon,
  zoom = 12,
  enabled = true,
}: UseSatelliteTextureOptions) {
  const accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string

  const query = useQuery({
    queryKey: ['satellite', minLat, maxLat, minLon, maxLon, zoom],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('VITE_MAPBOX_TOKEN not set')
      }

      // 1. Calculate which tiles we need
      const tiles = getTilesForBounds(minLat, maxLat, minLon, maxLon, zoom)
      console.log(`[Satellite] Fetching ${tiles.length} tiles at zoom ${zoom}`)

      // 2. Fetch and combine all tiles
      const { canvas, bounds } = await buildSatelliteImageFromTiles(
        tiles,
        accessToken,
        (loaded, total) => {
          console.log(`[Satellite] Loading tiles: ${loaded}/${total}`)
        }
      )

      // 3. Convert geo bounds to world coordinates
      const [minX, , maxZ] = geoToLocal(bounds.minLat, bounds.minLon)
      const [maxX, , minZ] = geoToLocal(bounds.maxLat, bounds.maxLon)

      return {
        canvas,
        worldBounds: { minX, maxX, minZ, maxZ },
      }
    },
    enabled: enabled && !!accessToken,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
  })

  // Create Three.js texture from canvas
  const textureData = useMemo<SatelliteTextureData | null>(() => {
    if (!query.data) return null

    const { canvas, worldBounds } = query.data
    const { minX, maxX, minZ, maxZ } = worldBounds

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.colorSpace = THREE.SRGBColorSpace
    
    const width = maxX - minX
    const height = maxZ - minZ
    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2

    console.log(`[Satellite] World bounds: X [${minX.toFixed(0)} to ${maxX.toFixed(0)}], Z [${minZ.toFixed(0)} to ${maxZ.toFixed(0)}]`)
    console.log(`[Satellite] Plane size: ${width.toFixed(0)} x ${height.toFixed(0)}, center: (${centerX.toFixed(0)}, ${centerZ.toFixed(0)})`)

    return {
      texture,
      bounds: worldBounds,
      width,
      height,
      center: [centerX, 0, centerZ],
    }
  }, [query.data])

  return {
    data: textureData,
    isLoading: query.isLoading,
    error: query.error,
  }
}
