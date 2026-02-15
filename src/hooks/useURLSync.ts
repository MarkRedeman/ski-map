/**
 * URL Sync Hook
 *
 * Bidirectional synchronization between URL search params and Zustand stores.
 *
 * Syncs: entity selection, lift types, layer visibility, resolution, camera.
 * Does NOT sync difficulty filter — that is URL-native via useDifficultyFilter().
 *
 * - On mount: Reads URL params and applies them to stores
 * - On store change: Updates URL params (debounced)
 * - Uses TanStack Router's navigate for URL updates (enables back/forward)
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMapStore, type LiftType } from '@/stores/useMapStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { Difficulty } from '@/lib/api/overpass';
import {
  type SearchParams,
  parseSearchParams,
  buildSearchParams,
  selectionToEntity,
  entityToSelection,
  DEFAULT_DIFFICULTIES,
} from '@/lib/url/searchSchema';

/** Debounce delay for URL updates (ms) */
const URL_UPDATE_DEBOUNCE = 150;

/**
 * Hook to sync URL search params with Zustand stores
 *
 * Call this once in your route component after ski data is loaded.
 * It handles both reading from URL on mount and writing to URL on changes.
 */
export function useURLSync() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as SearchParams;

  // Track if we're currently applying URL state (to prevent circular updates)
  const isApplyingURL = useRef(false);
  // Track if initial URL has been applied
  const hasAppliedInitialURL = useRef(false);
  // Debounce timer for URL updates
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get store values (no difficulty — that's URL-native)
  const selectedEntity = useMapStore((s) => s.selectedEntity);
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes);
  const showTerrain = useMapStore((s) => s.showTerrain);
  const showPistes = useMapStore((s) => s.showPistes);
  const showLifts = useMapStore((s) => s.showLifts);
  const showLabels = useMapStore((s) => s.showLabels);
  const resolution = useSettingsStore((s) => s.resolution);

  // Get store setters
  const setSelectedEntity = useMapStore((s) => s.setSelectedEntity);

  /**
   * Apply URL params to stores (URL -> Store)
   * Difficulty is handled by useDifficultyFilter, not here.
   */
  const applyURLToStores = useCallback(
    (params: SearchParams) => {
      isApplyingURL.current = true;

      const parsed = parseSearchParams(params);

      // Apply selection (convert URL ID to store ID with prefix)
      if (parsed.selection) {
        const entity = selectionToEntity(parsed.selection);
        if (entity) {
          setSelectedEntity(entity.type, entity.id);
        }
      }

      // Apply lift types
      if (parsed.liftTypes) {
        const mapStore = useMapStore.getState();
        // Clear all, then add specified types
        mapStore.setAllLiftTypesVisible(false);
        parsed.liftTypes.forEach((type) => {
          if (!mapStore.visibleLiftTypes.has(type)) {
            mapStore.toggleLiftType(type);
          }
        });
      }

      // Apply layers
      if (parsed.layers) {
        const mapStore = useMapStore.getState();
        const layerMap = {
          terrain: mapStore.showTerrain,
          pistes: mapStore.showPistes,
          lifts: mapStore.showLifts,
          labels: mapStore.showLabels,
        };

        // Toggle layers to match URL state
        for (const layer of ['terrain', 'pistes', 'lifts', 'labels'] as const) {
          const shouldBeVisible = parsed.layers.includes(layer);
          if (layerMap[layer] !== shouldBeVisible) {
            mapStore.toggleLayer(layer);
          }
        }
      }

      // Apply resolution (bypass store's own URL handling)
      if (parsed.resolution) {
        // Directly set in store without triggering URL update
        useSettingsStore.setState({ resolution: parsed.resolution });
      }

      // Apply camera position
      if (parsed.camera) {
        const mapStore = useMapStore.getState();
        mapStore.setCameraPosition(parsed.camera.position);
        mapStore.setCameraTarget(parsed.camera.target);
      }

      // Small delay to allow React to process state changes
      setTimeout(() => {
        isApplyingURL.current = false;
      }, 50);
    },
    [setSelectedEntity]
  );

  /**
   * Update URL from current store state (Store -> URL)
   * Preserves existing diff param (managed by useDifficultyFilter).
   */
  const updateURLFromStores = useCallback(() => {
    if (isApplyingURL.current) return;

    // Build params from store state, using default difficulties as placeholder
    // since buildSearchParams requires it. The actual diff param is preserved
    // via the ...prev spread.
    const params = buildSearchParams({
      selection: entityToSelection(selectedEntity),
      difficulties: DEFAULT_DIFFICULTIES as Difficulty[],
      liftTypes: Array.from(visibleLiftTypes) as LiftType[],
      layers: {
        terrain: showTerrain,
        pistes: showPistes,
        lifts: showLifts,
        labels: showLabels,
      },
      resolution,
    });

    // Remove diff from params — it's managed by useDifficultyFilter
    delete params.diff;

    // Use replace to avoid polluting history with every filter change
    navigate({
      to: '.',
      search: (prev) => ({ ...prev, ...params }),
      replace: true,
    });
  }, [
    navigate,
    selectedEntity,
    visibleLiftTypes,
    showTerrain,
    showPistes,
    showLifts,
    showLabels,
    resolution,
  ]);

  // Apply URL params on mount (once)
  useEffect(() => {
    if (hasAppliedInitialURL.current) return;
    hasAppliedInitialURL.current = true;

    // Check if URL has any meaningful params (diff excluded — handled by useDifficultyFilter)
    const hasParams =
      search.select || search.lifts || search.show || search.resolution || search.cam;

    if (hasParams) {
      applyURLToStores(search);
    }
  }, [search, applyURLToStores]);

  // Sync store changes to URL (debounced)
  useEffect(() => {
    // Skip if we're currently applying URL state
    if (isApplyingURL.current) return;
    // Skip the initial render before URL is applied
    if (!hasAppliedInitialURL.current) return;

    // Debounce URL updates
    if (updateTimer.current) {
      clearTimeout(updateTimer.current);
    }

    updateTimer.current = setTimeout(() => {
      updateURLFromStores();
    }, URL_UPDATE_DEBOUNCE);

    return () => {
      if (updateTimer.current) {
        clearTimeout(updateTimer.current);
      }
    };
  }, [
    updateURLFromStores,
    selectedEntity,
    visibleLiftTypes,
    showTerrain,
    showPistes,
    showLifts,
    showLabels,
    resolution,
  ]);
}

