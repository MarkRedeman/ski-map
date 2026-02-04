/**
 * URL Sync Hook
 * 
 * Bidirectional synchronization between URL search params and Zustand stores.
 * 
 * - On mount: Reads URL params and applies them to stores
 * - On store change: Updates URL params (debounced)
 * - Uses TanStack Router's navigate for URL updates (enables back/forward)
 */

import { useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMapStore, type LiftType } from '@/stores/useMapStore'
import { useNavigationStore, type Difficulty } from '@/stores/useNavigationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import {
  type SearchParams,
  parseSearchParams,
  buildSearchParams,
  storeIdToSelection,
  selectionToStoreId,
} from '@/lib/url/searchSchema'

/** Debounce delay for URL updates (ms) */
const URL_UPDATE_DEBOUNCE = 150

/**
 * Hook to sync URL search params with Zustand stores
 * 
 * Call this once in your route component after ski data is loaded.
 * It handles both reading from URL on mount and writing to URL on changes.
 */
export function useURLSync() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as SearchParams
  
  // Track if we're currently applying URL state (to prevent circular updates)
  const isApplyingURL = useRef(false)
  // Track if initial URL has been applied
  const hasAppliedInitialURL = useRef(false)
  // Debounce timer for URL updates
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Get store values
  const selectedPisteId = useMapStore((s) => s.selectedPisteId)
  const selectedLiftId = useMapStore((s) => s.selectedLiftId)
  const selectedPeakId = useMapStore((s) => s.selectedPeakId)
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId)
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes)
  const showTerrain = useMapStore((s) => s.showTerrain)
  const showPistes = useMapStore((s) => s.showPistes)
  const showLifts = useMapStore((s) => s.showLifts)
  const showLabels = useMapStore((s) => s.showLabels)
  const enabledDifficulties = useNavigationStore((s) => s.enabledDifficulties)
  const resolution = useSettingsStore((s) => s.resolution)
  
  // Get store setters
  const setSelectedPiste = useMapStore((s) => s.setSelectedPiste)
  const setSelectedLift = useMapStore((s) => s.setSelectedLift)
  const setSelectedPeak = useMapStore((s) => s.setSelectedPeak)
  const setSelectedPlace = useMapStore((s) => s.setSelectedPlace)
  const setDifficulties = useNavigationStore((s) => s.setDifficulties)
  
  /**
   * Apply URL params to stores (URL -> Store)
   */
  const applyURLToStores = useCallback((params: SearchParams) => {
    isApplyingURL.current = true
    
    const parsed = parseSearchParams(params)
    
    // Apply selection
    const storeIds = selectionToStoreId(parsed.selection)
    if (storeIds.selectedPisteId) {
      setSelectedPiste(storeIds.selectedPisteId)
    } else if (storeIds.selectedLiftId) {
      setSelectedLift(storeIds.selectedLiftId)
    } else if (storeIds.selectedPeakId) {
      setSelectedPeak(storeIds.selectedPeakId)
    } else if (storeIds.selectedPlaceId) {
      setSelectedPlace(storeIds.selectedPlaceId)
    }
    
    // Apply difficulties
    if (parsed.difficulties && parsed.difficulties.length > 0) {
      setDifficulties(parsed.difficulties)
    }
    
    // Apply lift types
    if (parsed.liftTypes) {
      const mapStore = useMapStore.getState()
      // Clear all, then add specified types
      mapStore.setAllLiftTypesVisible(false)
      parsed.liftTypes.forEach(type => {
        if (!mapStore.visibleLiftTypes.has(type)) {
          mapStore.toggleLiftType(type)
        }
      })
    }
    
    // Apply layers
    if (parsed.layers) {
      const mapStore = useMapStore.getState()
      const layerMap = {
        terrain: mapStore.showTerrain,
        pistes: mapStore.showPistes,
        lifts: mapStore.showLifts,
        labels: mapStore.showLabels,
      }
      
      // Toggle layers to match URL state
      for (const layer of ['terrain', 'pistes', 'lifts', 'labels'] as const) {
        const shouldBeVisible = parsed.layers.includes(layer)
        if (layerMap[layer] !== shouldBeVisible) {
          mapStore.toggleLayer(layer)
        }
      }
    }
    
    // Apply resolution (bypass store's own URL handling)
    if (parsed.resolution) {
      // Directly set in store without triggering URL update
      useSettingsStore.setState({ resolution: parsed.resolution })
    }
    
    // Apply camera position
    if (parsed.camera) {
      const mapStore = useMapStore.getState()
      mapStore.setCameraPosition(parsed.camera.position)
      mapStore.setCameraTarget(parsed.camera.target)
    }
    
    // Small delay to allow React to process state changes
    setTimeout(() => {
      isApplyingURL.current = false
    }, 50)
  }, [setSelectedPiste, setSelectedLift, setSelectedPeak, setSelectedPlace, setDifficulties])
  
  /**
   * Update URL from current store state (Store -> URL)
   */
  const updateURLFromStores = useCallback(() => {
    if (isApplyingURL.current) return
    
    const selection = storeIdToSelection(
      selectedPisteId,
      selectedLiftId,
      selectedPeakId,
      selectedPlaceId
    )
    
    const params = buildSearchParams({
      selection,
      difficulties: Array.from(enabledDifficulties) as Difficulty[],
      liftTypes: Array.from(visibleLiftTypes) as LiftType[],
      layers: {
        terrain: showTerrain,
        pistes: showPistes,
        lifts: showLifts,
        labels: showLabels,
      },
      resolution,
      // Don't include camera by default - only for explicit share actions
    })
    
    // Use replace to avoid polluting history with every filter change
    navigate({
      to: '.',
      search: (prev) => ({ ...prev, ...params }),
      replace: true,
    })
  }, [
    navigate,
    selectedPisteId,
    selectedLiftId,
    selectedPeakId,
    selectedPlaceId,
    enabledDifficulties,
    visibleLiftTypes,
    showTerrain,
    showPistes,
    showLifts,
    showLabels,
    resolution,
  ])
  
  // Apply URL params on mount (once)
  useEffect(() => {
    if (hasAppliedInitialURL.current) return
    hasAppliedInitialURL.current = true
    
    // Check if URL has any meaningful params
    const hasParams = search.select || search.diff || search.lifts || 
                      search.show || search.resolution || search.cam
    
    if (hasParams) {
      applyURLToStores(search)
    }
  }, [search, applyURLToStores])
  
  // Sync store changes to URL (debounced)
  useEffect(() => {
    // Skip if we're currently applying URL state
    if (isApplyingURL.current) return
    // Skip the initial render before URL is applied
    if (!hasAppliedInitialURL.current) return
    
    // Debounce URL updates
    if (updateTimer.current) {
      clearTimeout(updateTimer.current)
    }
    
    updateTimer.current = setTimeout(() => {
      updateURLFromStores()
    }, URL_UPDATE_DEBOUNCE)
    
    return () => {
      if (updateTimer.current) {
        clearTimeout(updateTimer.current)
      }
    }
  }, [
    updateURLFromStores,
    selectedPisteId,
    selectedLiftId,
    selectedPeakId,
    selectedPlaceId,
    enabledDifficulties,
    visibleLiftTypes,
    showTerrain,
    showPistes,
    showLifts,
    showLabels,
    resolution,
  ])
}

