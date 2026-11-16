import React, { useState, useRef } from 'react';
import { posApi } from '../api';
import { validateSuppliersCsv, downloadSuppliersCsvTemplate } from '../utils/csv';

export default function CsvSupplierImportModal({ suppliers, onImported, onClose }) {
  const [fileName, setFileName] = useState('');
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
      const result = validateSuppliersCsv(text, suppliers);
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
      const res = await posApi.importSuppliersCsv(validation.rows);
      onImported(res);
    } catch (err) {
      setErrorMsg(err?.message || "Erreur lors de l'importation CSV des fournisseurs.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-xl">
        <div className="modal-header">
          <h3>📥 Importer une liste de fournisseurs (CSV)</h3>
          <button type="button" className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <p className="muted" style={{ marginTop: 0 }}>
          Colonne obligatoire : <code>name</code> (ou <code>fournisseur</code>). Colonnes supportées :{' '}
          <code>primary_contact</code> (contact principal), <code>phone</code> (téléphone),{' '}
          <code>email</code>, <code>address</code>, <code>nif</code>, <code>notes</code>.
        </p>

        <div className="row-actions" style={{ marginBottom: 14 }}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFileChange} />
          <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
            📂 Choisir un fichier CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={downloadSuppliersCsvTemplate}>
            📄 Télécharger un modèle CSV
          </button>
          {fileName && <span className="pill">Fichier : {fileName}</span>}
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
                    <th>Fournisseur</th>
                    <th>Contact principal</th>
                    <th>Téléphone</th>
                    <th>Email</th>
                    <th>Adresse</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.rows.map((r) => (
                    <tr key={r.lineNum} className={!r.valid ? 'row-low-stock' : ''}>
                      <td>#{r.lineNum}</td>
                      <td>
                        <b>{r.name || '—'}</b>
                        {r.nif && <div className="muted" style={{ fontSize: 11 }}>NIF: {r.nif}</div>}
                      </td>
                      <td>{r.contact_name || <span className="muted">—</span>}</td>
                      <td>{r.phone || <span className="muted">—</span>}</td>
                      <td>{r.email || <span className="muted">—</span>}</td>
                      <td>{r.address || <span className="muted">—</span>}</td>
                      <td>
                        {r.valid ? (
                          <span className="pill pill-ok">
                            {r.isNew ? '✓ Nouveau' : '✓ Mise à jour'}
                          </span>
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
              : `Importer ${validation?.validCount || 0} fournisseur(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
