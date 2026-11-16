import React, { useState, useMemo, useEffect } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';
import { encodeCode128B, generateInternalEan13 } from '../utils/barcode';
import { exportBarcodeLabelsToPdf } from '../utils/barcodePdf';

const TEMPLATES_STORAGE_KEY = 'gestsupperette_label_templates_v1';
const ACTIVE_TEMPLATE_KEY = 'gestsupperette_active_label_template_v1';

const DEFAULT_TEMPLATES = [
  {
    id: 'preset_a4_std',
    name: 'Planche A4 Standard (63×38 mm)',
    layout: 'a4',
    labelWidthMm: 63,
    labelHeightMm: 38,
    columns: 3,
    fontSize: 10,
    barcodeHeightMm: 12,
    barcodeDensity: 'standard',
    showStore: true,
    showName: true,
    showPrice: true,
    builtIn: true
  },
  {
    id: 'preset_thermal_50x30',
    name: 'Thermique (50×30 mm)',
    layout: 'thermal',
    labelWidthMm: 50,
    labelHeightMm: 30,
    columns: 1,
    fontSize: 9,
    barcodeHeightMm: 10,
    barcodeDensity: 'standard',
    showStore: true,
    showName: true,
    showPrice: true,
    builtIn: true
  },
  {
    id: 'preset_compact_40x25',
    name: 'Compacte (40×25 mm)',
    layout: 'thermal',
    labelWidthMm: 40,
    labelHeightMm: 25,
    columns: 1,
    fontSize: 8,
    barcodeHeightMm: 8,
    barcodeDensity: 'compact',
    showStore: false,
    showName: true,
    showPrice: true,
    builtIn: true
  }
];

function loadSavedTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function BarcodeSvg({ code, heightMm = 12, density = 'standard' }) {
  const encoded = useMemo(() => encodeCode128B(code), [code]);
  if (!encoded.bars.length) return null;

  const widthPct = density === 'compact' ? '78%' : density === 'wide' ? '100%' : '90%';
  const svgHeight = Math.max(22, Math.round(Number(heightMm || 12) * 3.4));

  return (
    <div className="barcode-svg-wrap">
      <svg
        className="barcode-svg"
        style={{ width: widthPct, height: `${svgHeight}px` }}
        viewBox={`0 0 ${encoded.totalWidth} 50`}
        preserveAspectRatio="none"
        role="img"
        aria-label={encoded.text}
      >
        <rect x="0" y="0" width={encoded.totalWidth} height="50" fill="#ffffff" />
        {encoded.bars.map((b, idx) => (
          <rect key={idx} x={b.x} y="0" width={b.width} height="50" fill="#000000" />
        ))}
      </svg>
    </div>
  );
}

