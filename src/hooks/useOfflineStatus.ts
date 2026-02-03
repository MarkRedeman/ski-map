import { useState, useEffect, useCallback, useRef } from 'react'

interface OfflineStatus {
  isOnline: boolean
  wasOffline: boolean
  lastOnlineAt: Date | null
}

/**
 * Hook to detect online/offline status
 * Returns current status and whether the user was previously offline
 */
export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [wasOffline, setWasOffline] = useState(false)
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null)
  const wasOfflineRef = useRef(false)

  const handleOnline = useCallback(() => {
    setIsOnline(true)
    setLastOnlineAt(new Date())
    
    // If we were offline before, mark that we've recovered
    if (wasOfflineRef.current) {
      setWasOffline(true)
      // Reset wasOffline after a delay so UI can show recovery message
      setTimeout(() => setWasOffline(false), 5000)
    }
    wasOfflineRef.current = false
  }, [])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
    wasOfflineRef.current = true
  }, [])

  useEffect(() => {
    // Initial check
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
      wasOfflineRef.current = !navigator.onLine
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  return {
    isOnline,
    wasOffline,
    lastOnlineAt,
  }
}
