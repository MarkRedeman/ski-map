/**
 * TanStack Query persister using IndexedDB via idb-keyval
 *
 * Persists query cache to IndexedDB for offline access and reduced API calls.
 * Only Overpass API queries are persisted (terrain tiles handled separately).
 */

import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const STORAGE_KEY = 'ski-map-query-cache';

/**
 * Creates an async persister that stores TanStack Query cache in IndexedDB
 */
export function createIndexedDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(STORAGE_KEY, client);
      } catch (error) {
        console.warn('[QueryPersister] Failed to persist client:', error);
      }
    },

    restoreClient: async () => {
      try {
        const client = await get<PersistedClient>(STORAGE_KEY);
        return client ?? undefined;
      } catch (error) {
        console.warn('[QueryPersister] Failed to restore client:', error);
        return undefined;
      }
    },

    removeClient: async () => {
      try {
        await del(STORAGE_KEY);
      } catch (error) {
        console.warn('[QueryPersister] Failed to remove client:', error);
      }
    },
  };
}

/** Pre-configured persister instance */
export const indexedDBPersister = createIndexedDBPersister();
