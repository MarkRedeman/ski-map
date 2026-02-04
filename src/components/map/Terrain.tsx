import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { getSoldenBounds } from "@/lib/geo/coordinates";
import { createElevationGrid } from "@/lib/geo/elevationGrid";
import { useMapStore } from "@/stores/useMapStore";

/**
 * Color palette for elevation-based terrain coloring
 * Creates a realistic snow-covered mountain look
 */
const TERRAIN_COLORS = {
  valley: new THREE.Color("#8B9A7D"), // Greenish gray for valley
  lowSlope: new THREE.Color("#C5CCC0"), // Light gray-green transition
  snow: new THREE.Color("#F8FAFC"), // Bright snow white
  highSnow: new THREE.Color("#E2E8F0"), // Slightly blue-tinted snow
  peak: new THREE.Color("#CBD5E1"), // Ice/rock at peaks
};

/**
 * Get terrain color based on elevation
 */
function getElevationColor(
  elevation: number,
  maxElevation: number,
): THREE.Color {
  const normalizedHeight = elevation / maxElevation;

  if (normalizedHeight < 0.1) {
    // Valley - greenish
    return TERRAIN_COLORS.valley
      .clone()
      .lerp(TERRAIN_COLORS.lowSlope, normalizedHeight / 0.1);
  } else if (normalizedHeight < 0.3) {
    // Lower slopes - transition to snow
    const t = (normalizedHeight - 0.1) / 0.2;
    return TERRAIN_COLORS.lowSlope.clone().lerp(TERRAIN_COLORS.snow, t);
  } else if (normalizedHeight < 0.7) {
    // Main ski area - bright snow
    return TERRAIN_COLORS.snow.clone();
  } else if (normalizedHeight < 0.9) {
    // High altitude - slightly blue tint
    const t = (normalizedHeight - 0.7) / 0.2;
    return TERRAIN_COLORS.snow.clone().lerp(TERRAIN_COLORS.highSnow, t);
  } else {
    // Peaks - icy/rocky
    const t = (normalizedHeight - 0.9) / 0.1;
    return TERRAIN_COLORS.highSnow.clone().lerp(TERRAIN_COLORS.peak, t);
  }
}

/**
 * Terrain mesh for the Sölden ski area with elevation-based coloring
 *
 * In a production app, this would fetch Mapbox terrain-RGB tiles
 * and create a detailed elevation mesh. For now, we create a
 * procedural terrain that approximates mountain slopes.
 */
export function Terrain() {
  const bounds = getSoldenBounds();
  const meshRef = useRef<THREE.Mesh>(null);
  const setTerrainMesh = useMapStore((s) => s.setTerrainMesh);
  const setElevationGrid = useMapStore((s) => s.setElevationGrid);

  // Register terrain mesh and elevation grid with store
  useEffect(() => {
    if (meshRef.current) {
      setTerrainMesh(meshRef.current);
      // Create elevation grid for fast O(1) height lookups
      const grid = createElevationGrid(meshRef.current);
      setElevationGrid(grid);
    }
    return () => {
      setTerrainMesh(null);
      setElevationGrid(null);
    };
  }, [setTerrainMesh, setElevationGrid]);

  const geometry = useMemo(() => {
    const segments = 400; // Higher resolution for larger, smoother terrain
    const width = bounds.width || 500;
    const depth = bounds.depth || 500;

    const geo = new THREE.PlaneGeometry(width, depth, segments, segments);

    // Rotate to be horizontal (XZ plane)
    geo.rotateX(-Math.PI / 2);

    // Apply procedural elevation and vertex colors
    const positions = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);

    // Scale factors based on terrain size (larger terrain needs adjusted frequencies)
    const scale = Math.max(width, depth) / 500;

    let maxElevation = 0;

    // First pass - calculate elevations and find max
    if (positions) {
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);

        // Create mountain-like elevation using multiple octaves of noise
        let elevation = 0;

        // Base elevation - gentle bowl shape centered on Giggijoch
        // Mountains rise towards the edges
        const distFromCenter = Math.sqrt(x * x + z * z);
        const normalizedDist = distFromCenter / (Math.max(width, depth) * 0.5);

        // Bowl shape: lower in center (Giggijoch valley), higher at edges
        elevation += 30 + normalizedDist * 80;

        // Major mountain ridges running roughly east-west and north-south
        elevation += Math.sin((x * 0.012) / scale + 0.5) * 50;
        elevation += Math.cos((z * 0.01) / scale) * 40;

        // Secondary ridges at different angles
        elevation += Math.sin(((x + z) * 0.008) / scale) * 30;
        elevation += Math.cos(((x - z) * 0.009) / scale) * 25;

        // Medium-scale variation (individual peaks and valleys)
        elevation += Math.sin((x * 0.025) / scale + (z * 0.015) / scale) * 20;
        elevation += Math.sin((x * 0.04) / scale - (z * 0.03) / scale) * 15;

        // Fine detail
        elevation += Math.sin((x * 0.08) / scale + (z * 0.06) / scale) * 8;
        elevation +=
          Math.sin((x * 0.15) / scale) * Math.cos((z * 0.12) / scale) * 5;

        // Valley carved through the center (where Sölden village would be)
        // Runs roughly north-south
        const valleyWidth = 80 * scale;
        const valleyDepth = 40;
        const distFromValley = Math.abs(x - 20); // Slightly offset from center
        if (distFromValley < valleyWidth) {
          const valleyFactor = 1 - distFromValley / valleyWidth;
          elevation -= valleyDepth * valleyFactor * valleyFactor;
        }

        // Ensure minimum elevation (no holes below ground)
        elevation = Math.max(5, elevation);

        positions.setY(i, elevation);
        maxElevation = Math.max(maxElevation, elevation);
      }

      positions.needsUpdate = true;
    }

    // Second pass - apply colors based on elevation
    if (positions) {
      for (let i = 0; i < positions.count; i++) {
        const elevation = positions.getY(i);
        const color = getElevationColor(elevation, maxElevation);

        // Add slight noise to colors for more natural look
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const noise = Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.03;

        colors[i * 3] = Math.min(1, Math.max(0, color.r + noise));
        colors[i * 3 + 1] = Math.min(1, Math.max(0, color.g + noise));
        colors[i * 3 + 2] = Math.min(1, Math.max(0, color.b + noise));
      }

      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }

    geo.computeVertexNormals();

    return geo;
  }, [bounds.width, bounds.depth]);

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, 0, 0]} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.85}
        metalness={0.05}
        flatShading={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
