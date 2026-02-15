/**
 * Contour line generation using d3-contour
 *
 * Takes an elevation grid and generates contour polylines at specified intervals.
 */

import { contours } from 'd3-contour';
import { geoToLocal } from './coordinates';

export interface ContourLine {
  elevation: number;
  /**
   * MultiPolygon format from d3-contour:
   * coordinates[polygonIndex][ringIndex][pointIndex] = [x, y]
   */
  coordinates: number[][][][];
}

export interface ContourData3D {
  elevation: number;
  /** Array of rings in 3D world coordinates [x, y, z] */
  rings: Array<Array<[number, number, number]>>;
}

/**
 * Generate contour lines from an elevation grid
 *
 * @param elevations - Float32Array of elevation values (row-major order)
 * @param width - Grid width in pixels
 * @param height - Grid height in pixels
 * @param interval - Contour interval in meters (e.g., 50 or 100)
 * @param minElevation - Minimum elevation to generate contours for
 * @param maxElevation - Maximum elevation to generate contours for
 */
export function generateContours(
  elevations: Float32Array,
  width: number,
  height: number,
  interval: number,
  minElevation?: number,
  maxElevation?: number
): ContourLine[] {
  // Convert Float32Array to regular array for d3-contour
  const values = Array.from(elevations);

  // Calculate elevation range
  let min = minElevation ?? Infinity;
  let max = maxElevation ?? -Infinity;

  if (minElevation === undefined || maxElevation === undefined) {
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  // Generate threshold values (contour levels)
  const thresholds: number[] = [];
  const startElevation = Math.ceil(min / interval) * interval;
  for (let e = startElevation; e <= max; e += interval) {
    thresholds.push(e);
  }

  if (thresholds.length === 0) {
    return [];
  }

  // Create contour generator
  const contourGenerator = contours().size([width, height]).thresholds(thresholds);

  // Generate contours
  const contourPolygons = contourGenerator(values);

  // Extract contour lines
  return contourPolygons.map((polygon) => ({
    elevation: polygon.value,
    coordinates: polygon.coordinates as number[][][][],
  }));
}

/**
 * Convert contour pixel coordinates to 3D world coordinates
 *
 * @param contourLines - Array of contour lines with pixel coordinates
 * @param bounds - Geographic bounds of the elevation grid
 * @param width - Grid width in pixels
 * @param height - Grid height in pixels
 * @param yOffset - Y offset above the contour's actual elevation (default 0)
 * @param useElevationForY - If true, set Y based on contour elevation (converted to scene units)
 * @param centerElevation - Reference elevation (used when useElevationForY is true)
 * @param scale - Scale factor for elevation (used when useElevationForY is true)
 */
export function contourToWorld(
  contourLines: ContourLine[],
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  width: number,
  height: number,
  yOffset: number = 0,
  useElevationForY: boolean = false,
  centerElevation: number = 2284,
  scale: number = 0.1
): ContourData3D[] {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const lonRange = maxLon - minLon;
  const latRange = maxLat - minLat;

  // Debug first contour structure
  if (contourLines.length > 0) {
    const first = contourLines[0]!;
    console.log(`[contourToWorld] First contour elevation: ${first.elevation}`);
    console.log(`[contourToWorld] coordinates structure:`, {
      isArray: Array.isArray(first.coordinates),
      length: first.coordinates?.length,
      firstItem: first.coordinates?.[0],
      firstItemIsArray: Array.isArray(first.coordinates?.[0]),
      firstItemLength: first.coordinates?.[0]?.length,
      samplePoint: first.coordinates?.[0]?.[0],
    });
  }

  const result: ContourData3D[] = [];

  for (const contour of contourLines) {
    const validRings: Array<Array<[number, number, number]>> = [];

    // d3-contour returns MultiPolygon format: coordinates[polygon][ring][point]
    // Each polygon can have multiple rings (outer + holes)
    // We flatten all rings from all polygons
    for (const polygon of contour.coordinates) {
      // polygon is an array of rings (first is outer, rest are holes)
      if (!Array.isArray(polygon)) continue;

      for (const ring of polygon) {
        // ring should be an array of [x, y] points
        if (!Array.isArray(ring) || ring.length < 3) continue;

        const worldRing: Array<[number, number, number]> = [];
        let hasValidPoints = true;

        for (const point of ring) {
          // point should be [x, y]
          if (!Array.isArray(point)) {
            hasValidPoints = false;
            break;
          }

          const px = point[0];
          const py = point[1];

          // Validate pixel coordinates
          if (px === undefined || py === undefined || !isFinite(px) || !isFinite(py)) {
            hasValidPoints = false;
            break;
          }

          // Convert pixel coordinates to geo coordinates
          const lon = minLon + (px / width) * lonRange;
          // Y is inverted: top of image (py=0) = north = maxLat
          const lat = maxLat - (py / height) * latRange;

          // Validate geo coordinates
          if (!isFinite(lon) || !isFinite(lat)) {
            hasValidPoints = false;
            break;
          }

          // Convert to local 3D coordinates
          const [x, , z] = geoToLocal(lat, lon);

          // Validate world coordinates
          if (!isFinite(x) || !isFinite(z)) {
            hasValidPoints = false;
            break;
          }

          // Calculate Y coordinate
          let y: number;
          if (useElevationForY) {
            // Use actual contour elevation, converted to scene units
            y = (contour.elevation - centerElevation) * scale + yOffset;
          } else {
            y = yOffset;
          }

          worldRing.push([x, y, z]);
        }

        // Only add rings with at least 3 valid points
        if (hasValidPoints && worldRing.length >= 3) {
          validRings.push(worldRing);
        }
      }
    }

    // Only add contours with valid rings
    if (validRings.length > 0) {
      result.push({
        elevation: contour.elevation,
        rings: validRings,
      });
    }
  }

  console.log(
    `[contourToWorld] Converted ${contourLines.length} contours -> ${result.length} with valid rings`
  );

  return result;
}

/**
 * Simplify contour coordinates using Douglas-Peucker algorithm
 * Reduces the number of points while preserving shape
 */
export function simplifyContour(
  points: Array<[number, number, number]>,
  tolerance: number = 1
): Array<[number, number, number]> {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from the line between first and last
  let maxDist = 0;
  let maxIdx = 0;

  const [x1, , z1] = points[0]!;
  const [x2, , z2] = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const [x, , z] = points[i]!;
    const dist = pointToLineDistance(x, z, x1, z1, x2, z2);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = simplifyContour(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyContour(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  // Otherwise, just keep the endpoints
  return [points[0]!, points[points.length - 1]!];
}

/**
 * Calculate perpendicular distance from point (px, py) to line (x1,y1)-(x2,y2)
 */
function pointToLineDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Line segment is a point
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }

  // Calculate perpendicular distance
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}
