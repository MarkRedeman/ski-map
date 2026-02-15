/**
 * RideListPanel - Ride list for MY RIDES section in the sidebar
 *
 * Features:
 * - Uses useRuns() hook to get rides
 * - Loading state with spinner
 * - If no rides: shows RideUploadDropzone
 * - If has rides: shows list of RideListItem
 * - Max height with overflow scroll
 */

import { useParams } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useRuns } from '@/hooks/useRuns'
import { RideUploadDropzone } from './RideUploadDropzone'
import { RideListItem } from './RideListItem'

export function RideListPanel() {
  const { runs, isLoading, error } = useRuns()

  // Get selected ride from URL params if on a ride route
  // This safely handles when we're not on a ride route
  let selectedRideId: string | undefined
  try {
    const params = useParams({ strict: false })
    selectedRideId = (params as { rideId?: string }).rideId
  } catch {
    // Not on a route with rideId param
    selectedRideId = undefined
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 text-white/40">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">Loading rides...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 text-center text-sm text-red-400">
        Failed to load rides
      </div>
    )
  }

  // Empty state - show dropzone
  if (runs.length === 0) {
    return (
      <div className="p-3">
        <RideUploadDropzone compact />
      </div>
    )
  }

  // Has rides - show list
  return (
    <div className="max-h-64 overflow-y-auto">
      {runs.map((run) => (
        <RideListItem
          key={run.id}
          ride={run}
          isSelected={run.id === selectedRideId}
        />
      ))}
    </div>
  )
}
