import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Wifi, WifiOff, HardDriveDownload, Check, AlertCircle } from 'lucide-react';
import { LocationPoint } from '../types';
import {
  OfflineCachedTileLayer,
  getLastKnownLocation,
  saveLastKnownLocation,
  getCachedTilesCount,
  preCacheSurroundingArea,
  StoredLocation
} from '../utils/tileCache';

interface MapViewProps {
  currentLocation: { latitude: number; longitude: number; accuracy?: number } | null;
  breadcrumbs?: LocationPoint[];
  height?: string;
  zoom?: number;
  interactive?: boolean;
  isOfflineSimulated?: boolean;
  onCacheCountChange?: (count: number) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  currentLocation,
  breadcrumbs = [],
  height = '320px',
  zoom = 15,
  interactive = true,
  isOfflineSimulated = false,
  onCacheCountChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<OfflineCachedTileLayer | null>(null);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cachedTileCount, setCachedTileCount] = useState<number>(0);
  const [isPreCaching, setIsPreCaching] = useState<boolean>(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [effectiveLocation, setEffectiveLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    isLastKnown: boolean;
    timestamp?: number;
  } | null>(null);

  const effectiveOffline = isOfflineSimulated || !isOnline;

  // Listen to browser online/offline events and check cache count
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    getCachedTilesCount().then((count) => {
      setCachedTileCount(count);
      if (onCacheCountChange) onCacheCountChange(count);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onCacheCountChange]);

  // Determine effective location (Live GPS or cached last known location)
  useEffect(() => {
    if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
      // Save valid location for offline retrieval
      saveLastKnownLocation({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: currentLocation.accuracy,
      });

      setEffectiveLocation({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: currentLocation.accuracy,
        isLastKnown: false,
        timestamp: Date.now(),
      });

      // Automatically pre-cache surrounding tiles if online and not currently caching
      if (!effectiveOffline) {
        preCacheSurroundingArea(currentLocation.latitude, currentLocation.longitude, [15, 16], 1)
          .then((res) => {
            setCachedTileCount(res.cachedInTotal);
            if (onCacheCountChange) onCacheCountChange(res.cachedInTotal);
          })
          .catch(() => {});
      }
    } else {
      // Fallback to persisted last known location if device has no live GPS fix
      const lastKnown = getLastKnownLocation();
      if (lastKnown) {
        setEffectiveLocation({
          latitude: lastKnown.latitude,
          longitude: lastKnown.longitude,
          accuracy: lastKnown.accuracy,
          isLastKnown: true,
          timestamp: lastKnown.timestamp,
        });
      } else {
        // Default coordinate fallback (New Delhi center)
        setEffectiveLocation({
          latitude: 28.6139,
          longitude: 77.2090,
          accuracy: 25,
          isLastKnown: true,
          timestamp: Date.now(),
        });
      }
    }
  }, [currentLocation, effectiveOffline, onCacheCountChange]);

  // Handle manual pre-cache request for surrounding area
  const handleManualPrecache = async () => {
    if (!effectiveLocation || isPreCaching) return;
    setIsPreCaching(true);
    setCacheNotice('Caching surrounding tiles...');

    try {
      const res = await preCacheSurroundingArea(
        effectiveLocation.latitude,
        effectiveLocation.longitude,
        [14, 15, 16],
        2
      );
      setCachedTileCount(res.cachedInTotal);
      if (onCacheCountChange) onCacheCountChange(res.cachedInTotal);
      setCacheNotice(`Cached ${res.newlyCached} new tiles (${res.cachedInTotal} stored offline)`);
      setTimeout(() => setCacheNotice(null), 4000);
    } catch {
      setCacheNotice('Offline or cache storage unavailable');
      setTimeout(() => setCacheNotice(null), 3000);
    } finally {
      setIsPreCaching(false);
    }
  };

  // Map Initialization & Updates
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initLat = effectiveLocation?.latitude || 28.6139;
      const initLng = effectiveLocation?.longitude || 77.2090;

      const map = L.map(mapContainerRef.current, {
        center: [initLat, initLng],
        zoom: zoom,
        zoomControl: interactive,
        dragging: interactive,
        touchZoom: interactive,
        scrollWheelZoom: false,
      });

      // CartoDB Dark Matter tiles cached via OfflineCachedTileLayer
      const tileLayer = new OfflineCachedTileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 20,
          subdomains: 'abcd',
        }
      ).addTo(map);

      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Render Location Marker
    if (effectiveLocation && effectiveLocation.latitude && effectiveLocation.longitude) {
      const latLng: [number, number] = [effectiveLocation.latitude, effectiveLocation.longitude];
      const isStale = effectiveLocation.isLastKnown || effectiveOffline;

      const markerHtml = isStale
        ? `
          <div style="position: relative; width: 26px; height: 26px;">
            <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background: rgba(245, 158, 11, 0.4); animation: pulse 2s infinite;"></div>
            <div style="position: absolute; top: 4px; left: 4px; width: 18px; height: 18px; border-radius: 50%; background: #f59e0b; border: 3px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.6);"></div>
          </div>
        `
        : `
          <div style="position: relative; width: 26px; height: 26px;">
            <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background: rgba(225, 29, 72, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; top: 4px; left: 4px; width: 18px; height: 18px; border-radius: 50%; background: #e11d48; border: 3px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.6);"></div>
          </div>
        `;

      const userIcon = L.divIcon({
        className: 'custom-map-pin',
        html: markerHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const timeString = effectiveLocation.timestamp
        ? new Date(effectiveLocation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'Recently';

      const popupContent = isStale
        ? `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a;">
            <strong style="color: #d97706;">Last Known Location (Offline)</strong><br/>
            <span>Recorded at: ${timeString}</span><br/>
            <span style="color: #64748b; font-size: 11px;">Tiles served from local storage cache</span>
           </div>`
        : `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a;">
            <strong style="color: #e11d48;">Live GPS Position</strong><br/>
            <span>Active Real-Time Tracking</span><br/>
            <span style="color: #10b981; font-size: 11px;">Tiles auto-cached for offline safety</span>
           </div>`;

      if (!markerRef.current) {
        markerRef.current = L.marker(latLng, { icon: userIcon }).addTo(map);
        markerRef.current.bindPopup(popupContent);
      } else {
        markerRef.current.setLatLng(latLng);
        markerRef.current.setIcon(userIcon);
        markerRef.current.setPopupContent(popupContent);
      }

      // Accuracy Circle
      if (effectiveLocation.accuracy) {
        const radius = Math.min(effectiveLocation.accuracy, 200);
        const circleColor = isStale ? '#f59e0b' : '#e11d48';
        const circleFill = isStale ? '#f59e0b' : '#f43f5e';

        if (!circleRef.current) {
          circleRef.current = L.circle(latLng, {
            radius,
            color: circleColor,
            fillColor: circleFill,
            fillOpacity: 0.12,
            weight: 1,
          }).addTo(map);
        } else {
          circleRef.current.setLatLng(latLng);
          circleRef.current.setRadius(radius);
          circleRef.current.setStyle({ color: circleColor, fillColor: circleFill });
        }
      }

      map.panTo(latLng);
    }

    // Render Breadcrumb Path
    if (breadcrumbs.length > 1) {
      const latLngs: [number, number][] = breadcrumbs.map((b) => [b.latitude, b.longitude]);
      if (!polylineRef.current) {
        polylineRef.current = L.polyline(latLngs, {
          color: '#e11d48',
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 8',
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(latLngs);
      }
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [effectiveLocation, breadcrumbs, zoom, interactive, effectiveOffline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-100 rounded-3 overflow-hidden position-relative" style={{ height, backgroundColor: '#020617' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Top Floating Status Overlay: Connectivity & Tile Cache */}
      <div
        className="position-absolute top-0 start-0 m-2.5 d-flex flex-column gap-1 z-3 pointer-events-none"
        style={{ maxWidth: '90%' }}
      >
        <div className="d-flex align-items-center gap-1.5 flex-wrap">
          {effectiveOffline ? (
            <div
              className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill pointer-events-auto shadow-md"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.92)',
                color: '#020617',
                fontSize: '11px',
                fontWeight: 700,
                backdropFilter: 'blur(8px)',
              }}
              title="Cellular connectivity unavailable. Showing cached map tiles and last known position."
            >
              <WifiOff size={13} />
              <span>OFFLINE &bull; Cached Area Loaded</span>
            </div>
          ) : (
            <div
              className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill pointer-events-auto shadow-md"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.88)',
                color: '#cbd5e1',
                border: '1px solid #334155',
                fontSize: '11px',
                fontWeight: 600,
                backdropFilter: 'blur(8px)',
              }}
            >
              <Wifi size={13} style={{ color: '#10b981' }} />
              <span>Live GPS &bull; {cachedTileCount} tiles cached</span>
            </div>
          )}

          {/* Quick Pre-Cache Button */}
          {!effectiveOffline && (
            <button
              type="button"
              className="btn btn-sm py-0.5 px-2 rounded-pill d-flex align-items-center gap-1 pointer-events-auto shadow-sm"
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                borderColor: '#475569',
                color: '#e2e8f0',
                fontSize: '10px',
                fontWeight: 600,
                backdropFilter: 'blur(6px)',
              }}
              onClick={handleManualPrecache}
              disabled={isPreCaching}
              title="Cache tiles around current position to guarantee offline access"
            >
              <HardDriveDownload size={11} style={{ color: '#38bdf8' }} />
              <span>{isPreCaching ? 'Caching...' : 'Cache Area'}</span>
            </button>
          )}
        </div>

        {/* Temporary Notice Toast */}
        {cacheNotice && (
          <div
            className="px-2.5 py-1 rounded-2 shadow-sm d-inline-flex align-items-center gap-1"
            style={{
              backgroundColor: 'rgba(2, 6, 23, 0.95)',
              color: '#38bdf8',
              border: '1px solid #0284c7',
              fontSize: '11px',
              maxWidth: 'fit-content',
            }}
          >
            <Check size={12} />
            <span>{cacheNotice}</span>
          </div>
        )}
      </div>

      {/* Bottom Floating Cache Engine Badge */}
      <div
        className="position-absolute bottom-0 start-0 m-2 px-2.5 py-1 rounded-pill shadow-sm d-flex align-items-center gap-1.5 z-3"
        style={{
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          border: '1px solid #1e293b',
          fontSize: '10px',
          color: '#94a3b8',
          backdropFilter: 'blur(4px)',
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: effectiveOffline ? '#f59e0b' : '#10b981' }}></span>
        <span>{effectiveOffline ? 'Offline Tile Cache Active' : 'Offline Tile Cache Ready'}</span>
      </div>
    </div>
  );
};

