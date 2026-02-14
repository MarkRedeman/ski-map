/**
 * RideListItem - Individual ride item for the sidebar list
 *
 * Features:
 * - Shows: ride name, date, duration, distance
 * - Click navigates to /rides/{ride.id}
 * - Delete button on hover with confirmation
 * - Selected and hover state styling
 */

import { useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, formatDistance } from '@/lib/garmin/parser'
import { useDeleteRun } from '@/hooks/useRuns'
import type { SkiRun } from '@/lib/garmin/types'

interface RideListItemProps {
  ride: SkiRun
  isSelected: boolean
}

/**
 * Format a date to a nice readable string
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function RideListItem({ ride, isSelected }: RideListItemProps) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteRun()

  const [isHovered, setIsHovered] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleClick = useCallback(() => {
    if (!showDeleteConfirm) {
      if (isSelected) {
        // Deselect by navigating back to root
        navigate({ to: '/' })
      } else {
        // Select the ride
        navigate({ to: '/rides/$rideId', params: { rideId: ride.id }, search: { t: 0 } })
      }
    }
  }, [navigate, ride.id, showDeleteConfirm, isSelected])

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }, [])

  const handleConfirmDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await deleteMutation.mutateAsync(ride.id)
      } catch {
        // Error handling is done in the mutation
      }
      setShowDeleteConfirm(false)
    },
    [deleteMutation, ride.id]
  )

  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(false)
  }, [])

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setShowDeleteConfirm(false)
      }}
      className={cn(
        'relative cursor-pointer border-b border-white/5 px-3 py-2 transition-colors',
        isSelected
          ? 'border-l-2 border-l-amber-400 bg-white/15'
          : isHovered
            ? 'bg-white/10'
            : 'hover:bg-white/10'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Left content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎿</span>
            <span className="truncate text-sm font-medium text-white">
              {ride.name}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-white/50">
            {formatDate(ride.date)} • {formatDuration(ride.duration)} •{' '}
            {formatDistance(ride.distance)}
          </div>
        </div>

        {/* Delete button / confirmation */}
        <div className="flex-shrink-0">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="rounded bg-red-500/80 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
              >
                {deleteMutation.isPending ? '...' : 'Delete'}
              </button>
              <button
                onClick={handleCancelDelete}
                className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70 transition-colors hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className={cn(
                'rounded p-1 text-white/30 transition-all hover:bg-white/10 hover:text-red-400',
                isHovered ? 'opacity-100' : 'opacity-0'
              )}
              title="Delete ride"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
