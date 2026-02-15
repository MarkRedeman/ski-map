import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Mountain } from 'lucide-react';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { SettingsToggle, SettingsPanel } from '@/components/layout/SettingsPanel';

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="relative flex h-12 items-center justify-between bg-zinc-900 px-4 shadow-lg shadow-black/40">
      <Link to="/" className="flex items-center gap-2">
        <Mountain className="h-5 w-5 text-amber-500" />
        <span className="text-base font-bold text-amber-500">Sölden Navigator</span>
      </Link>

      <div className="flex items-center gap-2">
        <SettingsToggle open={settingsOpen} onToggle={() => setSettingsOpen((v) => !v)} />
        <OfflineIndicator />
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
