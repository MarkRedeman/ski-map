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

/**
 * Ski area with polygon boundary for spatial containment tests
 */
export interface SkiAreaPolygon extends SkiArea {
  polygon: [number, number][] // Boundary coordinates [lon, lat][]
  centroid: [number, number]  // Center point [lon, lat]
}

export interface Piste {
  id: string
  name: string
  difficulty: Difficulty
  ref?: string // Piste number/reference
  coordinates: [number, number][][] // Array of line segments, each segment is [lon, lat][] pairs
  startPoint?: [number, number, number] // [lat, lon, elevation]
  endPoint?: [number, number, number]
  length?: number // meters (total of all segments)
  skiArea?: SkiArea // Which ski resort this piste belongs to
  osmWayIds?: number[] // Original OSM way IDs (for merged pistes)
}

/**
 * Raw piste data before merging (single segment with OSM way ID)
 * This is different from Piste which has multi-segment coordinates
 */
export interface RawPiste {
  id: string
  osmWayId: number
  name: string
  difficulty: Difficulty
  ref?: string
  coordinates: [number, number][] // Single segment: [lon, lat][] pairs
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  skiArea?: SkiArea
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
  skiArea?: SkiArea // Which ski resort this lift belongs to
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
 * @deprecated Use fetchAllSkiData() + mergePisteSegments() instead
 */
export async function fetchPistes(): Promise<RawPiste[]> {
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
  const pistes: RawPiste[] = []
  
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
          osmWayId: el.id,
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

// =============================================================================
// Combined Query - Fetches all ski data in a single Overpass request
// =============================================================================

/**
 * Build a combined Overpass QL query for ALL ski data:
 * - Pistes (downhill ways and relations)
 * - Lifts (aerialway ways)
 * - Ski area polygons (landuse=winter_sports)
 * - Ski area relations (site=piste) - for backwards compatibility
 * - Mountain peaks
 * - Villages/towns/hamlets
 */
function buildCombinedQuery(): string {
  const { south, west, north, east } = SOLDEN_BBOX
  return `
[out:json][timeout:90];
(
  // Pistes
  way["piste:type"="downhill"](${south},${west},${north},${east});
  relation["piste:type"="downhill"](${south},${west},${north},${east});
  // Lifts
  way["aerialway"](${south},${west},${north},${east});
  // Ski area polygons (landuse=winter_sports)
  way["landuse"="winter_sports"](${south},${west},${north},${east});
  relation["landuse"="winter_sports"](${south},${west},${north},${east});
  // Ski area relations (for backwards compatibility with site=piste)
  relation["site"="piste"](${south},${west},${north},${east});
  // Peaks
  node["natural"="peak"](${south},${west},${north},${east});
  // Villages/towns/hamlets
  node["place"~"village|town|hamlet"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
`.trim()
}

/**
 * Combined ski data response
 */
export interface SkiData {
  pistes: RawPiste[]
  lifts: Lift[]
  skiAreas: SkiArea[]
  skiAreaPolygons: SkiAreaPolygon[] // Ski areas with polygon boundaries
  peaks: Peak[]
  places: Place[]
}

/**
 * Fetch ALL ski-related data in a single Overpass API request
 * 
 * This reduces API calls from 5 to 1, avoiding rate limiting issues.
 * Returns raw pistes (before segment merging) - use mergePisteSegments() afterward.
 */
export async function fetchAllSkiData(): Promise<SkiData> {
  const query = buildCombinedQuery()
  const response = await executeQuery(query)
  
  // Build node lookup for coordinates
  const nodes = new Map<number, OSMNode>()
  response.elements.forEach((el) => {
    if (el.type === 'node') {
      nodes.set(el.id, el)
    }
  })
  
  // First pass: extract ski area relations (site=piste) and build wayId -> SkiArea mapping
  // This is for backwards compatibility - spatial containment will override this
  const skiAreas: SkiArea[] = []
  const wayToSkiArea = new Map<number, SkiArea>()
  
  response.elements.forEach((el) => {
    if (el.type === 'relation' && el.tags?.site === 'piste' && el.tags?.name) {
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
  })
  
  // Parse ski area polygons (landuse=winter_sports ways and relations)
  const skiAreaPolygons: SkiAreaPolygon[] = []
  
  response.elements.forEach((el) => {
    if (el.tags?.landuse === 'winter_sports' && el.tags?.name) {
      if (el.type === 'way') {
        // Parse way as polygon
        const polygon: [number, number][] = []
        
        el.nodes.forEach((nodeId) => {
          const node = nodes.get(nodeId)
          if (node) {
            polygon.push([node.lon, node.lat])
          }
        })
        
        if (polygon.length >= 3) {
          // Calculate centroid
          let cx = 0, cy = 0
          for (const [lon, lat] of polygon) {
            cx += lon
            cy += lat
          }
          cx /= polygon.length
          cy /= polygon.length
          
          skiAreaPolygons.push({
            id: `skiarea-poly-${el.id}`,
            name: el.tags.name,
            url: el.tags.url,
            polygon,
            centroid: [cx, cy],
          })
        }
      } else if (el.type === 'relation') {
        // Parse relation - combine outer ways into a single polygon
        // For simplicity, we'll use the first outer way or combine them
        const outerWayIds: number[] = []
        
        for (const member of el.members) {
          if (member.type === 'way' && (member.role === 'outer' || member.role === '')) {
            outerWayIds.push(member.ref)
          }
        }
        
        // Find the way elements and build polygon
        // Note: Ways in relations need to be resolved from the response
        const polygon: [number, number][] = []
        
        // For relations, we need to find the way elements first
        // They should be in the response due to our > recursion
        const wayElements = response.elements.filter(
          (way): way is OSMWay => 
            way.type === 'way' && outerWayIds.includes(way.id)
        )
        
        // Combine all outer ways into a single polygon
        for (const way of wayElements) {
          for (const nodeId of way.nodes) {
            const node = nodes.get(nodeId)
            if (node) {
              polygon.push([node.lon, node.lat])
            }
          }
        }
        
        if (polygon.length >= 3) {
          // Calculate centroid
          let cx = 0, cy = 0
          for (const [lon, lat] of polygon) {
            cx += lon
            cy += lat
          }
          cx /= polygon.length
          cy /= polygon.length
          
          skiAreaPolygons.push({
            id: `skiarea-poly-${el.id}`,
            name: el.tags.name,
            url: el.tags.url,
            polygon,
            centroid: [cx, cy],
          })
        }
      }
    }
  })
  
  // Second pass: parse pistes, lifts, peaks, and places
  const pistes: RawPiste[] = []
  const lifts: Lift[] = []
  const peaks: Peak[] = []
  const places: Place[] = []
  
  response.elements.forEach((el) => {
    if (el.type === 'way' && el.tags) {
      // Check if it's a piste
      if (el.tags['piste:type'] === 'downhill') {
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
          // Keep site=piste assignment for now, spatial containment will override later
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
      // Check if it's a lift
      else if (el.tags.aerialway) {
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
    }
    // Parse peaks
    else if (el.type === 'node' && el.tags?.natural === 'peak' && el.tags.name) {
      peaks.push({
        id: `peak-${el.id}`,
        name: el.tags.name,
        lat: el.lat,
        lon: el.lon,
        elevation: parseFloat(el.tags.ele ?? '0'),
      })
    }
    // Parse places (villages, towns, hamlets)
    else if (el.type === 'node' && el.tags?.place && el.tags.name) {
      const placeType = el.tags.place
      if (placeType === 'town' || placeType === 'village' || placeType === 'hamlet') {
        places.push({
          id: `place-${el.id}`,
          name: el.tags.name,
          type: placeType,
          lat: el.lat,
          lon: el.lon,
        })
      }
    }
  })
  
  console.log(`[Overpass] Combined query fetched: ${pistes.length} pistes, ${lifts.length} lifts, ${skiAreaPolygons.length} ski area polygons, ${peaks.length} peaks, ${places.length} places`)
  
  return { pistes, lifts, skiAreas, skiAreaPolygons, peaks, places }
}
