/**
 * React Query hook for loading contour lines from Mapbox terrain tiles
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getTilesForBounds, buildElevationGridFromTiles } from '@/lib/geo/mapboxTiles'
import { generateContours, contourToWorld, simplifyContour, type ContourData3D } from '@/lib/geo/contourGenerator'
import { SOLDEN_CENTER } from '@/lib/geo/coordinates'

// Scale factor matching coordinates.ts
const SCALE = 0.1

interface UseContourLinesOptions {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
  /** Tile zoom level (12 = ~16 tiles, 13 = ~64 tiles) */
  zoom?: number
  /** Contour interval in meters (default 50) */
  interval?: number
  /** Simplification tolerance (default 1, set to 0 to disable) */
  simplifyTolerance?: number
  enabled?: boolean
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
  const accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string

  return useQuery({
    queryKey: ['contours', minLat, maxLat, minLon, maxLon, zoom, interval],
    queryFn: async (): Promise<ContourData3D[]> => {
      if (!accessToken) {
        throw new Error('VITE_MAPBOX_TOKEN not set')
      }

      // 1. Calculate which tiles we need
      const tiles = getTilesForBounds(minLat, maxLat, minLon, maxLon, zoom)
      console.log(`[Contours] Fetching ${tiles.length} terrain tiles at zoom ${zoom}`)

      // 2. Fetch and decode all tiles
      const { elevations, width, height, bounds } = await buildElevationGridFromTiles(
        tiles,
        accessToken,
        (loaded, total) => {
          console.log(`[Contours] Loading tiles: ${loaded}/${total}`)
        }
      )
      console.log(`[Contours] Built elevation grid: ${width}x${height}`)
      
      // Log elevation range for debugging
      let minElev = Infinity
      let maxElev = -Infinity
      for (const e of elevations) {
        if (e < minElev) minElev = e
        if (e > maxElev) maxElev = e
      }
      console.log(`[Contours] Elevation range: ${minElev.toFixed(0)}m - ${maxElev.toFixed(0)}m`)

      // 3. Generate contour lines
      const contours = generateContours(elevations, width, height, interval)
      console.log(`[Contours] Generated ${contours.length} contour levels`)

      // 4. Convert to 3D world coordinates with actual elevation
      // Use useElevationForY=true to render contours at their real elevation
      // Add small offset (1 unit = 10m) to float slightly above terrain surface
      let worldContours = contourToWorld(
        contours, 
        bounds, 
        width, 
        height, 
        1, // yOffset above terrain
        true, // useElevationForY
        SOLDEN_CENTER.elevation, // centerElevation
        SCALE // scale
      )
      
      // 5. Simplify contours to reduce vertex count
      if (simplifyTolerance > 0) {
        let totalPointsBefore = 0
        let totalPointsAfter = 0
        
        worldContours = worldContours.map((contour) => ({
          elevation: contour.elevation,
          rings: contour.rings
            .map((ring) => {
              totalPointsBefore += ring.length
              const simplified = simplifyContour(ring, simplifyTolerance)
              totalPointsAfter += simplified.length
              return simplified
            })
            // Filter out rings that are too small after simplification
            .filter((ring) => ring.length >= 3),
        }))
        
        // Filter out contours with no valid rings
        worldContours = worldContours.filter((c) => c.rings.length > 0)
        
        console.log(`[Contours] Simplified: ${totalPointsBefore} -> ${totalPointsAfter} points (${((1 - totalPointsAfter/totalPointsBefore) * 100).toFixed(1)}% reduction)`)
      }

      // Final validation - ensure all points are finite
      worldContours = worldContours.map((contour) => ({
        elevation: contour.elevation,
        rings: contour.rings.filter((ring) => 
          ring.every(([x, y, z]) => isFinite(x) && isFinite(y) && isFinite(z))
        ),
      })).filter((c) => c.rings.length > 0)

      console.log(`[Contours] Final: ${worldContours.length} contour levels with valid rings`)
      
      // Debug: log sample coordinates from first contour
      if (worldContours.length > 0 && worldContours[0]!.rings.length > 0) {
        const sampleRing = worldContours[0]!.rings[0]!
        const samplePoint = sampleRing[0]
        console.log(`[Contours] Sample contour at elevation ${worldContours[0]!.elevation}m:`)
        console.log(`  - First ring has ${sampleRing.length} points`)
        console.log(`  - First point: x=${samplePoint?.[0]?.toFixed(1)}, y=${samplePoint?.[1]?.toFixed(1)}, z=${samplePoint?.[2]?.toFixed(1)}`)
        
        // Log coordinate bounds
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
        for (const contour of worldContours) {
          for (const ring of contour.rings) {
            for (const [x, , z] of ring) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (z < minZ) minZ = z
              if (z > maxZ) maxZ = z
            }
          }
        }
        console.log(`[Contours] World bounds: X [${minX.toFixed(0)} to ${maxX.toFixed(0)}], Z [${minZ.toFixed(0)} to ${maxZ.toFixed(0)}]`)
      }
      
      return worldContours
    },
    enabled: enabled && !!accessToken,
    staleTime: Infinity, // Terrain data doesn't change
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    // Keep previous contours visible while fetching new resolution
    placeholderData: keepPreviousData,
  })
}
