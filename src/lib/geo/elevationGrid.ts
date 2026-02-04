/**
 * Elevation grid for fast terrain height lookups
 * 
 * Instead of raycasting against the terrain mesh (O(n) per query),
 * we extract elevation data into a 2D grid and use bilinear interpolation
 * for O(1) lookups.
 */

import * as THREE from 'three'

export interface ElevationGrid {
  /** 2D array of elevation values [row][col] */
  data: Float32Array
  /** Number of columns (X direction) */
  cols: number
  /** Number of rows (Z direction) */
  rows: number
  /** World-space bounds */
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /** Grid cell size */
  cellWidth: number
  cellDepth: number
}

/**
 * Collection of chunk-based elevation grids for efficient spatial lookup
 */
export interface ChunkElevationMap {
  /** Map of chunk key to elevation grid */
  chunks: Map<string, ElevationGrid>
  /** Chunk size in world units */
  chunkSize: number
}

/**
 * Create a chunk key from world coordinates
 */
export function worldToChunkKey(x: number, z: number, chunkSize: number): string {
  const chunkX = Math.floor(x / chunkSize)
  const chunkZ = Math.floor(z / chunkSize)
  return `${chunkX},${chunkZ}`
}

/**
 * Sample elevation from a chunk-based elevation map
 * O(1) lookup - finds the right chunk and samples from it
 */
export function sampleElevationFromChunks(
  chunkMap: ChunkElevationMap,
  x: number,
  z: number
): number {
  const key = worldToChunkKey(x, z, chunkMap.chunkSize)
  const grid = chunkMap.chunks.get(key)
  
  if (!grid) {
    // Point not in any loaded chunk - try nearby chunks (for edge cases)
    // Check all 4 adjacent chunks
    const chunkX = Math.floor(x / chunkMap.chunkSize)
    const chunkZ = Math.floor(z / chunkMap.chunkSize)
    
    const offsets: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
    for (const [dx, dz] of offsets) {
      const nearbyKey = `${chunkX + dx},${chunkZ + dz}`
      const nearbyGrid = chunkMap.chunks.get(nearbyKey)
      if (nearbyGrid && x >= nearbyGrid.minX && x <= nearbyGrid.maxX && 
          z >= nearbyGrid.minZ && z <= nearbyGrid.maxZ) {
        return sampleElevation(nearbyGrid, x, z)
      }
    }
    return 0
  }
  
  return sampleElevation(grid, x, z)
}

/**
 * Extract elevation grid from a PlaneGeometry-based terrain mesh
 * 
 * @param terrainMesh - Mesh with PlaneGeometry (rotated to XZ plane)
 * @returns ElevationGrid for fast lookups
 */
export function createElevationGrid(terrainMesh: THREE.Mesh): ElevationGrid {
  const geometry = terrainMesh.geometry as THREE.PlaneGeometry
  const positions = geometry.attributes.position as THREE.BufferAttribute
  
  // PlaneGeometry parameters
  const params = geometry.parameters
  const widthSegments = params.widthSegments ?? 1
  const heightSegments = params.heightSegments ?? 1
  
  const cols = widthSegments + 1
  const rows = heightSegments + 1
  
  // Get mesh world position offset
  const meshPosition = terrainMesh.position
  
  // Calculate world-space bounds
  const halfWidth = params.width / 2
  const halfDepth = params.height / 2
  
  const minX = meshPosition.x - halfWidth
  const maxX = meshPosition.x + halfWidth
  // Note: PlaneGeometry height maps to Z after rotation
  const minZ = meshPosition.z - halfDepth
  const maxZ = meshPosition.z + halfDepth
  
  const cellWidth = params.width / widthSegments
  const cellDepth = params.height / heightSegments
  
  // Extract elevation data
  // PlaneGeometry vertices are laid out row by row (in original Y direction, now Z)
  const data = new Float32Array(rows * cols)
  
  for (let i = 0; i < positions.count; i++) {
    // After rotateX(-PI/2), Y values contain elevation
    data[i] = positions.getY(i)
  }
  
  return {
    data,
    cols,
    rows,
    minX,
    maxX,
    minZ,
    maxZ,
    cellWidth,
    cellDepth,
  }
}

