/**
 * OpenStreetMap Overpass API client for fetching ski infrastructure data
 *
 * Fetches pistes, lifts, and POIs for the active region
 */

import { getRegionBbox } from '@/stores/useAppConfigStore';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export interface OSMNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OSMWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

export interface OSMRelation {
  type: 'relation';
  id: number;
  members: { type: string; ref: number; role: string }[];
  tags?: Record<string, string>;
}

export type OSMElement = OSMNode | OSMWay | OSMRelation;

export interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
  };
  elements: OSMElement[];
}

/**
 * Execute an Overpass API query
 */
async function executeQuery(query: string): Promise<OverpassResponse> {
  const response = await fetch(OVERPASS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Calculate distance between two lat/lon points (Haversine formula)
 */
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate approximate length of a [lon, lat] coordinate path in meters
 */
function calculateLength(coordinates: [number, number][]): number {
  let length = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1]!;
    const [lon2, lat2] = coordinates[i]!;
    length += distanceMeters(lat1, lon1, lat2, lon2);
  }
  return length;
}

/**
 * Parse pistes from Overpass response
 * Returns raw single-segment pistes (before merging)
 */
function parsePistes(elements: OSMElement[]): RawPiste[] {
  const nodes = new Map<number, OSMNode>();
  const ways: OSMWay[] = [];

  for (const element of elements) {
    if (element.type === 'node') {
      nodes.set(element.id, element);
    } else if (element.type === 'way') {
      ways.push(element);
    }
  }

  const pistes: RawPiste[] = [];

  for (const way of ways) {
    if (!way.tags) continue;
    if (way.tags['piste:type'] !== 'downhill') continue;

    const coordinates: [number, number][] = [];
    for (const nodeId of way.nodes) {
      const node = nodes.get(nodeId);
      if (node) {
        coordinates.push([node.lon, node.lat]);
      }
    }

    if (coordinates.length < 2) continue;

    const difficulty = way.tags['piste:difficulty'] || 'unknown';
    const name = way.tags.name || way.tags.ref || `Piste ${way.tags['piste:ref'] || way.id}`;

    pistes.push({
      id: `piste-${way.id}`,
      osmWayId: way.id,
      name,
      difficulty: normalizeDifficulty(difficulty),
      coordinates,
      ref: way.tags.ref || way.tags['piste:ref'],
      skiArea: undefined,
    });
  }

  return pistes;
}

/**
 * Normalize difficulty string to our enum
 */
function normalizeDifficulty(difficulty: string): Difficulty {
  switch (difficulty) {
    case 'easy':
    case 'novice':
      return 'blue';
    case 'intermediate':
      return 'red';
    case 'advanced':
    case 'expert':
      return 'black';
    default:
      return 'blue';
  }
}

/**
 * Parse lifts from Overpass response
 */
function parseLifts(elements: OSMElement[]): Lift[] {
  const nodes = new Map<number, OSMNode>();
  const ways: OSMWay[] = [];

  for (const element of elements) {
    if (element.type === 'node') {
      nodes.set(element.id, element);
    } else if (element.type === 'way') {
      ways.push(element);
    }
  }

  const lifts: Lift[] = [];

  for (const way of ways) {
    if (!way.tags?.aerialway) continue;

    const coordinates: [number, number][] = [];
    for (const nodeId of way.nodes) {
      const node = nodes.get(nodeId);
      if (node) {
        coordinates.push([node.lon, node.lat]);
      }
    }

    if (coordinates.length < 2) continue;

    const liftType = way.tags.aerialway;
    const name = way.tags.name || `Lift ${way.id}`;
    const firstCoord = coordinates[0]!;
    const lastCoord = coordinates[coordinates.length - 1]!;

    lifts.push({
      id: `lift-${way.id}`,
      name,
      type: normalizeLiftType(liftType),
      coordinates,
      length: calculateLength(coordinates),
      stations: [
        {
          name: way.tags['aerialway:station:bottom'],
          coordinates: [firstCoord[1], firstCoord[0], 0],
        },
        {
          name: way.tags['aerialway:station:top'],
          coordinates: [lastCoord[1], lastCoord[0], 0],
        },
      ],
      capacity: way.tags['aerialway:capacity']
        ? parseInt(way.tags['aerialway:capacity'], 10)
        : undefined,
      skiArea: undefined,
    });
  }

  return lifts;
}

