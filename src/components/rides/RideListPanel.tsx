/**
 * RideListPanel - Main panel for YOUR RIDES section in the sidebar
 *
 * Features:
 * - Uses useRuns() hook to get rides
 * - Loading state with spinner
 * - If no rides: shows RideUploadDropzone
 * - If has rides: shows list of RideListItem + Add button
 * - Max height with overflow scroll
 */

import { useRef, useCallback } from 'react'
import { useParams } from '@tanstack/react-router'
import { Loader2, Plus } from 'lucide-react'
import { useRuns } from '@/hooks/useRuns'
import { RideUploadDropzone } from './RideUploadDropzone'
import { RideListItem } from './RideListItem'

export function RideListPanel() {
  const { runs, isLoading, error } = useRuns()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      // Import dynamically to avoid circular deps
      const { parseGPXFile } = await import('@/lib/garmin/parser')
      const { useRunsStore } = await import('@/stores/useRunsStore')
      const addRun = useRunsStore.getState().addRun

      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith('.gpx')) {
          try {
            const run = await parseGPXFile(file)
            await addRun(run)
          } catch (err) {
            console.error('Failed to parse file:', file.name, err)
          }
        }
      }

      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    []
  )

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

  // Has rides - show list with add button
  return (
    <div className="flex flex-col">
      {/* Hidden file input for Add button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Ride list with max height and scroll */}
      <div className="max-h-64 overflow-y-auto">
        {runs.map((run) => (
          <RideListItem
            key={run.id}
            ride={run}
            isSelected={run.id === selectedRideId}
          />
        ))}
      </div>

      {/* Add ride button */}
      <div className="border-t border-white/10 p-2">
        <button
          onClick={handleAddClick}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Add ride
        </button>
      </div>
    </div>
  )
}
