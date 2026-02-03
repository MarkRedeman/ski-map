import { Link } from '@tanstack/react-router'
import { Mountain, MapPin, Navigation } from 'lucide-react'
import { OfflineIndicator } from '@/components/OfflineIndicator'

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-sky-100 bg-white px-4 shadow-sm">
      <Link to="/" className="flex items-center gap-2">
        <Mountain className="h-6 w-6 text-sky-600" />
        <span className="text-lg font-bold text-slate-800">Sölden Navigator</span>
      </Link>
      
      <div className="flex items-center gap-4">
        <OfflineIndicator />
        
        <nav className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-sky-600 transition-colors"
          >
            <MapPin className="h-4 w-4" />
            <span>Map</span>
          </Link>
          <Link
            to="/"
            search={{ panel: 'navigate' }}
            className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-sky-600 transition-colors"
          >
            <Navigation className="h-4 w-4" />
            <span>Navigate</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
