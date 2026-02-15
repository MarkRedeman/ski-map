/**
 * InfoPanel component - displays detailed info for selected piste/lift/peak/village/restaurant
 * Shows when an item is clicked, styled to match the map legend
 */

import {
  X,
  Mountain,
  Ruler,
  Users,
  ArrowUp,
  ArrowDown,
  MapPin,
  UtensilsCrossed,
  ExternalLink,
} from 'lucide-react';
import { useMapStore } from '@/stores/useMapStore';
import { usePistes } from '@/hooks/usePistes';
import { useLifts } from '@/hooks/useLifts';
import { usePeaks } from '@/hooks/usePeaks';
import { useVillages } from '@/hooks/useVillages';
import { useRestaurants } from '@/hooks/useRestaurants';
import type { RestaurantType } from '@/lib/api/overpass';
import { getElevationMeters } from '@/lib/geo/coordinates';
import { LIFT_TYPE_CONFIG, PISTE_DIFFICULTY_CONFIG } from '@/config/theme';
import { Panel } from './Panel';

// Common layout component for all info panels
interface PanelLayoutProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

function PanelLayout({ icon, title, subtitle, onClose, children }: PanelLayoutProps) {
  return (
    <Panel className="absolute top-4 left-4 z-50 w-72 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {icon}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">{title}</h2>
            {subtitle && <p className="text-xs text-white/60">{subtitle}</p>}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 transition-colors hover:bg-white/20 flex-shrink-0"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-white/70" />
        </button>
      </div>
      {children}
    </Panel>
  );
}