/**
 * Hook to get a shareable URL with current camera position
 *
 * Use this when user explicitly wants to share current view.
 * Reads difficulty from URL search params (since it's URL-native).
 */
export function useShareableURL(): () => string {
  const search = useSearch({ strict: false }) as SearchParams;
  const selectedEntity = useMapStore((s) => s.selectedEntity);
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes);
  const showTerrain = useMapStore((s) => s.showTerrain);
  const showPistes = useMapStore((s) => s.showPistes);
  const showLifts = useMapStore((s) => s.showLifts);
  const showLabels = useMapStore((s) => s.showLabels);
  const cameraPosition = useMapStore((s) => s.cameraPosition);
  const cameraTarget = useMapStore((s) => s.cameraTarget);
  const resolution = useSettingsStore((s) => s.resolution);

  return useCallback(() => {
    // Parse current difficulty from URL
    const currentDifficulties = search.diff
      ? search.diff.split(',').filter((d): d is Difficulty => ['blue', 'red', 'black'].includes(d))
      : (DEFAULT_DIFFICULTIES as Difficulty[]);

    const params = buildSearchParams({
      selection: entityToSelection(selectedEntity),
      difficulties: currentDifficulties,
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
    });

    // Build full URL
    const url = new URL(window.location.href);
    url.search = ''; // Clear existing params

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }, [
    search.diff,
    selectedEntity,
    visibleLiftTypes,
    showTerrain,
    showPistes,
    showLifts,
    showLabels,
    cameraPosition,
    cameraTarget,
    resolution,
  ]);
}
