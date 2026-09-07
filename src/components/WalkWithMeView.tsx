import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  AlertOctagon,
  Navigation,
  Plus,
  Shield,
  MapPin,
  AlertTriangle,
  StopCircle
} from 'lucide-react';
import { WalkWithMeTimer } from '../types';

interface WalkWithMeViewProps {
  timer: WalkWithMeTimer | null;
  onStartTimer: (data: { destination: string; durationMinutes: number; notes?: string }) => Promise<void>;
  onCheckIn: (pin: string) => Promise<{ success: boolean; error?: string }>;
  onCancelTimer: () => Promise<void>;
  onTimeoutEscalate: () => void;
}

export const WalkWithMeView: React.FC<WalkWithMeViewProps> = ({
  timer,
  onStartTimer,
  onCheckIn,
  onCancelTimer,
  onTimeoutEscalate,
}) => {
  const [destination, setDestination] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [notes, setNotes] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [checkInPin, setCheckInPin] = useState('');
  const [checkInError, setCheckInError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Update countdown timer
  useEffect(() => {
    if (!timer || timer.status !== 'ACTIVE') return;

    const calcRemaining = () => {
      const endsAt = new Date(timer.endsAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endsAt - now) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        onTimeoutEscalate();
      }
    };

    calcRemaining();
    const interval = setInterval(calcRemaining, 1000);
    return () => clearInterval(interval);
  }, [timer, onTimeoutEscalate]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;

    setIsStarting(true);
    try {
      await onStartTimer({
        destination: destination.trim(),
        durationMinutes,
        notes: notes.trim()
      });
      setDestination('');
      setNotes('');
    } catch (e) {
      // handled
    } finally {
      setIsStarting(false);
    }
  };

  const handleSafeCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckInError('');
    try {
      const res = await onCheckIn(checkInPin);
      if (!res.success) {
        setCheckInError(res.error || 'Incorrect PIN.');
      } else {
        setCheckInPin('');
      }
    } catch (err: any) {
      setCheckInError(err.message || 'Check-in failed.');
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container-fluid max-w-7xl py-4 px-3">
      {/* Header */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-2 mb-1">
          <Clock className="text-danger" size={26} />
          <h3 className="fw-bold mb-0">Walk With Me &bull; Safety Timer</h3>
        </div>
        <p className="text-muted small mb-0">
          Set an expected journey duration for solo commutes or rides. If you don't check in before the timer expires, an Emergency SOS is automatically triggered.
        </p>
      </div>

      <div className="row g-4">
        {/* Active Timer Display or Setup Form */}
        <div className="col-lg-7">
          {timer && timer.status === 'ACTIVE' ? (
            <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 text-center bg-white">
              <span className="badge bg-warning bg-opacity-25 text-warning-emphasis fw-bold px-3 py-1.5 rounded-pill text-uppercase mb-3 mx-auto">
                ⏱️ Safety Countdown Active
              </span>

              <h3 className="fw-bold text-dark mb-1">Journey in Progress</h3>
              <p className="text-muted small mb-4">
                Destination: <strong>{timer.destination}</strong>
              </p>

              {/* Massive Countdown */}
              <div
                className={`display-1 fw-black font-monospace my-4 ${
                  remainingSeconds < 180 ? 'text-danger animate-pulse' : 'text-dark'
                }`}
                style={{ letterSpacing: '2px' }}
              >
                {formatTimer(remainingSeconds)}
              </div>

              {timer.notes && (
                <div className="alert alert-light border small text-muted mx-auto mb-4" style={{ maxWidth: '440px' }}>
                  <strong>Vehicle / Safety Notes:</strong> {timer.notes}
                </div>
              )}

              {/* Check In Form */}
              <div className="card border p-3 rounded-4 bg-light mx-auto w-100" style={{ maxWidth: '440px' }}>
                <h6 className="fw-bold text-dark mb-2">Arrived Safely? Complete Trip</h6>
                <p className="text-muted small mb-3">
                  Enter your Safety PIN to confirm you reached your destination safely:
                </p>

                {checkInError && (
                  <div className="alert alert-danger py-1.5 small mb-2">{checkInError}</div>
                )}

                <form onSubmit={handleSafeCheckIn} className="d-flex gap-2">
                  <input
                    type="password"
                    maxLength={6}
                    className="form-control text-center font-monospace fs-5 rounded-3"
                    placeholder="Enter PIN"
                    value={checkInPin}
                    onChange={(e) => setCheckInPin(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-success fw-bold px-4 rounded-3 d-flex align-items-center gap-1">
                    <CheckCircle2 size={18} />
                    <span>Check In</span>
                  </button>
                </form>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  className="btn btn-link text-danger text-decoration-none small"
                  onClick={onCancelTimer}
                >
                  Cancel Journey Without Check-In
                </button>
              </div>
            </div>
          ) : (
            /* Setup New Journey Form */
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <h5 className="fw-bold mb-3">Start a Monitored Solo Journey</h5>
              <form onSubmit={handleStart}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Destination or Route *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">
                      <MapPin size={16} className="text-danger" />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Metro Station to Sector 18 Apartment"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Expected Travel Duration *</label>
                  <div className="d-flex gap-2 mb-2 flex-wrap">
                    {[10, 15, 20, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        className={`btn btn-sm rounded-3 py-2 px-3 fw-semibold ${
                          durationMinutes === mins ? 'btn-danger' : 'btn-light border'
                        }`}
                        onClick={() => setDurationMinutes(mins)}
                      >
                        {mins} mins
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-semibold text-secondary">Cab / Vehicle Details or Notes</label>
                  <textarea
                    className="form-control rounded-3"
                    rows={2}
                    placeholder="e.g. White Uber WagonR plate DL 1Y 4210, Driver name: Ramesh..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <small className="text-muted">
                    These notes will be automatically sent to your emergency contacts if the timer expires.
                  </small>
                </div>

                <button
                  type="submit"
                  className="btn btn-danger w-100 py-3 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                  disabled={isStarting}
                >
                  <Play size={20} />
                  <span>Start Walk-With-Me Monitoring</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Informational Column */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
            <h6 className="fw-bold text-uppercase text-secondary small mb-3">How Walk-With-Me Works</h6>
            <div className="d-flex flex-column gap-3 small text-muted">
              <div className="d-flex align-items-start gap-2.5">
                <div className="rounded-circle bg-light p-2 text-danger fw-bold flex-shrink-0">1</div>
                <div>
                  <strong className="text-dark">Set Destination &amp; Time:</strong> Choose your estimated travel duration with a safe buffer.
                </div>
              </div>

              <div className="d-flex align-items-start gap-2.5">
                <div className="rounded-circle bg-light p-2 text-danger fw-bold flex-shrink-0">2</div>
                <div>
                  <strong className="text-dark">Safe Journey Monitoring:</strong> Your device tracks countdown elapsed time and maintains location standby.
                </div>
              </div>

              <div className="d-flex align-items-start gap-2.5">
                <div className="rounded-circle bg-light p-2 text-danger fw-bold flex-shrink-0">3</div>
                <div>
                  <strong className="text-dark">Automated Escalation:</strong> If you are intercepted or incapacitated and cannot check in, the system initiates Emergency SOS dispatch automatically.
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 p-3.5 bg-danger bg-opacity-10 border border-danger-subtle">
            <div className="d-flex align-items-center gap-2 text-danger mb-1">
              <Shield size={18} />
              <span className="fw-bold small">Prevent Coercion with Dual PINs</span>
            </div>
            <p className="text-danger-emphasis small mb-0" style={{ fontSize: '12px' }}>
              If forced by an attacker to check in, enter your secret <strong>Duress PIN</strong>. The screen will simulate a normal check-in while covertly alerting your trusted contacts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
