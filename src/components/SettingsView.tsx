import React, { useState } from 'react';
import { Shield, KeyRound, AlertTriangle, HeartPulse, History, Check, Lock, Save } from 'lucide-react';
import { User, AuditLog } from '../types';

interface SettingsViewProps {
  user: User;
  onUpdatePins: (data: { safetyPin?: string; duressPin?: string; medicalNotes?: string }) => Promise<void>;
  onRefreshUser: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onUpdatePins,
  onRefreshUser
}) => {
  const [safetyPin, setSafetyPin] = useState('');
  const [duressPin, setDuressPin] = useState('');
  const [medicalNotes, setMedicalNotes] = useState(user.medicalNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    if (safetyPin && safetyPin.length < 4) {
      setErrorMessage('Safety PIN must be at least 4 digits');
      setIsSaving(false);
      return;
    }
    if (duressPin && duressPin.length < 4) {
      setErrorMessage('Duress PIN must be at least 4 digits');
      setIsSaving(false);
      return;
    }
    if (safetyPin && duressPin && safetyPin === duressPin) {
      setErrorMessage('Safety PIN and Duress PIN cannot be identical! They must be distinct.');
      setIsSaving(false);
      return;
    }

    try {
      await onUpdatePins({
        safetyPin: safetyPin || undefined,
        duressPin: duressPin || undefined,
        medicalNotes
      });
      setSuccessMessage('Security settings and emergency PINs successfully updated.');
      setSafetyPin('');
      setDuressPin('');
      await onRefreshUser();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container-fluid max-w-7xl py-4 px-3">
      {/* Header */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-2 mb-1">
          <Shield className="text-danger" size={26} />
          <h3 className="fw-bold mb-0">Security &amp; Dual-PIN Settings</h3>
        </div>
        <p className="text-muted small mb-0">
          Configure covert duress safeguards, medical details for first responders, and encryption preferences.
        </p>
      </div>

      {successMessage && (
        <div className="alert alert-success d-flex align-items-center gap-2 rounded-3 mb-4">
          <Check size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-4">
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="row g-4">
        <div className="col-lg-7">
          <form onSubmit={handleSaveSettings} className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <KeyRound size={20} className="text-danger" />
              <span>Emergency Deactivation PINs</span>
            </h5>

            {/* Safety PIN */}
            <div className="mb-4">
              <label className="form-label small fw-semibold text-dark">
                Primary Safety PIN {user.hasSafetyPin ? '(Configured)' : '(Default: 1234)'}
              </label>
              <input
                type="password"
                maxLength={6}
                className="form-control rounded-3 font-monospace"
                placeholder="Enter new 4-6 digit Safety PIN"
                value={safetyPin}
                onChange={(e) => setSafetyPin(e.target.value.replace(/\D/g, ''))}
              />
              <small className="text-muted">
                Used to genuinely deactivate active SOS alerts when you have reached safety.
              </small>
            </div>

            {/* Duress PIN */}
            <div className="mb-4 p-3 rounded-3 bg-danger bg-opacity-10 border border-danger-subtle">
              <label className="form-label small fw-bold text-danger d-flex align-items-center gap-1.5">
                <AlertTriangle size={16} />
                Covert Duress PIN {user.hasDuressPin ? '(Configured)' : '(Default: 9999)'}
              </label>
              <input
                type="password"
                maxLength={6}
                className="form-control rounded-3 font-monospace bg-white"
                placeholder="Enter new 4-6 digit Duress PIN"
                value={duressPin}
                onChange={(e) => setDuressPin(e.target.value.replace(/\D/g, ''))}
              />
              <small className="text-danger-emphasis d-block mt-1">
                <strong>Crucial Safeguard:</strong> If an attacker coerces you to "turn off the alert", enter this PIN. The screen will simulate deactivation while silently notifying emergency responders and keeping live GPS tracking active.
              </small>
            </div>

            {/* Medical Notes */}
            <div className="mb-4">
              <label className="form-label small fw-semibold text-dark d-flex align-items-center gap-1.5">
                <HeartPulse size={16} className="text-danger" />
                Medical &amp; Critical Emergency Notes
              </label>
              <textarea
                className="form-control rounded-3"
                rows={3}
                placeholder="e.g. Blood Group O+, Severe Penicillin allergy, Asthmatic (inhaler in backpack)..."
                value={medicalNotes}
                onChange={(e) => setMedicalNotes(e.target.value)}
              />
              <small className="text-muted">
                These notes will be displayed to trusted contacts and paramedics who view your live tracking link.
              </small>
            </div>

            <button
              type="submit"
              className="btn btn-danger py-2.5 px-4 rounded-3 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-xs"
              disabled={isSaving}
            >
              <Save size={18} />
              <span>{isSaving ? 'Saving...' : 'Update Security Settings'}</span>
            </button>
          </form>
        </div>

        {/* Right Info Column */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
            <h6 className="fw-bold text-uppercase text-secondary small mb-3">Data Privacy &amp; Security</h6>
            <div className="small text-muted d-flex flex-column gap-3">
              <div>
                <strong className="text-dark">Zero Commercial Telemetry:</strong> Yuki collects zero advertising trackers, analytics trackers, or third-party cookies.
              </div>
              <div>
                <strong className="text-dark">Ephemeral GPS Lifespans:</strong> Real-time location breadcrumbs are tied to high-entropy session tokens and expire when the incident is resolved.
              </div>
              <div>
                <strong className="text-dark">Cryptographic Passwords &amp; PINs:</strong> Passwords and PIN codes are hashed using scrypt / bcrypt with individual cryptographic salts.
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <h6 className="fw-bold text-uppercase text-secondary small mb-3">Account Overview</h6>
            <div className="small">
              <div className="mb-2">
                <span className="text-muted">Registered Name:</span> <strong className="text-dark">{user.name}</strong>
              </div>
              <div className="mb-2">
                <span className="text-muted">Email:</span> <strong className="text-dark">{user.email}</strong>
              </div>
              <div className="mb-2">
                <span className="text-muted">Mobile:</span> <strong className="text-dark">{user.phone}</strong>
              </div>
              <div>
                <span className="text-muted">Account Status:</span> <span className="badge bg-success-subtle text-success">Active &bull; Protected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
