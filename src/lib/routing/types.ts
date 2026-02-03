/**
 * Navigation graph types for ski routing
 */

import type { Difficulty } from '@/stores/useNavigationStore'

/**
 * Node types in the ski navigation graph
 */
export type SkiNodeType = 'piste_start' | 'piste_end' | 'lift_station' | 'intersection'

/**
 * A node in the ski navigation graph
 * Represents a point where routes can start, end, or connect
 */
export interface SkiNode {
  id: string
  name: string
  type: SkiNodeType
  /** [lat, lon, elevation] */
  coordinates: [number, number, number]
}

/**
 * Edge types in the ski navigation graph
 */
export type SkiEdgeType = 'piste' | 'lift'

/**
 * An edge in the ski navigation graph
 * Represents a connection between two nodes (piste or lift)
 */
export interface SkiEdge {
  id: string
  from: string
  to: string
  type: SkiEdgeType
  /** Only set for piste edges */
  difficulty?: Difficulty
  /** Distance in meters */
  distance: number
  /** Elevation change in meters (negative for downhill) */
  elevationChange: number
  /** Weighted cost for pathfinding */
  weight: number
  /** Name of the piste or lift */
  name: string
  /** Original coordinates for rendering [lon, lat][] */
  coordinates: [number, number][]
}

/**
 * The complete ski navigation graph
 */
export interface SkiGraph {
  /** All nodes indexed by id */
  nodes: Map<string, SkiNode>
  /** All edges in the graph */
  edges: SkiEdge[]
  /** Adjacency list: nodeId -> outgoing edges */
  adjacencyList: Map<string, SkiEdge[]>
}

/**
 * Result of pathfinding algorithm
 */
export interface PathResult {
  /** Ordered list of node IDs in the path */
  nodeIds: string[]
  /** Ordered list of edges traversed */
  edges: SkiEdge[]
  /** Total weighted cost */
  totalWeight: number
}
