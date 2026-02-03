/**
 * Terrain utilities for chunked terrain system
 * 
 * Handles elevation grid creation and merging for multiple chunks
 */

import * as THREE from 'three'
import type { ElevationGrid } from '@/lib/geo/elevationGrid'

/**
 * Create an elevation grid from a terrain chunk mesh
 */
export function createChunkElevationGrid(
  mesh: THREE.Mesh,
  chunkSize: number,
  segments: number
): ElevationGrid {
  const geometry = mesh.geometry as THREE.PlaneGeometry
  const positions = geometry.attributes.position as THREE.BufferAttribute
  
  const cols = segments + 1
  const rows = segments + 1
  
  const meshPosition = mesh.position
  const halfSize = chunkSize / 2
  
  const minX = meshPosition.x - halfSize
  const maxX = meshPosition.x + halfSize
  const minZ = meshPosition.z - halfSize
  const maxZ = meshPosition.z + halfSize
  
  const cellWidth = chunkSize / segments
  const cellDepth = chunkSize / segments
  
  const data = new Float32Array(rows * cols)
  
  for (let i = 0; i < positions.count; i++) {
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
 * Merge multiple elevation grids into one virtual grid
 * This creates a sparse grid that can sample from any of the source grids
 */
export function mergeElevationGrids(grids: ElevationGrid[]): ElevationGrid {
  if (grids.length === 0) {
    // Return empty grid
    return {
      data: new Float32Array(0),
      cols: 0,
      rows: 0,
      minX: 0,
      maxX: 0,
      minZ: 0,
      maxZ: 0,
      cellWidth: 1,
      cellDepth: 1,
    }
  }
  
  if (grids.length === 1) {
    return grids[0]!
  }
  
  // Find overall bounds
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  
  for (const grid of grids) {
    minX = Math.min(minX, grid.minX)
    maxX = Math.max(maxX, grid.maxX)
    minZ = Math.min(minZ, grid.minZ)
    maxZ = Math.max(maxZ, grid.maxZ)
  }
  
  // Use cell size from first grid (assuming all are same)
  const cellWidth = grids[0]!.cellWidth
  const cellDepth = grids[0]!.cellDepth
  
  // Calculate merged grid dimensions
  const cols = Math.ceil((maxX - minX) / cellWidth) + 1
  const rows = Math.ceil((maxZ - minZ) / cellDepth) + 1
  
  // Create merged data array (initialize with 0)
  const data = new Float32Array(rows * cols)
  
  // Fill in data from each grid
  for (const grid of grids) {
    const startCol = Math.round((grid.minX - minX) / cellWidth)
    const startRow = Math.round((grid.minZ - minZ) / cellDepth)
    
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const srcIdx = r * grid.cols + c
        const dstRow = startRow + r
        const dstCol = startCol + c
        
        if (dstRow >= 0 && dstRow < rows && dstCol >= 0 && dstCol < cols) {
          const dstIdx = dstRow * cols + dstCol
          // Take the maximum elevation if overlapping
          data[dstIdx] = Math.max(data[dstIdx] ?? 0, grid.data[srcIdx] ?? 0)
        }
      }
    }
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
 * Sample elevation from multiple grids (finds the right grid for the position)
 */
export function sampleFromGrids(
  grids: ElevationGrid[],
  x: number,
  z: number
): number {
  for (const grid of grids) {
    if (x >= grid.minX && x <= grid.maxX && z >= grid.minZ && z <= grid.maxZ) {
      // Point is within this grid, sample from it
      const gridX = ((x - grid.minX) / (grid.maxX - grid.minX)) * (grid.cols - 1)
      const gridZ = ((z - grid.minZ) / (grid.maxZ - grid.minZ)) * (grid.rows - 1)
      
      const x0 = Math.floor(gridX)
      const z0 = Math.floor(gridZ)
      const x1 = Math.min(x0 + 1, grid.cols - 1)
      const z1 = Math.min(z0 + 1, grid.rows - 1)
      
      const fx = gridX - x0
      const fz = gridZ - z0
      
      const e00 = grid.data[z0 * grid.cols + x0] ?? 0
      const e10 = grid.data[z0 * grid.cols + x1] ?? 0
      const e01 = grid.data[z1 * grid.cols + x0] ?? 0
      const e11 = grid.data[z1 * grid.cols + x1] ?? 0
      
      const e0 = e00 + (e10 - e00) * fx
      const e1 = e01 + (e11 - e01) * fx
      
      return e0 + (e1 - e0) * fz
    }
  }
  
  return 0 // Point not in any grid
}
