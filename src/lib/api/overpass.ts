/**
 * OpenStreetMap Overpass API client for fetching ski infrastructure data
 * 
 * Fetches pistes, lifts, and POIs for the Sölden ski area
 */

// Sölden ski area bounding box
const SOLDEN_BBOX = {
  south: 46.87,
  west: 10.95,
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
      return 'red' // Default to intermediate if unknown
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

export interface Piste {
  id: string
  name: string
  difficulty: 'blue' | 'red' | 'black'
  ref?: string // Piste number/reference
  coordinates: [number, number][] // [lon, lat] pairs
  startPoint?: [number, number, number] // [lat, lon, elevation]
  endPoint?: [number, number, number]
  length?: number // meters
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