/**
 * Normalize lift type string
 */
function normalizeLiftType(type: string): LiftType {
  const normalized = type.toLowerCase().replace(/_/g, ' ');

  if (normalized.includes('gondola')) return 'Gondola';
  if (normalized.includes('cable car')) return 'Cable Car';
  if (normalized.includes('chair')) return 'Chair Lift';
  if (normalized.includes('t-bar') || normalized.includes('tbar')) return 'T-Bar';
  if (normalized.includes('button') || normalized.includes('platter')) return 'Button Lift';
  if (normalized.includes('drag') || normalized.includes('rope')) return 'Drag Lift';
  if (normalized.includes('magic carpet')) return 'Magic Carpet';

  return 'Lift';
}

/**
 * Parse peaks from Overpass response
 */
function parsePeaks(elements: OSMElement[]): Peak[] {
  const peaks: Peak[] = [];

  for (const element of elements) {
    if (element.type !== 'node') continue;
    if (!element.tags) continue;

    const name = element.tags.name;
    if (!name) continue;

    const elevation = element.tags.ele ? parseFloat(element.tags.ele) : undefined;

    peaks.push({
      id: `peak-${element.id}`,
      name,
      lat: element.lat,
      lon: element.lon,
      elevation,
    });
  }

  return peaks;
}

/**
 * Parse places (villages, hamlets, etc) from Overpass response
 */
function parsePlaces(elements: OSMElement[]): Place[] {
  const places: Place[] = [];

  for (const element of elements) {
    if (element.type !== 'node') continue;
    if (!element.tags) continue;

    const name = element.tags.name;
    if (!name) continue;

    places.push({
      id: `place-${element.id}`,
      name,
      lat: element.lat,
      lon: element.lon,
      type: element.tags.place || 'locality',
    });
  }

  return places;
}

/**
 * Parse restaurants, cafes, bars, and alpine huts from Overpass response.
 * Handles both node-based and way-based (building polygon) restaurants.
 * For ways, the centroid of the building polygon is used as the location.
 */
function parseRestaurants(elements: OSMElement[], nodes: Map<number, OSMNode>): Restaurant[] {
  const restaurants: Restaurant[] = [];

  for (const element of elements) {
    if (!element.tags) continue;

    const name = element.tags.name;
    if (!name) continue;

    const type = normalizeRestaurantType(element.tags);
    if (!type) continue;

    let lat: number;
    let lon: number;

    if (element.type === 'node') {
      lat = element.lat;
      lon = element.lon;
    } else if (element.type === 'way') {
      // Compute centroid from the way's nodes
      const coords: [number, number][] = [];
      for (const nodeId of element.nodes) {
        const node = nodes.get(nodeId);
        if (node) {
          coords.push([node.lon, node.lat]);
        }
      }
      if (coords.length === 0) continue;
      const [cLon, cLat] = computeCentroid(coords);
      lat = cLat;
      lon = cLon;
    } else {
      continue;
    }

    const elevation = element.tags.ele ? parseFloat(element.tags.ele) : undefined;

    restaurants.push({
      id: `restaurant-${element.id}`,
      name,
      lat,
      lon,
      type,
      elevation,
      cuisine: element.tags.cuisine,
    });
  }

  return restaurants;
}

/**
 * Determine restaurant type from OSM tags
 */
