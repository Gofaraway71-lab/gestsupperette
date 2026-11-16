import React, { useState, useEffect, useRef } from 'react';
import { formatDA } from '../i18n';

export default function PaymentModal({ total, lang, t, onConfirm, onClose }) {
  const [method, setMethod] = useState('cash');
  const [received, setReceived] = useState(String(total));
  const [customerName, setCustomerName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [method]);

  const receivedNum = Math.round(Number(received) || 0);
  const change = method === 'cash' ? receivedNum - total : 0;
  const canValidate =
    method === 'card' ||
    (method === 'credit' && customerName.trim().length > 0) ||
    (method === 'cash' && receivedNum >= total);

  const quickAmounts = [total, 500, 1000, 2000, 5000];

  const handleSubmit = (shouldPrint) => {
    if (!canValidate) return;
    onConfirm({
      paymentMethod: method,
      amountReceived: method === 'cash' ? receivedNum : method === 'card' ? total : 0,
      changeGiven: method === 'cash' ? Math.max(0, change) : 0,
      customerName: customerName.trim(),
      shouldPrint
    });
  };

  return (
    <div className="modal-overlay" onKeyDown={(e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && canValidate) handleSubmit(true);
    }}>
      <div className="modal-card">
        <div className="modal-header">
          <h3>{t.paymentTitle}</h3>
          <button className="btn-icon" onClick={onClose}>âœ•</button>
        </div>

        <div className="pay-total-banner">
          <span>{t.grandTotal}</span>
          <strong>{formatDA(total, lang)}</strong>
        </div>

        <div className="pay-methods">
          {[
            ['cash', `ðŸ’µ ${t.cash}`],
            ['card', `ðŸ’³ ${t.card}`],
            ['credit', `ðŸ“’ ${t.credit}`]
          ].map(([key, label]) => (
            <button
              key={key}
              className={`pay-method-btn ${method === key ? 'active' : ''}`}
              onClick={() => setMethod(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <>
            <label className="field-label">{t.amountReceived} ({t.da})</label>
            <input
              ref={inputRef}
              type="number"
              className="input-xl"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
            />

            <div className="quick-cash-grid">
              {quickAmounts.map((amt, idx) => (
                <button
                  key={`${amt}-${idx}`}
                  className="btn btn-chip"
                  onClick={() => setReceived(String(amt))}
                >
                  {idx === 0 ? 'Exact' : formatDA(amt, lang)}
                </button>
              ))}
            </div>

            <div className={`change-box ${change < 0 ? 'bad' : 'good'}`}>
              <span>{change < 0 ? t.missingAmount : t.changeDue}</span>
              <strong>{formatDA(Math.abs(change), lang)}</strong>
            </div>
          </>
        )}

        {method === 'credit' && (
          <div style={{ marginTop: 14 }}>
            <label className="field-label">{t.customerName}</label>
            <input
              ref={inputRef}
              type="text"
              className="input-lg"
              placeholder="Ex: Karim â€” 0551 00 11 22"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
          <button
            className="btn btn-outline"
            disabled={!canValidate}
            onClick={() => handleSubmit(false)}
          >
            {t.validateOnly}
          </button>
          <button
            className="btn btn-primary btn-lg"
            disabled={!canValidate}
            onClick={() => handleSubmit(true)}
          >
            {t.validateSale}
          </button>
        </div>
      </div>
    </div>
  );
}