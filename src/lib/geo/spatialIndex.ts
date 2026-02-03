/**
 * Spatial index for fast nearest-feature lookups
 * 
 * Uses point-to-polyline distance calculations to find the nearest
 * piste or lift to any given point. This enables "click anywhere"
 * selection rather than requiring precise clicks on thin lines.
 */

export interface SpatialFeature {
  id: string
  type: 'piste' | 'lift'
  /** 3D points in local coordinates [x, y, z][] */
  points: [number, number, number][]
}

export interface NearestResult {
  feature: SpatialFeature
  distance: number
  /** The closest point on the feature */
  closestPoint: [number, number, number]
}

/**
 * Calculate squared distance between two 2D points (ignoring Y/elevation)
 */
function distanceSquared2D(
  x1: number, z1: number,
  x2: number, z2: number
): number {
  const dx = x2 - x1
  const dz = z2 - z1
  return dx * dx + dz * dz
}

/**
 * Find the closest point on a line segment to a given point (2D, ignoring Y)
 * Returns the squared distance and the parameter t (0-1) along the segment
 */
function pointToSegmentDistanceSquared(
  px: number, pz: number,
  x1: number, z1: number,
  x2: number, z2: number
): { distSq: number; t: number } {
  const dx = x2 - x1
  const dz = z2 - z1
  const lengthSq = dx * dx + dz * dz
  
  if (lengthSq === 0) {
    // Segment is a point
    return { distSq: distanceSquared2D(px, pz, x1, z1), t: 0 }
  }
  
  // Project point onto line, clamped to segment
  let t = ((px - x1) * dx + (pz - z1) * dz) / lengthSq
  t = Math.max(0, Math.min(1, t))
  
  const closestX = x1 + t * dx
  const closestZ = z1 + t * dz
  
  return {
    distSq: distanceSquared2D(px, pz, closestX, closestZ),
    t
  }
}

/**
 * Find the closest point on a polyline to a given point
 */
function pointToPolylineDistance(
  px: number, _py: number, pz: number,
  points: [number, number, number][]
): { distance: number; closestPoint: [number, number, number] } {
  let minDistSq = Infinity
  let closestPoint: [number, number, number] = [0, 0, 0]
  
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!
    const p2 = points[i + 1]!
    
    const { distSq, t } = pointToSegmentDistanceSquared(
      px, pz,
      p1[0], p1[2],
      p2[0], p2[2]
    )
    
    if (distSq < minDistSq) {
      minDistSq = distSq
      // Interpolate the closest point including Y
      closestPoint = [
        p1[0] + t * (p2[0] - p1[0]),
        p1[1] + t * (p2[1] - p1[1]),
        p1[2] + t * (p2[2] - p1[2])
      ]
    }
  }
  
  return {
    distance: Math.sqrt(minDistSq),
    closestPoint
  }
}

/**
 * Spatial index for pistes and lifts
 */
export class FeatureSpatialIndex {
  private features: SpatialFeature[] = []
  
  /**
   * Clear all features from the index
   */
  clear(): void {
    this.features = []
  }
  
  /**
   * Add a feature to the index
   */
  addFeature(feature: SpatialFeature): void {
    if (feature.points.length >= 2) {
      this.features.push(feature)
    }
  }
  
  /**
   * Get all features in the index
   */
  getFeatures(): SpatialFeature[] {
    return this.features
  }
  
  /**
   * Find the nearest feature to a given point
   * 
   * @param x - X coordinate in local space
   * @param y - Y coordinate (elevation)
   * @param z - Z coordinate in local space
   * @param maxDistance - Maximum distance to search (optional)
   * @param typeFilter - Only search for 'piste' or 'lift' (optional)
   * @returns Nearest feature and distance, or null if none found within maxDistance
   */
  findNearest(
    x: number,
    y: number,
    z: number,
    maxDistance?: number,
    typeFilter?: 'piste' | 'lift'
  ): NearestResult | null {
    let nearest: NearestResult | null = null
    let minDistance = maxDistance ?? Infinity
    
    for (const feature of this.features) {
      // Apply type filter if specified
      if (typeFilter && feature.type !== typeFilter) {
        continue
      }
      
      const { distance, closestPoint } = pointToPolylineDistance(
        x, y, z,
        feature.points
      )
      
      if (distance < minDistance) {
        minDistance = distance
        nearest = { feature, distance, closestPoint }
      }
    }
    
    return nearest
  }
  
  /**
   * Find all features within a given distance
   */
  findWithinDistance(
    x: number,
    y: number,
    z: number,
    maxDistance: number,
    typeFilter?: 'piste' | 'lift'
  ): NearestResult[] {
    const results: NearestResult[] = []
    
    for (const feature of this.features) {
      if (typeFilter && feature.type !== typeFilter) {
        continue
      }
      
      const { distance, closestPoint } = pointToPolylineDistance(
        x, y, z,
        feature.points
      )
      
      if (distance <= maxDistance) {
        results.push({ feature, distance, closestPoint })
      }
    }
    
    // Sort by distance
    results.sort((a, b) => a.distance - b.distance)
    
    return results
  }
}

/**
 * Create a singleton spatial index instance
 */
export const featureSpatialIndex = new FeatureSpatialIndex()
