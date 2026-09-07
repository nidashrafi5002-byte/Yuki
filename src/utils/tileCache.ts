import L from 'leaflet';

export const TILE_CACHE_NAME = 'nirbhaya-map-tiles-v1';
export const STORAGE_KEY_LAST_LOCATION = 'nirbhaya_last_known_location';

export interface StoredLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  timestamp: number;
}

/**
 * Converts latitude and longitude at a given zoom level into standard Slippy tile coordinates (Web Mercator EPSG:3857).
 */
export function latLngToTileCoords(lat: number, lng: number, zoom: number): { x: number; y: number; z: number } {
  const clampedZoom = Math.floor(zoom);
  const n = Math.pow(2, clampedZoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: clampedZoom };
}

/**
 * Generates a CartoDB Dark Matter tile URL for a given tile coordinate.
 */
export function getCartoTileUrl(x: number, y: number, z: number, subdomain: string = 'a'): string {
  return `https://${subdomain}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`;
}

/**
 * Returns the open CacheStorage instance for map tiles, or null if unsupported.
 */
export async function getTileCache(): Promise<Cache | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    return await caches.open(TILE_CACHE_NAME);
  } catch (e) {
    console.warn('CacheStorage is not available or permission was denied:', e);
    return null;
  }
}

/**
 * Retrieves a tile blob URL from the local cache, or fetches from the network and caches it.
 * If the device is offline and the tile is uncached, it throws an error.
 */
export async function getCachedTileBlobUrl(url: string): Promise<string> {
  const cache = await getTileCache();
  
  if (cache) {
    try {
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        return URL.createObjectURL(blob);
      }
    } catch {
      // Fall through to network fetch
    }
  }

  // Network fetch if device is online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch map tile: HTTP ${response.status}`);
    }

    if (cache) {
      try {
        await cache.put(url, response.clone());
      } catch {
        // Cache quota exceeded or storage error; still return fetched blob
      }
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  throw new Error('Device is offline and requested map tile is not cached');
}

/**
 * Proactively pre-caches a grid of surrounding tiles (default 3x3 to 5x5) around the user's
 * current or last known location for multiple zoom levels.
 */
export async function preCacheSurroundingArea(
  lat: number,
  lng: number,
  zooms: number[] = [15, 16, 17],
  radius: number = 2
): Promise<{ total: number; newlyCached: number; cachedInTotal: number }> {
  const cache = await getTileCache();
  if (!cache) {
    return { total: 0, newlyCached: 0, cachedInTotal: 0 };
  }

  const subdomains = ['a', 'b', 'c', 'd'];
  let subIdx = 0;
  const urlsToCache: string[] = [];

  for (const z of zooms) {
    const center = latLngToTileCoords(lat, lng, z);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const sub = subdomains[subIdx % subdomains.length];
        subIdx++;
        const tileX = center.x + dx;
        const tileY = center.y + dy;
        urlsToCache.push(getCartoTileUrl(tileX, tileY, z, sub));
      }
    }
  }

  let newlyCached = 0;
  const batchSize = 6;

  for (let i = 0; i < urlsToCache.length; i += batchSize) {
    const batch = urlsToCache.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const existing = await cache.match(url);
          if (!existing) {
            const res = await fetch(url, { mode: 'cors' });
            if (res.ok) {
              await cache.put(url, res);
              newlyCached++;
            }
          }
        } catch {
          // Gracefully continue caching remaining tiles
        }
      })
    );
  }

  const cachedInTotal = await getCachedTilesCount();
  return { total: urlsToCache.length, newlyCached, cachedInTotal };
}

/**
 * Returns the total number of cached map tiles currently stored locally.
 */
export async function getCachedTilesCount(): Promise<number> {
  const cache = await getTileCache();
  if (!cache) return 0;
  try {
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Clears the offline map tile cache.
 */
export async function clearTileCache(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    return await caches.delete(TILE_CACHE_NAME);
  } catch {
    return false;
  }
}

/**
 * Persists the user's last known location and timestamp into local storage.
 */
export function saveLastKnownLocation(loc: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  try {
    const data: StoredLocation = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      address: loc.address || undefined,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_LAST_LOCATION, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save last known location to localStorage:', e);
  }
}

/**
 * Retrieves the user's last known location and timestamp from local storage.
 */
export function getLastKnownLocation(): StoredLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_LOCATION);
    if (!raw) return null;
    return JSON.parse(raw) as StoredLocation;
  } catch {
    return null;
  }
}

/**
 * Custom Leaflet TileLayer subclass that automatically resolves tiles from CacheStorage
 * when offline and populates the cache when online.
 */
export class OfflineCachedTileLayer extends L.TileLayer {
  private activeObjectUrls: Set<string> = new Set();

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    tile.alt = 'Map Tile';
    tile.setAttribute('role', 'presentation');

    const url = this.getTileUrl(coords);

    getCachedTileBlobUrl(url)
      .then((blobUrl) => {
        this.activeObjectUrls.add(blobUrl);
        tile.src = blobUrl;
        done(undefined, tile);
      })
      .catch((err) => {
        // If offline and not in cache, or if blob extraction fails
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          tile.src = url;
          L.DomEvent.on(tile, 'load', () => done(undefined, tile));
          L.DomEvent.on(tile, 'error', (e) => done(e as any, tile));
        } else {
          // Provide a subtle dark placeholder tile for offline missing areas
          done(err, tile);
        }
      });

    return tile;
  }

  onRemove(map: L.Map): this {
    // Revoke object URLs to avoid memory leaks
    this.activeObjectUrls.forEach((blobUrl) => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // Ignored
      }
    });
    this.activeObjectUrls.clear();
    return super.onRemove(map);
  }
}
