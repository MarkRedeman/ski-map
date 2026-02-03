/**
 * Runs list page - shows all uploaded ski runs
 */

import { createFileRoute, Link } from '@tanstack/react-router'
import { Upload, SkipBack } from 'lucide-react'
import { useRuns, useSelectRun, useDeleteRun } from '@/hooks/useRuns'
import { RunCard } from '@/components/runs/RunCard'
import { useRunsStore } from '@/stores/useRunsStore'

export const Route = createFileRoute('/runs/')({
  component: RunsListPage,
})

function RunsListPage() {
  const { runs, isLoading, error } = useRuns()
  const selectedRunId = useRunsStore((s) => s.selectedRunId)
  const selectRun = useSelectRun()
  const deleteMutation = useDeleteRun()
  
  const handleSelect = (id: string) => {
    // Toggle selection
    if (selectedRunId === id) {
      selectRun(null)
    } else {
      selectRun(id)
    }
  }
  
  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }
  
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-lg text-sky-600">Loading runs...</div>
      </div>
    )
  }
  
  return (
    <div className="h-full overflow-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-sky-600 transition-colors"
            >
              <SkipBack className="h-4 w-4" />
              Back to Map
            </Link>
            <h1 className="text-2xl font-bold text-slate-800">My Runs</h1>
          </div>
          
          <Link
            to="/runs/upload"
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700"
          >
            <Upload className="h-4 w-4" />
            Upload GPX
          </Link>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
        
        {/* Runs list */}
        {runs.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <Upload className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h2 className="mb-2 text-lg font-medium text-slate-700">
              No runs yet
            </h2>
            <p className="mb-4 text-slate-500">
              Upload your first GPX file to see your ski runs on the map
            </p>
            <Link
              to="/runs/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700"
            >
              <Upload className="h-4 w-4" />
              Upload GPX File
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                isSelected={selectedRunId === run.id}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
        
        {/* Selected run action */}
        {selectedRunId && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 transform">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-full bg-sky-600 px-6 py-3 font-medium text-white shadow-lg transition-all hover:bg-sky-700 hover:shadow-xl"
            >
              View Selected Run on Map
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