export default function BarcodeLabelModal({
  initialProducts = [],
  allProducts = [],
  settings = {},
  lang = 'fr',
  t,
  onProductUpdated,
  onClose
}) {
  const [entries, setEntries] = useState(() =>
    initialProducts.map((p) => ({
      product: p,
      code: p.barcode || '',
      copies: 1
    }))
  );
  const [addProdId, setAddProdId] = useState('');

  const [savedTemplates, setSavedTemplates] = useState(() => loadSavedTemplates());
  const allTemplates = useMemo(() => [...DEFAULT_TEMPLATES, ...savedTemplates], [savedTemplates]);

  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    const savedId = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
    return savedId || DEFAULT_TEMPLATES[0].id;
  });

  const initialTpl = useMemo(() => {
    const found = [...DEFAULT_TEMPLATES, ...loadSavedTemplates()].find((x) => x.id === selectedTemplateId);
    return found || DEFAULT_TEMPLATES[0];
  }, []);

  const [layout, setLayout] = useState(initialTpl.layout);
  const [labelWidthMm, setLabelWidthMm] = useState(initialTpl.labelWidthMm);
  const [labelHeightMm, setLabelHeightMm] = useState(initialTpl.labelHeightMm);
  const [columns, setColumns] = useState(initialTpl.columns);
  const [fontSize, setFontSize] = useState(initialTpl.fontSize);
  const [barcodeHeightMm, setBarcodeHeightMm] = useState(initialTpl.barcodeHeightMm);
  const [barcodeDensity, setBarcodeDensity] = useState(initialTpl.barcodeDensity);
  const [showStore, setShowStore] = useState(initialTpl.showStore);
  const [showName, setShowName] = useState(initialTpl.showName);
  const [showPrice, setShowPrice] = useState(initialTpl.showPrice);

  const [templateNameInput, setTemplateNameInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const storeName = settings?.store_name || 'gestsupperette';

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TEMPLATE_KEY, selectedTemplateId);
    } catch { }
  }, [selectedTemplateId]);

  const showStatus = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const applyTemplate = (tpl) => {
    if (!tpl) return;
    setSelectedTemplateId(tpl.id);
    setLayout(tpl.layout);
    setLabelWidthMm(tpl.labelWidthMm);
    setLabelHeightMm(tpl.labelHeightMm);
    setColumns(tpl.columns);
    setFontSize(tpl.fontSize);
    setBarcodeHeightMm(tpl.barcodeHeightMm);
    setBarcodeDensity(tpl.barcodeDensity);
    setShowStore(tpl.showStore);
    setShowName(tpl.showName);
    setShowPrice(tpl.showPrice);
    if (!tpl.builtIn) {
      setTemplateNameInput(tpl.name);
    }
  };

  const handleTemplateSelect = (id) => {
    const tpl = allTemplates.find((x) => x.id === id);
    if (tpl) applyTemplate(tpl);
  };

  const currentTemplateConfig = useMemo(() => ({
    layout,
    labelWidthMm: Math.max(25, Math.min(180, Number(labelWidthMm) || 63)),
    labelHeightMm: Math.max(18, Math.min(150, Number(labelHeightMm) || 38)),
    columns: Math.max(1, Math.min(5, Math.round(Number(columns) || 3))),
    fontSize: Math.max(6, Math.min(18, Number(fontSize) || 10)),
    barcodeHeightMm: Math.max(6, Math.min(30, Number(barcodeHeightMm) || 12)),
    barcodeDensity,
    showStore,
    showName,
    showPrice
  }), [layout, labelWidthMm, labelHeightMm, columns, fontSize, barcodeHeightMm, barcodeDensity, showStore, showName, showPrice]);

  const handleSaveTemplate = () => {
    setErrorMsg('');
    const cleanName = templateNameInput.trim();
    if (!cleanName) {
      setErrorMsg('Veuillez saisir un nom pour enregistrer ce modèle.');
      return;
    }

    const existing = savedTemplates.find((x) => x.name.toLowerCase() === cleanName.toLowerCase());
    let nextList;
    let nextId;
    if (existing) {
      nextId = existing.id;
      nextList = savedTemplates.map((x) =>
        x.id === existing.id ? { ...currentTemplateConfig, id: existing.id, name: cleanName, builtIn: false } : x
      );
    } else {
      nextId = `tpl_${Date.now()}`;
      nextList = [
        ...savedTemplates,
        { ...currentTemplateConfig, id: nextId, name: cleanName, builtIn: false }
      ];
    }

    setSavedTemplates(nextList);
    setSelectedTemplateId(nextId);
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(nextList));
      showStatus(`Modèle « ${cleanName} » enregistré.`);
    } catch {
      setErrorMsg('Impossible d’enregistrer le modèle dans le navigateur.');
    }
  };

  const handleDeleteTemplate = () => {
    const active = savedTemplates.find((x) => x.id === selectedTemplateId);
    if (!active) return;
    const nextList = savedTemplates.filter((x) => x.id !== active.id);
    setSavedTemplates(nextList);
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(nextList));
    } catch { }
    applyTemplate(DEFAULT_TEMPLATES[0]);
    setTemplateNameInput('');
    showStatus(`Modèle « ${active.name} » supprimé.`);
  };

  const updateEntry = (idx, patch) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const removeEntry = (idx) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddProduct = () => {
    const prod = allProducts.find((p) => p.id === Number(addProdId));
    if (!prod) return;
    if (entries.some((e) => e.product.id === prod.id)) {
      setEntries((prev) =>
        prev.map((e) => (e.product.id === prod.id ? { ...e, copies: Number(e.copies || 1) + 1 } : e))
      );
    } else {
      setEntries((prev) => [...prev, { product: prod, code: prod.barcode || '', copies: 1 }]);
    }
    setAddProdId('');
  };

  const handleGenerateAndSaveCode = async (idx) => {
    const target = entries[idx];
    if (!target) return;
    setErrorMsg('');
    const newCode = generateInternalEan13(target.product.id);
    try {
      const updated = await posApi.upsertProduct({
        ...target.product,
        barcode: newCode
      });
      updateEntry(idx, { product: updated, code: updated.barcode });
      onProductUpdated?.();
    } catch (err) {
      setErrorMsg(err?.message || 'Impossible de générer un code unique.');
    }
  };

  const printableLabels = useMemo(() => {
    const list = [];
    entries.forEach((e) => {
      const cleanCode = String(e.code || '').trim();
      if (!cleanCode) return;
      const count = Math.max(1, Math.min(100, Math.round(Number(e.copies) || 1)));
      for (let i = 0; i < count; i++) {
        list.push({
          key: `${e.product.id}-${i}`,
          product: e.product,
          code: cleanCode
        });
      }
    });
    return list;
  }, [entries]);

  const handlePrint = async () => {
    await posApi.printReceipt();
  };

  const handleExportPdf = () => {
    if (printableLabels.length === 0) return;
    setErrorMsg('');
    try {
      exportBarcodeLabelsToPdf({
        labels: printableLabels,
        template: currentTemplateConfig,
        storeName,
        lang,
        formatPrice: formatDA
      });
      showStatus(`PDF généré (${printableLabels.length} étiquette${printableLabels.length > 1 ? 's' : ''}).`);
    } catch (err) {
      setErrorMsg(err?.message || 'Erreur lors de l’export PDF.');
    }
  };

  const isCustomTemplateSelected = savedTemplates.some((x) => x.id === selectedTemplateId);

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-xl">
        <div className="modal-header no-print">
          <h3>🏷️ Générateur & Impression d&apos;Étiquettes Code-barres</h3>
          <button type="button" className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {errorMsg && <div className="alert-error no-print">{errorMsg}</div>}
        {statusMsg && <div className="toast-banner no-print" style={{ marginBottom: 10 }}>{statusMsg}</div>}

        <div className="invoice-box no-print" style={{ marginBottom: 12 }}>
          <div className="row-actions" style={{ marginBottom: 10 }}>
            <select
              className="input-sm"
              style={{ flex: 1 }}
              value={addProdId}
              onChange={(e) => setAddProdId(e.target.value)}
            >
              <option value="">+ Ajouter un produit à la planche d&apos;étiquettes...</option>
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.barcode || 'Sans code-barres'})
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={handleAddProduct} disabled={!addProdId}>
              + Ajouter
            </button>
          </div>

          <div className="csv-preview-wrap" style={{ maxHeight: 165, marginBottom: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Code produit (source code-barres)</th>
                  <th className="text-center" style={{ width: 95 }}>Nb copies</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={entry.product.id}>
                    <td>
                      <b>{entry.product.name}</b>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {formatDA(entry.product.sell_price, lang)}
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <input
                          className="input-sm"
                          style={{ flex: 1, fontFamily: 'monospace' }}
                          placeholder="Code-barres requis..."
                          value={entry.code}
                          onChange={(e) => updateEntry(idx, { code: e.target.value })}
                        />
                        {!entry.product.barcode && (
                          <button
                            type="button"
                            className="btn-sm btn-primary"
                            title="Générer et enregistrer un code EAN-13 interne sur ce produit"
                            onClick={() => handleGenerateAndSaveCode(idx)}
                          >
                            ⚡ Générer
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="input-sm text-center"
                        value={entry.copies}
                        onChange={(e) => updateEntry(idx, { copies: e.target.value })}
                      />
                    </td>
                    <td className="text-center">
                      <button type="button" className="btn-del" onClick={() => removeEntry(idx)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="label-templates-panel">
            <div className="label-templates-row">
              <div className="label-tpl-field">
                <label className="field-label">Modèle enregistré</label>
                <div className="row-actions">
                  <select
                    className="input-sm"
                    style={{ flex: 1 }}
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                  >
                    <optgroup label="Modèles par défaut">
                      {DEFAULT_TEMPLATES.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                      ))}
                    </optgroup>
                    {savedTemplates.length > 0 && (
                      <optgroup label="Mes modèles personnalisés">
                        {savedTemplates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>⭐ {tpl.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {isCustomTemplateSelected && (
                    <button
                      type="button"
                      className="btn-sm btn-danger-txt"
                      title="Supprimer ce modèle personnalisé"
                      onClick={handleDeleteTemplate}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>

              <div className="label-tpl-field">
                <label className="field-label">Enregistrer comme modèle</label>
                <div className="row-actions">
                  <input
                    type="text"
                    className="input-sm"
                    style={{ flex: 1 }}
                    placeholder="Ex: Rayon frais 55×35"
                    value={templateNameInput}
                    onChange={(e) => setTemplateNameInput(e.target.value)}
                  />
                  <button type="button" className="btn-sm btn-primary" onClick={handleSaveTemplate}>
                    💾 Enregistrer
                  </button>
                </div>
              </div>
            </div>

            <div className="label-settings-grid">
              <div>
                <label className="field-label">Format</label>
                <select
                  className="input-sm"
                  value={layout}
                  onChange={(e) => {
                    const nextLayout = e.target.value;
                    setLayout(nextLayout);
                    if (nextLayout === 'thermal' && labelWidthMm === 63 && labelHeightMm === 38) {
                      setLabelWidthMm(50);
                      setLabelHeightMm(30);
                    } else if (nextLayout === 'a4' && labelWidthMm === 50 && labelHeightMm === 30) {
                      setLabelWidthMm(63);
                      setLabelHeightMm(38);
                    }
                  }}
                >
                  <option value="a4">📄 Planche A4</option>
                  <option value="thermal">🏷️ Thermique (rouleau)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Largeur (mm)</label>
                <input
                  type="number"
                  min="25"
                  max="180"
                  className="input-sm"
                  value={labelWidthMm}
                  onChange={(e) => setLabelWidthMm(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Hauteur (mm)</label>
                <input
                  type="number"
                  min="18"
                  max="150"
                  className="input-sm"
                  value={labelHeightMm}
                  onChange={(e) => setLabelHeightMm(e.target.value)}
                />
              </div>
              {layout === 'a4' && (
                <div>
                  <label className="field-label">Colonnes A4</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    className="input-sm"
                    value={columns}
                    onChange={(e) => setColumns(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="field-label">Police (pt)</label>
                <input
                  type="number"
                  min="6"
                  max="18"
                  className="input-sm"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Hauteur barres (mm)</label>
                <input
                  type="number"
                  min="6"
                  max="30"
                  className="input-sm"
                  value={barcodeHeightMm}
                  onChange={(e) => setBarcodeHeightMm(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Densité code-barres</label>
                <select
                  className="input-sm"
                  value={barcodeDensity}
                  onChange={(e) => setBarcodeDensity(e.target.value)}
                >
                  <option value="compact">Compacte</option>
                  <option value="standard">Standard</option>
                  <option value="wide">Large</option>
                </select>
              </div>
            </div>

            <div className="row-actions" style={{ marginTop: 10 }}>
              <label className="checkbox-row">
                <input type="checkbox" checked={showStore} onChange={(e) => setShowStore(e.target.checked)} />
                <span>Magasin</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
                <span>Nom</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
                <span>Prix</span>
              </label>
            </div>
          </div>
        </div>

        <div className="barcode-preview-scroll">
          {printableLabels.length === 0 ? (
            <div className="scan-history-empty">
              Aucun code-barres valide à afficher. Saisissez ou générez un code produit ci-dessus.
            </div>
          ) : (
            <div
              id="printable-barcode-labels"
              className={`barcode-labels-sheet ${layout === 'thermal' ? 'is-thermal' : 'is-a4'}`}
              style={{
                gridTemplateColumns:
                  layout === 'thermal'
                    ? `${currentTemplateConfig.labelWidthMm}mm`
                    : `repeat(${currentTemplateConfig.columns}, minmax(0, ${currentTemplateConfig.labelWidthMm}mm))`
              }}
            >
              {printableLabels.map((lbl) => {
                const prodName = lang === 'ar' && lbl.product.name_ar ? lbl.product.name_ar : lbl.product.name;
                return (
                  <div
                    key={lbl.key}
                    className="barcode-label-card"
                    style={{
                      minHeight: `${currentTemplateConfig.labelHeightMm}mm`,
                      fontSize: `${currentTemplateConfig.fontSize}pt`
                    }}
                  >
                    {showStore && (
                      <div
                        className="barcode-label-store"
                        style={{ fontSize: `${Math.max(6, currentTemplateConfig.fontSize * 0.72)}pt` }}
                      >
                        {storeName}
                      </div>
                    )}
                    {showName && (
                      <div
                        className="barcode-label-name"
                        style={{ fontSize: `${currentTemplateConfig.fontSize}pt` }}
                      >
                        {prodName}
                      </div>
                    )}
                    <BarcodeSvg
                      code={lbl.code}
                      heightMm={currentTemplateConfig.barcodeHeightMm}
                      density={currentTemplateConfig.barcodeDensity}
                    />
                    <div className="barcode-label-footer">
                      <span
                        className="barcode-label-code"
                        style={{ fontSize: `${Math.max(6, currentTemplateConfig.fontSize * 0.85)}pt` }}
                      >
                        {lbl.code}
                      </span>
                      {showPrice && (
                        <strong
                          className="barcode-label-price"
                          style={{ fontSize: `${Math.max(7, currentTemplateConfig.fontSize * 1.05)}pt` }}
                        >
                          {formatDA(lbl.product.sell_price, lang)}
                        </strong>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-actions no-print">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t.close}</button>
          <button
            type="button"
            className="btn btn-outline"
            disabled={printableLabels.length === 0}
            onClick={handleExportPdf}
          >
            📄 Exporter PDF
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={printableLabels.length === 0}
            onClick={handlePrint}
          >
            🖨️ Imprimer ({printableLabels.length} étiquette{printableLabels.length > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}
