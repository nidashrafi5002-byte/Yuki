import React, { useEffect, useState } from 'react';
import { AlertCircle, Volume2, VolumeX, ShieldCheck, Share2, MessageCircle, Send, Check } from 'lucide-react';
import { EmergencySession, TrustedContact } from '../types';
import { audioEngine } from '../utils/audio';

interface ActiveEmergencyBannerProps {
  session: EmergencySession;
  trackingUrl: string;
  contacts: TrustedContact[];
  onDisarmClick: () => void;
}

export const ActiveEmergencyBanner: React.FC<ActiveEmergencyBannerProps> = ({
  session,
  trackingUrl,
  contacts,
  onDisarmClick,
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isSirenActive, setIsSirenActive] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const startTime = new Date(session.startedAt).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSec(Math.max(0, Math.floor((now - startTime) / 1000)));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [session.startedAt]);

  const toggleSiren = () => {
    if (isSirenActive) {
      audioEngine.stopSiren();
      setIsSirenActive(false);
    } else {
      const started = audioEngine.playSiren();
      if (started) setIsSirenActive(true);
    }
  };

  useEffect(() => {
    return () => {
      audioEngine.stopSiren();
    };
  }, []);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Primary contacts blast links
  const primaryContacts = contacts.filter(c => c.isVerified);
  const blastMessage = `🚨 EMERGENCY ALERT from Yuki: I need immediate assistance! Follow my real-time GPS location here: ${trackingUrl} . If you cannot reach me, please immediately dial 112 (Police) or 1091 (Women Helpline).`;

  const waLink = primaryContacts.length > 0 && primaryContacts[0].phone
    ? `https://api.whatsapp.com/send?phone=${primaryContacts[0].phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(blastMessage)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(blastMessage)}`;

  const smsLink = primaryContacts.length > 0
    ? `sms:${primaryContacts.map(c => c.phone).join(',')}?body=${encodeURIComponent(blastMessage)}`
    : `sms:?body=${encodeURIComponent(blastMessage)}`;

  return (
    <div
      className="text-white py-3 px-3 shadow-2xl sticky-top z-3"
      style={{
        backgroundColor: '#4c0519',
        borderBottom: '1px solid #e11d48',
        boxShadow: '0 10px 30px rgba(225, 29, 72, 0.3)'
      }}
    >
      <div className="container-fluid max-w-7xl">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          {/* Left: Emergency Status */}
          <div className="d-flex align-items-center gap-3">
            <div
              className="spinner-grow"
              style={{ width: '1.25rem', height: '1.25rem', color: '#f43f5e' }}
              role="status"
            >
              <span className="visually-hidden">Active Alert</span>
            </div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <span
                  className="badge fw-bold text-uppercase px-2.5 py-1 rounded-pill font-mono"
                  style={{ backgroundColor: '#e11d48', color: '#ffffff', letterSpacing: '0.5px' }}
                >
                  🚨 EMERGENCY SOS ACTIVE
                </span>
                <span
                  className="font-monospace fw-bold px-2 py-0.5 rounded small"
                  style={{ backgroundColor: '#020617', color: '#fca5a5', border: '1px solid #881337' }}
                >
                  {formatElapsed(elapsedSec)}
                </span>
              </div>
              <p className="mb-0 small mt-1" style={{ color: '#fecdd3' }}>
                Live location streaming &bull; {contacts.length} trusted contacts notified
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            {/* Siren button */}
            <button
              type="button"
              className="btn btn-sm d-flex align-items-center gap-1.5 rounded-2 font-medium"
              style={{
                backgroundColor: isSirenActive ? '#f59e0b' : '#020617',
                color: isSirenActive ? '#020617' : '#f1f5f9',
                borderColor: isSirenActive ? '#f59e0b' : '#881337'
              }}
              onClick={toggleSiren}
            >
              {isSirenActive ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {isSirenActive ? 'Stop Siren' : 'Loud Siren'}
            </button>

            {/* Direct WhatsApp Blast */}
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm d-flex align-items-center gap-1.5 fw-bold rounded-2 text-decoration-none"
              style={{ backgroundColor: '#059669', color: '#ffffff', borderColor: '#10b981' }}
            >
              <MessageCircle size={16} />
              WhatsApp Alert
            </a>

            {/* Direct SMS Blast */}
            <a
              href={smsLink}
              className="btn btn-sm d-flex align-items-center gap-1.5 fw-bold rounded-2 text-decoration-none"
              style={{ backgroundColor: '#020617', color: '#fb7185', borderColor: '#e11d48' }}
            >
              <Send size={16} />
              SMS Alert
            </a>

            {/* Copy Live Tracking URL */}
            <button
              type="button"
              className="btn btn-sm d-flex align-items-center gap-1.5 rounded-2 font-medium"
              style={{ backgroundColor: '#020617', color: '#cbd5e1', borderColor: '#334155' }}
              onClick={handleCopyLink}
              title="Copy live tracking link"
            >
              {copied ? <Check size={16} style={{ color: '#fbbf24' }} /> : <Share2 size={16} />}
              {copied ? 'Link Copied!' : 'Share Link'}
            </button>

            {/* Safe Stand Down / Disarm */}
            <button
              type="button"
              className="btn btn-sm fw-bold px-3 d-flex align-items-center gap-1.5 rounded-2 shadow-sm"
              style={{ backgroundColor: '#e11d48', color: '#ffffff', borderColor: '#f43f5e' }}
              onClick={onDisarmClick}
            >
              <ShieldCheck size={16} />
              I Am Safe (Disarm)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
