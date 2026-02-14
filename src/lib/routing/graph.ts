/**
 * Build navigation graph from pistes and lifts data
 */

import type { Piste, Lift } from '@/lib/api/overpass'
import type { Difficulty } from '@/lib/api/overpass'
import type { SkiGraph, SkiNode, SkiEdge, SkiNodeType } from './types'
import { distanceMeters } from '@/lib/geo/coordinates'

/** Maximum distance (meters) between points to consider them connected */
const CONNECTION_THRESHOLD = 50

/** Difficulty multipliers for edge weights */
const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  blue: 1,
  red: 2,
  black: 5,
}

/** Fixed weight for lift edges (equivalent to ~5 minute ride) */
const LIFT_WEIGHT = 300

/**
 * Generate a unique node ID
 */
function generateNodeId(type: SkiNodeType, sourceId: string, index?: number): string {
  return index !== undefined 
    ? `${type}-${sourceId}-${index}` 
    : `${type}-${sourceId}`
}

/**
 * Calculate edge weight for a piste
 * Weight is based on distance and difficulty
 */
function calculatePisteWeight(distance: number, difficulty: Difficulty): number {
  return distance * DIFFICULTY_MULTIPLIER[difficulty]
}

/**
 * Find nodes within threshold distance of a given node
 */
function findNearbyNodes(
  targetNode: SkiNode,
  allNodes: Map<string, SkiNode>,
  threshold: number
): SkiNode[] {
  const nearby: SkiNode[] = []
  
  for (const [nodeId, node] of allNodes) {
    if (nodeId === targetNode.id) continue
    
    const distance = distanceMeters(
      targetNode.coordinates[0],
      targetNode.coordinates[1],
      node.coordinates[0],
      node.coordinates[1]
    )
    
    if (distance <= threshold) {
      nearby.push(node)
    }
  }
  
  return nearby
}

/**
 * Build the navigation graph from pistes and lifts
 */
