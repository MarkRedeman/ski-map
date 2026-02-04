/**
 * CameraNavigator - Handles animated camera focus on selected items
 * 
 * When an item is selected from the sidebar (piste, lift, peak, or village),
 * this component smoothly animates the camera to center on the item.
 * 
 * Features:
 * - Smooth easing animation (ease-out cubic)
 * - Maintains camera viewing angle while panning
 * - Adjusts distance based on item type (closer for peaks/places)
 */

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { useMapStore } from '@/stores/useMapStore'

const ANIMATION_DURATION = 0.6 // seconds

export function CameraNavigator() {
  const { camera, controls } = useThree()
  const cameraFocusTarget = useMapStore((s) => s.cameraFocusTarget)
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget)
  
  // Animation state
  const animating = useRef(false)
  const animationProgress = useRef(0)
  const startPosition = useRef(new THREE.Vector3())
  const startTarget = useRef(new THREE.Vector3())
  const endTarget = useRef(new THREE.Vector3())
  const targetDistance = useRef(200)
  
  // Start animation when focus target changes
  useEffect(() => {
    if (!cameraFocusTarget) return
    
    const orbitControls = controls as OrbitControlsImpl | null
    if (!orbitControls) return
    
    // Store start positions
    startPosition.current.copy(camera.position)
    startTarget.current.copy(orbitControls.target)
    
    // Set end target from the focus target
    endTarget.current.set(
      cameraFocusTarget.position[0],
      cameraFocusTarget.position[1],
      cameraFocusTarget.position[2]
    )
    targetDistance.current = cameraFocusTarget.distance
    
    // Start animation
    animating.current = true
    animationProgress.current = 0
    
  }, [cameraFocusTarget, camera, controls])
  
  useFrame((_, delta) => {
    if (!animating.current) return
    
    const orbitControls = controls as OrbitControlsImpl | null
    if (!orbitControls) return
    
    // Progress the animation
    animationProgress.current += delta / ANIMATION_DURATION
    
    if (animationProgress.current >= 1) {
      // Animation complete
      animating.current = false
      animationProgress.current = 1
      
      // Clear the focus target
      setCameraFocusTarget(null)
    }
    
    // Ease out cubic
    const t = 1 - Math.pow(1 - animationProgress.current, 3)
    
    // Interpolate target position
    const currentTarget = new THREE.Vector3().lerpVectors(
      startTarget.current,
      endTarget.current,
      t
    )
    
    // Calculate camera offset from current target
    const currentOffset = new THREE.Vector3().subVectors(
      camera.position,
      orbitControls.target
    )
    
    // Calculate target offset (maintain direction, adjust distance)
    const currentDistance = currentOffset.length()
    const newDistance = THREE.MathUtils.lerp(currentDistance, targetDistance.current, t)
    
    // Normalize and scale
    const targetOffset = currentOffset.clone().normalize().multiplyScalar(newDistance)
    
    // Calculate new camera position
    const newCameraPosition = currentTarget.clone().add(targetOffset)
    
    // Apply positions
    orbitControls.target.copy(currentTarget)
    camera.position.copy(newCameraPosition)
    camera.lookAt(currentTarget)
    
    // Update controls
    orbitControls.update()
  })
  
  return null
}
