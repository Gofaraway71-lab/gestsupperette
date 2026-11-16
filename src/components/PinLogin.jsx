import React, { useState } from 'react';
import { posApi } from '../api';
import { playBeep } from '../utils/sound';

export default function PinLogin({ t, onLoginSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submitPin = async (code) => {
    const user = await posApi.login(code);
    if (user) {
      playBeep('success');
      onLoginSuccess(user);
    } else {
      playBeep('error');
      setError(t.invalidPin);
      setPin('');
    }
  };

  const handleDigit = (d) => {
    setError('');
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      submitPin(next);
    }
  };

  const handleKeyDown = (e) => {
    if (/^\d$/.test(e.key)) handleDigit(e.key);
    else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    else if (e.key === 'Enter' && pin.length > 0) submitPin(pin);
  };

  return (
    <div className="login-backdrop" tabIndex={0} onKeyDown={handleKeyDown} autoFocus>
      <div className="login-card">
        <div className="login-logo">🛒 {t.appTitle}</div>
        <h2>{t.loginTitle}</h2>
        <p className="muted">{t.enterPin}</p>

        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
          ))}
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="key-btn" onClick={() => handleDigit(d)}>{d}</button>
          ))}
          <button className="key-btn key-sec" onClick={() => setPin('')}>C</button>
          <button className="key-btn" onClick={() => handleDigit('0')}>0</button>
          <button className="key-btn key-ok" onClick={() => submitPin(pin)}>OK</button>
        </div>

        <div className="demo-hints">
          <span>PIN Démo — {t.cashier}: <b>1234</b></span>
          <span>{t.manager}: <b>0000</b></span>
        </div>
      </div>
    </div>
  );
}