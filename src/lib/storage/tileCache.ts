/**
 * Tile cache for Mapbox terrain-rgb and satellite tiles
 *
 * Stores tile images as Blobs in IndexedDB for offline access and
 * reduced API calls. Tiles have a 30-day TTL since terrain/satellite
 * data is relatively static.
 */

import { get, set, del, keys } from 'idb-keyval';

/** Cache entry with blob data and metadata */
interface TileCacheEntry {
  blob: Blob;
  timestamp: number;
  version: number;
}

/** Current cache version - increment to invalidate all tiles */
const CACHE_VERSION = 1;

/** TTL: 30 days in milliseconds */
const TILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Cache key prefixes */
const TERRAIN_PREFIX = 'tile-terrain:';
const SATELLITE_PREFIX = 'tile-satellite:';

/**
 * Generate a cache key for a tile
 */
function getTileKey(prefix: string, z: number, x: number, y: number): string {
  return `${prefix}${z}/${x}/${y}`;
}

/**
 * Check if a cache entry is still valid
 */
function isValid(entry: TileCacheEntry | undefined): entry is TileCacheEntry {
  if (!entry) return false;
  if (entry.version !== CACHE_VERSION) return false;
  const age = Date.now() - entry.timestamp;
  return age < TILE_TTL_MS;
}

/**
 * Get a cached terrain tile
 */
export async function getCachedTerrainTile(z: number, x: number, y: number): Promise<Blob | null> {
  try {
    const key = getTileKey(TERRAIN_PREFIX, z, x, y);
    const entry = await get<TileCacheEntry>(key);

    if (isValid(entry)) {
      return entry.blob;
    }

    return null;
  } catch (error) {
    console.warn('[TileCache] Error reading terrain tile:', error);
    return null;
  }
}

/**
 * Store a terrain tile in cache
 */
export async function setCachedTerrainTile(
  z: number,
  x: number,
  y: number,
  blob: Blob
): Promise<void> {
  try {
    const key = getTileKey(TERRAIN_PREFIX, z, x, y);
    const entry: TileCacheEntry = {
      blob,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    await set(key, entry);
  } catch (error) {
    console.warn('[TileCache] Error storing terrain tile:', error);
  }
}

/**
 * Get a cached satellite tile
 */
export async function getCachedSatelliteTile(
  z: number,
  x: number,
  y: number
): Promise<Blob | null> {
  try {
    const key = getTileKey(SATELLITE_PREFIX, z, x, y);
    const entry = await get<TileCacheEntry>(key);

    if (isValid(entry)) {
      return entry.blob;
    }

    return null;
  } catch (error) {
    console.warn('[TileCache] Error reading satellite tile:', error);
    return null;
  }
}

/**
 * Store a satellite tile in cache
 */
export async function setCachedSatelliteTile(
  z: number,
  x: number,
  y: number,
  blob: Blob
): Promise<void> {
  try {
    const key = getTileKey(SATELLITE_PREFIX, z, x, y);
    const entry: TileCacheEntry = {
      blob,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    await set(key, entry);
  } catch (error) {
    console.warn('[TileCache] Error storing satellite tile:', error);
  }
}

/**
 * Create an HTMLImageElement from a Blob
 */
export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image from blob'));
    };

    img.src = url;
  });
}

/**
 * Fetch an image and return as Blob
 */
export async function fetchImageAsBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return response.blob();
}

/**
 * Clear all tile caches
 */
export async function clearTileCache(): Promise<void> {
  try {
    const allKeys = await keys();
    const tileKeys = allKeys.filter(
      (key): key is string =>
        typeof key === 'string' &&
        (key.startsWith(TERRAIN_PREFIX) || key.startsWith(SATELLITE_PREFIX))
    );

    for (const key of tileKeys) {
      await del(key);
    }

    console.log(`[TileCache] Cleared ${tileKeys.length} tiles`);
  } catch (error) {
    console.warn('[TileCache] Error clearing cache:', error);
  }
}

/**
 * Get tile cache statistics
 */
export async function getTileCacheStats(): Promise<{
  terrainTiles: number;
  satelliteTiles: number;
  totalTiles: number;
}> {
  try {
    const allKeys = await keys();
    const terrainKeys = allKeys.filter(
      (key): key is string => typeof key === 'string' && key.startsWith(TERRAIN_PREFIX)
    );
    const satelliteKeys = allKeys.filter(
      (key): key is string => typeof key === 'string' && key.startsWith(SATELLITE_PREFIX)
    );

    return {
      terrainTiles: terrainKeys.length,
      satelliteTiles: satelliteKeys.length,
      totalTiles: terrainKeys.length + satelliteKeys.length,
    };
  } catch (error) {
    console.warn('[TileCache] Error getting stats:', error);
    return { terrainTiles: 0, satelliteTiles: 0, totalTiles: 0 };
  }
}
