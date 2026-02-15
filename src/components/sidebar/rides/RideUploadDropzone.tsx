/**
 * RideUploadDropzone - Compact drag-and-drop zone for GPX file uploads
 *
 * Features:
 * - Drag-and-drop with visual feedback
 * - Click to open file picker
 * - Accepts .gpx files only
 * - Supports multiple files at once
 * - Shows upload/parsing progress
 * - Error handling with inline error message
 */

import { useState, useCallback, useRef } from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseGPXFile } from '@/lib/garmin/parser';
import { useRunsStore } from '@/stores/useRunsStore';

interface RideUploadDropzoneProps {
  /** Called after all files are successfully parsed and added */
  onComplete?: () => void;
  /** Compact mode for use in smaller spaces */
  compact?: boolean;
}

export function RideUploadDropzone({ onComplete, compact = false }: RideUploadDropzoneProps) {
  const addRun = useRunsStore((s) => s.addRun);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Handle multiple files
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // Filter for GPX files only
      const gpxFiles = fileArray.filter((file) => file.name.toLowerCase().endsWith('.gpx'));

      if (gpxFiles.length === 0) {
        setError('Please select .gpx files only');
        return;
      }

      setError(null);
      setIsParsing(true);
      setParseProgress({ current: 0, total: gpxFiles.length });

      const errors: string[] = [];

      for (let i = 0; i < gpxFiles.length; i++) {
        const file = gpxFiles[i]!;
        setParseProgress({ current: i + 1, total: gpxFiles.length });

        try {
          const run = await parseGPXFile(file);
          await addRun(run);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to parse file';
          errors.push(`${file.name}: ${message}`);
        }
      }

      setIsParsing(false);
      setParseProgress(null);

      if (errors.length > 0) {
        setError(errors.length === 1 ? errors[0]! : `${errors.length} files failed to parse`);
      } else {
        onComplete?.();
      }

      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [addRun, onComplete]
  );

  // Drag event handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  // Click to open file picker
  const handleClick = () => {
    if (!isParsing) {
      fileInputRef.current?.click();
    }
  };

  // File input change handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          'cursor-pointer rounded-lg border-2 border-dashed transition-all',
          compact ? 'p-4' : 'p-6',
          isDragging
            ? 'border-amber-400 bg-amber-400/10'
            : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10',
          isParsing && 'pointer-events-none opacity-70'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center text-center">
          {isParsing ? (
            <>
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-amber-400" />
              <p className="text-sm font-medium text-white/80">
                {parseProgress && parseProgress.total > 1
                  ? `Parsing ${parseProgress.current} of ${parseProgress.total} files...`
                  : 'Parsing...'}
              </p>
            </>
          ) : (
            <>
              <FolderOpen
                className={cn(
                  'mb-2 h-8 w-8 transition-transform',
                  isDragging ? 'scale-110 text-amber-400' : 'text-white/50'
                )}
              />
              <p className="text-sm font-medium text-white/80">Drag & drop GPX files here</p>
              <p className="mt-1 text-xs text-white/40">or click to browse</p>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 rounded bg-red-500/20 px-3 py-2 text-xs text-red-300">{error}</div>
      )}
    </div>
  );
}
