/**
 * OpenStreetMap Overpass API client for fetching ski infrastructure data
 * 
 * Fetches pistes, lifts, and POIs for the Sölden ski area
 */

// Sölden ski area bounding box (includes Rettenbach & Tiefenbach glaciers)
const SOLDEN_BBOX = {
  south: 46.84,
  west: 10.86,
  north: 46.98,
  east: 11.15,
}

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter'

export interface OSMNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}

export interface OSMWay {
  type: 'way'
  id: number
  nodes: number[]
  tags?: Record<string, string>
}

export interface OSMRelation {
  type: 'relation'
  id: number
  members: { type: string; ref: number; role: string }[]
  tags?: Record<string, string>
}

export type OSMElement = OSMNode | OSMWay | OSMRelation

export interface OverpassResponse {
  version: number
  generator: string
  osm3s: {
    timestamp_osm_base: string
  }
  elements: OSMElement[]
}

/**
 * Build Overpass QL query for ski pistes in Sölden
 */
function buildPistesQuery(): string {
  const { south, west, north, east } = SOLDEN_BBOX
  return `
[out:json][timeout:60];
(
  way["piste:type"="downhill"](${south},${west},${north},${east});
  relation["piste:type"="downhill"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
`.trim()
}

/**
 * Build Overpass QL query for ski lifts in Sölden
 */
function buildLiftsQuery(): string {
  const { south, west, north, east } = SOLDEN_BBOX
  return `
[out:json][timeout:60];
(
  way["aerialway"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
`.trim()
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
  })

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Parse OSM difficulty to our difficulty type
 * European ski slope colors:
 * - Blue = Easy/Beginner (novice, easy)
 * - Red = Intermediate (intermediate)
 * - Black = Expert/Advanced (advanced, expert, freeride)
 */
export function parseDifficulty(osmDifficulty?: string): 'blue' | 'red' | 'black' {
  switch (osmDifficulty) {
    case 'novice':
    case 'easy':
      return 'blue'
    case 'intermediate':
      return 'red'
    case 'advanced':
    case 'expert':
    case 'freeride':
      return 'black'
    default:
      return 'blue' // Default to easy if unknown
  }
}

/**
 * Parse OSM lift type
 */
export function parseLiftType(aerialway?: string): string {
  switch (aerialway) {
    case 'gondola':
      return 'Gondola'
    case 'chair_lift':
      return 'Chair Lift'
    case 'cable_car':
      return 'Cable Car'
    case 't-bar':
      return 'T-Bar'
    case 'drag_lift':
      return 'Drag Lift'
    case 'platter':
      return 'Button Lift'
    case 'magic_carpet':
      return 'Magic Carpet'
    default:
      return 'Lift'
  }
}

import type { Difficulty } from '@/stores/useNavigationStore'

export interface SkiArea {
  id: string
  name: string
  url?: string
}

export interface Piste {
  id: string
  name: string
  difficulty: Difficulty
  ref?: string // Piste number/reference
  coordinates: [number, number][] // [lon, lat] pairs
  startPoint?: [number, number, number] // [lat, lon, elevation]
  endPoint?: [number, number, number]
  length?: number // meters
  skiArea?: SkiArea // Which ski resort this piste belongs to
  osmWayIds?: number[] // Original OSM way IDs (for merged pistes)
}

export interface Lift {
  id: string
  name: string
  type: string
  coordinates: [number, number][] // [lon, lat] pairs
  stations?: {
    name?: string
    coordinates: [number, number, number] // [lat, lon, elevation]
  }[]
  capacity?: number
}

export interface Peak {
  id: string
  name: string
  lat: number
  lon: number
  elevation: number
}

export interface Place {
  id: string
  name: string
  type: 'town' | 'village' | 'hamlet'
  lat: number
  lon: number
}

/**
 * Fetch and parse ski pistes from OSM
 */