/**
 * Sample elevation at a world X/Z position using bilinear interpolation
 * 
 * @param grid - Elevation grid
 * @param x - World X coordinate
 * @param z - World Z coordinate
 * @returns Elevation (Y value), or 0 if outside grid
 */
export function sampleElevation(grid: ElevationGrid, x: number, z: number): number {
  // Check bounds
  if (x < grid.minX || x > grid.maxX || z < grid.minZ || z > grid.maxZ) {
    return 0
  }
  
  // Convert world coords to grid coords (0 to cols-1, 0 to rows-1)
  const gridX = ((x - grid.minX) / (grid.maxX - grid.minX)) * (grid.cols - 1)
  // Z is inverted: PlaneGeometry after rotateX(-PI/2) has row 0 at +Z (south/maxZ)
  // and last row at -Z (north/minZ), so we invert the mapping
  const gridZ = ((grid.maxZ - z) / (grid.maxZ - grid.minZ)) * (grid.rows - 1)
  
  // Get integer grid cell indices
  const x0 = Math.floor(gridX)
  const z0 = Math.floor(gridZ)
  const x1 = Math.min(x0 + 1, grid.cols - 1)
  const z1 = Math.min(z0 + 1, grid.rows - 1)
  
  // Fractional position within cell
  const fx = gridX - x0
  const fz = gridZ - z0
  
  // Get four corner elevations
  // Grid data is stored row by row: index = row * cols + col
  const e00 = grid.data[z0 * grid.cols + x0] ?? 0
  const e10 = grid.data[z0 * grid.cols + x1] ?? 0
  const e01 = grid.data[z1 * grid.cols + x0] ?? 0
  const e11 = grid.data[z1 * grid.cols + x1] ?? 0
  
  // Bilinear interpolation
  const e0 = e00 + (e10 - e00) * fx  // Interpolate along X at z0
  const e1 = e01 + (e11 - e01) * fx  // Interpolate along X at z1
  const elevation = e0 + (e1 - e0) * fz  // Interpolate along Z
  
  return elevation
}

/**
 * Project an array of 3D points onto the terrain surface using grid lookup
 * 
 * @param grid - Elevation grid
 * @param points - Array of [x, y, z] coordinates (y will be replaced)
 * @param offset - Height offset above the terrain surface
 * @returns New array with Y values sampled from terrain
 */
export function projectPointsOnGrid(
  grid: ElevationGrid,
  points: [number, number, number][],
  offset: number = 2
): [number, number, number][] {
  return points.map(([x, , z]) => {
    const terrainY = sampleElevation(grid, x, z)
    return [x, terrainY + offset, z]
  })
}

/**
 * Batch project multiple routes onto terrain
 * More efficient than calling projectPointsOnGrid multiple times
 * 
 * @param grid - Elevation grid
 * @param routes - Array of routes, each being an array of [x, y, z] points
 * @param offset - Height offset above terrain
 * @returns Array of projected routes
 */
export function projectMultipleRoutes(
  grid: ElevationGrid,
  routes: [number, number, number][][],
  offset: number = 2
): [number, number, number][][] {
  return routes.map(route => projectPointsOnGrid(grid, route, offset))
}

/**
 * Project Vector3 array onto terrain
 * 
 * @param grid - Elevation grid
 * @param points - Array of THREE.Vector3 points
 * @param offset - Height offset above terrain
 * @returns New array of Vector3 with Y values sampled from terrain
 */
export function projectVectorsOnGrid(
  grid: ElevationGrid,
  points: THREE.Vector3[],
  offset: number = 2
): THREE.Vector3[] {
  return points.map((p) => {
    const terrainY = sampleElevation(grid, p.x, p.z)
    return new THREE.Vector3(p.x, terrainY + offset, p.z)
  })
}

/**
 * Project an array of 3D points onto terrain using chunk-based elevation map
 * 
 * @param chunkMap - Chunk-based elevation map
 * @param points - Array of [x, y, z] coordinates (y will be replaced)
 * @param offset - Height offset above the terrain surface
 * @returns New array with Y values sampled from terrain
 */
export function projectPointsOnChunks(
  chunkMap: ChunkElevationMap,
  points: [number, number, number][],
  offset: number = 2
): [number, number, number][] {
  return points.map(([x, , z]) => {
    const terrainY = sampleElevationFromChunks(chunkMap, x, z)
    return [x, terrainY + offset, z]
  })
}
