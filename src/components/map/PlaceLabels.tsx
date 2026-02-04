/**
 * PlaceLabels component - renders village/town labels with smart visibility
 * 
 * Features:
 * - Badge-style labels with building icon
 * - Smart distance-based filtering: towns always visible, villages/hamlets filtered
 * - Uses terrain elevation sampling for accurate Y positioning
 * - Occlusion: labels hide when behind terrain
 */

import { useMemo, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { usePlaces } from '@/hooks/usePlaces'
import { useTerrainStore } from '@/store/terrainStore'
import { useMapStore } from '@/stores/useMapStore'
import { geoToLocal } from '@/lib/geo/coordinates'
import { sampleElevation } from '@/lib/geo/elevationGrid'

type PlaceType = 'town' | 'village' | 'hamlet'

/**
 * Get which place types to show based on camera distance
 */
function getVisiblePlaceTypes(cameraDistance: number): Set<PlaceType> {
  if (cameraDistance < 500) {
    return new Set(['town', 'village', 'hamlet'])  // Show all
  }
  if (cameraDistance < 1500) {
    return new Set(['town', 'village'])  // Towns and villages
  }
  return new Set(['town'])  // Only towns when far away
}

/**
 * Quantize camera distance to threshold levels to avoid constant re-renders
 */
function getDistanceLevel(distance: number): number {
  if (distance < 500) return 0
  if (distance < 1500) return 1
  return 2
}

/**
 * Get icon based on place type
 */
function getPlaceIcon(type: PlaceType): string {
  switch (type) {
    case 'town':
      return '🏘️'
    case 'village':
      return '🏠'
    case 'hamlet':
      return '🏡'
  }
}

interface PlaceLabelProps {
  name: string
  type: PlaceType
  position: [number, number, number]
}

function PlaceLabel({ name, type, position }: PlaceLabelProps) {
  const isTown = type === 'town'
  
  return (
    <Html
      position={position}
      center
      distanceFactor={isTown ? 200 : 150}
      occlude
      zIndexRange={[40, 0]}
    >
      <div className={`
        pointer-events-none flex items-center gap-1.5 rounded-full backdrop-blur-sm shadow-lg
        ${isTown 
          ? 'bg-amber-900/80 px-3 py-1.5' 
          : 'bg-black/70 px-2.5 py-1'
        }
      `}>
        <span className={isTown ? 'text-base' : 'text-sm'}>{getPlaceIcon(type)}</span>
        <span className={`
          font-semibold text-white whitespace-nowrap
          ${isTown ? 'text-sm' : 'text-xs'}
        `}>
          {name}
        </span>
      </div>
    </Html>
  )
}

export function PlaceLabels() {
  const { data: places } = usePlaces()
  const elevationGrid = useTerrainStore((s) => s.elevationGrid)
  const showLabels = useMapStore((s) => s.showLabels)
  
  // Track camera distance level for filtering
  const [distanceLevel, setDistanceLevel] = useState(1)
  
  // Update distance level based on camera position
  useFrame(({ camera }) => {
    const distance = camera.position.length()
    const newLevel = getDistanceLevel(distance)
    if (newLevel !== distanceLevel) {
      setDistanceLevel(newLevel)
    }
  })
  
  // Filter and position places based on camera distance
  const visiblePlaces = useMemo(() => {
    if (!places || !showLabels) return []
    
    const visibleTypes = getVisiblePlaceTypes(
      distanceLevel === 0 ? 0 : distanceLevel === 1 ? 1000 : 2000
    )
    
    return places
      .filter((place) => visibleTypes.has(place.type))
      .map((place) => {
        // Convert geo coordinates to local 3D position
        const [x, , z] = geoToLocal(place.lat, place.lon, 0)
        
        // Get terrain height at this position
        let y: number
        if (elevationGrid) {
          y = sampleElevation(elevationGrid, x, z) + 20 // Offset above terrain
        } else {
          y = 20 // Default height if no elevation data
        }
        
        return {
          ...place,
          position: [x, y, z] as [number, number, number],
        }
      })
  }, [places, elevationGrid, showLabels, distanceLevel])
  
  if (!showLabels || visiblePlaces.length === 0) return null
  
  return (
    <group name="place-labels">
      {visiblePlaces.map((place) => (
        <PlaceLabel
          key={place.id}
          name={place.name}
          type={place.type}
          position={place.position}
        />
      ))}
    </group>
  )
}
