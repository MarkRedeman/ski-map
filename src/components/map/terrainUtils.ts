/**
 * Terrain utilities for chunked terrain system
 * 
 * Handles elevation grid creation and merging for multiple chunks
 */

import * as THREE from 'three'
import type { ElevationGrid, ChunkElevationMap } from '@/lib/geo/elevationGrid'

/**
 * Create an elevation grid from a terrain chunk mesh
 * 
 * IMPORTANT: This function properly handles the coordinate transformation.
 * The mesh geometry stores vertices in local space (-halfSize to +halfSize),
 * but we need world-space bounds for the elevation grid.
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
  
  // World-space bounds
  const minX = meshPosition.x - halfSize
  const maxX = meshPosition.x + halfSize
  const minZ = meshPosition.z - halfSize
  const maxZ = meshPosition.z + halfSize
  
  const cellWidth = chunkSize / segments
  const cellDepth = chunkSize / segments
  
  const data = new Float32Array(rows * cols)
  
  // The PlaneGeometry after rotateX(-PI/2) has vertices laid out as:
  // - X goes from -halfSize to +halfSize (left to right)
  // - Z goes from -halfSize to +halfSize (back to front)
  // - Y contains the elevation
  // Vertices are ordered row by row (Z direction first, then X)
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
 * Create a chunk key for the elevation map
 */
export function getChunkKey(chunkX: number, chunkZ: number): string {
  return `${chunkX},${chunkZ}`
}

/**
 * Create or update a ChunkElevationMap with a new chunk
 */
export function addChunkToMap(
  existingMap: ChunkElevationMap | null,
  chunkKey: string,
  grid: ElevationGrid,
  chunkSize: number
): ChunkElevationMap {
  const chunks = new Map(existingMap?.chunks || [])
  chunks.set(chunkKey, grid)
  
  return {
    chunks,
    chunkSize,
  }
}

/**
 * Remove a chunk from the elevation map
 */
export function removeChunkFromMap(
  existingMap: ChunkElevationMap | null,
  chunkKey: string,
  chunkSize: number
): ChunkElevationMap {
  const chunks = new Map(existingMap?.chunks || [])
  chunks.delete(chunkKey)
  
  return {
    chunks,
    chunkSize,
  }
}
