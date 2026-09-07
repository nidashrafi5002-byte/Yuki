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

  // Secure Auth Token Helper (supports cookies + iframe Bearer tokens)
  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('yuki_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch Current User
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
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
      const headers = getAuthHeaders();

      // 1. Active SOS
      const sosRes = await fetch('/api/emergency/active', { headers });
      if (sosRes.ok) {
        const sosData = await sosRes.json();
        setActiveSession(sosData.session);
        if (sosData.breadcrumbs) {
          setBreadcrumbs(sosData.breadcrumbs);
        }
      }

      // 2. Contacts
      const contactsRes = await fetch('/api/contacts', { headers });
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setContacts(contactsData.contacts || []);
      }

      // 3. Walk With Me
      const walkRes = await fetch('/api/walk-with-me/status', { headers });
      if (walkRes.ok) {
        const walkData = await walkRes.json();
        setWalkTimer(walkData.timer || null);
      }

      // 4. Incidents
      const incRes = await fetch('/api/incidents', { headers });
      if (incRes.ok) {
        const incData = await incRes.json();
        setIncidents(incData.incidents || []);
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  }, [user]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
            fetch('/api/emergency/location', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
      const err = await res.json();
      const customError: any = new Error(err.error || 'Login failed');
      customError.code = err.code;
      throw customError;
    }
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('yuki_auth_token', data.token);
    }
    setUser(data.user);
  };

  const handleRegister = async (regData: any) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regData)
    });
    if (!res.ok) {
      const err = await res.json();
      const customError: any = new Error(err.error || 'Registration failed');
      customError.code = err.code;
      throw customError;
    }
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('yuki_auth_token', data.token);
    }
    setUser(data.user);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch {}
    localStorage.removeItem('yuki_auth_token');
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
      const res = await fetch('/api/emergency/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          triggerType,
          latitude: currentLocation?.latitude || 28.6139,
          longitude: currentLocation?.longitude || 77.2090,
          accuracy: currentLocation?.accuracy || 15,
          address: currentAddress || 'Live GPS Location'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.session);
        if (data.session.lastLatitude && data.session.lastLongitude) {
          setBreadcrumbs([{
            latitude: data.session.lastLatitude,
            longitude: data.session.lastLongitude,
            accuracy: data.session.lastAccuracy || 15,
            timestamp: new Date().toISOString()
          }]);
        }
      }
    } catch (err) {
      console.error('SOS dispatch error:', err);
    }
  };

  // Disarm / Stand down
  const handleDisarmConfirm = async (pin: string) => {
    const res = await fetch('/api/emergency/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ pin, note: 'User entered deactivation PIN' })
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error };
    }

    if (data.covertDuress) {
      // Covert duress: hide alarm banner from screen so abuser believes it is turned off
      setActiveSession(null);
      return { success: true, covertDuress: true };
    }

    setActiveSession(null);
    return { success: true };
  };

  // Contacts handlers
  const handleAddContact = async (contactData: any) => {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(contactData)
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        if (data.code === 'SESSION_EXPIRED') {
          throw new Error('Your session has expired. Please log in again to continue.');
        }
        throw new Error('Please log in to continue.');
      }
      throw new Error(data.error || 'Failed to add contact');
    }
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
    const res = await fetch(`/api/contacts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(contactData)
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        if (data.code === 'SESSION_EXPIRED') {
          throw new Error('Your session has expired. Please log in again to continue.');
        }
        throw new Error('Please log in to continue.');
      }
      throw new Error(data.error || 'Failed to update contact');
    }
    if (data.contacts) {
      setContacts(data.contacts);
    } else if (data.contact) {
      setContacts(prev => prev.map(c => c.id === id ? data.contact : (data.contact.isPrimary ? { ...c, isPrimary: false } : c)));
    }
  };

  const handleDeleteContact = async (id: string) => {
    const res = await fetch(`/api/contacts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        if (data.code === 'SESSION_EXPIRED') {
          throw new Error('Your session has expired. Please log in again to continue.');
        }
        throw new Error('Please log in to continue.');
      }
      throw new Error(data.error || 'Failed to delete contact');
    }
    if (data.contacts) {
      setContacts(data.contacts);
    } else {
      setContacts(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleSetPrimaryContact = async (id: string) => {
    const res = await fetch(`/api/contacts/${id}/primary`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        if (data.code === 'SESSION_EXPIRED') {
          throw new Error('Your session has expired. Please log in again to continue.');
        }
        throw new Error('Please log in to continue.');
      }
      throw new Error(data.error || 'Failed to set primary contact');
    }
    if (data.contacts) {
      setContacts(data.contacts);
    } else {
      setContacts(prev => prev.map(c => ({ ...c, isPrimary: c.id === id })));
    }
  };

  // Walk With Me Handlers
  const handleStartWalkTimer = async (timerData: any) => {
    const res = await fetch('/api/walk-with-me/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(timerData)
    });
    if (res.ok) {
      const data = await res.json();
      setWalkTimer(data.timer);
    }
  };

  const handleCheckInWalkTimer = async (pin: string) => {
    const res = await fetch('/api/walk-with-me/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error };
    }
    setWalkTimer(null);
    return { success: true };
  };

  const handleCancelWalkTimer = async () => {
    await fetch('/api/walk-with-me/cancel', { method: 'POST', headers: getAuthHeaders() });
    setWalkTimer(null);
  };

  const handleWalkTimeoutEscalate = () => {
    handleExecuteTrigger('ONE_TAP_SOS');
  };

  // Incidents handlers
  const handleCreateIncident = async (incidentData: any) => {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(incidentData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save incident');
    }
    const data = await res.json();
    setIncidents(data.incidents);
  };

  const handleDeleteIncident = async (id: string) => {
    const res = await fetch(`/api/incidents/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      setIncidents(data.incidents);
    }
  };

  // Settings handlers
  const handleUpdatePins = async (pinData: any) => {
    const res = await fetch('/api/auth/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(pinData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update PINs');
    }
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
