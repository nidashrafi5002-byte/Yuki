import React, { useEffect, useState } from 'react';
import { MapView } from './MapView';
import { Shield, PhoneCall, Battery, Clock, MapPin, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { LocationPoint } from '../types';
import { apiRequest } from '../utils/api';

interface PublicTrackingViewProps {
  token: string;
  onBackToApp?: () => void;
}

export const PublicTrackingView: React.FC<PublicTrackingViewProps> = ({ token, onBackToApp }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchTracking = async () => {
    try {
      const json = await apiRequest(`/api/track/${token}`);
      setData(json);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load tracking data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(() => {
      fetchTracking();
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center p-4">
          <div className="spinner-border text-danger mb-3" style={{ width: '3rem', height: '3rem' }} role="status" />
          <h5 className="fw-bold">Connecting to Yuki Live Satellite Feed...</h5>
          <p className="text-muted small">Retrieving real-time encrypted coordinates</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
        <div className="card border-0 shadow rounded-4 p-4 text-center max-w-md w-100">
          <AlertCircle size={48} className="text-danger mx-auto mb-3" />
          <h4 className="fw-bold text-danger">Tracking Link Unavailable</h4>
          <p className="text-muted small mb-4">
            {error || 'This live tracking session has ended or has expired.'}
          </p>
          {onBackToApp && (
            <button className="btn btn-outline-danger" onClick={onBackToApp}>
              Return to Yuki
            </button>
          )}
        </div>
      </div>
    );
  }

  const { session, user, breadcrumbs } = data;
  const isEmergency = session.status === 'ACTIVE' || session.status === 'DURESS';

  const currentLocation = session.lastLatitude && session.lastLongitude
    ? {
        latitude: session.lastLatitude,
        longitude: session.lastLongitude,
        accuracy: session.lastAccuracy || 15
      }
    : breadcrumbs.length > 0
    ? {
        latitude: breadcrumbs[breadcrumbs.length - 1].latitude,
        longitude: breadcrumbs[breadcrumbs.length - 1].longitude,
        accuracy: breadcrumbs[breadcrumbs.length - 1].accuracy || 15
      }
    : null;

  return (
    <div className="min-vh-100 bg-light pb-5">
      {/* Top Banner */}
      <div className={`${isEmergency ? 'bg-danger' : 'bg-success'} text-white py-3 px-4 shadow`}>
        <div className="container max-w-5xl d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <Shield size={28} />
            <div>
              <h5 className="fw-bold mb-0">Yuki &bull; Live Emergency Tracking</h5>
              <p className="small text-white-70 mb-0">
                Authorized Emergency Contact View &bull; Live Feed
              </p>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-white text-dark py-2 px-3 fw-bold">
              Status: {session.status === 'ACTIVE' ? '🚨 SOS ACTIVE' : session.status === 'RESOLVED' ? '✅ SAFE / RESOLVED' : session.status}
            </span>
            <button
              className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
              onClick={fetchTracking}
              title="Refresh GPS"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container max-w-5xl py-4">
        <div className="row g-4">
          {/* Main Map Column */}
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
              <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <MapPin className="text-danger" size={20} />
                  <span className="fw-bold">Real-Time Location &amp; Breadcrumb Trail</span>
                </div>
                <span className="text-muted small">
                  Last updated: {lastRefreshed.toLocaleTimeString()}
                </span>
              </div>
              <div className="card-body p-0">
                <MapView
                  currentLocation={currentLocation}
                  breadcrumbs={breadcrumbs}
                  height="420px"
                  zoom={16}
                />
              </div>
            </div>

            {/* Address & Coords Card */}
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
              <div className="row g-3">
                <div className="col-md-7">
                  <span className="text-muted small fw-semibold text-uppercase">Detected Address</span>
                  <p className="fw-medium mb-1">
                    {session.lastAddress || (currentLocation ? `Lat: ${currentLocation.latitude.toFixed(5)}, Lng: ${currentLocation.longitude.toFixed(5)}` : 'Waiting for GPS fix...')}
                  </p>
                  {currentLocation && (
                    <span className="badge bg-light text-secondary border">
                      GPS Accuracy: &plusmn;{Math.round(currentLocation.accuracy || 10)}m
                    </span>
                  )}
                </div>

                <div className="col-md-5 d-flex justify-content-md-end gap-3 align-items-center">
                  {session.batteryLevel !== null && session.batteryLevel !== undefined && (
                    <div className="text-center">
                      <div className="d-flex align-items-center gap-1 text-muted small justify-content-center">
                        <Battery size={16} className={session.batteryLevel < 20 ? 'text-danger' : 'text-success'} />
                        <span>Battery</span>
                      </div>
                      <span className="fw-bold fs-6">{Math.round(session.batteryLevel)}%</span>
                    </div>
                  )}

                  <div className="text-center">
                    <div className="d-flex align-items-center gap-1 text-muted small justify-content-center">
                      <Clock size={16} />
                      <span>Alert Time</span>
                    </div>
                    <span className="fw-bold fs-6">{new Date(session.startedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Action Sidebar */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
              <h6 className="fw-bold text-uppercase text-secondary small mb-3">Protected Person</h6>
              <div className="d-flex align-items-center gap-3 mb-4">
                <div className="rounded-circle bg-danger bg-opacity-10 text-danger p-3 fw-bold fs-4">
                  {user.name ? user.name.slice(0, 1) : 'U'}
                </div>
                <div>
                  <h5 className="fw-bold mb-0">{user.name}</h5>
                  <span className="text-muted small">Yuki Protected User</span>
                </div>
              </div>

              {user.medicalNotes && (
                <div className="alert alert-warning py-2 px-3 small rounded-3 mb-4">
                  <strong>Medical Information:</strong><br />
                  {user.medicalNotes}
                </div>
              )}

              <h6 className="fw-bold text-uppercase text-secondary small mb-2">Emergency Response</h6>
              <p className="text-muted small mb-3">
                If you suspect immediate danger, call official police emergency dispatch immediately with the coordinates shown on the map:
              </p>

              <div className="d-grid gap-2">
                <a
                  href="tel:112"
                  className="btn btn-danger py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm rounded-3"
                >
                  <PhoneCall size={18} />
                  Call Police Emergency (112)
                </a>

                <a
                  href="tel:1091"
                  className="btn btn-outline-danger py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 rounded-3"
                >
                  <PhoneCall size={18} />
                  Call Women Helpline (1091)
                </a>

                {user.phone && (
                  <a
                    href={`tel:${user.phone}`}
                    className="btn btn-light border py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-2 rounded-3"
                  >
                    <PhoneCall size={18} />
                    Call {user.name}
                  </a>
                )}
              </div>
            </div>

            {/* Safety Verification Badge */}
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
              <div className="d-flex align-items-center justify-content-center gap-2 text-success mb-1">
                <CheckCircle2 size={20} />
                <span className="fw-bold">Encrypted Emergency Session</span>
              </div>
              <small className="text-muted">
                Token-verified live tracking. Coordinates are transmitted securely over SSL.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
