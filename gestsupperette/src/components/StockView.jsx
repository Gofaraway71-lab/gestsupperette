import React, { useState, useEffect } from 'react';
import { posApi } from '../api';

export default function StockView({ user }) {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [onlyLow, setOnlyLow] = useState(true);
  const [selected, setSelected] = useState(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('RÃ©approvisionnement fournisseur');

  const load = async () => {
    setProducts(await posApi.listProducts());
    setMovements(await posApi.listStockMovements(50));
  };

  useEffect(() => { load(); }, []);

  const visibleProducts = onlyLow
    ? products.filter((p) => p.stock <= p.alert_threshold)
    : products;

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!selected || !delta) return;
    await posApi.adjustStock({
      productId: selected.id,
      delta: Number(delta),
      reason,
      userId: user.id
    });
    setSelected(null);
    setDelta('');
    load();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>ðŸ“Š Gestion du Stock</h2>
        <div className="row-actions">
          <button className={`btn ${onlyLow ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOnlyLow(true)}>
            âš ï¸ Alertes stock bas ({products.filter((p) => p.stock <= p.alert_threshold).length})
          </button>
          <button className={`btn ${!onlyLow ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOnlyLow(false)}>
            Tous les produits
          </button>
        </div>
      </div>

      <div className="split-2">
        <div className="card-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th className="text-center">Stock</th>
                <th className="text-center">Seuil</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b></td>
                  <td className="text-center">
                    <span className={`pill ${p.stock <= p.alert_threshold ? 'pill-danger' : 'pill-ok'}`}>{p.stock}</span>
                  </td>
                  <td className="text-center">{p.alert_threshold}</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => { setSelected(p); setDelta('10'); }}>
                      Â± Mouvement
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card-table-wrap">
          <h4 style={{ padding: '12px 16px', margin: 0 }}>Derniers mouvements</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Variation</th>
                <th>Motif</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.product_name}</td>
                  <td><b className={m.delta >= 0 ? 'txt-ok' : 'txt-bad'}>{m.delta > 0 ? `+${m.delta}` : m.delta}</b></td>
                  <td><small>{m.reason}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="modal-overlay">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>Ajustement : {selected.name}</h3>
              <button className="btn-icon" onClick={() => setSelected(null)}>âœ•</button>
            </div>
            <p className="muted">Stock actuel : <b>{selected.stock}</b></p>
            <form onSubmit={handleAdjust} className="form-grid">
              <div>
                <label className="field-label">QuantitÃ© (+ entrÃ©e / âˆ’ perte ou inventaire)</label>
                <input autoFocus required type="number" className="input-lg" value={delta} onChange={(e) => setDelta(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Motif</label>
                <input className="input-lg" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}