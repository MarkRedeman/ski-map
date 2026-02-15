/**
 * Settings Panel
 *
 * Dropdown panel for runtime configuration of Mapbox token and region bounds.
 * Anchored to the cog icon in the Header. Changes are saved to localStorage
 * via useAppConfigStore and require a page reload to take effect.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Settings, RotateCcw, ExternalLink } from 'lucide-react';
import { useAppConfigStore } from '@/stores/useAppConfigStore';
import { SOLDEN_REGION } from '@/config/region';
import { TerrainSettings } from '@/components/map/panels/TerrainSettings';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`rounded p-1.5 transition-colors ${
        open ? 'bg-amber-500/20 text-amber-400' : 'text-white/60 hover:text-white/90'
      }`}
      title="Settings"
    >
      <Settings className="h-4 w-4" />
    </button>
  );
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const store = useAppConfigStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Local form state (initialized from store)
  const [token, setToken] = useState(store.mapboxToken ?? '');
  const [bounds, setBounds] = useState({
    minLat: store.regionBounds?.minLat ?? '',
    maxLat: store.regionBounds?.maxLat ?? '',
    minLon: store.regionBounds?.minLon ?? '',
    maxLon: store.regionBounds?.maxLon ?? '',
  });
  const [center, setCenter] = useState({
    lat: store.regionCenter?.lat ?? '',
    lon: store.regionCenter?.lon ?? '',
    elevation: store.regionCenter?.elevation ?? '',
  });

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (open) {
      // Delay to avoid catching the toggle click
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [open, onClose]);

  const handleApply = useCallback(() => {
    // Save token
    store.setMapboxToken(token.trim() || null);

    // Save bounds (only if all four fields are filled)
    const b = {
      minLat: parseFloat(String(bounds.minLat)),
      maxLat: parseFloat(String(bounds.maxLat)),
      minLon: parseFloat(String(bounds.minLon)),
      maxLon: parseFloat(String(bounds.maxLon)),
    };
    if (Object.values(b).every((v) => !isNaN(v))) {
      store.setRegionBounds(b);
    } else if (
      bounds.minLat === '' &&
      bounds.maxLat === '' &&
      bounds.minLon === '' &&
      bounds.maxLon === ''
    ) {
      store.setRegionBounds(null);
    }

    // Save center (only if all three fields are filled)
    const c = {
      lat: parseFloat(String(center.lat)),
      lon: parseFloat(String(center.lon)),
      elevation: parseFloat(String(center.elevation)),
    };
    if (Object.values(c).every((v) => !isNaN(v))) {
      store.setRegionCenter(c);
    } else if (center.lat === '' && center.lon === '' && center.elevation === '') {
      store.setRegionCenter(null);
    }

    // Reload to apply changes
    window.location.reload();
  }, [store, token, bounds, center]);

  const handleResetToken = useCallback(() => {
    setToken('');
    store.setMapboxToken(null);
  }, [store]);

  const handleResetRegion = useCallback(() => {
    setBounds({ minLat: '', maxLat: '', minLon: '', maxLon: '' });
    setCenter({ lat: '', lon: '', elevation: '' });
    store.setRegionBounds(null);
    store.setRegionCenter(null);
  }, [store]);

  if (!open) return null;

  const defaults = SOLDEN_REGION;

  return (
    <div
      ref={panelRef}
      className="absolute right-4 top-12 z-50 w-80 rounded-lg bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur-md"
    >
      <div className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-amber-500">Settings</h2>

        {/* Terrain Appearance */}
        <section className="mb-4">
          <TerrainSettings />
        </section>

        <hr className="mb-4 border-white/10" />

        {/* Mapbox Token */}
        <section className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-white">Mapbox Token</label>
            <button
              onClick={handleResetToken}
              className="flex items-center gap-1 text-[10px] text-white/40 transition-colors hover:text-white/70"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Reset
            </button>
          </div>
          <p className="mb-1.5 text-[10px] leading-tight text-white/50">
            Override the default token. Get one at{' '}
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-amber-500/70 hover:text-amber-400"
            >
              mapbox.com
              <ExternalLink className="h-2 w-2" />
            </a>
          </p>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="pk.eyJ1Ijo..."
            className="w-full rounded bg-white/10 px-2 py-1.5 font-mono text-[11px] text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </section>

        <hr className="mb-4 border-white/10" />

        {/* Region Bounds */}
        <section className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-white">Region Bounds</label>
            <button
              onClick={handleResetRegion}
              className="flex items-center gap-1 text-[10px] text-white/40 transition-colors hover:text-white/70"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Reset to Sölden
            </button>
          </div>
          <p className="mb-1.5 text-[10px] leading-tight text-white/50">
            Geographic bounding box for terrain tiles and OSM data. Leave empty to use Sölden
            defaults.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <NumberInput
              label="North"
              value={bounds.maxLat}
              placeholder={String(defaults.bounds.maxLat)}
              onChange={(v) => setBounds((prev) => ({ ...prev, maxLat: v }))}
            />
            <NumberInput
              label="South"
              value={bounds.minLat}
              placeholder={String(defaults.bounds.minLat)}
              onChange={(v) => setBounds((prev) => ({ ...prev, minLat: v }))}
            />
            <NumberInput
              label="West"
              value={bounds.minLon}
              placeholder={String(defaults.bounds.minLon)}
              onChange={(v) => setBounds((prev) => ({ ...prev, minLon: v }))}
            />
            <NumberInput
              label="East"
              value={bounds.maxLon}
              placeholder={String(defaults.bounds.maxLon)}
              onChange={(v) => setBounds((prev) => ({ ...prev, maxLon: v }))}
            />
          </div>
        </section>

        {/* Region Center */}
        <section className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-white">Region Center</label>
          <p className="mb-1.5 text-[10px] leading-tight text-white/50">
            Origin point for the 3D coordinate system. Elevation is in meters above sea level.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <NumberInput
              label="Lat"
              value={center.lat}
              placeholder={String(defaults.center.lat)}
              onChange={(v) => setCenter((prev) => ({ ...prev, lat: v }))}
            />
            <NumberInput
              label="Lon"
              value={center.lon}
              placeholder={String(defaults.center.lon)}
              onChange={(v) => setCenter((prev) => ({ ...prev, lon: v }))}
            />
            <NumberInput
              label="Elev"
              value={center.elevation}
              placeholder={String(defaults.center.elevation)}
              onChange={(v) => setCenter((prev) => ({ ...prev, elevation: v }))}
            />
          </div>
        </section>

        <hr className="mb-4 border-white/10" />

        {/* Apply */}
        <button
          onClick={handleApply}
          className="w-full rounded bg-amber-500 py-1.5 text-xs font-semibold text-zinc-900 transition-colors hover:bg-amber-400"
        >
          Apply &amp; Reload
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal components
// ---------------------------------------------------------------------------

function NumberInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | number;
  placeholder: string;
  onChange: (value: string | number) => void;
}) {
  return (
    <div>
      <span className="mb-0.5 block text-[10px] text-white/60">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          // Allow empty, negative sign, decimal point, or valid number
          if (v === '' || v === '-' || v === '.' || v === '-.' || !isNaN(Number(v))) {
            onChange(v);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded bg-white/10 px-1.5 py-1 text-[11px] text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
      />
    </div>
  );
}
