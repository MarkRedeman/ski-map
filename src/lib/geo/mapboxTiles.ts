/**
 * Mapbox Terrain RGB tile utilities
 *
 * Fetches terrain tiles from Mapbox and decodes RGB values to elevation.
 * Uses the "slippy map" tile coordinate system (same as OpenStreetMap).
 * Includes caching via IndexedDB for offline access and reduced API calls.
 */

import {
  getCachedTerrainTile,
  setCachedTerrainTile,
  getCachedSatelliteTile,
  setCachedSatelliteTile,
  blobToImage,
  fetchImageAsBlob,
} from '../storage/tileCache';

/**
 * Convert longitude to tile X coordinate at a given zoom level
 */
export function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

/**
 * Convert latitude to tile Y coordinate at a given zoom level
 * Uses Mercator projection
 */
export function lat2tile(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

/**
 * Convert tile X coordinate back to longitude (west edge of tile)
 */
export function tile2lon(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

/**
 * Convert tile Y coordinate back to latitude (north edge of tile)
 */
export function tile2lat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

/**
 * Get all tiles that cover a bounding box at a given zoom level
 */
export function getTilesForBounds(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  zoom: number
): TileCoord[] {
  const tiles: TileCoord[] = [];

  const minTileX = lon2tile(minLon, zoom);
  const maxTileX = lon2tile(maxLon, zoom);
  // Note: tile Y increases southward, so min lat gives max tile Y
  const minTileY = lat2tile(maxLat, zoom);
  const maxTileY = lat2tile(minLat, zoom);

  for (let x = minTileX; x <= maxTileX; x++) {
    for (let y = minTileY; y <= maxTileY; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }

  return tiles;
}

/**
 * Generate Mapbox Terrain RGB tile URL
 */
export function getMapboxTerrainRGBUrl(
  x: number,
  y: number,
  z: number,
  accessToken: string
): string {
  return `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.png?access_token=${accessToken}`;
}

/**
 * Generate Mapbox Satellite tile URL
 */
export function getMapboxSatelliteUrl(
  x: number,
  y: number,
  z: number,
  accessToken: string
): string {
  return `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}@2x.jpg?access_token=${accessToken}`;
}

/**
 * Decode Mapbox Terrain RGB pixel to elevation in meters
 *
 * Formula: height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
 */
export function decodeTerrainRGB(r: number, g: number, b: number): number {
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

/**
 * Fetch a terrain tile and return its pixel data as ImageData
 * Uses IndexedDB cache for offline access and reduced API calls.
 *
 * Supports both main-thread (HTMLCanvasElement) and worker (OffscreenCanvas) contexts.
 */
export async function fetchTerrainTile(
  x: number,
  y: number,
  z: number,
  accessToken: string
): Promise<ImageData> {
  // Try cache first
  const cachedBlob = await getCachedTerrainTile(z, x, y);
  let blob: Blob;

  if (cachedBlob) {
    blob = cachedBlob;
  } else {
    // Fetch from network
    const url = getMapboxTerrainRGBUrl(x, y, z, accessToken);
    blob = await fetchImageAsBlob(url);

    // Store in cache
    await setCachedTerrainTile(z, x, y, blob);
  }

  // Use createImageBitmap + OffscreenCanvas (works in both main thread and workers)
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to get 2D context from OffscreenCanvas');
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Decode an entire ImageData to elevation values
 */
export function decodeTerrainImageData(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const elevations = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    elevations[i] = decodeTerrainRGB(r, g, b);
  }

  return elevations;
}

export interface ElevationGridData {
  elevations: Float32Array;
  width: number;
  height: number;
  bounds: {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
  };
}

/**
 * Build a unified elevation grid from multiple terrain tiles
 */
export async function buildElevationGridFromTiles(
  tiles: TileCoord[],
  accessToken: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<ElevationGridData> {
  if (tiles.length === 0) {
    throw new Error('No tiles provided');
  }

  const zoom = tiles[0]!.z;
  const tileSize = 256;

  // Calculate grid dimensions
  const minTileX = Math.min(...tiles.map((t) => t.x));
  const maxTileX = Math.max(...tiles.map((t) => t.x));
  const minTileY = Math.min(...tiles.map((t) => t.y));
  const maxTileY = Math.max(...tiles.map((t) => t.y));

  const numTilesX = maxTileX - minTileX + 1;
  const numTilesY = maxTileY - minTileY + 1;
  const width = numTilesX * tileSize;
  const height = numTilesY * tileSize;

  // Calculate geographic bounds
  const minLon = tile2lon(minTileX, zoom);
  const maxLon = tile2lon(maxTileX + 1, zoom);
  const maxLat = tile2lat(minTileY, zoom); // North edge
  const minLat = tile2lat(maxTileY + 1, zoom); // South edge

  const elevations = new Float32Array(width * height);

  // Fetch all tiles (with concurrency limit to avoid overwhelming the browser)
  let loaded = 0;
  const BATCH_SIZE = 4;

  for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
    const batch = tiles.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (tile) => {
        try {
          const imageData = await fetchTerrainTile(tile.x, tile.y, tile.z, accessToken);
          const tileElevations = decodeTerrainImageData(imageData);

          // Calculate offset in the combined grid
          const offsetX = (tile.x - minTileX) * tileSize;
          const offsetY = (tile.y - minTileY) * tileSize;

          // Copy tile data into combined grid
          for (let y = 0; y < tileSize; y++) {
            for (let x = 0; x < tileSize; x++) {
              const srcIdx = y * tileSize + x;
              const dstIdx = (offsetY + y) * width + (offsetX + x);
              elevations[dstIdx] = tileElevations[srcIdx]!;
            }
          }

          loaded++;
          onProgress?.(loaded, tiles.length);
        } catch (err) {
          console.warn(`Failed to fetch tile ${tile.z}/${tile.x}/${tile.y}:`, err);
          // Fill with 0 elevation for failed tiles
          loaded++;
          onProgress?.(loaded, tiles.length);
        }
      })
    );
  }

  return {
    elevations,
    width,
    height,
    bounds: { minLon, maxLon, minLat, maxLat },
  };
}

/**
 * Fetch satellite tiles and combine them into a single canvas/texture
 * Uses IndexedDB cache for offline access and reduced API calls.
 */
export async function buildSatelliteImageFromTiles(
  tiles: TileCoord[],
  accessToken: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<{
  canvas: HTMLCanvasElement;
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number };
}> {
  if (tiles.length === 0) {
    throw new Error('No tiles provided');
  }

  const zoom = tiles[0]!.z;
  const tileSize = 512; // @2x tiles are 512x512

  // Calculate grid dimensions
  const minTileX = Math.min(...tiles.map((t) => t.x));
  const maxTileX = Math.max(...tiles.map((t) => t.x));
  const minTileY = Math.min(...tiles.map((t) => t.y));
  const maxTileY = Math.max(...tiles.map((t) => t.y));

  const numTilesX = maxTileX - minTileX + 1;
  const numTilesY = maxTileY - minTileY + 1;
  const width = numTilesX * tileSize;
  const height = numTilesY * tileSize;

  // Calculate geographic bounds
  const minLon = tile2lon(minTileX, zoom);
  const maxLon = tile2lon(maxTileX + 1, zoom);
  const maxLat = tile2lat(minTileY, zoom); // North edge
  const minLat = tile2lat(maxTileY + 1, zoom); // South edge

  // Create combined canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  // Fetch all tiles
  let loaded = 0;
  const BATCH_SIZE = 4;

  for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
    const batch = tiles.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (tile) => {
        try {
          // Try cache first
          const cachedBlob = await getCachedSatelliteTile(tile.z, tile.x, tile.y);
          let img: HTMLImageElement;

          if (cachedBlob) {
            // Load from cache
            img = await blobToImage(cachedBlob);
          } else {
            // Fetch from network
            const url = getMapboxSatelliteUrl(tile.x, tile.y, tile.z, accessToken);
            const blob = await fetchImageAsBlob(url);

            // Store in cache
            await setCachedSatelliteTile(tile.z, tile.x, tile.y, blob);

            img = await blobToImage(blob);
          }

          // Calculate position in combined canvas
          const offsetX = (tile.x - minTileX) * tileSize;
          const offsetY = (tile.y - minTileY) * tileSize;

          ctx.drawImage(img, offsetX, offsetY, tileSize, tileSize);

          loaded++;
          onProgress?.(loaded, tiles.length);
        } catch (err) {
          console.warn(`Failed to fetch satellite tile ${tile.z}/${tile.x}/${tile.y}:`, err);
          // Fill with gray for failed tiles
          const offsetX = (tile.x - minTileX) * tileSize;
          const offsetY = (tile.y - minTileY) * tileSize;
          ctx.fillStyle = '#4a5568';
          ctx.fillRect(offsetX, offsetY, tileSize, tileSize);
          loaded++;
          onProgress?.(loaded, tiles.length);
        }
      })
    );
  }

  console.log(`[Satellite] Built ${width}x${height} image from ${tiles.length} tiles`);

  return {
    canvas,
    bounds: { minLon, maxLon, minLat, maxLat },
  };
}
