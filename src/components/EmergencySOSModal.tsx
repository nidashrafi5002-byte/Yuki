import React, { useEffect, useState } from 'react';
import { AlertOctagon, XCircle, ShieldAlert } from 'lucide-react';
import { audioEngine } from '../utils/audio';

interface EmergencySOSModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onTrigger: (triggerType: 'ONE_TAP_SOS' | 'SILENT_ALARM') => void;
  triggerType?: 'ONE_TAP_SOS' | 'SILENT_ALARM';
}

export const EmergencySOSModal: React.FC<EmergencySOSModalProps> = ({
  isOpen,
  onCancel,
  onTrigger,
  triggerType = 'ONE_TAP_SOS'
}) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(3);
      return;
    }

    setCountdown(3);
    audioEngine.playCountdownBeep(660, 0.2);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onTrigger(triggerType);
          return 0;
        }
        audioEngine.playCountdownBeep(prev === 2 ? 880 : 1100, 0.2);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onTrigger, triggerType]);

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(2, 6, 23, 0.88)', backdropFilter: 'blur(10px)' }} tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered">
        <div
          className="modal-content border shadow-2xl rounded-4 text-center p-4"
          style={{ backgroundColor: '#0f172a', borderColor: '#1e293b', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)' }}
        >
          <div className="my-2">
            <div
              className="rounded-circle text-white d-inline-flex align-items-center justify-content-center mx-auto mb-3 shadow-lg"
              style={{
                width: '84px',
                height: '84px',
                backgroundColor: '#e11d48',
                boxShadow: '0 0 35px rgba(225, 29, 72, 0.5)',
                animation: 'pulse 1s infinite'
              }}
            >
              <AlertOctagon size={44} />
            </div>
            <h3 className="fw-black text-white mb-1 tracking-tight">EMERGENCY SOS DISPATCH</h3>
            <p className="small mb-4" style={{ color: '#94a3b8' }}>
              Alerting verified trusted contacts and initiating live GPS broadcasting in...
            </p>

            <div className="display-1 fw-black my-2 font-monospace" style={{ color: '#f43f5e', textShadow: '0 0 30px rgba(244, 63, 94, 0.6)' }}>
              {countdown}
            </div>

            <div className="d-flex flex-column gap-2.5 mt-4">
              <button
                type="button"
                className="btn btn-lg py-3 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2"
                style={{ backgroundColor: '#020617', borderColor: '#334155', color: '#cbd5e1' }}
                onClick={onCancel}
              >
                <XCircle size={22} className="text-slate-400" />
                CANCEL SOS (Accidental Tap)
              </button>

              <button
                type="button"
                className="btn btn-lg py-3 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow"
                style={{ backgroundColor: '#e11d48', borderColor: '#f43f5e', color: '#ffffff', boxShadow: '0 4px 20px rgba(225, 29, 72, 0.4)' }}
                onClick={() => onTrigger(triggerType)}
              >
                <ShieldAlert size={22} />
                SEND ALERTS IMMEDIATELY
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
