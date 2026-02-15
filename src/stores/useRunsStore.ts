/**
 * Zustand store for managing ski runs
 * Persists runs to IndexedDB using idb-keyval
 */

import { create } from 'zustand';
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';
import type { SkiRun, SkiRunSerialized } from '@/lib/garmin/types';
import { serializeRun, deserializeRun } from '@/lib/garmin/types';

const RUNS_KEY_PREFIX = 'ski_run_';

interface RunsState {
  // Data
  runs: SkiRun[];
  selectedRunId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadRuns: () => Promise<void>;
  addRun: (run: SkiRun) => Promise<void>;
  deleteRun: (id: string) => Promise<void>;
  selectRun: (id: string | null) => void;
  clearError: () => void;
}

export const useRunsStore = create<RunsState>((setState, getState) => ({
  runs: [],
  selectedRunId: null,
  isLoading: false,
  error: null,

  /**
   * Load all runs from IndexedDB
   */
  loadRuns: async () => {
    setState({ isLoading: true, error: null });

    try {
      const allKeys = await idbKeys();
      const runKeys = allKeys.filter(
        (key) => typeof key === 'string' && key.startsWith(RUNS_KEY_PREFIX)
      ) as string[];

      const runs: SkiRun[] = [];

      for (const key of runKeys) {
        try {
          const serialized = await idbGet<SkiRunSerialized>(key);
          if (serialized) {
            runs.push(deserializeRun(serialized));
          }
        } catch (err) {
          console.error(`Error loading run ${key}:`, err);
        }
      }

      // Sort by date, newest first
      runs.sort((a, b) => b.date.getTime() - a.date.getTime());

      setState({ runs, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load runs';
      setState({ error: message, isLoading: false });
      console.error('Error loading runs:', err);
    }
  },

  /**
   * Add a new run and persist to IndexedDB
   */
  addRun: async (run: SkiRun) => {
    const key = `${RUNS_KEY_PREFIX}${run.id}`;

    try {
      // Save to IndexedDB
      await idbSet(key, serializeRun(run));

      // Update state
      const currentRuns = getState().runs;
      const newRuns = [run, ...currentRuns].sort((a, b) => b.date.getTime() - a.date.getTime());
      setState({ runs: newRuns });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save run';
      setState({ error: message });
      console.error('Error saving run:', err);
      throw err;
    }
  },

  /**
   * Delete a run from state and IndexedDB
   */
  deleteRun: async (id: string) => {
    const key = `${RUNS_KEY_PREFIX}${id}`;

    try {
      // Remove from IndexedDB
      await idbDel(key);

      // Update state
      const currentRuns = getState().runs;
      const newRuns = currentRuns.filter((run) => run.id !== id);

      // Clear selection if deleted run was selected
      const selectedId = getState().selectedRunId;
      const newSelectedId = selectedId === id ? null : selectedId;

      setState({ runs: newRuns, selectedRunId: newSelectedId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete run';
      setState({ error: message });
      console.error('Error deleting run:', err);
      throw err;
    }
  },

  /**
   * Select a run by ID (or null to deselect)
   */
  selectRun: (id: string | null) => {
    setState({ selectedRunId: id });
  },

  /**
   * Clear the current error
   */
  clearError: () => {
    setState({ error: null });
  },
}));

/**
 * Selector for getting the currently selected run
 */
export const selectSelectedRun = (state: RunsState): SkiRun | null => {
  if (!state.selectedRunId) return null;
  return state.runs.find((run) => run.id === state.selectedRunId) ?? null;
};
