/**
 * 3D Terrain mesh component
 *
 * Creates a PlaneGeometry displaced by real elevation data from Mapbox,
 * textured with satellite imagery.
 */

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useTerrainData } from '@/hooks/useTerrainData';
import { useTerrainSettings, useSettingsStore } from '@/stores/useSettingsStore';
import { useMapStore } from '@/stores/useMapStore';
import { LOADING } from '@/config/theme';

export function Terrain3D() {
  const { zoom, segments } = useTerrainSettings();
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const setTerrainGroup = useMapStore((s) => s.setTerrainGroup);
  const { data, isLoading, error } = useTerrainData({ zoom });

  // Register terrain group with store for raycasting
  // Re-runs when data loads (groupRef is only attached when terrain renders, not during loading state)
  useEffect(() => {
    if (groupRef.current) {
      setTerrainGroup(groupRef.current);
    }
    return () => {
      setTerrainGroup(null);
    };
  }, [setTerrainGroup, data]);

  // Create the displaced geometry
  const geometry = useMemo(() => {
    if (!data) return null;

    const { bounds: _, width, height, elevationGrid } = data;
    // bounds destructured but not used directly (we use width/height)

    console.log(`[Terrain3D] Creating ${segments}x${segments} mesh`);
    console.log(`[Terrain3D] Size: ${width.toFixed(0)} x ${height.toFixed(0)}`);

    // Create plane geometry
    const geo = new THREE.PlaneGeometry(width, height, segments, segments);

    // Rotate to XZ plane (Y up)
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position as THREE.BufferAttribute;
    const vertexCount = positions.count;

    // Sample elevation for each vertex
    const cols = segments + 1;
    const rows = segments + 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const vertexIndex = row * cols + col;

        // Get vertex world position
        // After rotation, X and Z are correct, Y is elevation
        // PlaneGeometry vertices go from -width/2 to +width/2
        const normalizedX = col / segments; // 0 to 1
        // After rotateX(-PI/2): row 0 ends up at +Z (local), which is south (maxZ) in world space
        // Grid data has row 0 = north (from minTileY = highest lat)
        // Mesh row 0 = south, mesh row max = north
        // Grid row 0 = north, grid row max = south
        // So mesh row 0 (south) should sample grid row max (south)
        // normalizedZ = row / segments gives: row 0 -> 0, row max -> 1
        // gridZ = normalizedZ * (rows-1) gives: row 0 -> 0, row max -> rows-1
        // This maps mesh row 0 (south) to grid row 0 (north) - WRONG
        // We need to flip: mesh row 0 -> grid row max, mesh row max -> grid row 0
        // So: normalizedZ = 1 - (row / segments)
        // Wait, but sampleElevation uses: gridZ = ((maxZ - z) / (maxZ - minZ)) * (rows - 1)
        // For z = maxZ (south): gridZ = 0 (north row)
        // For z = minZ (north): gridZ = rows-1 (south row)
        // So sampleElevation maps south -> north row and north -> south row
        // To match, we need mesh row 0 (south) -> gridZ = 0, mesh row max (north) -> gridZ = rows-1
        // That means: normalizedZ = row / segments (NOT flipped!)
        const normalizedZ = row / segments;

        // Sample from elevation grid
        const gridX = normalizedX * (elevationGrid.cols - 1);
        const gridZ = normalizedZ * (elevationGrid.rows - 1);

        const x0 = Math.floor(gridX);
        const z0 = Math.floor(gridZ);
        const x1 = Math.min(x0 + 1, elevationGrid.cols - 1);
        const z1 = Math.min(z0 + 1, elevationGrid.rows - 1);

        const fx = gridX - x0;
        const fz = gridZ - z0;

        // Bilinear interpolation
        const e00 = elevationGrid.data[z0 * elevationGrid.cols + x0] ?? 0;
        const e10 = elevationGrid.data[z0 * elevationGrid.cols + x1] ?? 0;
        const e01 = elevationGrid.data[z1 * elevationGrid.cols + x0] ?? 0;
        const e11 = elevationGrid.data[z1 * elevationGrid.cols + x1] ?? 0;

        const e0 = e00 + (e10 - e00) * fx;
        const e1 = e01 + (e11 - e01) * fx;
        const elevation = e0 + (e1 - e0) * fz;

        // Set Y (elevation) - positions are already in local coords after rotation
        positions.setY(vertexIndex, elevation);
      }
    }

    // Update normals for proper lighting
    geo.computeVertexNormals();
    positions.needsUpdate = true;

    console.log(`[Terrain3D] Geometry created with ${vertexCount} vertices`);

    return geo;
  }, [data, segments]);

  // Terrain appearance settings
  const terrainBrightness = useSettingsStore((s) => s.terrainBrightness);
  const terrainSaturation = useSettingsStore((s) => s.terrainSaturation);

  // Create a desaturated copy of the satellite texture when saturation changes
  // Uses Canvas 2D filter API to avoid manual pixel manipulation
  const processedTexture = useMemo(() => {
    if (!data) return null;

    // Access the original canvas from the satellite texture
    const sourceCanvas = data.satelliteTexture.source.data as HTMLCanvasElement;
    if (!sourceCanvas) return data.satelliteTexture;

    // Create an offscreen canvas matching the source dimensions
    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return data.satelliteTexture;

    // Apply saturation filter: 0 = grayscale, 1 = original, >1 = oversaturated
    // CSS filter saturate() takes a percentage where 100% = no change
    ctx.filter = `saturate(${terrainSaturation * 100}%)`;
    ctx.drawImage(sourceCanvas, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }, [data, terrainSaturation]);

  // Create material with processed satellite texture
  const material = useMemo(() => {
    if (!data || !processedTexture) return null;

    return new THREE.MeshStandardMaterial({
      map: processedTexture,
      // Darken terrain by multiplying texture with a gray color
      // brightness=1.0 means no change, 0.7 means 30% darker
      color: new THREE.Color(terrainBrightness, terrainBrightness, terrainBrightness),
      roughness: 0.9,
      metalness: 0.0,
    });
  }, [data, processedTexture, terrainBrightness]);

  // Dispose GPU resources when they are replaced or unmounted
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      // Only dispose our processed copy, not the original query-cached texture
      if (processedTexture && processedTexture !== data?.satelliteTexture) {
        processedTexture.dispose();
      }
    };
  }, [processedTexture, data?.satelliteTexture]);

  useEffect(() => {
    return () => {
      material?.dispose();
    };
  }, [material]);

  if (isLoading) {
    return (
      <group name="terrain-loading">
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[15, 20, 32]} />
          <meshBasicMaterial color={LOADING.terrain} transparent opacity={0.5} />
        </mesh>
      </group>
    );
  }

  if (error) {
    console.error('[Terrain3D] Failed to load terrain:', error);
    return null;
  }

  if (!geometry || !material || !data) {
    return null;
  }

  return (
    <group ref={groupRef} name="terrain-3d">
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        position={[data.center[0], 0, data.center[2]]}
        receiveShadow
      />
    </group>
  );
}
