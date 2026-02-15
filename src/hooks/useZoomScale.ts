import { useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

/**
 * Hook to calculate zoom-based line width scaling.
 * Returns a scale factor based on camera distance from origin.
 *
 * At distance 50  -> scale = 4    (very close, thick lines)
 * At distance 300 -> scale = 1    (default overview)
 * At distance 2000 -> scale = 0.15 (very far, thin lines)
 */
export function useZoomScale(): number {
  const { camera } = useThree();
  const [scale, setScale] = useState(1);

  useFrame(() => {
    const distance = camera.position.length();
    const newScale = Math.max(0.15, Math.min(4, 300 / distance));
    // Only update if significantly different to avoid re-renders
    if (Math.abs(newScale - scale) > 0.02) {
      setScale(newScale);
    }
  });

  return scale;
}
