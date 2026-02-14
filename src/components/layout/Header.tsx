import { Link } from '@tanstack/react-router'
import { Mountain } from 'lucide-react'
import { OfflineIndicator } from '@/components/OfflineIndicator'

export function Header() {
  return (
    <header className="flex h-12 items-center justify-between bg-black/80 px-4 backdrop-blur-md">
      <Link to="/" className="flex items-center gap-2">
        <Mountain className="h-5 w-5 text-white" />
        <span className="text-base font-bold text-white">Sölden Navigator</span>
      </Link>
      
      <OfflineIndicator />
    </header>
  )
}
