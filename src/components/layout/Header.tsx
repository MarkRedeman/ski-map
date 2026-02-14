import { Link } from '@tanstack/react-router'
import { Mountain } from 'lucide-react'
import { OfflineIndicator } from '@/components/OfflineIndicator'

export function Header() {
  return (
    <header className="flex h-12 items-center justify-between bg-zinc-900 px-4 shadow-lg shadow-black/40">
      <Link to="/" className="flex items-center gap-2">
        <Mountain className="h-5 w-5 text-amber-500" />
        <span className="text-base font-bold text-amber-500">Sölden Navigator</span>
      </Link>
      
      <OfflineIndicator />
    </header>
  )
}
