/**
 * Compass widget for the 3D map viewer
 *
 * Shows cardinal directions (N, E, S, W) that rotate based on camera orientation.
 * Clicking the compass resets the camera to face north (looking from south to north).
 */

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { PANEL_CLASSES } from './Panel';

/**
 * Inner component that runs inside the R3F Canvas context
 * Updates the compass rotation and handles click-to-north animation
 */
export function CompassController({
  onRotationUpdate,
  resetToNorth,
}: {
  onRotationUpdate: (angle: number) => void;
  resetToNorth: boolean;
}) {
  const { camera, controls } = useThree();
  const targetAzimuth = useRef<number | null>(null);
  const animationProgress = useRef(0);
  const startAzimuth = useRef(0);

  // Handle reset to north trigger
  useEffect(() => {
    if (resetToNorth) {
      const orbitControls = controls as OrbitControlsImpl | null;
      if (orbitControls) {
        // Calculate current azimuth
        const offset = new THREE.Vector3();
        offset.subVectors(camera.position, orbitControls.target);
        startAzimuth.current = Math.atan2(offset.x, offset.z);

        // Target azimuth: camera should be south of target, looking north
        // This means camera at +Z relative to target, so azimuth = 0
        targetAzimuth.current = 0;
        animationProgress.current = 0;
      }
    }
  }, [resetToNorth, camera, controls]);

  useFrame(() => {
    const orbitControls = controls as OrbitControlsImpl | null;
    if (!orbitControls) return;

    // Calculate current azimuth angle (angle around Y axis)
    const offset = new THREE.Vector3();
    offset.subVectors(camera.position, orbitControls.target);
    const azimuth = Math.atan2(offset.x, offset.z);

    // If animating to north
    if (targetAzimuth.current !== null) {
      animationProgress.current += 0.02; // ~60fps, 50 frames = ~0.8s animation

      if (animationProgress.current >= 1) {
        // Animation complete
        targetAzimuth.current = null;
      } else {
        // Ease out cubic
        const t = 1 - Math.pow(1 - animationProgress.current, 3);

        // Calculate shortest rotation path
        let deltaAngle = targetAzimuth.current - startAzimuth.current;
        // Normalize to [-PI, PI]
        while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

        const newAzimuth = startAzimuth.current + deltaAngle * t;

        // Rotate camera position around target
        const distance = offset.length();
        const polar = Math.acos(offset.y / distance); // angle from Y axis

        const newX = distance * Math.sin(polar) * Math.sin(newAzimuth);
        const newY = distance * Math.cos(polar);
        const newZ = distance * Math.sin(polar) * Math.cos(newAzimuth);

        camera.position.set(
          orbitControls.target.x + newX,
          orbitControls.target.y + newY,
          orbitControls.target.z + newZ
        );
        camera.lookAt(orbitControls.target);
        orbitControls.update();
      }
    }

    // Update compass rotation (convert to degrees, negate for visual rotation)
    // When camera is south of target (azimuth=0), north should point up
    // Azimuth increases clockwise when viewed from above
    onRotationUpdate(-azimuth * (180 / Math.PI));
  });

  return null;
}

/**
 * Compass UI overlay component (rendered outside Canvas)
 */
export function CompassUI({ rotation, onClick }: { rotation: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        PANEL_CLASSES,
        'absolute top-4 right-4 flex h-14 w-14 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95'
      )}
      title="Click to reset view to north"
      aria-label="Compass - click to face north"
    >
      {/* Rotating compass rose */}
      <div className="relative h-10 w-10" style={{ transform: `rotate(${rotation}deg)` }}>
        {/* Compass circle */}
        <div className="absolute inset-0 rounded-full border border-white/30" />

        {/* North pointer (red) */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-red-400">N</span>
            <div className="h-2 w-0.5 bg-red-400" />
          </div>
        </div>

        {/* South pointer */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <div className="flex flex-col items-center">
            <div className="h-2 w-0.5 bg-white/50" />
            <span className="text-[10px] text-white/50">S</span>
          </div>
        </div>

        {/* East pointer */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <div className="flex items-center">
            <div className="h-0.5 w-2 bg-white/50" />
            <span className="text-[10px] text-white/50">E</span>
          </div>
        </div>

        {/* West pointer */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2">
          <div className="flex items-center">
            <span className="text-[10px] text-white/50">W</span>
            <div className="h-0.5 w-2 bg-white/50" />
          </div>
        </div>

        {/* Center dot */}
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      </div>
    </button>
  );
}
