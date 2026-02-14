/**
 * OpenStreetMap Overpass API client for fetching ski infrastructure data
 * 
 * Fetches pistes, lifts, and POIs for the Sölden ski area
 */

import { SOLDEN_BBOX } from '@/config/region'

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
 * Parse pistes from Overpass response
 */
function parsePistes(elements: OSMElement[]): Piste[] {
  const nodes = new Map<number, OSMNode>()
  const ways: OSMWay[] = []
  const relations: OSMRelation[] = []

  for (const element of elements) {
    if (element.type === 'node') {
      nodes.set(element.id, element)
    } else if (element.type === 'way') {
      ways.push(element)
    } else if (element.type === 'relation') {
      relations.push(element)
    }
  }

  const pistes: Piste[] = []

  // Parse ways (individual piste segments)
  for (const way of ways) {
    if (!way.tags) continue

    const coordinates: [number, number, number][] = []
    for (const nodeId of way.nodes) {
      const node = nodes.get(nodeId)
      if (node) {
        coordinates.push([node.lat, node.lon, 0])
      }
    }

    if (coordinates.length < 2) continue

    const difficulty = way.tags['piste:difficulty'] || 'unknown'
    const name = way.tags.name || `Piste ${way.id}`

    pistes.push({
      id: `piste-${way.id}`,
      name,
      difficulty: normalizeDifficulty(difficulty),
      coordinates,
      length: calculateLength(coordinates),
      oneway: way.tags['piste:oneway'] === 'yes',
      ref: way.tags.ref,
      skiArea: undefined, // Will be assigned later
    })
  }

  // Parse relations (piste routes - collections of ways)
  for (const relation of relations) {
    if (!relation.tags) continue

    const difficulty = relation.tags['piste:difficulty'] || 'unknown'
    const name = relation.tags.name || `Route ${relation.id}`

    // Collect all coordinates from member ways
    const coordinates: [number, number, number][] = []
    for (const member of relation.members) {
      if (member.type === 'way') {
        const way = ways.find((w) => w.id === member.ref)
        if (way) {
          for (const nodeId of way.nodes) {
            const node = nodes.get(nodeId)
            if (node) {
              coordinates.push([node.lat, node.lon, 0])
            }
          }
        }
      }
    }

    if (coordinates.length < 2) continue

    pistes.push({
      id: `piste-relation-${relation.id}`,
      name,
      difficulty: normalizeDifficulty(difficulty),
      coordinates,
      length: calculateLength(coordinates),
      oneway: relation.tags['piste:oneway'] === 'yes',
      ref: relation.tags.ref,
      skiArea: undefined,
    })
  }

  return pistes
}

/**
 * Normalize difficulty string to our enum
 */
function normalizeDifficulty(difficulty: string): Difficulty {
  switch (difficulty) {
    case 'easy':
    case 'novice':
      return 'blue'
    case 'intermediate':
      return 'red'
    case 'advanced':
    case 'expert':
      return 'black'
    default:
      return 'blue' // Default to easiest
  }
}

/**
 * Calculate approximate length of a coordinate path in meters
 */
function calculateLength(coordinates: [number, number, number][]): number {
  let length = 0
  for (let i = 1; i < coordinates.length; i++) {
    const [lat1, lon1] = coordinates[i - 1]!
    const [lat2, lon2] = coordinates[i]!
    length += distanceMeters(lat1, lon1, lat2, lon2)
  }
  return length
}

/**
 * Calculate distance between two lat/lon points (Haversine formula)
 */
function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Parse lifts from Overpass response
 */
function parseLifts(elements: OSMElement[]): Lift[] {
  const nodes = new Map<number, OSMNode>()
  const ways: OSMWay[] = []

  for (const element of elements) {
    if (element.type === 'node') {
      nodes.set(element.id, element)
    } else if (element.type === 'way') {
      ways.push(element)
    }
  }

  const lifts: Lift[] = []

  for (const way of ways) {
    if (!way.tags) continue

    const coordinates: [number, number, number][] = []
    for (const nodeId of way.nodes) {
      const node = nodes.get(nodeId)
      if (node) {
        coordinates.push([node.lat, node.lon, 0])
      }
    }

    if (coordinates.length < 2) continue

    const liftType = way.tags.aerialway || 'lift'
    const name = way.tags.name || `Lift ${way.id}`

    lifts.push({
      id: `lift-${way.id}`,
      name,
      type: normalizeLiftType(liftType),
      coordinates,
      length: calculateLength(coordinates),
      skiArea: undefined, // Will be assigned later
    })
  }

  return lifts
}

/**
 * Normalize lift type string
 */
function normalizeLiftType(type: string): LiftType {
  const normalized = type.toLowerCase().replace(/_/g, ' ')

  if (normalized.includes('gondola')) return 'Gondola'
  if (normalized.includes('cable car')) return 'Cable Car'
  if (normalized.includes('chair')) return 'Chair Lift'
  if (normalized.includes('t-bar') || normalized.includes('tbar')) return 'T-Bar'
  if (normalized.includes('button') || normalized.includes('platter'))
    return 'Button Lift'
  if (normalized.includes('drag') || normalized.includes('rope')) return 'Drag Lift'
  if (normalized.includes('magic carpet')) return 'Magic Carpet'

  return 'Lift'
}

/**
 * Parse peaks from Overpass response
 */
