import { WifiOff, Wifi } from 'lucide-react'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'

/**
 * Offline status indicator
 * Shows when the user is offline or has just recovered from being offline
 */
export function OfflineIndicator() {
  const { isOnline, wasOffline } = useOfflineStatus()

  // Show "back online" message briefly
  if (wasOffline && isOnline) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-800 px-2.5 py-1 text-xs font-medium text-green-100 animate-in fade-in duration-300">
        <Wifi className="h-3 w-3" />
        <span>Back online</span>
      </div>
    )
  }

  // Show offline indicator
  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-amber-200 animate-in fade-in duration-300">
        <WifiOff className="h-3 w-3" />
        <span>Offline</span>
      </div>
    )
  }

  // Online and wasn't just offline - don't show anything
  return null
}