/**
 * Hook to get a shareable URL with current camera position
 * 
 * Use this when user explicitly wants to share current view.
 */
export function useShareableURL(): () => string {
  const selectedPisteId = useMapStore((s) => s.selectedPisteId)
  const selectedLiftId = useMapStore((s) => s.selectedLiftId)
  const selectedPeakId = useMapStore((s) => s.selectedPeakId)
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId)
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes)
  const showTerrain = useMapStore((s) => s.showTerrain)
  const showPistes = useMapStore((s) => s.showPistes)
  const showLifts = useMapStore((s) => s.showLifts)
  const showLabels = useMapStore((s) => s.showLabels)
  const cameraPosition = useMapStore((s) => s.cameraPosition)
  const cameraTarget = useMapStore((s) => s.cameraTarget)
  const enabledDifficulties = useNavigationStore((s) => s.enabledDifficulties)
  const resolution = useSettingsStore((s) => s.resolution)
  
  return useCallback(() => {
    const selection = storeIdToSelection(
      selectedPisteId,
      selectedLiftId,
      selectedPeakId,
      selectedPlaceId
    )
    
    const params = buildSearchParams({
      selection,
      difficulties: Array.from(enabledDifficulties) as Difficulty[],
      liftTypes: Array.from(visibleLiftTypes) as LiftType[],
      layers: {
        terrain: showTerrain,
        pistes: showPistes,
        lifts: showLifts,
        labels: showLabels,
      },
      resolution,
      camera: {
        position: cameraPosition,
        target: cameraTarget,
      },
    })
    
    // Build full URL
    const url = new URL(window.location.href)
    url.search = '' // Clear existing params
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value)
      }
    }
    
    return url.toString()
  }, [
    selectedPisteId,
    selectedLiftId,
    selectedPeakId,
    selectedPlaceId,
    enabledDifficulties,
    visibleLiftTypes,
    showTerrain,
    showPistes,
    showLifts,
    showLabels,
    cameraPosition,
    cameraTarget,
    resolution,
  ])
}