export async function fetchPistes(): Promise<Piste[]> {
  const query = buildPistesQuery()
  const response = await executeQuery(query)
  
  // Build node lookup for coordinates
  const nodes = new Map<number, OSMNode>()
  response.elements.forEach((el) => {
    if (el.type === 'node') {
      nodes.set(el.id, el)
    }
  })

  // Parse ways into pistes
  const pistes: Piste[] = []
  
  response.elements.forEach((el) => {
    if (el.type === 'way' && el.tags) {
      const coordinates: [number, number][] = []
      
      el.nodes.forEach((nodeId) => {
        const node = nodes.get(nodeId)
        if (node) {
          coordinates.push([node.lon, node.lat])
        }
      })

      if (coordinates.length > 0) {
        const firstCoord = coordinates[0]
        const lastCoord = coordinates[coordinates.length - 1]
        
        pistes.push({
          id: `piste-${el.id}`,
          name: el.tags.name || el.tags.ref || `Piste ${el.tags['piste:ref'] || el.id}`,
          difficulty: parseDifficulty(el.tags['piste:difficulty']),
          ref: el.tags.ref || el.tags['piste:ref'],
          coordinates,
          startPoint: firstCoord ? [firstCoord[1], firstCoord[0], 0] : undefined,
          endPoint: lastCoord ? [lastCoord[1], lastCoord[0], 0] : undefined,
        })
      }
    }
  })

  return pistes
}

/**
 * Fetch and parse ski lifts from OSM
 */
export async function fetchLifts(): Promise<Lift[]> {
  const query = buildLiftsQuery()
  const response = await executeQuery(query)
  
  // Build node lookup for coordinates
  const nodes = new Map<number, OSMNode>()
  response.elements.forEach((el) => {
    if (el.type === 'node') {
      nodes.set(el.id, el)
    }
  })

  // Parse ways into lifts
  const lifts: Lift[] = []
  
  response.elements.forEach((el) => {
    if (el.type === 'way' && el.tags?.aerialway) {
      const coordinates: [number, number][] = []
      
      el.nodes.forEach((nodeId) => {
        const node = nodes.get(nodeId)
        if (node) {
          coordinates.push([node.lon, node.lat])
        }
      })

      if (coordinates.length >= 2) {
        const firstCoord = coordinates[0]
        const lastCoord = coordinates[coordinates.length - 1]
        
        lifts.push({
          id: `lift-${el.id}`,
          name: el.tags.name || `${parseLiftType(el.tags.aerialway)} ${el.id}`,
          type: parseLiftType(el.tags.aerialway),
          coordinates,
          stations: [
            {
              name: el.tags['aerialway:station:bottom'],
              coordinates: firstCoord ? [firstCoord[1], firstCoord[0], 0] : [0, 0, 0],
            },
            {
              name: el.tags['aerialway:station:top'],
              coordinates: lastCoord ? [lastCoord[1], lastCoord[0], 0] : [0, 0, 0],
            },
          ],
          capacity: el.tags['aerialway:capacity'] 
            ? parseInt(el.tags['aerialway:capacity'], 10) 
            : undefined,
        })
      }
    }
  })

  return lifts
}

/**
 * Build Overpass QL query for mountain peaks
 */
function buildPeaksQuery(): string {
  const { south, west, north, east } = SOLDEN_BBOX
  return `
[out:json][timeout:30];
node["natural"="peak"](${south},${west},${north},${east});
out body;
`.trim()
}

/**
 * Build Overpass QL query for villages, towns, and hamlets
 */
function buildPlacesQuery(): string {
  const { south, west, north, east } = SOLDEN_BBOX
  return `
[out:json][timeout:30];
node["place"~"village|town|hamlet"](${south},${west},${north},${east});
out body;
`.trim()
}

/**
 * Fetch and parse mountain peaks from OSM
 */
export async function fetchPeaks(): Promise<Peak[]> {
  const query = buildPeaksQuery()
  const response = await executeQuery(query)
  
  return response.elements
    .filter((el): el is OSMNode => el.type === 'node' && !!el.tags?.name)
    .map((node) => ({
      id: `peak-${node.id}`,
      name: node.tags!.name!,
      lat: node.lat,
      lon: node.lon,
      elevation: parseFloat(node.tags?.ele ?? '0'),
    }))
}