function normalizeRestaurantType(tags: Record<string, string>): RestaurantType | null {
  if (tags.tourism === 'alpine_hut') return 'Alpine Hut';
  if (tags.amenity === 'restaurant') return 'Restaurant';
  if (tags.amenity === 'cafe') return 'Cafe';
  if (tags.amenity === 'bar') return 'Bar';
  return null;
}

/**
 * Parse ski area polygons from Overpass response
 * Handles both way-based and relation-based ski areas
 */
function parseSkiAreaPolygons(
  elements: OSMElement[],
  nodes: Map<number, OSMNode>
): SkiAreaPolygon[] {
  const polygons: SkiAreaPolygon[] = [];

  for (const element of elements) {
    if (!element.tags) continue;

    // Match landuse=winter_sports areas (ways or relations with polygon boundaries)
    const isWinterSports = element.tags.landuse === 'winter_sports';
    // Also match site=piste relations
    const isSitePiste = element.tags.site === 'piste';

    if (!isWinterSports && !isSitePiste) continue;

    const name = element.tags.name;
    if (!name) continue;

    if (element.type === 'way') {
      const polygon: [number, number][] = [];
      for (const nodeId of element.nodes) {
        const node = nodes.get(nodeId);
        if (node) {
          polygon.push([node.lon, node.lat]);
        }
      }

      if (polygon.length >= 3) {
        const centroid = computeCentroid(polygon);
        polygons.push({
          id: `skiarea-poly-${element.id}`,
          name,
          url: element.tags.url,
          polygon,
          centroid,
        });
      }
    } else if (element.type === 'relation') {
      // Collect outer ways to form polygon
      const polygon: [number, number][] = [];

      for (const member of element.members) {
        if (member.type === 'way' && (member.role === 'outer' || member.role === '')) {
          const way = elements.find((e): e is OSMWay => e.type === 'way' && e.id === member.ref);
          if (way) {
            for (const nodeId of way.nodes) {
              const node = nodes.get(nodeId);
              if (node) {
                polygon.push([node.lon, node.lat]);
              }
            }
          }
        }
      }

      if (polygon.length >= 3) {
        const centroid = computeCentroid(polygon);
        polygons.push({
          id: `skiarea-poly-${element.id}`,
          name,
          url: element.tags.url,
          polygon,
          centroid,
        });
      }
    }
  }

  return polygons;
}

/**
 * Compute centroid of a polygon as average of all points
 */
function computeCentroid(polygon: [number, number][]): [number, number] {
  let cx = 0;
  let cy = 0;
  for (const [lon, lat] of polygon) {
    cx += lon;
    cy += lat;
  }
  return [cx / polygon.length, cy / polygon.length];
}

// ─── Type Definitions ────────────────────────────────────────────────────────

/** Piste difficulty levels */
export type Difficulty = 'blue' | 'red' | 'black';

/** All available difficulty levels in order from easiest to hardest */
export const ALL_DIFFICULTIES: Difficulty[] = ['blue', 'red', 'black'];

/** Ski area identity */
export interface SkiArea {
  id: string;
  name: string;
  url?: string;
}

/**
 * Ski area with polygon boundary for spatial containment tests
 */
export interface SkiAreaPolygon extends SkiArea {
  polygon: [number, number][]; // Boundary coordinates [lon, lat][]
  centroid: [number, number]; // Center point [lon, lat]
}

/**
 * Raw piste data before merging (single segment per OSM way)
 * Coordinates are [lon, lat][] pairs
 */
export interface RawPiste {
  id: string;
  osmWayId: number;
  name: string;
  difficulty: Difficulty;
  ref?: string;
  coordinates: [number, number][];
  skiArea?: SkiArea;
}

/**
 * Merged piste data (multiple segments combined by name/ref/difficulty)
 * Coordinates are [lon, lat][][] — array of segments
 */
export interface Piste {
  id: string;
  name: string;
  difficulty: Difficulty;
  ref?: string;
  coordinates: [number, number][][];
  startPoint?: [number, number, number];
  endPoint?: [number, number, number];
  length: number;
  skiArea?: SkiArea;
  osmWayIds: number[];
}

