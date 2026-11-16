import React, { useEffect } from 'react';

export default function HelpModal({ t, onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const sections = [
    {
      title: t.helpSectionPos,
      items: [
        { keys: ['F1'], desc: t.helpF1 },
        { keys: ['F2'], desc: t.helpF2 },
        { keys: ['F3', 'P'], desc: t.helpF3 },
        { keys: ['F4'], desc: t.helpF4 },
        { keys: ['+', '−'], desc: t.helpPlusMinus },
        { keys: ['Q', 'x', '*'], desc: t.helpMultiply },
        { keys: ['0–9'], desc: t.helpQtyNumeric },
        { keys: ['↑', '↓'], desc: t.helpArrowLines },
        { keys: [t.keyDelete], desc: t.helpDelete },
        { keys: [t.keyEscape], desc: t.helpEscape }
      ]
    },
    {
      title: t.helpSectionScan,
      items: [
        { keys: [t.keyEnter], desc: t.helpEnterScan },
        { keys: ['Tab'], desc: t.helpTabScan },
        { keys: [t.keyEnter], desc: t.helpEnterPay }
      ]
    },
    {
      title: t.helpSectionNav,
      items: [
        { keys: ['F9', '?'], desc: t.helpToggleModal },
        { keys: ['0–9', t.keyBackspace, t.keyEnter], desc: t.helpPinKeys }
      ]
    }
  ];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 id="help-modal-title">⌨️ {t.helpTitle}</h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>{t.helpSubtitle}</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t.close}>✕</button>
        </div>

        <div className="help-modal-sections">
          {sections.map((sec) => (
            <div key={sec.title} className="help-section">
              <div className="help-section-title">{sec.title}</div>
              <div className="shortcut-list">
                {sec.items.map((item, idx) => (
                  <div key={idx} className="shortcut-item">
                    <span className="shortcut-desc">{item.desc}</span>
                    <span className="shortcut-keys">
                      {item.keys.map((k, kIdx) => (
                        <React.Fragment key={kIdx}>
                          {kIdx > 0 && <span className="muted" style={{ fontSize: 11 }}>/</span>}
                          <kbd className="kbd-key">{k}</kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="help-tip-box">
          <strong>💡 {t.helpTipTitle} :</strong> {t.helpTipBody}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>{t.close}</button>
        </div>
      </div>
    </div>
  );
}
