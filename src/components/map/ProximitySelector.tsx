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
import { type Difficulty } from '@/lib/api/overpass'
import { useMapStore } from '@/stores/useMapStore'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { projectPointsOnGrid } from '@/lib/geo/elevationGrid'
import { featureSpatialIndex } from '@/lib/geo/spatialIndex'

/** Maximum distance (in scene units) to hover on a feature */
const MAX_HOVER_DISTANCE = 15

/** Maximum distance (in scene units) to click-select a feature */
const MAX_CLICK_DISTANCE = 25

/** Raycaster for terrain intersection */
const raycaster = new THREE.Raycaster()

interface ProximitySelectorProps {
  enabledDifficulties: Set<Difficulty>
}

export function ProximitySelector({ enabledDifficulties }: ProximitySelectorProps) {
  const { camera, gl } = useThree()
  const terrainGroup = useMapStore((s) => s.terrainGroup)
  const elevationGrid = useMapStore((s) => s.elevationGrid)
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity)
  const setSelectedEntity = useMapStore((s) => s.setSelectedEntity)
  const showPistes = useMapStore((s) => s.showPistes)
  const showLifts = useMapStore((s) => s.showLifts)
  
  const { data: pistes } = usePistes()
  const { data: lifts } = useLifts()
  
  // Track if we're hovering over a direct line hit (to not override it)
  const directHitRef = useRef(false)
  
  // Build spatial index when data changes
  useEffect(() => {
    if (!elevationGrid) return
    
    featureSpatialIndex.clear()
    
    // Add pistes (filtered by difficulty) - index ALL segments with same piste ID
    if (pistes && showPistes) {
      for (const piste of pistes) {
        if (!enabledDifficulties.has(piste.difficulty)) continue
        
        // Add each segment to the index with the same piste ID
        // This way hovering any segment will highlight the whole piste
        for (const segmentCoords of piste.coordinates) {
          const localCoords = coordsToLocal(segmentCoords, 0)
          const projectedPoints = projectPointsOnGrid(elevationGrid, localCoords, 2)
          
          featureSpatialIndex.addFeature({
            id: piste.id,
            type: 'piste',
            points: projectedPoints
          })
        }
      }
    }
    
    // Add lifts
    if (lifts && showLifts) {
      for (const lift of lifts) {
        const localCoords = coordsToLocal(lift.coordinates, 0)
        const projectedPoints = projectPointsOnGrid(elevationGrid, localCoords, 10)
        
        featureSpatialIndex.addFeature({
          id: lift.id,
          type: 'lift',
          points: projectedPoints
        })
      }
    }
  }, [pistes, lifts, elevationGrid, enabledDifficulties, showPistes, showLifts])
  
  // Get terrain intersection point from mouse position
  const getTerrainPoint = useCallback((event: PointerEvent): THREE.Vector3 | null => {
    if (!terrainGroup) return null
    
    const rect = gl.domElement.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    
    // Raycast recursively through terrain group
    const intersects = raycaster.intersectObjects(terrainGroup.children, true)
    
    if (intersects.length > 0 && intersects[0]) {
      return intersects[0].point
    }
    return null
  }, [terrainGroup, camera, gl])
  
  // Handle pointer move for hover
  const handlePointerMove = useCallback((event: PointerEvent) => {
    // Skip if there's a direct hit on a line (handled by the line itself)
    if (directHitRef.current) return
    
    const point = getTerrainPoint(event)
    if (!point) {
      setHoveredEntity('piste', null)
      return
    }
    
    const nearest = featureSpatialIndex.findNearest(
      point.x,
      point.y,
      point.z,
      MAX_HOVER_DISTANCE
    )
    
    if (nearest) {
      setHoveredEntity(nearest.feature.type, nearest.feature.id)
    } else {
      setHoveredEntity('piste', null)
    }
  }, [getTerrainPoint, setHoveredEntity])
  
  // Handle click for selection
  const handleClick = useCallback((event: MouseEvent) => {
    const point = getTerrainPoint(event as unknown as PointerEvent)
    if (!point) return

    const nearest = featureSpatialIndex.findNearest(
      point.x,
      point.y,
      point.z,
      MAX_CLICK_DISTANCE
    )

    if (nearest) {
      setSelectedEntity(nearest.feature.type, nearest.feature.id)
    } else {
      // Clear selection when clicking on empty terrain
      setSelectedEntity('piste', null)
    }
  }, [getTerrainPoint, setSelectedEntity])
  
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
