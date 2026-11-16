import React, { useState, useEffect, useRef } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';
import { exportProductsToCsv, parseCsvProducts } from '../utils/csv';

const emptyForm = {
  id: null, barcode: '', name: '', name_ar: '', category: 'Ã‰picerie',
  buy_price: '', sell_price: '', stock: '0', alert_threshold: '5'
};

export default function ProductsView({ lang, t }) {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    setProducts(await posApi.listProducts());
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) =>
    `${p.name} ${p.name_ar} ${p.barcode || ''} ${p.category}`.toLowerCase().includes(filter.toLowerCase())
  );

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
      alert('Erreur : ce code-barres existe dÃ©jÃ  sur un autre produit.');
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Supprimer le produit "${p.name}" ?`)) return;
    await posApi.deleteProduct(p.id);
    load();
  };

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvProducts(text);
    const count = await posApi.importCsv(rows);
    alert(`${count} produit(s) importÃ©(s) ou mis Ã  jour.`);
    e.target.value = '';
    load();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>ðŸ“¦ Catalogue Produits ({products.length})</h2>
        <div className="row-actions">
          <input
            className="input-search"
            placeholder="Filtrer par nom, code-barres..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleImportCsv} />
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>ðŸ“¥ Importer CSV</button>
          <button className="btn btn-secondary" onClick={() => exportProductsToCsv(products)}>ðŸ“¤ Exporter CSV</button>
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setShowModal(true); }}>+ Nouveau produit</button>
        </div>
      </div>

      <div className="card-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code-barres</th>
              <th>Nom</th>
              <th>CatÃ©gorie</th>
              <th className="text-end">Achat</th>
              <th className="text-end">Vente</th>
              <th className="text-center">Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td><code>{p.barcode || 'Vrac'}</code></td>
                <td><b>{p.name}</b> {p.name_ar && <small className="muted">({p.name_ar})</small>}</td>
                <td><span className="pill">{p.category}</span></td>
                <td className="text-end">{formatDA(p.buy_price, lang)}</td>
                <td className="text-end bold">{formatDA(p.sell_price, lang)}</td>
                <td className="text-center">
                  <span className={`pill ${p.stock <= p.alert_threshold ? 'pill-danger' : 'pill-ok'}`}>
                    {p.stock}
                  </span>
                </td>
                <td>
                  <button className="btn-sm" onClick={() => openEdit(p)}>âœï¸</button>
                  <button className="btn-sm btn-danger-txt" onClick={() => handleDelete(p)}>ðŸ—‘</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{form.id ? 'Modifier produit' : 'Nouveau produit'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>âœ•</button>
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
                  <label className="field-label">CatÃ©gorie</label>
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
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}