/**
 * Fetch and parse villages, towns, and hamlets from OSM
 */
export async function fetchPlaces(): Promise<Place[]> {
  const query = buildPlacesQuery()
  const response = await executeQuery(query)
  
  return response.elements
    .filter((el): el is OSMNode => el.type === 'node' && !!el.tags?.name && !!el.tags?.place)
    .map((node) => ({
      id: `place-${node.id}`,
      name: node.tags!.name!,
      type: node.tags!.place as 'town' | 'village' | 'hamlet',
      lat: node.lat,
      lon: node.lon,
    }))
}

/**
 * Build Overpass QL query for ski area site relations
 * These relations group pistes by ski resort
 */
function buildSkiAreasQuery(): string {
  const { south, west, north, east } = SOLDEN_BBOX
  return `
[out:json][timeout:60];
relation["site"="piste"](${south},${west},${north},${east});
out body;
`.trim()
}

/**
 * Ski area data with member way IDs
 */
export interface SkiAreaWithMembers extends SkiArea {
  wayIds: Set<number>
}

/**
 * Fetch ski area relations and their member way IDs
 * Returns a map of wayId -> SkiArea for quick lookup
 */
export async function fetchSkiAreaMemberships(): Promise<{
  skiAreas: SkiArea[]
  wayToSkiArea: Map<number, SkiArea>
}> {
  const query = buildSkiAreasQuery()
  const response = await executeQuery(query)
  
  const skiAreas: SkiArea[] = []
  const wayToSkiArea = new Map<number, SkiArea>()
  
  for (const el of response.elements) {
    if (el.type === 'relation' && el.tags?.name) {
      const skiArea: SkiArea = {
        id: `skiarea-${el.id}`,
        name: el.tags.name,
        url: el.tags.url,
      }
      skiAreas.push(skiArea)
      
      // Map each way member to this ski area
      for (const member of el.members) {
        if (member.type === 'way') {
          wayToSkiArea.set(member.ref, skiArea)
        }
      }
    }
  }
  
  return { skiAreas, wayToSkiArea }
}

/**
 * Raw piste data before merging (includes OSM way ID)
 */
export interface RawPiste extends Piste {
  osmWayId: number
}

/**
 * Fetch and parse ski pistes from OSM with ski area assignment
 * Returns raw pistes (before segment merging)
 */
export async function fetchPistesWithSkiAreas(): Promise<RawPiste[]> {
  // Fetch ski area memberships and pistes in parallel
  const [{ wayToSkiArea }, pistesResponse] = await Promise.all([
    fetchSkiAreaMemberships(),
    executeQuery(buildPistesQuery()),
  ])
  
  // Build node lookup for coordinates
  const nodes = new Map<number, OSMNode>()
  pistesResponse.elements.forEach((el) => {
    if (el.type === 'node') {
      nodes.set(el.id, el)
    }
  })

  // Parse ways into pistes with ski area assignment
  const pistes: RawPiste[] = []
  
  pistesResponse.elements.forEach((el) => {
    if (el.type === 'way' && el.tags) {
      const coordinates: [number, number][] = []
      
      el.nodes.forEach((nodeId) => {
        const node = nodes.get(nodeId)
        if (node) {
          coordinates.push([node.lon, node.lat])
        }
      })

      if (coordinates.length > 0) {
        const firstCoord = coordinates[0]
        const lastCoord = coordinates[coordinates.length - 1]
        
        // Look up ski area for this way
        const skiArea = wayToSkiArea.get(el.id)
        
        pistes.push({
          id: `piste-${el.id}`,
          osmWayId: el.id,
          name: el.tags.name || el.tags.ref || `Piste ${el.tags['piste:ref'] || el.id}`,
          difficulty: parseDifficulty(el.tags['piste:difficulty']),
          ref: el.tags.ref || el.tags['piste:ref'],
          coordinates,
          startPoint: firstCoord ? [firstCoord[1], firstCoord[0], 0] : undefined,
          endPoint: lastCoord ? [lastCoord[1], lastCoord[0], 0] : undefined,
          skiArea,
        })
      }
    }
  })

  return pistes
}
