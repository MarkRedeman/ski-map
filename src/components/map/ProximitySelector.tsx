/**
 * ProximitySelector - Handles proximity-based selection of pistes and lifts
 * 
 * Uses a spatial index to find the nearest feature to where the user
 * is pointing/clicking, enabling "click anywhere" selection instead of
 * requiring precise clicks on thin lines.
 */

import { useEffect, useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePistes } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useMapStore } from '@/stores/useMapStore'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { projectPointsOnChunks } from '@/lib/geo/elevationGrid'
import { featureSpatialIndex } from '@/lib/geo/spatialIndex'

/** Maximum distance (in scene units) to select a feature */
const MAX_SELECTION_DISTANCE = 50

/** Raycaster for terrain intersection */
const raycaster = new THREE.Raycaster()

export function ProximitySelector() {
  const { camera, gl } = useThree()
  const terrainMesh = useMapStore((s) => s.terrainMesh)
  const terrainGroup = useMapStore((s) => s.terrainGroup)
  const chunkElevationMap = useMapStore((s) => s.chunkElevationMap)
  const setHoveredPiste = useMapStore((s) => s.setHoveredPiste)
  const setHoveredLift = useMapStore((s) => s.setHoveredLift)
  const setSelectedPiste = useMapStore((s) => s.setSelectedPiste)
  const setSelectedLift = useMapStore((s) => s.setSelectedLift)
  const enabledDifficulties = useNavigationStore((s) => s.enabledDifficulties)
  const showPistes = useMapStore((s) => s.showPistes)
  const showLifts = useMapStore((s) => s.showLifts)
  
  const { data: pistes } = usePistes()
  const { data: lifts } = useLifts()
  
  // Track if we're hovering over a direct line hit (to not override it)
  const directHitRef = useRef(false)
  
  // Build spatial index when data changes
  useEffect(() => {
    if (!chunkElevationMap) return
    
    featureSpatialIndex.clear()
    
    // Add pistes (filtered by difficulty)
    if (pistes && showPistes) {
      for (const piste of pistes) {
        if (!enabledDifficulties.has(piste.difficulty)) continue
        
        const localCoords = coordsToLocal(piste.coordinates, 0)
        const projectedPoints = projectPointsOnChunks(chunkElevationMap, localCoords, 2)
        
        featureSpatialIndex.addFeature({
          id: piste.id,
          type: 'piste',
          points: projectedPoints
        })
      }
    }
    
    // Add lifts
    if (lifts && showLifts) {
      for (const lift of lifts) {
        const localCoords = coordsToLocal(lift.coordinates, 0)
        const projectedPoints = projectPointsOnChunks(chunkElevationMap, localCoords, 10)
        
        featureSpatialIndex.addFeature({
          id: lift.id,
          type: 'lift',
          points: projectedPoints
        })
      }
    }
  }, [pistes, lifts, chunkElevationMap, enabledDifficulties, showPistes, showLifts])
  
  // Get terrain intersection point from mouse position
  const getTerrainPoint = useCallback((event: PointerEvent): THREE.Vector3 | null => {
    // Prefer terrain group (chunked terrain) over single mesh
    const raycastTarget = terrainGroup || terrainMesh
    if (!raycastTarget) return null
    
    const rect = gl.domElement.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    
    // For groups, raycast recursively; for mesh, direct intersection
    const intersects = terrainGroup 
      ? raycaster.intersectObjects(terrainGroup.children, true)
      : raycaster.intersectObject(terrainMesh!, false)
    
    if (intersects.length > 0 && intersects[0]) {
      return intersects[0].point
    }
    return null
  }, [terrainMesh, terrainGroup, camera, gl])
  
  // Handle pointer move for hover
  const handlePointerMove = useCallback((event: PointerEvent) => {
    // Skip if there's a direct hit on a line (handled by the line itself)
    if (directHitRef.current) return
    
    const point = getTerrainPoint(event)
    if (!point) {
      setHoveredPiste(null)
      setHoveredLift(null)
      return
    }
    
    const nearest = featureSpatialIndex.findNearest(
      point.x,
      point.y,
      point.z,
      MAX_SELECTION_DISTANCE
    )
    
    if (nearest) {
      if (nearest.feature.type === 'piste') {
        setHoveredPiste(nearest.feature.id)
        setHoveredLift(null)
      } else {
        setHoveredLift(nearest.feature.id)
        setHoveredPiste(null)
      }
    } else {
      setHoveredPiste(null)
      setHoveredLift(null)
    }
  }, [getTerrainPoint, setHoveredPiste, setHoveredLift])
  
  // Handle click for selection
  const handleClick = useCallback((event: MouseEvent) => {
    const point = getTerrainPoint(event as unknown as PointerEvent)
    if (!point) return
    
    const nearest = featureSpatialIndex.findNearest(
      point.x,
      point.y,
      point.z,
      MAX_SELECTION_DISTANCE
    )
    
    if (nearest) {
      if (nearest.feature.type === 'piste') {
        setSelectedPiste(nearest.feature.id)
      } else {
        setSelectedLift(nearest.feature.id)
      }
    } else {
      // Clear selection when clicking on empty terrain
      setSelectedPiste(null)
      setSelectedLift(null)
    }
  }, [getTerrainPoint, setSelectedPiste, setSelectedLift])
  
  // Attach event listeners
  useEffect(() => {
    const canvas = gl.domElement
    
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('click', handleClick)
    
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('click', handleClick)
    }
  }, [gl, handlePointerMove, handleClick])
  
  // This component doesn't render anything
  return null
}

/**
 * Hook to notify ProximitySelector of direct line hits
 * Call this from line components to prevent proximity override
 */
export function useDirectHit() {
  return {
    onPointerOver: () => {
      // Could be used to set directHitRef.current = true
      // For now, we let proximity selection take precedence
    },
    onPointerOut: () => {
      // directHitRef.current = false
    }
  }
}
