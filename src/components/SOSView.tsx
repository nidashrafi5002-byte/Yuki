import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  PhoneCall,
  Volume2,
  VolumeX,
  Volume1,
  EyeOff,
  Navigation,
  Battery,
  ShieldCheck,
  CheckCircle,
  Users,
  MapPin,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Wifi,
  WifiOff,
  HardDriveDownload,
  RotateCw,
  CloudCheck
} from 'lucide-react';
import { MapView } from './MapView';
import { User, TrustedContact, EmergencySession, LocationPoint } from '../types';
import { audioEngine } from '../utils/audio';
import {
  preCacheSurroundingArea,
  getCachedTilesCount,
  getLastKnownLocation,
  StoredLocation
} from '../utils/tileCache';

interface SOSViewProps {
  user: User;
  contacts: TrustedContact[];
  activeSession: EmergencySession | null;
  breadcrumbs: LocationPoint[];
  currentLocation: { latitude: number; longitude: number; accuracy?: number } | null;
  currentAddress: string | null;
  onInitiateSOS: (triggerType: 'ONE_TAP_SOS' | 'SILENT_ALARM') => void;
  onDisarmClick: () => void;
}

export const SOSView: React.FC<SOSViewProps> = ({
  user,
  contacts,
  activeSession,
  breadcrumbs,
  currentLocation,
  currentAddress,
  onInitiateSOS,
  onDisarmClick,
}) => {
  const [isSirenOn, setIsSirenOn] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isOfflineSimulated, setIsOfflineSimulated] = useState<boolean>(false);
  const [cachedTileCount, setCachedTileCount] = useState<number>(0);
  const [isCachingArea, setIsCachingArea] = useState<boolean>(false);
  const [cacheFeedback, setCacheFeedback] = useState<string | null>(null);
  const [lastKnownFix, setLastKnownFix] = useState<StoredLocation | null>(null);

  const isEmergencyActive = !!activeSession && (activeSession.status === 'ACTIVE' || activeSession.status === 'DURESS');
  const isEffectivelyOffline = isOfflineSimulated || !isOnline;

  // Monitor network connectivity & cached tile count
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    getCachedTilesCount().then((cnt) => setCachedTileCount(cnt));
    setLastKnownFix(getLastKnownLocation());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update last known fix when currentLocation arrives
  useEffect(() => {
    if (currentLocation) {
      setLastKnownFix(getLastKnownLocation());
    }
  }, [currentLocation]);

  // Monitor device battery if Battery Status API is accessible
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {
        // Battery API permission blocked or unsupported
      });
    }
  }, []);

  const toggleSiren = () => {
    if (isSirenOn) {
      audioEngine.stopSiren();
      setIsSirenOn(false);
    } else {
      const ok = audioEngine.playSiren();
      if (ok) setIsSirenOn(true);
    }
  };

  const handlePrecacheArea = async () => {
    const lat = currentLocation?.latitude || lastKnownFix?.latitude || 28.6139;
    const lng = currentLocation?.longitude || lastKnownFix?.longitude || 77.2090;

    setIsCachingArea(true);
    setCacheFeedback('Caching surrounding map area...');
    try {
      const res = await preCacheSurroundingArea(lat, lng, [15, 16, 17], 2);
      setCachedTileCount(res.cachedInTotal);
      setCacheFeedback(`Cached ${res.newlyCached} surrounding tiles! Total stored: ${res.cachedInTotal}`);
      setTimeout(() => setCacheFeedback(null), 4000);
    } catch {
      setCacheFeedback('Failed to cache tiles. Verify network connection.');
      setTimeout(() => setCacheFeedback(null), 3000);
    } finally {
      setIsCachingArea(false);
    }
  };

  const verifiedContacts = contacts.filter(c => c.isVerified);

  return (
    <div className="container-fluid max-w-7xl py-4 px-3">
      {/* Top Banner if no contacts verified */}
      {verifiedContacts.length === 0 && (
        <div
          className="border shadow-sm rounded-4 p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24' }}
        >
          <div className="d-flex align-items-center gap-2">
            <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
            <div>
              <strong className="text-white">Action Needed: Add Trusted Contacts</strong>
              <div className="small" style={{ color: '#d1d5db' }}>You have no verified emergency contacts. Alerts will only be recorded locally.</div>
            </div>
          </div>
          <a
            href="#contacts"
            className="btn btn-sm fw-bold rounded-3"
            style={{ backgroundColor: '#f59e0b', color: '#020617' }}
          >
            Add Contacts Now
          </a>
        </div>
      )}

      <div className="row g-4">
        {/* Left Column: Big SOS Button & Trigger Options */}
        <div className="col-lg-6">
          <div
            className="card border rounded-4 p-4 p-md-5 text-center h-100 d-flex flex-column justify-content-between shadow-xl"
            style={{
              backgroundColor: '#0f172a',
              borderColor: '#1e293b',
              background: 'radial-gradient(circle at center, rgba(225, 29, 72, 0.08) 0%, #0f172a 75%)'
            }}
          >
            <div>
              <div
                className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-full mb-3"
                style={{
                  backgroundColor: isEmergencyActive ? 'rgba(225, 29, 72, 0.2)' : 'rgba(225, 29, 72, 0.1)',
                  border: '1px solid rgba(225, 29, 72, 0.3)'
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f43f5e', animation: 'pulse 1s infinite' }}></div>
                <span className="text-uppercase fw-bold" style={{ fontSize: '11px', color: '#fb7185', letterSpacing: '0.5px' }}>
                  {isEmergencyActive ? '🚨 Emergency Status: ACTIVE' : '⚡ 24/7 Rapid Emergency Response'}
                </span>
              </div>

              <h2 className="fw-black text-white tracking-tight mb-2">
                {isEmergencyActive ? 'Emergency Alert In Progress' : 'Emergency Assistance'}
              </h2>
              <p className="small mb-4 mx-auto" style={{ maxWidth: '420px', color: '#94a3b8' }}>
                {isEmergencyActive
                  ? 'Your live GPS location is being streamed to your emergency contacts. Press Disarm below when you are safe.'
                  : 'Press the SOS button below in danger. A 3-second safeguard countdown allows aborting accidental taps.'}
              </p>
            </div>

            {/* Giant Stress-Tested SOS Trigger Button with Sophisticated Glow */}
            <div className="my-4 py-2 position-relative d-flex justify-content-center align-items-center">
              {/* Outer Ambient Glow */}
              <div
                className="position-absolute rounded-circle"
                style={{
                  width: '280px',
                  height: '280px',
                  backgroundColor: 'rgba(225, 29, 72, 0.18)',
                  filter: 'blur(60px)',
                  zIndex: 0
                }}
              />

              {/* Pulsing Outer Ping Ring */}
              <div
                className="position-absolute rounded-circle"
                style={{
                  width: '260px',
                  height: '260px',
                  backgroundColor: 'rgba(225, 29, 72, 0.12)',
                  animation: 'ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                  zIndex: 1
                }}
              />

              {/* Base Button Outer Rim */}
              <button
                type="button"
                className="rounded-circle d-flex flex-column align-items-center justify-content-center text-white transition-all position-relative"
                style={{
                  width: '230px',
                  height: '230px',
                  backgroundColor: '#020617',
                  border: '8px solid #1e293b',
                  cursor: 'pointer',
                  zIndex: 2,
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
                  transform: 'scale(1)',
                  outline: 'none'
                }}
                onClick={() => {
                  if (isEmergencyActive) {
                    onDisarmClick();
                  } else {
                    onInitiateSOS('ONE_TAP_SOS');
                  }
                }}
              >
                {/* Inner Dashed Ring */}
                <div
                  className="position-absolute rounded-circle pointer-events-none"
                  style={{
                    inset: '8px',
                    border: '2px dashed rgba(244, 63, 94, 0.35)',
                    borderRadius: '50%'
                  }}
                />

                {/* Core Glowing SOS Sphere */}
                <div
                  className="rounded-circle d-flex flex-column align-items-center justify-content-center text-white transition-all"
                  style={{
                    width: '176px',
                    height: '176px',
                    backgroundColor: '#e11d48',
                    boxShadow: '0 0 45px rgba(225, 29, 72, 0.55)'
                  }}
                >
                  <AlertOctagon size={46} className="mb-0.5 text-white" />
                  <span className="fw-black tracking-wider text-uppercase font-monospace" style={{ fontSize: '32px', lineHeight: 1 }}>
                    {isEmergencyActive ? 'DISARM' : 'SOS'}
                  </span>
                  <span className="fw-bold uppercase tracking-widest mt-1" style={{ fontSize: '10px', color: '#ffe4e6', letterSpacing: '1px' }}>
                    {isEmergencyActive ? 'ENTER PIN' : 'HOLD / TAP'}
                  </span>
                </div>
              </button>
            </div>

            {/* Status note */}
            <div className="text-center mb-2">
              <p className="small mb-1" style={{ color: '#94a3b8' }}>Press to alert emergency contacts immediately</p>
              <p className="fw-bold text-uppercase tracking-wider mb-0" style={{ fontSize: '11px', color: '#fb7185' }}>
                Live GPS Location Sharing Active
              </p>
            </div>

            {/* Secondary Trigger Controls: Silent Alert & Siren */}
            <div className="d-flex flex-wrap justify-content-center gap-2.5 mt-3">
              {!isEmergencyActive ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm py-2 px-3 rounded-3 d-flex align-items-center gap-2 font-medium"
                    style={{ backgroundColor: '#020617', borderColor: '#334155', color: '#cbd5e1' }}
                    onClick={() => onInitiateSOS('SILENT_ALARM')}
                    title="Discreet alert with no sounds or flashing screen"
                  >
                    <EyeOff size={16} className="text-slate-400" />
                    <span>Silent SOS (Covert)</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm py-2 px-3 rounded-3 d-flex align-items-center gap-2 fw-semibold"
                    style={{
                      backgroundColor: isSirenOn ? '#e11d48' : '#020617',
                      borderColor: isSirenOn ? '#f43f5e' : '#334155',
                      color: isSirenOn ? '#ffffff' : '#cbd5e1'
                    }}
                    onClick={toggleSiren}
                  >
                    {isSirenOn ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    <span>{isSirenOn ? 'Stop Audible Alarm' : 'Sound Audible Siren'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm fw-bold py-2.5 px-4 rounded-3 d-flex align-items-center gap-2 shadow-sm"
                  style={{ backgroundColor: '#020617', borderColor: '#f43f5e', color: '#fb7185' }}
                  onClick={onDisarmClick}
                >
                  <ShieldCheck size={18} />
                  <span>I Am Safe Now (Cancel Emergency)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live GPS Map & Fast Emergency Dials */}
        <div className="col-lg-6">
          {/* Quick Dial Helplines Bar */}
          <div
            className="card border rounded-4 p-3.5 mb-4 shadow-lg"
            style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2.5">
              <span className="fw-bold text-uppercase small tracking-wider" style={{ color: '#94a3b8', fontSize: '11px' }}>
                Direct Emergency Helplines
              </span>
              <span
                className="badge rounded-pill text-uppercase"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '10px' }}
              >
                Verified
              </span>
            </div>
            <div className="row g-2">
              <div className="col-6 col-md-3">
                <a
                  href="tel:112"
                  className="btn w-100 py-2 rounded-3 d-flex flex-column align-items-center justify-content-center text-decoration-none transition-all"
                  style={{ backgroundColor: 'rgba(225, 29, 72, 0.1)', borderColor: 'rgba(225, 29, 72, 0.3)', color: '#fb7185' }}
                >
                  <span className="fw-bold fs-5 mb-0 font-monospace">112</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Police &bull; 24/7</span>
                </a>
              </div>

              <div className="col-6 col-md-3">
                <a
                  href="tel:1091"
                  className="btn w-100 py-2 rounded-3 d-flex flex-column align-items-center justify-content-center text-decoration-none transition-all"
                  style={{ backgroundColor: 'rgba(225, 29, 72, 0.1)', borderColor: 'rgba(225, 29, 72, 0.3)', color: '#fb7185' }}
                >
                  <span className="fw-bold fs-5 mb-0 font-monospace">1091</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Women Helpline</span>
                </a>
              </div>

              <div className="col-6 col-md-3">
                <a
                  href="tel:181"
                  className="btn w-100 py-2 rounded-3 d-flex flex-column align-items-center justify-content-center text-decoration-none transition-all"
                  style={{ backgroundColor: '#020617', borderColor: '#334155', color: '#e2e8f0' }}
                >
                  <span className="fw-bold fs-5 mb-0 font-monospace">181</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Domestic Support</span>
                </a>
              </div>

              <div className="col-6 col-md-3">
                <a
                  href="https://wa.me/917827170170?text=HELP%20EMERGENCY"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn w-100 py-2 rounded-3 d-flex flex-column align-items-center justify-content-center text-decoration-none transition-all"
                  style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }}
                >
                  <span className="fw-bold fs-6 mb-0">NCW WhatsApp</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>7827170170</span>
                </a>
              </div>
            </div>
          </div>

          {/* Real-time Map & Location Telemetry Card */}
          <div
            className="card border rounded-4 overflow-hidden shadow-lg"
            style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
          >
            <div
              className="card-header py-3 px-3.5 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2"
              style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
            >
              <div className="d-flex align-items-center gap-2">
                <MapPin className="text-rose-500" size={18} style={{ color: '#f43f5e' }} />
                <span className="fw-bold text-white small">Live GPS &amp; Safe Breadcrumb Trail</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                {isEffectivelyOffline ? (
                  <span
                    className="badge rounded-pill d-inline-flex align-items-center gap-1"
                    style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '10px' }}
                    title="Cellular connection offline or simulated. Using local cached tiles."
                  >
                    <WifiOff size={11} />
                    <span>Offline &bull; Tile Cache</span>
                  </span>
                ) : (
                  <span
                    className="badge rounded-pill d-inline-flex align-items-center gap-1"
                    style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '10px' }}
                  >
                    <Wifi size={11} />
                    <span>{cachedTileCount} Tiles Cached</span>
                  </span>
                )}

                {batteryLevel !== null && (
                  <div className="d-flex align-items-center gap-1 small" style={{ color: '#94a3b8' }} title="Device Battery">
                    <Battery size={15} style={{ color: batteryLevel < 20 ? '#f43f5e' : '#10b981' }} />
                    <span>{batteryLevel}%</span>
                  </div>
                )}
                {currentLocation?.accuracy && (
                  <span
                    className="badge rounded-pill small"
                    style={{ backgroundColor: '#020617', color: '#94a3b8', border: '1px solid #334155' }}
                  >
                    &plusmn;{Math.round(currentLocation.accuracy)}m
                  </span>
                )}
              </div>
            </div>

            {/* Offline Preparation & Simulation Controls */}
            <div
              className="px-3.5 py-2 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2"
              style={{ backgroundColor: '#020617', borderColor: '#1e293b' }}
            >
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm py-1 px-2.5 rounded-3 d-flex align-items-center gap-1.5 fw-semibold"
                  style={{
                    backgroundColor: isCachingArea ? '#0f172a' : '#1e293b',
                    borderColor: '#334155',
                    color: '#e2e8f0',
                    fontSize: '11px',
                  }}
                  onClick={handlePrecacheArea}
                  disabled={isCachingArea || isEffectivelyOffline}
                  title="Download and cache map tiles for the surrounding 2-3km perimeter"
                >
                  <HardDriveDownload size={13} style={{ color: '#38bdf8' }} />
                  <span>{isCachingArea ? 'Caching Surrounding Area...' : 'Pre-cache Surrounding Area'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-sm py-1 px-2.5 rounded-3 d-flex align-items-center gap-1.5"
                  style={{
                    backgroundColor: isOfflineSimulated ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
                    borderColor: isOfflineSimulated ? '#f59e0b' : '#334155',
                    color: isOfflineSimulated ? '#fbbf24' : '#94a3b8',
                    fontSize: '11px',
                  }}
                  onClick={() => setIsOfflineSimulated(!isOfflineSimulated)}
                  title="Toggle offline simulation to test map visibility without cellular data"
                >
                  {isOfflineSimulated ? <WifiOff size={12} /> : <Wifi size={12} />}
                  <span>{isOfflineSimulated ? 'Simulating Cellular Loss (Active)' : 'Test Cellular Loss'}</span>
                </button>
              </div>

              {cacheFeedback && (
                <div
                  className="small text-truncate py-0.5 px-2 rounded"
                  style={{ backgroundColor: '#0f172a', color: '#38bdf8', fontSize: '11px', border: '1px solid #1e293b' }}
                >
                  {cacheFeedback}
                </div>
              )}
            </div>

            <div className="card-body p-0">
              <MapView
                currentLocation={currentLocation}
                breadcrumbs={breadcrumbs}
                height="310px"
                zoom={16}
                isOfflineSimulated={isOfflineSimulated}
                onCacheCountChange={(cnt) => setCachedTileCount(cnt)}
              />
            </div>

            <div
              className="card-footer border-0 py-3 px-3.5"
              style={{ backgroundColor: '#020617', borderTop: '1px solid #1e293b' }}
            >
              <div className="d-flex align-items-start gap-2.5">
                <Navigation
                  size={18}
                  className="mt-1 flex-shrink-0"
                  style={{ color: isEffectivelyOffline ? '#f59e0b' : '#f43f5e' }}
                />
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                    <span className="fw-semibold text-white small">
                      {isEffectivelyOffline ? 'Last Known Location (Offline Fix):' : 'Current GPS Location:'}
                    </span>
                    {isEffectivelyOffline ? (
                      <span
                        className="badge rounded-pill text-uppercase"
                        style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '9px' }}
                      >
                        Preserved in Local Cache
                      </span>
                    ) : (
                      <span
                        className="badge rounded-pill text-uppercase"
                        style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '9px' }}
                      >
                        Live Fix
                      </span>
                    )}
                  </div>
                  <p className="small mb-0" style={{ color: isEffectivelyOffline ? '#cbd5e1' : '#94a3b8' }}>
                    {currentAddress ||
                      (currentLocation
                        ? `Lat ${currentLocation.latitude.toFixed(5)}, Lng ${currentLocation.longitude.toFixed(5)}`
                        : lastKnownFix
                        ? `Lat ${lastKnownFix.latitude.toFixed(5)}, Lng ${lastKnownFix.longitude.toFixed(5)} (Stored ${new Date(lastKnownFix.timestamp).toLocaleTimeString()})`
                        : 'Acquiring GPS fix...')}
                  </p>
                  {isEffectivelyOffline && (
                    <span style={{ fontSize: '11px', color: '#f59e0b' }}>
                      Surrounding streets and emergency breadcrumb trail remain visible from locally cached tiles.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
