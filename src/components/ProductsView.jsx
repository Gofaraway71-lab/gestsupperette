import React, { useState, useEffect } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';
import { exportProductsToCsv } from '../utils/csv';
import CsvStockImportModal from './CsvStockImportModal';
import BarcodeLabelModal from './BarcodeLabelModal';
import BulkEditModal from './BulkEditModal';
import ProductThumb from './ProductThumb';

const emptyForm = {
  id: null, barcode: '', name: '', name_ar: '', category: 'Épicerie',
  buy_price: '', sell_price: '', stock: '0', alert_threshold: '5',
  image: '', is_favorite: 0
};

const MIN_THRESHOLD_KEY = 'pos_min_stock_threshold';

export default function ProductsView({ user, settings = {}, lang, t }) {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('');
  const [minThreshold, setMinThreshold] = useState(() => {
    const saved = localStorage.getItem(MIN_THRESHOLD_KEY);
    return saved !== null ? saved : '30';
  });
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [labelProducts, setLabelProducts] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [toast, setToast] = useState('');

  const load = async () => {
    setProducts(await posApi.listProducts());
  };

  useEffect(() => { load(); }, []);

  const handleThresholdChange = (val) => {
    setMinThreshold(val);
    localStorage.setItem(MIN_THRESHOLD_KEY, val);
  };

  const hasGlobalThreshold = minThreshold !== '' && !Number.isNaN(Number(minThreshold));
  const getThreshold = (p) => (hasGlobalThreshold ? Math.max(0, Number(minThreshold)) : Number(p.alert_threshold || 0));
  const isLowStock = (p) => Number(p.stock) < getThreshold(p);

  const lowStockCount = products.filter(isLowStock).length;

  const filtered = products.filter((p) => {
    const matchesSearch = `${p.name} ${p.name_ar} ${p.barcode || ''} ${p.category}`
      .toLowerCase()
      .includes(filter.toLowerCase());
    if (!matchesSearch) return false;
    return onlyLowStock ? isLowStock(p) : true;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.includes(p.id));

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filtered.map((p) => p.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((p) => p.id)])));
    }
  };

  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));
  const existingCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();

  const openBatchLabels = () => {
    if (selectedProducts.length > 0) {
      setLabelProducts(selectedProducts);
      return;
    }
    const withBarcode = filtered.filter((p) => p.barcode);
    setLabelProducts(withBarcode.length > 0 ? withBarcode : filtered.slice(0, 1));
  };

  const openEdit = (p) => {
    setForm({ ...p, barcode: p.barcode || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await posApi.upsertProduct(form);
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch {
      alert('Erreur : ce code-barres existe déjà sur un autre produit.');
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Supprimer le produit "${p.name}" ?`)) return;
    await posApi.deleteProduct(p.id);
    setSelectedIds((prev) => prev.filter((id) => id !== p.id));
    load();
  };

  const handleToggleFavorite = async (p) => {
    await posApi.toggleProductFavorite(p.id);
    load();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, image: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>📦 Catalogue Produits ({products.length})</h2>
        <div className="row-actions">
          <label className="threshold-control" title={t.belowThresholdTitle}>
            <span>⚠️ {t.minThreshold} :</span>
            <input
              type="number"
              min="0"
              className="threshold-input"
              placeholder={t.perProductThreshold}
              value={minThreshold}
              onChange={(e) => handleThresholdChange(e.target.value)}
            />
            {minThreshold !== '' && (
              <button
                type="button"
                className="btn-icon"
                title={t.perProductThreshold}
                onClick={() => handleThresholdChange('')}
              >
                ✕
              </button>
            )}
          </label>
          <button
            type="button"
            className={`btn btn-filter-warn ${onlyLowStock ? 'active' : ''}`}
            onClick={() => setOnlyLowStock((prev) => !prev)}
          >
            ⚠️ {t.onlyLowStock} ({lowStockCount})
          </button>
          <input
            className="input-search"
            placeholder="Filtrer par nom, code-barres..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={products.length === 0}
            onClick={openBatchLabels}
          >
            🏷️ Étiquettes{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCsvModal(true)}>📥 Importer CSV</button>
          <button className="btn btn-secondary" onClick={() => exportProductsToCsv(products)}>📤 Exporter CSV</button>
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setShowModal(true); }}>+ Nouveau produit</button>
        </div>
      </div>

      {toast && <div className="toast-banner" style={{ marginBottom: 12 }}>{toast}</div>}

      {selectedProducts.length > 0 && (
        <div className="bulk-action-bar">
          <div>
            <strong>{selectedProducts.length}</strong> {t.bulkSelectedCount}
          </div>
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowBulkModal(true)}
            >
              ✏️ {t.bulkEditBtn}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={openBatchLabels}
            >
              🏷️ Étiquettes ({selectedProducts.length})
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedIds([])}
            >
              ✕ {t.bulkClearSelection}
            </button>
          </div>
        </div>
      )}

      <div className="card-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-center" style={{ width: 38 }}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  title="Tout sélectionner pour impression d'étiquettes"
                />
              </th>
              <th>Code-barres</th>
              <th>Nom</th>
              <th>Catégorie</th>
              <th className="text-end">Achat</th>
              <th className="text-end">Vente</th>
              <th className="text-center">Stock</th>
              <th className="text-center">{t.thresholdCol}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const threshold = getThreshold(p);
              const low = isLowStock(p);
              const isSelected = selectedIds.includes(p.id);
              return (
                <tr key={p.id} className={`${low ? 'row-low-stock' : ''} ${isSelected ? 'row-selected' : ''}`}>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => toggleSelectOne(p.id)}
                      aria-label={`Sélectionner ${p.name}`}
                    />
                  </td>
                  <td><code>{p.barcode || 'Vrac'}</code></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ProductThumb product={p} size={32} />
                      <div>
                        <b className={low ? 'txt-bad' : ''}>
                          {low && <span aria-hidden="true">⚠️ </span>}
                          {p.name}
                        </b>{' '}
                        {p.name_ar && <small className="muted">({p.name_ar})</small>}
                      </div>
                    </div>
                  </td>
                  <td><span className="pill">{p.category}</span></td>
                  <td className="text-end">{formatDA(p.buy_price, lang)}</td>
                  <td className="text-end bold">{formatDA(p.sell_price, lang)}</td>
                  <td className="text-center">
                    <span
                      className={`pill ${low ? 'pill-danger stock-warn-pill' : 'pill-ok'}`}
                      title={low ? `${t.belowThresholdTitle} (${p.stock} < ${threshold})` : undefined}
                    >
                      {low && <span aria-hidden="true">⚠️</span>}
                      {p.stock}
                    </span>
                    {low && <span className="stock-warn-label">{t.belowThreshold}</span>}
                  </td>
                  <td className="text-center muted">{threshold}</td>
                  <td>
                    <button
                      className="fav-star-btn"
                      title={Number(p.is_favorite) === 1 ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      onClick={() => handleToggleFavorite(p)}
                    >
                      {Number(p.is_favorite) === 1 ? '⭐' : '☆'}
                    </button>
                    <button
                      className="btn-sm"
                      title="Générer / imprimer étiquette code-barres"
                      onClick={() => setLabelProducts([p])}
                    >
                      🏷️
                    </button>
                    <button className="btn-sm" onClick={() => openEdit(p)}>✏️</button>
                    <button className="btn-sm btn-danger-txt" onClick={() => handleDelete(p)}>🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{form.id ? 'Modifier produit' : 'Nouveau produit'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="form-grid">
              <div>
                <label className="field-label">Code-barres (scannez directement ici, laisser vide si vrac)</label>
                <input
                  autoFocus
                  className="input-lg"
                  value={form.barcode}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                />
              </div>
              <div className="row-2">
                <div>
                  <label className="field-label">Nom (FR) *</label>
                  <input required className="input-lg" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Nom (AR optionnel)</label>
                  <input dir="rtl" className="input-lg" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
                </div>
              </div>
              <div className="row-2">
                <div>
                  <label className="field-label">Prix d'achat (DA)</label>
                  <input type="number" className="input-lg" value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Prix de vente (DA) *</label>
                  <input required type="number" className="input-lg" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} />
                </div>
              </div>
              <div className="row-3">
                <div>
                  <label className="field-label">Catégorie</label>
                  <input className="input-lg" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Stock actuel</label>
                  <input type="number" className="input-lg" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Seuil d'alerte</label>
                  <input type="number" className="input-lg" value={form.alert_threshold} onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="field-label">Image du produit (URL ou fichier local, optionnel)</label>
                <div className="row-actions">
                  <ProductThumb product={form} size={40} />
                  <input
                    className="input-lg"
                    style={{ flex: 1 }}
                    placeholder="https://... ou choisir un fichier"
                    value={form.image || ''}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                  />
                  <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                    📷 Fichier
                    <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Number(form.is_favorite) === 1}
                  onChange={(e) => setForm({ ...form, is_favorite: e.target.checked ? 1 : 0 })}
                />
                <span>⭐ Afficher dans les produits favoris (Caisse)</span>
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCsvModal && (
        <CsvStockImportModal
          products={products}
          user={user}
          lang={lang}
          onImported={(res) => {
            setShowCsvModal(false);
            load();
            setToast(`Import CSV terminé : ${res.updatedCount} mis à jour, ${res.createdCount} créé(s).`);
            setTimeout(() => setToast(''), 4000);
          }}
          onClose={() => setShowCsvModal(false)}
        />
      )}
      {labelProducts && (
        <BarcodeLabelModal
          initialProducts={labelProducts}
          allProducts={products}
          settings={settings}
          lang={lang}
          t={t}
          onProductUpdated={load}
          onClose={() => setLabelProducts(null)}
        />
      )}
      {showBulkModal && selectedProducts.length > 0 && (
        <BulkEditModal
          selectedProducts={selectedProducts}
          existingCategories={existingCategories}
          lang={lang}
          t={t}
          onApplied={(count) => {
            setShowBulkModal(false);
            setSelectedIds([]);
            load();
            setToast(`${count} produit(s) mis à jour en masse.`);
            setTimeout(() => setToast(''), 4000);
          }}
          onClose={() => setShowBulkModal(false)}
        />
      )}
    </div>
  );
}