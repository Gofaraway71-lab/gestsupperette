import React, { useState, useRef } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';
import { validateStockCsv, downloadStockCsvTemplate } from '../utils/csv';

export default function CsvStockImportModal({ products, user, lang, onImported, onClose }) {
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState('set');
  const [validation, setValidation] = useState(null);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setFileName(file.name);
    try {
      const text = await file.text();
      const result = validateStockCsv(text, products);
      setValidation(result);
    } catch {
      setErrorMsg('Impossible de lire le fichier CSV.');
      setValidation(null);
    }
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!validation || validation.validCount === 0) return;
    setImporting(true);
    setErrorMsg('');
    try {
      const res = await posApi.importStockCsv({
        rows: validation.rows,
        mode,
        userId: user?.id || null
      });
      onImported(res);
    } catch (err) {
      setErrorMsg(err?.message || "Erreur lors de l'importation CSV.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-xl">
        <div className="modal-header">
          <h3>📥 Importation Stock & Prix depuis CSV</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <p className="muted" style={{ marginTop: 0 }}>
          Colonnes attendues : <code>barcode</code> (code produit), <code>stock</code> (quantité ≥ 0),{' '}
          <code>sell_price</code> (prix vente &gt; 0), optionnels : <code>name</code>, <code>buy_price</code>,{' '}
          <code>category</code>, <code>alert_threshold</code>.
        </p>

        <div className="row-actions" style={{ marginBottom: 14 }}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFileChange} />
          <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
            📂 Choisir un fichier CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => downloadStockCsvTemplate(products)}>
            📄 Télécharger un modèle CSV
          </button>
          {fileName && <span className="pill">Fichier : {fileName}</span>}
        </div>

        <div className="pay-methods" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 14 }}>
          <button
            type="button"
            className={`pay-method-btn ${mode === 'set' ? 'active' : ''}`}
            onClick={() => setMode('set')}
          >
            🔄 Remplacer le stock (Inventaire)
          </button>
          <button
            type="button"
            className={`pay-method-btn ${mode === 'add' ? 'active' : ''}`}
            onClick={() => setMode('add')}
          >
            ➕ Ajouter au stock actuel (Réception)
          </button>
        </div>

        {errorMsg && <div className="alert-error">{errorMsg}</div>}
        {validation?.fileError && <div className="alert-error">{validation.fileError}</div>}

        {validation && !validation.fileError && (
          <>
            <div className="csv-summary-bar" style={{ marginBottom: 12 }}>
              <div className="row-actions">
                <span className="pill">Total : {validation.rows.length}</span>
                <span className="pill pill-ok">✓ Valides : {validation.validCount}</span>
                <span className={`pill ${validation.invalidCount > 0 ? 'pill-danger' : 'pill-ok'}`}>
                  ✕ Erreurs : {validation.invalidCount}
                </span>
              </div>
              {validation.invalidCount > 0 && (
                <small className="csv-error-txt">
                  Les lignes invalides seront ignorées lors de l&apos;importation.
                </small>
              )}
            </div>

            <div className="csv-preview-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ligne</th>
                    <th>Code produit</th>
                    <th>Article</th>
                    <th className="text-end">Prix achat</th>
                    <th className="text-end">Prix vente</th>
                    <th className="text-center">Qté CSV</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.rows.map((r) => (
                    <tr key={r.lineNum} className={!r.valid ? 'row-low-stock' : ''}>
                      <td>#{r.lineNum}</td>
                      <td><code>{r.code || '—'}</code></td>
                      <td>
                        <b>{r.name || '—'}</b>
                        {r.existingProduct && (
                          <div className="muted" style={{ fontSize: 12 }}>
                            Stock actuel : {r.existingProduct.stock} →{' '}
                            {r.valid ? (mode === 'add' ? r.existingProduct.stock + r.stock : r.stock) : '—'}
                          </div>
                        )}
                      </td>
                      <td className="text-end">
                        {r.buy_price !== null ? formatDA(r.buy_price, lang) : <span className="muted">—</span>}
                      </td>
                      <td className="text-end">
                        {r.sell_price !== null
                          ? formatDA(r.sell_price, lang)
                          : r.existingProduct
                            ? <span className="muted">{formatDA(r.existingProduct.sell_price, lang)}</span>
                            : '—'}
                      </td>
                      <td className="text-center bold">{String(r.stock)}</td>
                      <td>
                        {r.valid ? (
                          <div>
                            <span className="pill pill-ok">
                              {r.isNew ? '✓ Nouveau' : '✓ Mise à jour'}
                            </span>
                            {r.warnings.map((w, idx) => (
                              <div key={idx} className="csv-warn-txt">⚠️ {w}</div>
                            ))}
                          </div>
                        ) : (
                          <div>
                            {r.errors.map((err, idx) => (
                              <div key={idx} className="csv-error-txt">✕ {err}</div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Fermer</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={importing || !validation || validation.validCount === 0}
            onClick={handleConfirmImport}
          >
            {importing
              ? 'Importation...'
              : `Importer ${validation?.validCount || 0} ligne(s) valide(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