function parsePeaks(elements: OSMElement[]): Peak[] {
  const peaks: Peak[] = []

  for (const element of elements) {
    if (element.type !== 'node') continue
    if (!element.tags) continue

    const name = element.tags.name
    if (!name) continue

    const elevation = element.tags.ele
      ? parseFloat(element.tags.ele)
      : undefined

    peaks.push({
      id: `peak-${element.id}`,
      name,
      lat: element.lat,
      lon: element.lon,
      elevation,
    })
  }

  return peaks
}

/**
 * Parse places (villages, restaurants, etc) from Overpass response
 */
function parsePlaces(elements: OSMElement[]): Place[] {
  const places: Place[] = []

  for (const element of elements) {
    if (element.type !== 'node') continue
    if (!element.tags) continue

    const name = element.tags.name
    if (!name) continue

    places.push({
      id: `place-${element.id}`,
      name,
      lat: element.lat,
      lon: element.lon,
      type: element.tags.place || 'locality',
    })
  }

  return places
}

/** Piste difficulty levels */
export type Difficulty = 'blue' | 'red' | 'black'

/** Piste (ski run) data */
export interface Piste {
  id: string
  name: string
  difficulty: Difficulty
  coordinates: [number, number, number][]
  length: number
  oneway: boolean
  ref?: string
  skiArea?: string
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
  | 'Lift'

/** Ski lift data */
export interface Lift {
  id: string
  name: string
  type: LiftType
  coordinates: [number, number, number][]
  length: number
  skiArea?: string
}

/** Peak/mountain data */
export interface Peak {
  id: string
  name: string
  lat: number
  lon: number
  elevation?: number
}

/** Place/POI data */
export interface Place {
  id: string
  name: string
  lat: number
  lon: number
  type: string
}

/** Ski area relation */
export interface SkiArea {
  id: string
  name: string
  members: { type: string; ref: number; role: string }[]
}

/** Polygon data for ski areas */
export interface SkiAreaPolygon {
  id: string
  name: string
  polygon: [number, number][][] // GeoJSON-style polygon
}

/** Complete ski data response */
export interface SkiData {
  pistes: Piste[]
  lifts: Lift[]
  peaks: Peak[]
  places: Place[]
  skiAreaPolygons: SkiAreaPolygon[]
}

/**
 * Build a single combined Overpass query for all ski data
 * More efficient than making separate requests
 */
function buildCombinedQuery(): string {
  const { south, west, north, east } = SOLDEN_BBOX
  return `
[out:json][timeout:120];
(
  // Ski pistes (downhill only)
  way["piste:type"="downhill"](${south},${west},${north},${east});
  relation["piste:type"="downhill"](${south},${west},${north},${east});
  
  // Ski lifts
  way["aerialway"](${south},${west},${north},${east});
  
  // Ski areas (for boundaries)
  relation["site"="piste"](${south},${west},${north},${east});
  
  // Peaks and places
  node["natural"="peak"](${south},${west},${north},${east});
  node["place"~"^(village|hamlet|locality|isolated_dwelling)$"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
`.trim()
}

/**
 * Parse ski area polygons from Overpass response
 * Returns simplified polygons for each ski area
 */
function parseSkiAreaPolygons(
  elements: OSMElement[],
  nodes: Map<number, OSMNode>
): SkiAreaPolygon[] {
  const polygons: SkiAreaPolygon[] = []

  for (const element of elements) {
    if (element.type !== 'relation') continue
    if (!element.tags) continue

    const name = element.tags.name
    if (!name) continue

    // Collect all outer ways to form polygon
    const outerRings: [number, number][][] = []

    for (const member of element.members) {
      if (member.type === 'way' && member.role === 'outer') {
        const way = elements.find(
          (e): e is OSMWay => e.type === 'way' && e.id === member.ref
        )
        if (way) {
          const ring: [number, number][] = []
          for (const nodeId of way.nodes) {
            const node = nodes.get(nodeId)
            if (node) {
              ring.push([node.lon, node.lat])
            }
          }
          if (ring.length > 2) {
            outerRings.push(ring)
          }
        }
      }
    }

    if (outerRings.length > 0) {
      polygons.push({
        id: `skiarea-${element.id}`,
        name,
        polygon: outerRings,
      })
    }
  }

  return polygons
}

/**
 * Fetch all ski data in a single request
 */
export async function fetchAllSkiData(): Promise<SkiData> {
  console.log('[Overpass] Fetching all ski data...')

  const query = buildCombinedQuery()
  const response = await executeQuery(query)

  // Build node lookup
  const nodes = new Map<number, OSMNode>()
  for (const element of response.elements) {
    if (element.type === 'node') {
      nodes.set(element.id, element)
    }
  }

  // Parse all data types
  const pistes = parsePistes(response.elements)
  const lifts = parseLifts(response.elements)
  const peaks = parsePeaks(response.elements)
  const places = parsePlaces(response.elements)
  const skiAreaPolygons = parseSkiAreaPolygons(response.elements, nodes)

  console.log(
    `[Overpass] Loaded: ${pistes.length} pistes, ${lifts.length} lifts, ${peaks.length} peaks, ${places.length} places, ${skiAreaPolygons.length} ski areas`
  )

  return {
    pistes,
    lifts,
    peaks,
    places,
    skiAreaPolygons,
  }
}
