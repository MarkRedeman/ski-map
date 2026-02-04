/**
 * Geometric utilities for spatial containment tests
 * Used to assign pistes and lifts to ski areas based on polygon boundaries
 */

/**
 * Test if a point is inside a polygon using the ray-casting algorithm
 * 
 * Algorithm: Cast a ray from the point to infinity (along +X axis) and count
 * how many polygon edges it crosses. If odd, point is inside; if even, outside.
 * 
 * @param point - [lon, lat] coordinates of the point to test
 * @param polygon - Array of [lon, lat] vertices defining the polygon boundary
 * @returns true if the point is inside the polygon
 */
export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  if (polygon.length < 3) return false
  
  const [x, y] = point
  let inside = false
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!
    const [xj, yj] = polygon[j]!
    
    // Check if the ray from point crosses this edge
    if (((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  
  return inside
}

/**
 * Calculate the centroid (geometric center) of a polygon
 * 
 * @param polygon - Array of [lon, lat] vertices
 * @returns [lon, lat] of the centroid
 */
export function polygonCentroid(polygon: [number, number][]): [number, number] {
  if (polygon.length === 0) return [0, 0]
  
  let x = 0
  let y = 0
  
  for (const [px, py] of polygon) {
    x += px
    y += py
  }
  
  return [x / polygon.length, y / polygon.length]
}

/**
 * Calculate the distance between two geographic points using the Haversine formula
 * 
 * @param p1 - [lon, lat] of first point
 * @param p2 - [lon, lat] of second point
 * @returns Distance in kilometers
 */
export function distanceBetweenPoints(
  p1: [number, number],
  p2: [number, number]
): number {
  const R = 6371 // Earth's radius in kilometers
  
  const [lon1, lat1] = p1
  const [lon2, lat2] = p2
  
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  return R * c
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Find the first coordinate of a line (for pistes/lifts)
 * Works with both single-segment and multi-segment coordinates
 * 
 * @param coordinates - Either [lon, lat][] or [lon, lat][][]
 * @returns The first [lon, lat] point, or null if empty
 */
export function getFirstCoordinate(
  coordinates: [number, number][] | [number, number][][]
): [number, number] | null {
  if (!coordinates || coordinates.length === 0) return null
  
  const first = coordinates[0]
  if (!first) return null
  
  // Check if it's multi-segment (array of arrays of arrays)
  if (Array.isArray(first[0])) {
    // Multi-segment: coordinates is [number, number][][]
    const firstSegment = first as [number, number][]
    return firstSegment[0] ?? null
  }
  
  // Single segment: coordinates is [number, number][]
  return first as [number, number]
}
