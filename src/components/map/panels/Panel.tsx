/**
 * Panel — Shared glass-panel wrapper for map overlay components.
 *
 * Provides the consistent dark-glass appearance used across all floating
 * map panels: Controls, InfoPanel, InfoTooltip, Compass, SidebarToggle,
 * PlaybackControls, etc.
 *
 * Usage:
 *   <Panel className="absolute top-4 left-4 p-3">…</Panel>
 *
 * For components that render as <button> instead of <div>, import
 * PANEL_CLASSES and merge with cn():
 *   <button className={cn(PANEL_CLASSES, "h-10 w-10")}>…</button>
 */

import { cn } from '@/lib/utils';

/** Base class string for the glass-panel appearance. */
export const PANEL_CLASSES =
  'rounded-lg bg-black/80 shadow-lg shadow-black/30 backdrop-blur-md hover:bg-black/90 z-[100]';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function Panel({ children, className, ...rest }: PanelProps) {
  return (
    <div className={cn(PANEL_CLASSES, className)} {...rest}>
      {children}
    </div>
  );
}
