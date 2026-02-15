/**
 * Centralized design system — single source of truth for all colors
 *
 * Brand palette:
 *   Primary: Amber #F59E0B  (Tailwind amber-500)
 *   Dark:    Charcoal #18181B (Tailwind zinc-900)
 *
 * Conventions:
 *   - `color` = default/normal state
 *   - `colorHighlight` = hovered or selected state (lighter)
 *   - Piste difficulties and lift types each get a distinct hue
 *   - Semantic colors (success, warning, error, info) are independent of brand
 */

import type { Difficulty } from '@/lib/api/overpass';
import type { LiftType } from '@/stores/useMapStore';

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

export const BRAND = {
  primary: '#f59e0b', // amber-500
  primaryLight: '#fbbf24', // amber-400
  primaryDark: '#d97706', // amber-600
  charcoal: '#18181b', // zinc-900
  charcoalLight: '#27272a', // zinc-800
} as const;

// ---------------------------------------------------------------------------
// Piste difficulty colors
// ---------------------------------------------------------------------------

export const PISTE_COLORS: Record<
  Difficulty,
  { color: string; colorHighlight: string; icon: string; label: string }
> = {
  blue: { color: '#3b82f6', colorHighlight: '#60a5fa', icon: '\u{1F535}', label: 'Easy' },
  red: { color: '#ef4444', colorHighlight: '#f87171', icon: '\u{1F534}', label: 'Intermediate' },
  black: { color: '#1e293b', colorHighlight: '#475569', icon: '\u{26AB}', label: 'Expert' },
};

/** Convenience lookup: difficulty → hex color */
export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  blue: PISTE_COLORS.blue.color,
  red: PISTE_COLORS.red.color,
  black: PISTE_COLORS.black.color,
};

/** Convenience lookup: difficulty → highlight hex color */
export const DIFFICULTY_COLORS_HIGHLIGHT: Record<Difficulty, string> = {
  blue: PISTE_COLORS.blue.colorHighlight,
  red: PISTE_COLORS.red.colorHighlight,
  black: PISTE_COLORS.black.colorHighlight,
};

// ---------------------------------------------------------------------------
// Lift type colors
// ---------------------------------------------------------------------------

export const LIFT_COLORS: Record<
  LiftType,
  { color: string; colorHighlight: string; icon: string }
> = {
  Gondola: { color: '#eab308', colorHighlight: '#facc15', icon: '\u{1F6A1}' },
  'Cable Car': { color: '#f59e0b', colorHighlight: '#fbbf24', icon: '\u{1F6A0}' },
  'Chair Lift': { color: '#ec4899', colorHighlight: '#f472b6', icon: '\u{1FA91}' },
  'T-Bar': { color: '#d946ef', colorHighlight: '#e879f9', icon: '\u{23F8}\u{FE0F}' },
  'Button Lift': { color: '#c026d3', colorHighlight: '#d946ef', icon: '\u{1F518}' },
  'Drag Lift': { color: '#a855f7', colorHighlight: '#c084fc', icon: '\u{2197}\u{FE0F}' },
  'Magic Carpet': { color: '#84cc16', colorHighlight: '#a3e635', icon: '\u{1F7F0}' },
  Lift: { color: '#f59e0b', colorHighlight: '#fbbf24', icon: '\u{1F3BF}' },
};

// ---------------------------------------------------------------------------
// Semantic / UI colors
// ---------------------------------------------------------------------------

export const SEMANTIC = {
  success: '#22c55e', // green-500
  warning: '#f59e0b', // amber-500
  error: '#ef4444', // red-500
  info: '#3b82f6', // blue-500
  /** Unknown / fallback gray */
  unknown: '#6b7280', // gray-500
  /** Idle segment color */
  idle: '#475569', // slate-600
} as const;

// ---------------------------------------------------------------------------
// Entity-category colors (used in sidebar tabs, selection dots, spinners)
// These are intentionally NOT brand-amber — they identify categories.
// ---------------------------------------------------------------------------

export const ENTITY_CATEGORY = {
  piste: { tailwind: 'blue-400', hex: '#60a5fa' },
  lift: { tailwind: 'amber-400', hex: '#fbbf24' },
  peak: { tailwind: 'purple-400', hex: '#c084fc' },
  village: { tailwind: 'orange-400', hex: '#fb923c' },
} as const;

// ---------------------------------------------------------------------------
// Loading indicator colors (3D meshes inside R3F canvas)
// ---------------------------------------------------------------------------

export const LOADING = {
  /** Contour terrain loading torus */
  contourTerrain: '#f59e0b',
  /** Terrain3D loading ring */
  terrain: '#f59e0b',
} as const;

// ---------------------------------------------------------------------------
// Line rendering style (shared by pistes and lifts)
// ---------------------------------------------------------------------------

export const LINE_STYLE = {
  /** Base line width in pixels */
  baseWidth: 11,
  /** Width multiplier when hovered/selected */
  highlightWidthMultiplier: 1.1,
  /** Default line opacity */
  opacity: 1.0,
  /** Shadow outline color */
  shadowColor: '#000000',
  /** Shadow outline opacity */
  shadowOpacity: 0.4,
  /** Shadow width multiplier relative to main line */
  shadowWidthMultiplier: 1.8,
  /** Shadow Y offset below the main line (scene units) */
  shadowYOffset: -0.3,
} as const;
