/**
 * Dijkstra's algorithm for ski route pathfinding
 */

import type { Difficulty } from '@/lib/api/overpass'
import type { Route, RouteStep, Location } from '@/stores/useNavigationStore'
import type { SkiGraph, SkiEdge, PathResult } from './types'
import { getOutgoingEdges, findNode } from './graph'

/**
 * Priority queue implementation for Dijkstra's algorithm
 */
class PriorityQueue<T> {
  private items: { item: T; priority: number }[] = []
  
  enqueue(item: T, priority: number): void {
    const entry = { item, priority }
    let added = false
    
    for (let i = 0; i < this.items.length; i++) {
      const current = this.items[i]
      if (current && priority < current.priority) {
        this.items.splice(i, 0, entry)
        added = true
        break
      }
    }
    
    if (!added) {
      this.items.push(entry)
    }
  }
  
  dequeue(): T | undefined {
    return this.items.shift()?.item
  }
  
  isEmpty(): boolean {
    return this.items.length === 0
  }
}

/**
 * Check if an edge is passable given enabled difficulties
 */
function isEdgePassable(edge: SkiEdge, enabledDifficulties: Set<Difficulty>): boolean {
  // Lifts are always passable
  if (edge.type === 'lift') return true
  
  // Connections (walking) are always passable
  if (edge.name === 'Connection') return true
  
  // Check if piste difficulty is enabled
  if (edge.difficulty) {
    return enabledDifficulties.has(edge.difficulty)
  }
  
  return true
}

/**
 * Find the shortest path using Dijkstra's algorithm
 */
export function findPath(
  graph: SkiGraph,
  fromId: string,
  toId: string,
  enabledDifficulties: Set<Difficulty>
): PathResult | null {
  const startNode = findNode(graph, fromId)
  const endNode = findNode(graph, toId)
  
  if (!startNode || !endNode) {
    return null
  }
  
  // Distance from start to each node
  const distances = new Map<string, number>()
  // Previous node in optimal path
  const previous = new Map<string, string>()
  // Edge used to reach each node
  const previousEdge = new Map<string, SkiEdge>()
  // Visited nodes
  const visited = new Set<string>()
  
  // Initialize distances
  for (const nodeId of graph.nodes.keys()) {
    distances.set(nodeId, Infinity)
  }
  distances.set(fromId, 0)
  
  // Priority queue
  const queue = new PriorityQueue<string>()
  queue.enqueue(fromId, 0)
  
  while (!queue.isEmpty()) {
    const currentId = queue.dequeue()
    if (!currentId) break
    
    // Skip if already visited
    if (visited.has(currentId)) continue
    visited.add(currentId)
    
    // Found destination
    if (currentId === toId) break
    
    const currentDistance = distances.get(currentId) ?? Infinity
    
    // Explore neighbors
    const edges = getOutgoingEdges(graph, currentId)
    
    for (const edge of edges) {
      // Skip if edge is not passable (difficulty filter)
      if (!isEdgePassable(edge, enabledDifficulties)) continue
      
      const neighborId = edge.to
      
      // Skip if already visited
      if (visited.has(neighborId)) continue
      
      const newDistance = currentDistance + edge.weight
      const currentNeighborDistance = distances.get(neighborId) ?? Infinity
      
      if (newDistance < currentNeighborDistance) {
        distances.set(neighborId, newDistance)
        previous.set(neighborId, currentId)
        previousEdge.set(neighborId, edge)
        queue.enqueue(neighborId, newDistance)
      }
    }
  }
  
  // Check if destination was reached
  const finalDistance = distances.get(toId)
  if (finalDistance === undefined || finalDistance === Infinity) {
    return null
  }
  
  // Reconstruct path
  const nodeIds: string[] = []
  const edges: SkiEdge[] = []
  
  let currentId: string | undefined = toId
  while (currentId) {
    nodeIds.unshift(currentId)
    
    const edge = previousEdge.get(currentId)
    if (edge) {
      edges.unshift(edge)
    }
    
    currentId = previous.get(currentId)
  }
  
  return {
    nodeIds,
    edges,
    totalWeight: finalDistance,
  }
}

/**
 * Convert a path result to a full Route object
 */
export function pathToRoute(
  graph: SkiGraph,
  path: PathResult,
  fromLocation: Location,
  toLocation: Location
): Route {
  const steps: RouteStep[] = []
  let totalDistance = 0
  let totalElevationDown = 0
  let totalElevationUp = 0
  let maxDifficulty: Difficulty = 'blue'
  
  const difficultyRank: Record<Difficulty, number> = { blue: 0, red: 1, black: 2 }
  
  for (const edge of path.edges) {
    const fromNode = findNode(graph, edge.from)
    const toNode = findNode(graph, edge.to)
    
    if (!fromNode || !toNode) continue
    
    // Skip connection edges in the step list (they're just transitions)
    if (edge.name === 'Connection') continue
    
    const stepFrom: Location = {
      id: fromNode.id,
      name: fromNode.name,
      type: fromNode.type,
      coordinates: fromNode.coordinates,
    }
    
    const stepTo: Location = {
      id: toNode.id,
      name: toNode.name,
      type: toNode.type,
      coordinates: toNode.coordinates,
    }
    
    const step: RouteStep = {
      type: edge.type,
      name: edge.name,
      difficulty: edge.difficulty,
      from: stepFrom,
      to: stepTo,
      distance: edge.distance,
      elevationChange: edge.elevationChange,
    }
    
    steps.push(step)
    totalDistance += edge.distance
    
    if (edge.elevationChange < 0) {
      totalElevationDown += Math.abs(edge.elevationChange)
    } else {
      totalElevationUp += edge.elevationChange
    }
    
    // Track max difficulty
    if (edge.difficulty && difficultyRank[edge.difficulty] > difficultyRank[maxDifficulty]) {
      maxDifficulty = edge.difficulty
    }
  }
  
  // Estimate time: 10 km/h skiing, 5 min per lift
  const skiingTimeMinutes = (totalDistance / 1000) * 6 // 10 km/h = 6 min/km
  const liftCount = steps.filter(s => s.type === 'lift').length
  const liftTimeMinutes = liftCount * 5
  const estimatedTime = Math.ceil(skiingTimeMinutes + liftTimeMinutes)
  
  return {
    id: `route-${Date.now()}`,
    from: fromLocation,
    to: toLocation,
    steps,
    totalDistance,
    totalElevationDown,
    totalElevationUp,
    estimatedTime: Math.max(estimatedTime, 1), // At least 1 minute
    maxDifficulty,
  }
}

/**
 * Main function to find a route between two locations
 */
export function findRoute(
  graph: SkiGraph,
  fromLocation: Location,
  toLocation: Location,
  enabledDifficulties: Set<Difficulty>
): Route | null {
  // Find closest nodes to the locations
  const fromNodeId = fromLocation.id
  const toNodeId = toLocation.id
  
  // Run pathfinding
  const path = findPath(graph, fromNodeId, toNodeId, enabledDifficulties)
  
  if (!path) {
    return null
  }
  
  // Convert to Route
  return pathToRoute(graph, path, fromLocation, toLocation)
}
