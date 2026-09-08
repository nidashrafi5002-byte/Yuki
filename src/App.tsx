import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { ActiveEmergencyBanner } from './components/ActiveEmergencyBanner';
import { EmergencySOSModal } from './components/EmergencySOSModal';
import { DisarmModal } from './components/DisarmModal';
import { SOSView } from './components/SOSView';
import { ContactsView } from './components/ContactsView';
import { AISafetyAdvisorView } from './components/AISafetyAdvisorView';
import { HelplinesView } from './components/HelplinesView';
import { IncidentsView } from './components/IncidentsView';
import { WalkWithMeView } from './components/WalkWithMeView';
import { SettingsView } from './components/SettingsView';
import { AuthView } from './components/AuthView';
import { CamouflageCalculator } from './components/CamouflageCalculator';
import { PublicTrackingView } from './components/PublicTrackingView';
import { User, TrustedContact, EmergencySession, WalkWithMeTimer, IncidentReport, LocationPoint } from './types';
import { getLastKnownLocation, saveLastKnownLocation } from './utils/tileCache';
import { apiRequest, setAuthToken, getAuthToken } from './utils/api';

export function App() {
  // Public tracking route check (/track/:token)
  const [publicToken, setPublicToken] = useState<string | null>(() => {
    const path = window.location.pathname;
    const match = path.match(/\/track\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  });

  // App State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sos');
  const [isCamouflage, setIsCamouflage] = useState(false);

  // Emergency & Tracking State
  const [activeSession, setActiveSession] = useState<EmergencySession | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [walkTimer, setWalkTimer] = useState<WalkWithMeTimer | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<LocationPoint[]>([]);

  // Modals
  const [isSOSCountdownOpen, setIsSOSCountdownOpen] = useState(false);
  const [pendingTriggerType, setPendingTriggerType] = useState<'ONE_TAP_SOS' | 'SILENT_ALARM'>('ONE_TAP_SOS');
  const [isDisarmModalOpen, setIsDisarmModalOpen] = useState(false);

  // Device Location (Initialized with persisted last known location if device is offline)
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(() => {
    const last = getLastKnownLocation();
    return last ? { latitude: last.latitude, longitude: last.longitude, accuracy: last.accuracy } : null;
  });
  const [currentAddress, setCurrentAddress] = useState<string | null>(() => {
    const last = getLastKnownLocation();
    return last?.address || null;
  });
  const geoWatchIdRef = useRef<number | null>(null);

  // Secure Auth Token Helper (supports cookies + iframe Bearer tokens + multi-tier fallback)
  const getAuthHeaders = (): Record<string, string> => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch Current User
  const checkAuth = useCallback(async () => {
    try {
      const data = await apiRequest('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Fetch Dashboard Data
  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Active SOS
      try {
        const sosData = await apiRequest('/api/emergency/active');
        setActiveSession(sosData.session || null);
        if (sosData.breadcrumbs) {
          setBreadcrumbs(sosData.breadcrumbs);
        }
      } catch {}

      // 2. Contacts
      try {
        const contactsData = await apiRequest('/api/contacts');
        setContacts(contactsData.contacts || []);
      } catch {}

      // 3. Walk With Me
      try {
        const walkData = await apiRequest('/api/walk-with-me/status');
        setWalkTimer(walkData.timer || null);
      } catch {}

      // 4. Incidents
      try {
        const incData = await apiRequest('/api/incidents');
        setIncidents(incData.incidents || []);
      } catch {}
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  }, [user]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Seamless re-sync when Android reconnects or switches between Wi-Fi and Mobile Data
  useEffect(() => {
    const handleOnline = () => {
      checkAuth();
      if (user) {
        loadDashboardData();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [checkAuth, user, loadDashboardData]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 6000);
      return () => clearInterval(interval);
    }
  }, [user, loadDashboardData]);

  // Geolocation Continuous Tracking
  useEffect(() => {
    if ('geolocation' in navigator) {
      geoWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          setCurrentLocation({ latitude: lat, longitude: lng, accuracy: acc });
          saveLastKnownLocation({ latitude: lat, longitude: lng, accuracy: acc });

          // Reverse geocode via OpenStreetMap Nominatim
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
            .then(res => res.json())
            .then(data => {
              if (data && data.display_name) {
                setCurrentAddress(data.display_name);
                saveLastKnownLocation({ latitude: lat, longitude: lng, accuracy: acc, address: data.display_name });
              }
            })
            .catch(() => {
              // Nominatim rate limits or offline
            });

          // If SOS active, post real-time breadcrumbs to backend
          if (activeSession && activeSession.status === 'ACTIVE') {
            apiRequest('/api/emergency/location', {
              method: 'POST',
              body: JSON.stringify({
                latitude: lat,
                longitude: lng,
                accuracy: acc,
                speed: pos.coords.speed || 0,
                heading: pos.coords.heading || 0
              })
            }).catch(() => {});
          }
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
          // Fallback to persisted last known location or New Delhi
          if (!currentLocation) {
            const cached = getLastKnownLocation();
            if (cached) {
              setCurrentLocation({ latitude: cached.latitude, longitude: cached.longitude, accuracy: cached.accuracy });
              if (cached.address) setCurrentAddress(cached.address);
            } else {
              setCurrentLocation({ latitude: 28.6139, longitude: 77.2090, accuracy: 25 });
              setCurrentAddress('Connaught Place, New Delhi, Delhi 110001, India');
            }
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );
    }

    return () => {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
    };
  }, [activeSession]);

  // Auth Handlers
  const handleLogin = async (credentials: any) => {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (data.token) {
      setAuthToken(data.token);
    }
    setUser(data.user);
  };

  const handleRegister = async (regData: any) => {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(regData)
    });
    if (data.token) {
      setAuthToken(data.token);
    }
    setUser(data.user);
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {}
    setAuthToken(null);
    setUser(null);
    setActiveSession(null);
  };

  // SOS Triggers
  const handleInitiateSOS = (triggerType: 'ONE_TAP_SOS' | 'SILENT_ALARM') => {
    setPendingTriggerType(triggerType);
    setIsSOSCountdownOpen(true);
  };

  const handleExecuteTrigger = async (triggerType: 'ONE_TAP_SOS' | 'SILENT_ALARM') => {
    setIsSOSCountdownOpen(false);
    try {
      const data = await apiRequest('/api/emergency/sos', {
        method: 'POST',
        body: JSON.stringify({
          triggerType,
          latitude: currentLocation?.latitude || 28.6139,
          longitude: currentLocation?.longitude || 77.2090,
          accuracy: currentLocation?.accuracy || 15,
          address: currentAddress || 'Live GPS Location'
        })
      });
      setActiveSession(data.session);
      if (data.session.lastLatitude && data.session.lastLongitude) {
        setBreadcrumbs([{
          latitude: data.session.lastLatitude,
          longitude: data.session.lastLongitude,
          accuracy: data.session.lastAccuracy || 15,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error('SOS dispatch error:', err);
    }
  };

  // Disarm / Stand down
  const handleDisarmConfirm = async (pin: string) => {
    try {
      const data = await apiRequest('/api/emergency/resolve', {
        method: 'POST',
        body: JSON.stringify({ pin, note: 'User entered deactivation PIN' })
      });

      if (data.covertDuress) {
        // Covert duress: hide alarm banner from screen so abuser believes it is turned off
        setActiveSession(null);
        return { success: true, covertDuress: true };
      }

      setActiveSession(null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Invalid PIN or server error' };
    }
  };

  // Contacts handlers
  const handleAddContact = async (contactData: any) => {
    const data = await apiRequest('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData)
    });
    if (data.contacts) {
      setContacts(data.contacts);
    } else if (data.contact) {
      setContacts(prev => {
        const next = data.contact.isPrimary ? prev.map(c => ({ ...c, isPrimary: false })) : [...prev];
        return [...next.filter(c => c.id !== data.contact.id), data.contact];
      });
    }
  };

  const handleEditContact = async (id: string, contactData: any) => {
    const data = await apiRequest(`/api/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contactData)
    });
    if (data.contacts) {
      setContacts(data.contacts);
    } else if (data.contact) {
      setContacts(prev => prev.map(c => c.id === id ? data.contact : (data.contact.isPrimary ? { ...c, isPrimary: false } : c)));
    }
  };

  const handleDeleteContact = async (id: string) => {
    const data = await apiRequest(`/api/contacts/${id}`, {
      method: 'DELETE'
    });
    if (data.contacts) {
      setContacts(data.contacts);
    } else {
      setContacts(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleSetPrimaryContact = async (id: string) => {
    const data = await apiRequest(`/api/contacts/${id}/primary`, {
      method: 'POST'
    });
    if (data.contacts) {
      setContacts(data.contacts);
    } else {
      setContacts(prev => prev.map(c => ({ ...c, isPrimary: c.id === id })));
    }
  };

  // Walk With Me Handlers
  const handleStartWalkTimer = async (timerData: any) => {
    try {
      const data = await apiRequest('/api/walk-with-me/start', {
        method: 'POST',
        body: JSON.stringify(timerData)
      });
      setWalkTimer(data.timer);
    } catch (err) {
      console.error('Walk timer start error:', err);
    }
  };

  const handleCheckInWalkTimer = async (pin: string) => {
    try {
      await apiRequest('/api/walk-with-me/check-in', {
        method: 'POST',
        body: JSON.stringify({ pin })
      });
      setWalkTimer(null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to check in' };
    }
  };

  const handleCancelWalkTimer = async () => {
    try {
      await apiRequest('/api/walk-with-me/cancel', { method: 'POST' });
    } catch {}
    setWalkTimer(null);
  };

  const handleWalkTimeoutEscalate = () => {
    handleExecuteTrigger('ONE_TAP_SOS');
  };

  // Incidents handlers
  const handleCreateIncident = async (incidentData: any) => {
    const data = await apiRequest('/api/incidents', {
      method: 'POST',
      body: JSON.stringify(incidentData)
    });
    setIncidents(data.incidents || []);
  };

  const handleDeleteIncident = async (id: string) => {
    const data = await apiRequest(`/api/incidents/${id}`, { method: 'DELETE' });
    setIncidents(data.incidents || []);
  };

  // Settings handlers
  const handleUpdatePins = async (pinData: any) => {
    await apiRequest('/api/auth/pins', {
      method: 'POST',
      body: JSON.stringify(pinData)
    });
  };

  // 1. If public tracking token URL
  if (publicToken) {
    return <PublicTrackingView token={publicToken} onBackToApp={() => setPublicToken(null)} />;
  }

  // 2. If Camouflage Calculator Mode Active
  if (isCamouflage) {
    return <CamouflageCalculator onUnlock={() => setIsCamouflage(false)} secretCode="1234" />;
  }

  // 3. If Auth Loading
  if (authLoading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-slate-950 text-slate-100" style={{ backgroundColor: '#020617' }}>
        <div className="text-center p-4">
          <div className="spinner-border text-rose-500 mb-3" style={{ color: '#e11d48' }} role="status" />
          <h5 className="fw-bold text-white tracking-tight">Initializing Yuki...</h5>
          <p className="text-slate-400 small">Establishing secure cryptographic session</p>
        </div>
      </div>
    );
  }

  // 4. If Not Logged In
  if (!user) {
    return <AuthView onLogin={handleLogin} onRegister={handleRegister} />;
  }

  const trackingUrl = activeSession
    ? `${window.location.origin}/track/${activeSession.trackingToken}`
    : '';

  return (
    <div className="min-vh-100 bg-slate-950 text-slate-100 d-flex flex-column font-sans" style={{ backgroundColor: '#020617', color: '#f1f5f9' }}>
      {/* Top Active Emergency Alert Banner */}
      {activeSession && (activeSession.status === 'ACTIVE' || activeSession.status === 'DURESS') && (
        <ActiveEmergencyBanner
          session={activeSession}
          trackingUrl={trackingUrl}
          contacts={contacts}
          onDisarmClick={() => setIsDisarmModalOpen(true)}
        />
      )}

      {/* Main Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        onCamouflage={() => setIsCamouflage(true)}
        hasActiveSOS={!!activeSession && activeSession.status === 'ACTIVE'}
      />

      {/* Main Content Body */}
      <main className="flex-grow-1 pb-5">
        {activeTab === 'sos' && (
          <SOSView
            user={user}
            contacts={contacts}
            activeSession={activeSession}
            breadcrumbs={breadcrumbs}
            currentLocation={currentLocation}
            currentAddress={currentAddress}
            onInitiateSOS={handleInitiateSOS}
            onDisarmClick={() => setIsDisarmModalOpen(true)}
          />
        )}

        {activeTab === 'contacts' && (
          <ContactsView
            contacts={contacts}
            onAddContact={handleAddContact}
            onEditContact={handleEditContact}
            onDeleteContact={handleDeleteContact}
            onSetPrimary={handleSetPrimaryContact}
          />
        )}

        {activeTab === 'ai' && (
          <AISafetyAdvisorView onTriggerSOS={() => handleInitiateSOS('ONE_TAP_SOS')} />
        )}

        {activeTab === 'helplines' && <HelplinesView />}

        {activeTab === 'walk' && (
          <WalkWithMeView
            timer={walkTimer}
            onStartTimer={handleStartWalkTimer}
            onCheckIn={handleCheckInWalkTimer}
            onCancelTimer={handleCancelWalkTimer}
            onTimeoutEscalate={handleWalkTimeoutEscalate}
          />
        )}

        {activeTab === 'incidents' && (
          <IncidentsView
            incidents={incidents}
            onCreateIncident={handleCreateIncident}
            onDeleteIncident={handleDeleteIncident}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            user={user}
            onUpdatePins={handleUpdatePins}
            onRefreshUser={checkAuth}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-3 text-center small text-slate-500 mt-auto" style={{ backgroundColor: '#020617', borderColor: '#1e293b' }}>
        <div className="container">
          <span className="text-slate-400">Yuki &bull; 24/7 Digital Safety &amp; Emergency Assistance &bull; End-to-End Encrypted &bull; V2.1.0</span>
        </div>
      </footer>

      {/* 3-Second Safeguard Countdown Modal */}
      <EmergencySOSModal
        isOpen={isSOSCountdownOpen}
        triggerType={pendingTriggerType}
        onCancel={() => setIsSOSCountdownOpen(false)}
        onTrigger={handleExecuteTrigger}
      />

      {/* Dual PIN Disarm Modal */}
      <DisarmModal
        isOpen={isDisarmModalOpen}
        onClose={() => setIsDisarmModalOpen(false)}
        onConfirm={handleDisarmConfirm}
      />
    </div>
  );
}

export default App;
