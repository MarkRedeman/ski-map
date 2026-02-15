/**
 * Terrain sampling utility using raycasting
 * Projects points onto the terrain mesh surface
 */

import * as THREE from 'three';

// Reusable objects to avoid allocations
const raycaster = new THREE.Raycaster();
const downDirection = new THREE.Vector3(0, -1, 0);
const rayOrigin = new THREE.Vector3();

/**
 * Sample the terrain elevation at a given X/Z position
 * @param terrainMesh - The terrain mesh to sample from
 * @param x - X coordinate in scene space
 * @param z - Z coordinate in scene space
 * @returns Y elevation at that point, or 0 if no intersection
 */
export function sampleTerrainElevation(terrainMesh: THREE.Mesh, x: number, z: number): number {
  // Cast ray from high above, pointing down
  rayOrigin.set(x, 1000, z);
  raycaster.set(rayOrigin, downDirection);

  const intersects = raycaster.intersectObject(terrainMesh, false);

  if (intersects.length > 0 && intersects[0]) {
    return intersects[0].point.y;
  }

  return 0; // Fallback if no intersection
}

/**
 * Project an array of 3D points onto the terrain surface
 * @param terrainMesh - The terrain mesh to project onto
 * @param points - Array of [x, y, z] coordinates (y will be replaced)
 * @param offset - Height offset above the terrain surface
 * @returns New array with Y values sampled from terrain
 */
export function projectPointsOnTerrain(
  terrainMesh: THREE.Mesh,
  points: [number, number, number][],
  offset: number = 2
): [number, number, number][] {
  return points.map(([x, , z]) => {
    const terrainY = sampleTerrainElevation(terrainMesh, x, z);
    return [x, terrainY + offset, z];
  });
}

/**
 * Project Vector3 array onto terrain
 */
export function projectVectorsOnTerrain(
  terrainMesh: THREE.Mesh,
  points: THREE.Vector3[],
  offset: number = 2
): THREE.Vector3[] {
  return points.map((p) => {
    const terrainY = sampleTerrainElevation(terrainMesh, p.x, p.z);
    return new THREE.Vector3(p.x, terrainY + offset, p.z);
  });
}
