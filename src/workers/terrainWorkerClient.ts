/**
 * Shared terrain worker instance
 *
 * Both useTerrainData and useContourLines share the same worker
 * to avoid creating duplicate workers.
 */

import * as Comlink from 'comlink';
import type { TerrainWorkerApi } from '@/workers/terrain.worker';

let workerInstance: Comlink.Remote<TerrainWorkerApi> | null = null;

export function getTerrainWorker(): Comlink.Remote<TerrainWorkerApi> {
  if (!workerInstance) {
    const worker = new Worker(new URL('@/workers/terrain.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerInstance = Comlink.wrap<TerrainWorkerApi>(worker);
  }
  return workerInstance;
}
