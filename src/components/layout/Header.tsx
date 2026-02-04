import { Link } from '@tanstack/react-router'
import { Mountain, MapPin, Navigation, Activity } from 'lucide-react'
import { OfflineIndicator } from '@/components/OfflineIndicator'

export function Header() {
  return (
    <header className="flex h-12 items-center justify-between bg-black/80 px-4 backdrop-blur-md">
      <Link to="/" className="flex items-center gap-2">
        <Mountain className="h-5 w-5 text-white" />
        <span className="text-base font-bold text-white">Sölden Navigator</span>
      </Link>
      
      <div className="flex items-center gap-4">
        <OfflineIndicator />
        
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <MapPin className="h-4 w-4" />
            <span>Map</span>
          </Link>
          <Link
            to="/"
            search={{ panel: 'navigate' }}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Navigation className="h-4 w-4" />
            <span>Navigate</span>
          </Link>
          <Link
            to="/runs"
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Activity className="h-4 w-4" />
            <span>My Runs</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
