/**
 * PlaybackCameraFollow - Follows the player marker during ride playback
 *
 * When camera follow is enabled and a ride is playing, this component
 * smoothly moves the camera to track the player's position.
 *
 * Features:
 * - Velocity-based movement with acceleration limiting (cinematic, smooth)
 * - Maximum speed cap to prevent jerky movement at high playback speeds
 * - Smooth deceleration when approaching target
 * - Maintains a comfortable viewing angle behind the player
 */

import { useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { usePlaybackStore } from '@/stores/usePlaybackStore'
import { useTerrainStore } from '@/store/terrainStore'
import { geoToLocal } from '@/lib/geo/coordinates'
import { sampleElevation } from '@/lib/geo/elevationGrid'
import type { SkiRun, RunPoint } from '@/lib/garmin/types'

interface PlaybackCameraFollowProps {
  ride: SkiRun | null
}

// Camera positioning settings
const CAMERA_DISTANCE = 350     // Distance from player
const CAMERA_HEIGHT = 180       // Height above player

// Velocity-based smoothing settings (very smooth, cinematic)
const MAX_CAMERA_SPEED = 80     // Maximum units per second
const MAX_ACCELERATION = 40     // Maximum acceleration (units/s²)
const SMOOTH_TIME = 1.0         // Approximate time to reach target (seconds)
const VELOCITY_DECAY = 0.95     // Velocity decay when near target

// Temporary vectors to avoid allocation in useFrame
const _targetDelta = new THREE.Vector3()
const _desiredVelocity = new THREE.Vector3()
const _velocityDelta = new THREE.Vector3()

/**
 * Smooth damp a vector toward a target with acceleration limiting
 * Similar to Unity's Vector3.SmoothDamp but with explicit acceleration limits
 */
function smoothDampVector(
  current: THREE.Vector3,
  target: THREE.Vector3,
  velocity: THREE.Vector3,
  smoothTime: number,
  maxSpeed: number,
  maxAcceleration: number,
  deltaTime: number
): void {
  // Calculate distance to target
  _targetDelta.subVectors(target, current)
  const distance = _targetDelta.length()
  
  if (distance < 0.001) {
    // Close enough - stop moving
    velocity.multiplyScalar(VELOCITY_DECAY)
    return
  }
  
  // Calculate desired velocity to reach target in smoothTime
  // This creates a critically damped spring-like behavior
  const omega = 2 / smoothTime
  const x = omega * deltaTime
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  
  _desiredVelocity.copy(_targetDelta).multiplyScalar(omega)
  
  // Clamp desired velocity to max speed
  const desiredSpeed = _desiredVelocity.length()
  if (desiredSpeed > maxSpeed) {
    _desiredVelocity.multiplyScalar(maxSpeed / desiredSpeed)
  }
  
  // Calculate velocity change needed
  _velocityDelta.subVectors(_desiredVelocity, velocity)
  
  // Limit acceleration
  const accelerationMagnitude = _velocityDelta.length() / deltaTime
  if (accelerationMagnitude > maxAcceleration) {
    _velocityDelta.multiplyScalar((maxAcceleration * deltaTime) / _velocityDelta.length())
  }
  
  // Apply acceleration to velocity
  velocity.add(_velocityDelta)
  
  // Clamp final velocity to max speed
  const currentSpeed = velocity.length()
  if (currentSpeed > maxSpeed) {
    velocity.multiplyScalar(maxSpeed / currentSpeed)
  }
  
  // Apply velocity with exponential decay for smooth arrival
  const movement = velocity.clone().multiplyScalar(deltaTime * exp)
  
  // Don't overshoot
  if (movement.length() > distance) {
    current.copy(target)
    velocity.multiplyScalar(0.5)
  } else {
    current.add(movement)
  }
}

/**
 * Get interpolated position at a given time
 */
function getPositionAtTime(
  coordinates: RunPoint[],
  timeSeconds: number
): { lat: number; lon: number; elevation: number } | null {
  if (coordinates.length === 0) return null

  const firstPoint = coordinates[0]
  const lastPoint = coordinates[coordinates.length - 1]
  if (!firstPoint || !lastPoint) return null

  const startTime = firstPoint.time.getTime()
  const targetTime = startTime + timeSeconds * 1000

  // Handle edge cases
  if (targetTime <= startTime) {
    return { lat: firstPoint.lat, lon: firstPoint.lon, elevation: firstPoint.elevation }
  }

  const endTime = lastPoint.time.getTime()
  if (targetTime >= endTime) {
    return { lat: lastPoint.lat, lon: lastPoint.lon, elevation: lastPoint.elevation }
  }

  // Find bracketing points
  for (let i = 0; i < coordinates.length - 1; i++) {
    const curr = coordinates[i]
    const next = coordinates[i + 1]
    if (!curr || !next) continue

    const currTime = curr.time.getTime()
    const nextTime = next.time.getTime()

    if (currTime <= targetTime && nextTime >= targetTime) {
      const t = (targetTime - currTime) / (nextTime - currTime)
      return {
        lat: curr.lat + (next.lat - curr.lat) * t,
        lon: curr.lon + (next.lon - curr.lon) * t,
        elevation: curr.elevation + (next.elevation - curr.elevation) * t,
      }
    }
  }

  return null
}

export function PlaybackCameraFollow({ ride }: PlaybackCameraFollowProps) {
  const { camera, controls } = useThree()
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const cameraFollowEnabled = usePlaybackStore((s) => s.cameraFollowEnabled)
  const elevationGrid = useTerrainStore((s) => s.elevationGrid)

  // Track velocities for smooth movement
  const cameraVelocity = useRef(new THREE.Vector3())
  const lookAtVelocity = useRef(new THREE.Vector3())
  
  // Target positions
  const targetCameraPos = useRef(new THREE.Vector3())
  const targetLookAt = useRef(new THREE.Vector3())
  
  // Track initialization state
  const isInitialized = useRef(false)
  const wasFollowEnabled = useRef(false)

  useFrame((_, delta) => {
    // Clamp delta to avoid huge jumps when tab is backgrounded
    const clampedDelta = Math.min(delta, 0.1)
    
    // Only follow when enabled and we have a ride
    if (!cameraFollowEnabled || !ride) {
      isInitialized.current = false
      wasFollowEnabled.current = false
      return
    }

    const orbitControls = controls as OrbitControlsImpl | null
    if (!orbitControls) return

    // Get current player position
    const pos = getPositionAtTime(ride.coordinates, currentTime)
    if (!pos) return

    const [x, , z] = geoToLocal(pos.lat, pos.lon, 0)
    
    // Use terrain elevation if available
    let terrainY: number
    if (elevationGrid) {
      terrainY = sampleElevation(elevationGrid, x, z)
    } else {
      const SOLDEN_ELEVATION = 2284
      terrainY = (pos.elevation - SOLDEN_ELEVATION) * 0.1
    }

    const playerPosition = new THREE.Vector3(x, terrainY, z)

    // Calculate direction of travel for camera positioning
    let direction = new THREE.Vector3(0, 0, -1) // Default: looking north

    if (ride.coordinates.length >= 2) {
      const pos1 = getPositionAtTime(ride.coordinates, Math.max(0, currentTime - 2))
      const pos2 = getPositionAtTime(ride.coordinates, currentTime)

      if (pos1 && pos2) {
        const [x1, , z1] = geoToLocal(pos1.lat, pos1.lon, 0)
        const [x2, , z2] = geoToLocal(pos2.lat, pos2.lon, 0)

        direction = new THREE.Vector3(x2 - x1, 0, z2 - z1)
        if (direction.length() > 0.01) {
          direction.normalize()
        } else {
          direction.set(0, 0, -1)
        }
      }
    }

    // Position camera behind the player in direction of travel
    const cameraOffset = direction.clone().multiplyScalar(-CAMERA_DISTANCE)
    cameraOffset.y = CAMERA_HEIGHT

    // Set target positions
    targetCameraPos.current.copy(playerPosition).add(cameraOffset)
    targetLookAt.current.copy(playerPosition)
    targetLookAt.current.y += 10 // Look slightly above player

    // Initialize on first frame or when follow is re-enabled
    if (!isInitialized.current || !wasFollowEnabled.current) {
      camera.position.copy(targetCameraPos.current)
      orbitControls.target.copy(targetLookAt.current)
      cameraVelocity.current.set(0, 0, 0)
      lookAtVelocity.current.set(0, 0, 0)
      isInitialized.current = true
      wasFollowEnabled.current = true
      orbitControls.update()
      return
    }

    // Apply smooth damping with acceleration limiting
    smoothDampVector(
      camera.position,
      targetCameraPos.current,
      cameraVelocity.current,
      SMOOTH_TIME,
      MAX_CAMERA_SPEED,
      MAX_ACCELERATION,
      clampedDelta
    )

    smoothDampVector(
      orbitControls.target,
      targetLookAt.current,
      lookAtVelocity.current,
      SMOOTH_TIME,
      MAX_CAMERA_SPEED * 0.5, // Look-at moves slower for stability
      MAX_ACCELERATION * 0.5,
      clampedDelta
    )

    // Update controls
    orbitControls.update()
  })

  return null
}
