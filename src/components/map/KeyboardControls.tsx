/**
 * WASD / Arrow key camera controls for panning (FPS-style)
 * 
 * Movement is relative to camera view direction:
 * - W/Up: Move forward (direction camera is looking)
 * - S/Down: Move backward
 * - A/Left: Strafe left
 * - D/Right: Strafe right
 * - Shift: Move faster
 */

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'

const PAN_SPEED = 5
const FAST_MULTIPLIER = 3

export function KeyboardControls() {
  const { camera, controls } = useThree()
  const keysPressed = useRef<Set<string>>(new Set())
  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const movement = useRef(new THREE.Vector3())
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only capture WASD/arrows if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      keysPressed.current.add(e.key.toLowerCase())
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase())
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])
  
  useFrame((_, delta) => {
    const keys = keysPressed.current
    if (keys.size === 0) return
    
    const speed = keys.has('shift') ? PAN_SPEED * FAST_MULTIPLIER : PAN_SPEED
    
    // Get camera's forward direction (projected onto XZ plane for ground movement)
    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    forward.current.normalize()
    
    // Get camera's right direction (perpendicular to forward on XZ plane)
    right.current.crossVectors(forward.current, camera.up).normalize()
    
    movement.current.set(0, 0, 0)
    
    // Forward/backward (relative to camera view)
    if (keys.has('w') || keys.has('arrowup')) {
      movement.current.add(forward.current)
    }
    if (keys.has('s') || keys.has('arrowdown')) {
      movement.current.sub(forward.current)
    }
    
    // Strafe left/right (relative to camera view)
    if (keys.has('a') || keys.has('arrowleft')) {
      movement.current.sub(right.current)
    }
    if (keys.has('d') || keys.has('arrowright')) {
      movement.current.add(right.current)
    }
    
    // Apply movement scaled by speed and delta time
    if (movement.current.length() > 0) {
      movement.current.normalize().multiplyScalar(speed * delta * 60)
      
      // Move both camera and orbit controls target together (true panning)
      camera.position.add(movement.current)
      
      // Also move the orbit controls target to maintain the same view angle
      const orbitControls = controls as OrbitControlsImpl | null
      if (orbitControls?.target) {
        orbitControls.target.add(movement.current)
      }
    }
  })
  
  return null
}
