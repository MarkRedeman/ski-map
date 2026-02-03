/**
 * GPX upload page with drag-and-drop
 */

import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useCallback, useRef } from 'react'
import { Upload, FileCheck, AlertCircle, X, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUploadRun } from '@/hooks/useRuns'
import { RunCard } from '@/components/runs/RunCard'
import type { SkiRun } from '@/lib/garmin/types'

export const Route = createFileRoute('/runs/upload')({
  component: UploadPage,
})

function UploadPage() {
  const navigate = useNavigate()
  const uploadMutation = useUploadRun()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isDragging, setIsDragging] = useState(false)
  const [previewRun, setPreviewRun] = useState<SkiRun | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  
  // Handle file selection
  const handleFile = useCallback(
    async (file: File) => {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.gpx')) {
        setParseError('Please select a .gpx file')
        return
      }
      
      setParseError(null)
      
      try {
        // Parse but don't save yet - show preview
        const { parseGPXFile } = await import('@/lib/garmin/parser')
        const run = await parseGPXFile(file)
        setPreviewRun(run)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to parse GPX file'
        setParseError(message)
        setPreviewRun(null)
      }
    },
    []
  )
  
  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      
      const file = e.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )
  
  // Handle file input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )
  
  // Save the run
  const handleSave = async () => {
    if (!previewRun) return
    
    try {
      // The run is already parsed, we just need to add it to the store
      const addRun = (await import('@/stores/useRunsStore')).useRunsStore.getState().addRun
      await addRun(previewRun)
      navigate({ to: '/runs' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save run'
      setParseError(message)
    }
  }
  
  // Clear preview and start over
  const handleClear = () => {
    setPreviewRun(null)
    setParseError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  return (
    <div className="h-full overflow-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/runs"
            className="mb-2 flex items-center gap-1 text-sm text-slate-500 hover:text-sky-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Runs
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Upload GPX File</h1>
          <p className="text-slate-500">
            Import your ski run from Garmin, Strava, or any other GPX source
          </p>
        </div>
        
        {/* Upload area or preview */}
        {!previewRun ? (
          <>
            {/* Drag and drop area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all',
                isDragging
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-slate-300 bg-white hover:border-sky-400 hover:bg-slate-50'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx"
                onChange={handleInputChange}
                className="hidden"
              />
              
              <Upload
                className={cn(
                  'mx-auto mb-4 h-12 w-12 transition-colors',
                  isDragging ? 'text-sky-500' : 'text-slate-400'
                )}
              />
              
              <h2 className="mb-2 text-lg font-medium text-slate-700">
                {isDragging ? 'Drop your file here' : 'Drag and drop your GPX file'}
              </h2>
              <p className="text-slate-500">
                or click to browse your files
              </p>
            </div>
            
            {/* Error message */}
            {parseError && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Preview */}
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700">
              <FileCheck className="h-5 w-5" />
              <span>File parsed successfully! Review your run below.</span>
            </div>
            
            <RunCard run={previewRun} showPreview={true} />
            
            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleClear}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={uploadMutation.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
              >
                {uploadMutation.isPending ? (
                  <>Saving...</>
                ) : (
                  <>
                    <FileCheck className="h-4 w-4" />
                    Save Run
                  </>
                )}
              </button>
            </div>
            
            {/* Save error */}
            {parseError && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