/** Lift types */
export type LiftType =
  | 'Gondola'
  | 'Chair Lift'
  | 'Cable Car'
  | 'T-Bar'
  | 'Button Lift'
  | 'Drag Lift'
  | 'Magic Carpet'
  | 'Lift';

/** Ski lift data — coordinates are [lon, lat][] pairs */
export interface Lift {
  id: string;
  name: string;
  type: LiftType;
  coordinates: [number, number][];
  length: number;
  stations?: {
    name?: string;
    coordinates: [number, number, number]; // [lat, lon, elevation]
  }[];
  capacity?: number;
  skiArea?: SkiArea;
}

/** Peak/mountain data */
export interface Peak {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevation?: number;
}

/** Place/POI data */
export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
}

/** Restaurant sub-types */
export type RestaurantType = 'Restaurant' | 'Cafe' | 'Bar' | 'Alpine Hut';

/** Restaurant/dining data */
export interface Restaurant {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: RestaurantType;
  elevation?: number;
  cuisine?: string;
  skiArea?: SkiArea;
}

/** Complete raw ski data response (before merge processing) */
export interface SkiData {
  pistes: RawPiste[];
  lifts: Lift[];
  peaks: Peak[];
  places: Place[];
  restaurants: Restaurant[];
  skiAreaPolygons: SkiAreaPolygon[];
}

/**
 * Build a single combined Overpass query for all ski data
 */
function buildCombinedQuery(): string {
  const { south, west, north, east } = getRegionBbox();
  return `
[out:json][timeout:120];
(
  // Ski pistes (downhill only)
  way["piste:type"="downhill"](${south},${west},${north},${east});
  
  // Ski lifts
  way["aerialway"](${south},${west},${north},${east});
  
  // Ski areas (polygon boundaries)
  way["landuse"="winter_sports"](${south},${west},${north},${east});
  relation["landuse"="winter_sports"](${south},${west},${north},${east});
  relation["site"="piste"](${south},${west},${north},${east});
  
  // Peaks and places
  node["natural"="peak"](${south},${west},${north},${east});
  node["place"~"^(village|hamlet|locality|isolated_dwelling)$"](${south},${west},${north},${east});
  
  // Restaurants, cafes, bars, and alpine huts (nodes and ways/buildings)
  node["amenity"~"^(restaurant|cafe|bar)$"](${south},${west},${north},${east});
  way["amenity"~"^(restaurant|cafe|bar)$"](${south},${west},${north},${east});
  node["tourism"="alpine_hut"](${south},${west},${north},${east});
  way["tourism"="alpine_hut"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
`.trim();
}

/**
 * Fetch all ski data in a single request
 */
export async function fetchAllSkiData(): Promise<SkiData> {
  console.log('[Overpass] Fetching all ski data...');

  const query = buildCombinedQuery();
  const response = await executeQuery(query);

  // Build node lookup
  const nodes = new Map<number, OSMNode>();
  for (const element of response.elements) {
    if (element.type === 'node') {
      nodes.set(element.id, element);
    }
  }

  // Parse all data types
  const pistes = parsePistes(response.elements);
  const lifts = parseLifts(response.elements);
  const peaks = parsePeaks(response.elements);
  const places = parsePlaces(response.elements);
  const restaurants = parseRestaurants(response.elements, nodes);
  const skiAreaPolygons = parseSkiAreaPolygons(response.elements, nodes);

  console.log(
    `[Overpass] Loaded: ${pistes.length} pistes, ${lifts.length} lifts, ${peaks.length} peaks, ${places.length} places, ${restaurants.length} restaurants, ${skiAreaPolygons.length} ski areas`
  );

  return {
    pistes,
    lifts,
    peaks,
    places,
    restaurants,
    skiAreaPolygons,
  };
}
