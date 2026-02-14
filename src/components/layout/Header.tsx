import { Link } from '@tanstack/react-router'
import { Mountain } from 'lucide-react'
import { OfflineIndicator } from '@/components/OfflineIndicator'

export function Header() {
  return (
    <header className="flex h-12 items-center justify-between bg-amber-500 px-4">
      <Link to="/" className="flex items-center gap-2">
        <Mountain className="h-5 w-5 text-zinc-900" />
        <span className="text-base font-bold text-zinc-900">Sölden Navigator</span>
      </Link>
      
      <OfflineIndicator />
    </header>
  )
}
