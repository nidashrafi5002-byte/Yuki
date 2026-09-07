import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertTriangle, X } from 'lucide-react';

interface DisarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => Promise<{ success: boolean; error?: string; covertDuress?: boolean }>;
}

export const DisarmModal: React.FC<DisarmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setErrorMessage('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length < 4) {
      setErrorMessage('Please enter at least 4 digits.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await onConfirm(pin);
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid PIN entered. Emergency remains active.');
        setPin('');
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(2, 6, 23, 0.88)', backdropFilter: 'blur(10px)' }} tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border shadow-2xl rounded-4 overflow-hidden" style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}>
          <div className="modal-header py-3 px-4" style={{ backgroundColor: '#020617', borderBottom: '1px solid #1e293b' }}>
            <div className="d-flex align-items-center gap-2">
              <ShieldCheck style={{ color: '#f43f5e' }} size={24} />
              <h5 className="modal-title fw-bold text-white mb-0">Deactivate Emergency SOS</h5>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={isLoading}
              aria-label="Close"
            />
          </div>

          <div className="modal-body p-4 text-center">
            <p className="small mb-3" style={{ color: '#94a3b8' }}>
              Enter your secret <strong className="text-white">Safety PIN</strong> to confirm you are safe. If coerced, enter your covert <strong className="text-rose-400" style={{ color: '#fb7185' }}>Duress PIN</strong>.
            </p>

            {errorMessage && (
              <div
                className="py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3"
                style={{ backgroundColor: 'rgba(225, 29, 72, 0.15)', border: '1px solid rgba(225, 29, 72, 0.3)', color: '#fb7185' }}
              >
                <AlertTriangle size={18} className="flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* PIN Dots Display */}
            <div className="d-flex justify-content-center gap-3 my-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-circle d-flex align-items-center justify-content-center transition-all"
                  style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: pin.length > i ? '#e11d48' : '#020617',
                    border: pin.length > i ? '2px solid #f43f5e' : '2px solid #334155',
                    boxShadow: pin.length > i ? '0 0 10px rgba(225, 29, 72, 0.5)' : 'none'
                  }}
                />
              ))}
            </div>

            {/* Numeric Keypad for fast, stress-free touch */}
            <div className="d-flex flex-column gap-2 mx-auto" style={{ maxWidth: '280px' }}>
              <div className="d-flex gap-2">
                {['1', '2', '3'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className="btn flex-fill py-3 fs-4 fw-bold rounded-3"
                    style={{ backgroundColor: '#020617', borderColor: '#334155', color: '#f1f5f9' }}
                    onClick={() => handleKeyPress(num)}
                    disabled={isLoading}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="d-flex gap-2">
                {['4', '5', '6'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className="btn flex-fill py-3 fs-4 fw-bold rounded-3"
                    style={{ backgroundColor: '#020617', borderColor: '#334155', color: '#f1f5f9' }}
                    onClick={() => handleKeyPress(num)}
                    disabled={isLoading}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="d-flex gap-2">
                {['7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className="btn flex-fill py-3 fs-4 fw-bold rounded-3"
                    style={{ backgroundColor: '#020617', borderColor: '#334155', color: '#f1f5f9' }}
                    onClick={() => handleKeyPress(num)}
                    disabled={isLoading}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn flex-fill py-3 fw-semibold rounded-3"
                  style={{ backgroundColor: '#020617', borderColor: '#334155', color: '#94a3b8' }}
                  onClick={handleClear}
                  disabled={isLoading}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="btn flex-fill py-3 fs-4 fw-bold rounded-3"
                  style={{ backgroundColor: '#020617', borderColor: '#334155', color: '#f1f5f9' }}
                  onClick={() => handleKeyPress('0')}
                  disabled={isLoading}
                >
                  0
                </button>
                <button
                  type="button"
                  className="btn flex-fill py-3 fw-semibold rounded-3"
                  style={{ backgroundColor: '#020617', borderColor: '#881337', color: '#fb7185' }}
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-4 d-flex gap-2">
              <button
                type="button"
                className="btn w-50 py-2.5 rounded-3 fw-medium"
                style={{ backgroundColor: '#020617', borderColor: '#334155', color: '#cbd5e1' }}
                onClick={onClose}
                disabled={isLoading}
              >
                Keep Active
              </button>
              <button
                type="button"
                className="btn w-50 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 rounded-3 shadow"
                style={{
                  backgroundColor: '#e11d48',
                  borderColor: '#f43f5e',
                  color: '#ffffff',
                  opacity: pin.length < 4 || isLoading ? 0.6 : 1
                }}
                onClick={() => handleSubmit()}
                disabled={pin.length < 4 || isLoading}
              >
                <Lock size={16} />
                {isLoading ? 'Verifying...' : 'Confirm Disarm'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