export function buildGraph(pistes: Piste[], lifts: Lift[]): SkiGraph {
  const nodes = new Map<string, SkiNode>()
  const edges: SkiEdge[] = []
  const adjacencyList = new Map<string, SkiEdge[]>()
  
  // Helper to add an edge to the adjacency list
  function addEdge(edge: SkiEdge) {
    edges.push(edge)
    const existing = adjacencyList.get(edge.from) ?? []
    existing.push(edge)
    adjacencyList.set(edge.from, existing)
  }
  
  // Create nodes and edges for pistes
  for (const piste of pistes) {
    if (!piste.startPoint || !piste.endPoint) continue
    if (piste.coordinates.length === 0) continue
    
    // Create start node (top of piste)
    const startNodeId = generateNodeId('piste_start', piste.id)
    const startNode: SkiNode = {
      id: startNodeId,
      name: `${piste.name} (Top)`,
      type: 'piste_start',
      coordinates: piste.startPoint,
    }
    nodes.set(startNodeId, startNode)
    
    // Create end node (bottom of piste)
    const endNodeId = generateNodeId('piste_end', piste.id)
    const endNode: SkiNode = {
      id: endNodeId,
      name: `${piste.name} (Bottom)`,
      type: 'piste_end',
      coordinates: piste.endPoint,
    }
    nodes.set(endNodeId, endNode)
    
    // Calculate distance along all segments of the piste
    let totalDistance = 0
    for (const segment of piste.coordinates) {
      for (let i = 0; i < segment.length - 1; i++) {
        const coord1 = segment[i]
        const coord2 = segment[i + 1]
        if (coord1 && coord2) {
          totalDistance += distanceMeters(coord1[1], coord1[0], coord2[1], coord2[0])
        }
      }
    }
    
    // Flatten all segments for edge coordinates (for rendering route)
    const flattenedCoords: [number, number][] = piste.coordinates.flat()
    
    // Calculate elevation change
    const elevationChange = piste.endPoint[2] - piste.startPoint[2]
    
    // Create edge from start to end (downhill only)
    const pisteEdge: SkiEdge = {
      id: `edge-${piste.id}`,
      from: startNodeId,
      to: endNodeId,
      type: 'piste',
      difficulty: piste.difficulty,
      distance: totalDistance || piste.length || 500, // Use pre-calculated length or default
      elevationChange,
      weight: calculatePisteWeight(totalDistance || piste.length || 500, piste.difficulty),
      name: piste.name,
      coordinates: flattenedCoords,
    }
    addEdge(pisteEdge)
  }
  
  // Create nodes and edges for lifts
  for (const lift of lifts) {
    if (!lift.stations || lift.stations.length < 2) continue
    
    const stations = lift.stations
    
    // Create nodes for each station
    const stationNodeIds: string[] = []
    for (let i = 0; i < stations.length; i++) {
      const station = stations[i]
      if (!station) continue
      
      const nodeId = generateNodeId('lift_station', lift.id, i)
      const node: SkiNode = {
        id: nodeId,
        name: station.name || `${lift.name} ${i === 0 ? 'Bottom' : 'Top'}`,
        type: 'lift_station',
        coordinates: station.coordinates,
      }
      nodes.set(nodeId, node)
      stationNodeIds.push(nodeId)
    }
    
    // Create edge from bottom to top (uphill lift)
    if (stationNodeIds.length >= 2) {
      const bottomNodeId = stationNodeIds[0]
      const topNodeId = stationNodeIds[stationNodeIds.length - 1]
      
      if (bottomNodeId && topNodeId) {
        const bottomStation = stations[0]
        const topStation = stations[stations.length - 1]
        
        if (bottomStation && topStation) {
          const distance = distanceMeters(
            bottomStation.coordinates[0],
            bottomStation.coordinates[1],
            topStation.coordinates[0],
            topStation.coordinates[1]
          )
          
          const elevationChange = topStation.coordinates[2] - bottomStation.coordinates[2]
          
          const liftEdge: SkiEdge = {
            id: `edge-${lift.id}`,
            from: bottomNodeId,
            to: topNodeId,
            type: 'lift',
            distance,
            elevationChange,
            weight: LIFT_WEIGHT,
            name: lift.name,
            coordinates: lift.coordinates,
          }
          addEdge(liftEdge)
        }
      }
    }
  }
  
  // Connect nearby nodes (create intersection connections)
  // This allows transitioning between pistes and lifts
  const nodeArray = Array.from(nodes.values())
  const connectionEdges: SkiEdge[] = []
  
  for (const node of nodeArray) {
    const nearbyNodes = findNearbyNodes(node, nodes, CONNECTION_THRESHOLD)
    
    for (const nearbyNode of nearbyNodes) {
      // Skip if connection already exists
      const existingEdge = edges.find(
        e => (e.from === node.id && e.to === nearbyNode.id) ||
             (e.from === nearbyNode.id && e.to === node.id)
      )
      if (existingEdge) continue
      
      // Skip if same source (same piste/lift)
      const nodeSource = node.id.split('-').slice(1, -1).join('-')
      const nearbySource = nearbyNode.id.split('-').slice(1, -1).join('-')
      if (nodeSource === nearbySource) continue
      
      const distance = distanceMeters(
        node.coordinates[0],
        node.coordinates[1],
        nearbyNode.coordinates[0],
        nearbyNode.coordinates[1]
      )
      
      // Create bidirectional walking connection
      const connectionId = `connection-${node.id}-${nearbyNode.id}`
      
      // Check if we already added this connection in reverse
      const reverseExists = connectionEdges.some(
        e => e.from === nearbyNode.id && e.to === node.id
      )
      if (reverseExists) continue
      
      // Connection from this node to nearby node
      const connectionEdge: SkiEdge = {
        id: connectionId,
        from: node.id,
        to: nearbyNode.id,
        type: 'piste', // Walking connection
        distance,
        elevationChange: nearbyNode.coordinates[2] - node.coordinates[2],
        weight: distance * 2, // Walking is slower
        name: 'Connection',
        coordinates: [
          [node.coordinates[1], node.coordinates[0]],
          [nearbyNode.coordinates[1], nearbyNode.coordinates[0]],
        ],
      }
      connectionEdges.push(connectionEdge)
      
      // Reverse connection
      const reverseConnectionId = `connection-${nearbyNode.id}-${node.id}`
      const reverseConnectionEdge: SkiEdge = {
        id: reverseConnectionId,
        from: nearbyNode.id,
        to: node.id,
        type: 'piste',
        distance,
        elevationChange: node.coordinates[2] - nearbyNode.coordinates[2],
        weight: distance * 2,
        name: 'Connection',
        coordinates: [
          [nearbyNode.coordinates[1], nearbyNode.coordinates[0]],
          [node.coordinates[1], node.coordinates[0]],
        ],
      }
      connectionEdges.push(reverseConnectionEdge)
    }
  }
  
  // Add all connection edges
  for (const edge of connectionEdges) {
    addEdge(edge)
  }
  
  return { nodes, edges, adjacencyList }
}

/**
 * Find a node by ID in the graph
 */
export function findNode(graph: SkiGraph, nodeId: string): SkiNode | undefined {
  return graph.nodes.get(nodeId)
}

/**
 * Get all outgoing edges from a node
 */
export function getOutgoingEdges(graph: SkiGraph, nodeId: string): SkiEdge[] {
  return graph.adjacencyList.get(nodeId) ?? []
}

/**
 * Find the closest node to given coordinates
 */
export function findClosestNode(
  graph: SkiGraph,
  lat: number,
  lon: number
): SkiNode | undefined {
  let closestNode: SkiNode | undefined
  let minDistance = Infinity
  
  for (const node of graph.nodes.values()) {
    const distance = distanceMeters(lat, lon, node.coordinates[0], node.coordinates[1])
    if (distance < minDistance) {
      minDistance = distance
      closestNode = node
    }
  }
  
  return closestNode
}
