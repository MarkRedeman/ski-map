/**
 * URL Search Parameter Schema
 * 
 * Defines the Zod schema for shareable URL state including:
 * - Selection (piste, lift, peak, place)
 * - Filters (difficulties, lift types, layers)
 * - Resolution
 * - Camera position (for advanced sharing)
 */

import { z } from 'zod'
import type { LiftType } from '@/stores/useMapStore'
import type { Difficulty } from '@/stores/useNavigationStore'
import type { ResolutionLevel } from '@/stores/useSettingsStore'

// Selection types
export type SelectionType = 'piste' | 'lift' | 'peak' | 'place'

export interface Selection {
  type: SelectionType
  id: string
}

// Default values
export const DEFAULT_DIFFICULTIES: Difficulty[] = ['blue', 'red', 'black']
export const DEFAULT_LIFT_TYPES: LiftType[] = ['Gondola', 'Cable Car', 'Chair Lift', 'Lift']
export const DEFAULT_LAYERS = ['terrain', 'pistes', 'lifts', 'labels'] as const
export const DEFAULT_RESOLUTION: ResolutionLevel = '2x'

// Valid values for validation
const VALID_SELECTION_TYPES = ['piste', 'lift', 'peak', 'place'] as const
const VALID_DIFFICULTIES = ['blue', 'red', 'black'] as const
const VALID_LIFT_TYPES = ['Gondola', 'Chair Lift', 'Cable Car', 'T-Bar', 'Button Lift', 'Drag Lift', 'Magic Carpet', 'Lift'] as const
const VALID_LAYERS = ['terrain', 'pistes', 'lifts', 'labels'] as const
const VALID_RESOLUTIONS = ['1x', '2x', '4x', '8x', '16x'] as const

/**
 * Parse selection string from URL
 * Format: "piste:12345678" -> { type: 'piste', id: '12345678' }
 */
export function parseSelection(value: string | undefined): Selection | null {
  if (!value) return null
  
  const [type, id] = value.split(':')
  if (!type || !id) return null
  
  if (!VALID_SELECTION_TYPES.includes(type as typeof VALID_SELECTION_TYPES[number])) {
    return null
  }
  
  return { type: type as SelectionType, id }
}

/**
 * Serialize selection to URL string
 * { type: 'piste', id: '12345678' } -> "piste:12345678"
 */
export function serializeSelection(selection: Selection | null): string | undefined {
  if (!selection) return undefined
  return `${selection.type}:${selection.id}`
}

/**
 * Convert store selection IDs to Selection object
 * Store uses: "piste-12345678" format
 * URL uses: "piste:12345678" format
 */
export function storeIdToSelection(
  selectedPisteId: string | null,
  selectedLiftId: string | null,
  selectedPeakId: string | null,
  selectedPlaceId: string | null
): Selection | null {
  if (selectedPisteId) {
    return { type: 'piste', id: selectedPisteId.replace('piste-', '') }
  }
  if (selectedLiftId) {
    return { type: 'lift', id: selectedLiftId.replace('lift-', '') }
  }
  if (selectedPeakId) {
    return { type: 'peak', id: selectedPeakId.replace('peak-', '') }
  }
  if (selectedPlaceId) {
    return { type: 'place', id: selectedPlaceId.replace('place-', '') }
  }
  return null
}

/**
 * Convert URL Selection to store ID format
 * URL: { type: 'piste', id: '12345678' }
 * Store: "piste-12345678"
 */
export function selectionToStoreId(selection: Selection | null): {
  selectedPisteId: string | null
  selectedLiftId: string | null
  selectedPeakId: string | null
  selectedPlaceId: string | null
} {
  const result = {
    selectedPisteId: null as string | null,
    selectedLiftId: null as string | null,
    selectedPeakId: null as string | null,
    selectedPlaceId: null as string | null,
  }
  
  if (!selection) return result
  
  switch (selection.type) {
    case 'piste':
      result.selectedPisteId = `piste-${selection.id}`
      break
    case 'lift':
      result.selectedLiftId = `lift-${selection.id}`
      break
    case 'peak':
      result.selectedPeakId = `peak-${selection.id}`
      break
    case 'place':
      result.selectedPlaceId = `place-${selection.id}`
      break
  }
  
  return result
}

/**
 * Parse comma-separated list from URL
 */
export function parseList<T extends string>(value: string | undefined, validValues: readonly T[]): T[] | undefined {
  if (!value) return undefined
  
  const items = value.split(',').filter(item => 
    validValues.includes(item as T)
  ) as T[]
  
  return items.length > 0 ? items : undefined
}

/**
 * Serialize list to comma-separated string
 * Returns undefined if list equals default (to keep URL clean)
 */
