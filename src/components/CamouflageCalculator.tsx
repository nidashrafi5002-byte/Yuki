import React, { useState } from 'react';
import { Eye, Shield } from 'lucide-react';

interface CamouflageCalculatorProps {
  onUnlock: () => void;
  secretCode?: string;
}

export const CamouflageCalculator: React.FC<CamouflageCalculatorProps> = ({
  onUnlock,
  secretCode = '1234'
}) => {
  const [display, setDisplay] = useState('0');
  const [history, setHistory] = useState('');
  const [enteredSequence, setEnteredSequence] = useState('');

  const handleDigit = (digit: string) => {
    setEnteredSequence(prev => (prev + digit).slice(-10));
    setDisplay(prev => (prev === '0' ? digit : prev + digit));
  };

  const handleOperator = (op: string) => {
    setHistory(display + ' ' + op);
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setHistory('');
    setEnteredSequence('');
  };

  const handleEquals = () => {
    // Secret unlock sequence trigger
    if (enteredSequence.endsWith(secretCode) || display === secretCode) {
      onUnlock();
      return;
    }

    try {
      if (history) {
        const parts = history.trim().split(' ');
        const num1 = parseFloat(parts[0]);
        const op = parts[1];
        const num2 = parseFloat(display);
        let res = 0;
        if (op === '+') res = num1 + num2;
        else if (op === '-') res = num1 - num2;
        else if (op === '×' || op === '*') res = num1 * num2;
        else if (op === '÷' || op === '/') res = num2 !== 0 ? num1 / num2 : 0;
        setDisplay(res.toString());
        setHistory('');
      }
    } catch {
      setDisplay('Error');
    }
  };

  return (
    <div className="min-vh-100 bg-dark text-white d-flex flex-column align-items-center justify-content-center p-3">
      <div className="card bg-black border-secondary border-opacity-25 rounded-4 shadow-lg p-4" style={{ width: '100%', maxWidth: '360px' }}>
        {/* Disguised Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="text-secondary small font-monospace">Standard Calculator</span>
          <button
            type="button"
            className="btn btn-sm btn-link text-secondary text-decoration-none p-0 opacity-25"
            onClick={onUnlock}
            title="Secret Emergency Shield Exit"
          >
            <Shield size={14} />
          </button>
        </div>

        {/* Display Screen */}
        <div className="bg-dark bg-opacity-75 rounded-3 p-3 mb-4 text-end">
          <div className="text-secondary small font-monospace" style={{ minHeight: '18px' }}>
            {history}
          </div>
          <div className="fs-1 fw-semibold font-monospace text-white overflow-hidden text-truncate">
            {display}
          </div>
        </div>

        {/* Calculator Keypad */}
        <div className="d-grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <button type="button" className="btn btn-secondary py-3 fs-5 rounded-3" onClick={handleClear}>C</button>
          <button type="button" className="btn btn-secondary py-3 fs-5 rounded-3" onClick={() => handleDigit('(')}>(</button>
          <button type="button" className="btn btn-secondary py-3 fs-5 rounded-3" onClick={() => handleDigit(')')}>)</button>
          <button type="button" className="btn btn-warning text-dark py-3 fs-5 fw-bold rounded-3" onClick={() => handleOperator('÷')}>÷</button>

          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('7')}>7</button>
          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('8')}>8</button>
          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('9')}>9</button>
          <button type="button" className="btn btn-warning text-dark py-3 fs-5 fw-bold rounded-3" onClick={() => handleOperator('×')}>×</button>

          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('4')}>4</button>
          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('5')}>5</button>
          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('6')}>6</button>
          <button type="button" className="btn btn-warning text-dark py-3 fs-5 fw-bold rounded-3" onClick={() => handleOperator('-')}>-</button>

          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('1')}>1</button>
          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('2')}>2</button>
          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('3')}>3</button>
          <button type="button" className="btn btn-warning text-dark py-3 fs-5 fw-bold rounded-3" onClick={() => handleOperator('+')}>+</button>

          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('0')} style={{ gridColumn: 'span 2' }}>0</button>
          <button type="button" className="btn btn-dark border border-secondary border-opacity-25 py-3 fs-5 rounded-3" onClick={() => handleDigit('.')}>.</button>
          <button type="button" className="btn btn-primary py-3 fs-5 fw-bold rounded-3" onClick={handleEquals}>=</button>
        </div>

        <div className="text-center mt-3">
          <small className="text-secondary opacity-50" style={{ fontSize: '11px' }}>
            Tip: Enter PIN ({secretCode}) and press = to return
          </small>
        </div>
      </div>
    </div>
  );
};