// Reusable Google Maps link shown at the bottom of each info panel
function GoogleMapsLink({ lat, lon }: { lat: number; lon: number }) {
  return (
    <div className="px-3 pb-3">
      <a
        href={`https://www.google.com/maps?q=${lat},${lon}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded bg-white/10 p-2 text-xs text-white/70 hover:bg-white/20 transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Open on Google Maps
      </a>
    </div>
  );
}

// Piste info panel — fetches its own data
function PisteInfoPanel({ id }: { id: string }) {
  const { data: pistes } = usePistes();
  const clearSelection = useMapStore((s) => s.clearSelection);
  const elevationGrid = useMapStore((s) => s.elevationGrid);

  const piste = pistes?.find((p) => p.id === id);
  if (!piste) return null;

  const config = PISTE_DIFFICULTY_CONFIG[piste.difficulty];

  // Compute top/bottom elevations from start/end points via terrain grid
  let topElevation: number | null = null;
  let bottomElevation: number | null = null;
  if (elevationGrid && piste.startPoint && piste.endPoint) {
    const startElev = getElevationMeters(piste.startPoint[0], piste.startPoint[1], elevationGrid);
    const endElev = getElevationMeters(piste.endPoint[0], piste.endPoint[1], elevationGrid);
    topElevation = Math.round(Math.max(startElev, endElev));
    bottomElevation = Math.round(Math.min(startElev, endElev));
  }

  // Midpoint for Google Maps link — use longest segment midpoint
  const allCoords = piste.coordinates.flat();
  const midCoord = allCoords[Math.floor(allCoords.length / 2)];

  return (
    <PanelLayout
      icon={
        <div
          className="h-4 w-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: config.color }}
        />
      }
      title={piste.name}
      subtitle={`${config.label} Piste${piste.ref ? ` #${piste.ref}` : ''}`}
      onClose={clearSelection}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <Ruler className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Length</p>
            <p className="text-xs font-medium text-white">{(piste.length / 1000).toFixed(2)} km</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <Mountain className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Difficulty</p>
            <p className="text-xs font-medium text-white">{config.label}</p>
          </div>
        </div>
        {topElevation != null && (
          <div className="flex items-center gap-2 rounded bg-white/10 p-2">
            <ArrowUp className="h-4 w-4 text-red-400" />
            <div>
              <p className="text-[10px] text-white/50">Top</p>
              <p className="text-xs font-medium text-white">{topElevation.toLocaleString()} m</p>
            </div>
          </div>
        )}
        {bottomElevation != null && (
          <div className="flex items-center gap-2 rounded bg-white/10 p-2">
            <ArrowDown className="h-4 w-4 text-green-400" />
            <div>
              <p className="text-[10px] text-white/50">Bottom</p>
              <p className="text-xs font-medium text-white">{bottomElevation.toLocaleString()} m</p>
            </div>
          </div>
        )}
      </div>
      {midCoord && <GoogleMapsLink lat={midCoord[1]} lon={midCoord[0]} />}
    </PanelLayout>
  );
}

// Lift info panel — fetches its own data
function LiftInfoPanel({ id }: { id: string }) {
  const { data: lifts } = useLifts();
  const clearSelection = useMapStore((s) => s.clearSelection);
  const elevationGrid = useMapStore((s) => s.elevationGrid);

  const lift = lifts?.find((l) => l.id === id);
  if (!lift) return null;

  const config =
    LIFT_TYPE_CONFIG[lift.type as keyof typeof LIFT_TYPE_CONFIG] ?? LIFT_TYPE_CONFIG['Lift'];

  // Compute station elevations from terrain grid
  const stationElevations: (number | null)[] = [];
  if (elevationGrid && lift.stations) {
    for (const station of lift.stations) {
      // station.coordinates is [lat, lon, elevation] with elevation hardcoded to 0
      const elev = getElevationMeters(
        station.coordinates[0],
        station.coordinates[1],
        elevationGrid
      );
      stationElevations.push(Math.round(elev));
    }
  }

  // Midpoint for Google Maps link
  const midCoord = lift.coordinates[Math.floor(lift.coordinates.length / 2)];

  return (
    <PanelLayout
      icon={<span className="text-lg">{config.icon}</span>}
      title={lift.name}
      subtitle={lift.type}
      onClose={clearSelection}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <Ruler className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Length</p>
            <p className="text-xs font-medium text-white">{(lift.length / 1000).toFixed(2)} km</p>
          </div>
        </div>
        {lift.capacity ? (
          <div className="flex items-center gap-2 rounded bg-white/10 p-2">
            <Users className="h-4 w-4 text-white/50" />
            <div>
              <p className="text-[10px] text-white/50">Capacity</p>
              <p className="text-xs font-medium text-white">{lift.capacity}/h</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded bg-white/10 p-2">
            <div
              className="h-4 w-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <div>
              <p className="text-[10px] text-white/50">Type</p>
              <p className="text-xs font-medium text-white">{lift.type}</p>
            </div>
          </div>
        )}
      </div>

      {/* Stations with elevation */}
      {lift.stations && lift.stations.length >= 2 && (
        <div className="px-3 pb-3">
          <div className="rounded bg-white/10 p-2">
            <p className="text-[10px] text-white/50 mb-1.5">Stations</p>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <ArrowDown className="h-3 w-3 text-green-400" />
                <span className="text-white/80 truncate max-w-[80px]">
                  {lift.stations[0]?.name || 'Bottom'}
                </span>
                {stationElevations[0] != null && (
                  <span className="text-white/50">
                    {' '}
                    · {stationElevations[0].toLocaleString()} m
                  </span>
                )}
              </div>
              <div className="h-px flex-1 bg-white/20" />
              <div className="flex items-center gap-1">
                <ArrowUp className="h-3 w-3 text-red-400" />
                <span className="text-white/80 truncate max-w-[80px]">
                  {lift.stations[1]?.name || 'Top'}
                </span>
                {stationElevations[1] != null && (
                  <span className="text-white/50">
                    {' '}
                    · {stationElevations[1].toLocaleString()} m
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {midCoord && <GoogleMapsLink lat={midCoord[1]} lon={midCoord[0]} />}
    </PanelLayout>
  );
}

// Peak info panel — fetches its own data
function PeakInfoPanel({ id }: { id: string }) {
  const { data: peaks } = usePeaks();
  const clearSelection = useMapStore((s) => s.clearSelection);

  const peak = peaks?.find((p) => p.id === id);
  if (!peak) return null;

  return (
    <PanelLayout
      icon={<Mountain className="h-4 w-4 text-amber-400" />}
      title={peak.name}
      subtitle="Mountain Peak"
      onClose={clearSelection}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <Mountain className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Elevation</p>
            <p className="text-xs font-medium text-white">
              {peak.elevation?.toLocaleString() ?? 'Unknown'} m
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <MapPin className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Coordinates</p>
            <p className="text-xs font-medium text-white">{peak.lat.toFixed(4)}°</p>
          </div>
        </div>
      </div>
      <GoogleMapsLink lat={peak.lat} lon={peak.lon} />
    </PanelLayout>
  );
}

// Village info panel — fetches its own data
function VillageInfoPanel({ id }: { id: string }) {
  const { data: villages } = useVillages();
  const clearSelection = useMapStore((s) => s.clearSelection);

  const village = villages?.find((v) => v.id === id);
  if (!village) return null;

  const getVillageIcon = () => {
    switch (village.type) {
      case 'town':
        return '🏘️';
      case 'village':
        return '🏠';
      case 'hamlet':
        return '🏡';
      default:
        return '📍';
    }
  };

  const getVillageTypeLabel = () => {
    switch (village.type) {
      case 'town':
        return 'Town';
      case 'village':
        return 'Village';
      case 'hamlet':
        return 'Hamlet';
      default:
        return village.type.charAt(0).toUpperCase() + village.type.slice(1);
    }
  };

  return (
    <PanelLayout
      icon={<span className="text-lg">{getVillageIcon()}</span>}
      title={village.name}
      subtitle={getVillageTypeLabel()}
      onClose={clearSelection}
    >
      {/* Stats */}
      <div className="p-3">
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <MapPin className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Location</p>
            <p className="text-xs font-medium text-white">
              {village.lat.toFixed(4)}°N, {village.lon.toFixed(4)}°E
            </p>
          </div>
        </div>
      </div>
      <GoogleMapsLink lat={village.lat} lon={village.lon} />
    </PanelLayout>
  );
}

// Restaurant info panel — fetches its own data
const RESTAURANT_ICON_MAP: Record<RestaurantType, string> = {
  Restaurant: '🍽️',
  Cafe: '☕',
  Bar: '🍷',
  'Alpine Hut': '🏔️',
};

function RestaurantInfoPanel({ id }: { id: string }) {
  const { data: restaurants } = useRestaurants();
  const clearSelection = useMapStore((s) => s.clearSelection);
  const elevationGrid = useMapStore((s) => s.elevationGrid);

  const restaurant = restaurants?.find((r) => r.id === id);
  if (!restaurant) return null;

  const icon = RESTAURANT_ICON_MAP[restaurant.type] ?? '🍽️';

  // Always compute elevation — prefer OSM value, fall back to terrain grid
  const elevation =
    restaurant.elevation ??
    (elevationGrid
      ? Math.round(getElevationMeters(restaurant.lat, restaurant.lon, elevationGrid))
      : null);

  return (
    <PanelLayout
      icon={<span className="text-lg">{icon}</span>}
      title={restaurant.name}
      subtitle={restaurant.type}
      onClose={clearSelection}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <UtensilsCrossed className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Type</p>
            <p className="text-xs font-medium text-white">{restaurant.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <Mountain className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Elevation</p>
            <p className="text-xs font-medium text-white">
              {elevation != null ? `${elevation.toLocaleString()} m` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Cuisine info */}
      {restaurant.cuisine && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 rounded bg-white/10 p-2">
            <span className="text-sm">🍴</span>
            <div>
              <p className="text-[10px] text-white/50">Cuisine</p>
              <p className="text-xs font-medium text-white">{restaurant.cuisine}</p>
            </div>
          </div>
        </div>
      )}
      <GoogleMapsLink lat={restaurant.lat} lon={restaurant.lon} />
    </PanelLayout>
  );
}

// Main InfoPanel component — delegates to type-specific panels
export function InfoPanel() {
  const selectedEntity = useMapStore((s) => s.selectedEntity);

  if (!selectedEntity) return null;

  switch (selectedEntity.type) {
    case 'piste':
      return <PisteInfoPanel id={selectedEntity.id} />;
    case 'lift':
      return <LiftInfoPanel id={selectedEntity.id} />;
    case 'peak':
      return <PeakInfoPanel id={selectedEntity.id} />;
    case 'village':
      return <VillageInfoPanel id={selectedEntity.id} />;
    case 'restaurant':
      return <RestaurantInfoPanel id={selectedEntity.id} />;
    default:
      return null;
  }
}