export function serializeList<T extends string>(
  list: T[], 
  defaultList: readonly T[],
  allValues: readonly T[]
): string | undefined {
  // If all values selected or equals default, don't include in URL
  const sortedList = [...list].sort()
  const sortedDefault = [...defaultList].sort()
  const sortedAll = [...allValues].sort()
  
  if (JSON.stringify(sortedList) === JSON.stringify(sortedDefault)) {
    return undefined
  }
  
  if (JSON.stringify(sortedList) === JSON.stringify(sortedAll)) {
    return undefined
  }
  
  return list.join(',')
}

/**
 * Parse camera position from URL
 * Format: "x,y,z,tx,ty,tz" (position and target)
 */
export function parseCamera(value: string | undefined): {
  position: [number, number, number]
  target: [number, number, number]
} | undefined {
  if (!value) return undefined
  
  const parts = value.split(',').map(Number)
  if (parts.length !== 6 || parts.some(isNaN)) return undefined
  
  return {
    position: [parts[0]!, parts[1]!, parts[2]!],
    target: [parts[3]!, parts[4]!, parts[5]!],
  }
}

/**
 * Serialize camera to URL string
 */
export function serializeCamera(
  position: [number, number, number],
  target: [number, number, number]
): string {
  // Round to 1 decimal place to keep URL manageable
  const round = (n: number) => Math.round(n * 10) / 10
  return [
    ...position.map(round),
    ...target.map(round)
  ].join(',')
}

/**
 * Zod schema for URL search parameters
 * 
 * All fields are optional - missing means "use default"
 * This enables clean, minimal URLs for simple shares
 */
export const searchSchema = z.object({
  // Selection: "piste:12345678" or "lift:23456789"
  select: z.string().optional(),
  
  // Difficulty filter: "blue,red" or "black"
  diff: z.string().optional(),
  
  // Lift type filter: "Gondola,Chair Lift"
  lifts: z.string().optional(),
  
  // Layer visibility: "pistes,lifts" (terrain always shown)
  show: z.string().optional(),
  
  // Resolution: "1x", "2x", "4x", "8x", "16x"
  resolution: z.enum(VALID_RESOLUTIONS).optional(),
  
  // Camera: "x,y,z,tx,ty,tz"
  cam: z.string().optional(),
})

export type SearchParams = z.infer<typeof searchSchema>

/**
 * Parse all search params into typed objects
 */
export function parseSearchParams(params: SearchParams): {
  selection: Selection | null
  difficulties: Difficulty[] | undefined
  liftTypes: LiftType[] | undefined
  layers: typeof VALID_LAYERS[number][] | undefined
  resolution: ResolutionLevel | undefined
  camera: { position: [number, number, number]; target: [number, number, number] } | undefined
} {
  return {
    selection: parseSelection(params.select),
    difficulties: parseList(params.diff, VALID_DIFFICULTIES),
    liftTypes: parseList(params.lifts, VALID_LIFT_TYPES),
    layers: parseList(params.show, VALID_LAYERS),
    resolution: params.resolution,
    camera: parseCamera(params.cam),
  }
}

/**
 * Build search params from current state
 * Returns only non-default values to keep URLs clean
 */
export function buildSearchParams(state: {
  selection: Selection | null
  difficulties: Difficulty[]
  liftTypes: LiftType[]
  layers: { terrain: boolean; pistes: boolean; lifts: boolean; labels: boolean }
  resolution: ResolutionLevel
  camera?: { position: [number, number, number]; target: [number, number, number] }
}): SearchParams {
  const params: SearchParams = {}
  
  // Selection
  const selectStr = serializeSelection(state.selection)
  if (selectStr) params.select = selectStr
  
  // Difficulties (only if not default)
  const diffStr = serializeList(state.difficulties, DEFAULT_DIFFICULTIES, VALID_DIFFICULTIES)
  if (diffStr) params.diff = diffStr
  
  // Lift types (only if not default)
  const liftsStr = serializeList(state.liftTypes, DEFAULT_LIFT_TYPES, VALID_LIFT_TYPES)
  if (liftsStr) params.lifts = liftsStr
  
  // Layers (only if something is hidden)
  const activeLayers = Object.entries(state.layers)
    .filter(([_, visible]) => visible)
    .map(([layer]) => layer) as typeof VALID_LAYERS[number][]
  const layersStr = serializeList(activeLayers, DEFAULT_LAYERS, VALID_LAYERS)
  if (layersStr) params.show = layersStr
  
  // Resolution (only if not default)
  if (state.resolution !== DEFAULT_RESOLUTION) {
    params.resolution = state.resolution
  }
  
  // Camera (only if explicitly provided)
  if (state.camera) {
    params.cam = serializeCamera(state.camera.position, state.camera.target)
  }
  
  return params
}

// Export constants for use elsewhere
export { VALID_DIFFICULTIES, VALID_LIFT_TYPES, VALID_LAYERS, VALID_RESOLUTIONS }
