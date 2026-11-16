import React, { useState, useEffect } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';
import ReceiptModal from './ReceiptModal';

export default function ReportsView({ user, settings, onSettingsUpdated, lang, t }) {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [previewSale, setPreviewSale] = useState(null);

  const [openReg, setOpenReg] = useState(null);
  const [regHistory, setRegHistory] = useState([]);
  const [openingCash, setOpeningCash] = useState('5000');
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const [storeForm, setStoreForm] = useState(settings);

  useEffect(() => {
    setStoreForm(settings);
  }, [settings]);

  const loadAll = async () => {
    setStats(await posApi.getDashboardStats());
    setSales(await posApi.listSales({ search }));
    setOpenReg(await posApi.getOpenRegister());
    setRegHistory(await posApi.listRegisterHistory());
  };

  useEffect(() => { loadAll(); }, [search]);

  const handleOpenSale = async (id) => {
    setPreviewSale(await posApi.getSaleDetails(id));
  };

  const handleCancelSale = async (sale) => {
    const reason = window.prompt(`Motif d'annulation du ticket ${sale.ticket_number} ?`);
    if (!reason) return;
    await posApi.cancelSale({ saleId: sale.id, reason, userId: user.id });
    loadAll();
  };

  const handleOpenCash = async () => {
    await posApi.openRegister({ openingCash: Number(openingCash) || 0, userId: user.id });
    loadAll();
  };

  const handleCloseCash = async () => {
    if (!openReg || countedCash === '') return;
    if (!window.confirm('Confirmer la clÃ´ture dÃ©finitive de la caisse ?')) return;
    await posApi.closeRegister({
      id: openReg.id,
      countedCash: Number(countedCash),
      notes: closeNotes,
      userId: user.id
    });
    setCountedCash('');
    setCloseNotes('');
    loadAll();
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const updated = await posApi.updateSettings(storeForm);
    onSettingsUpdated(updated);
    alert('ParamÃ¨tres enregistrÃ©s.');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>ðŸ“ˆ Rapports, Historique & ClÃ´ture</h2>
        <div className="row-actions">
          <button className={`btn ${tab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('dashboard')}>SynthÃ¨se du jour</button>
          <button className={`btn ${tab === 'tickets' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('tickets')}>Historique tickets</button>
          <button className={`btn ${tab === 'cash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('cash')}>ClÃ´ture de caisse</button>
          <button className={`btn ${tab === 'settings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('settings')}>ParamÃ¨tres & Sauvegarde</button>
        </div>
      </div>

      {tab === 'dashboard' && stats && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card"><span>Chiffre d'affaires (Jour)</span><strong>{formatDA(stats.revenue, lang)}</strong></div>
            <div className="kpi-card"><span>Tickets validÃ©s</span><strong>{stats.tickets_count}</strong></div>
            <div className="kpi-card"><span>Panier moyen</span><strong>{formatDA(stats.avg_basket, lang)}</strong></div>
            <div className="kpi-card"><span>BÃ©nÃ©fice estimÃ©</span><strong className="txt-ok">{formatDA(stats.estimated_profit, lang)}</strong></div>
          </div>

          <div className="split-2" style={{ marginTop: 18 }}>
            <div className="card-box">
              <h4>RÃ©partition paiements (Jour)</h4>
              <div className="stat-line"><span>ðŸ’µ EspÃ¨ces</span><b>{formatDA(stats.cash_total, lang)}</b></div>
              <div className="stat-line"><span>ðŸ’³ Carte / CIB</span><b>{formatDA(stats.card_total, lang)}</b></div>
              <div className="stat-line"><span>ðŸ“’ CrÃ©dit client</span><b>{formatDA(stats.credit_total, lang)}</b></div>
            </div>
            <div className="card-box">
              <h4>Top 10 produits</h4>
              {stats.top_products.map((tp, i) => (
                <div key={i} className="stat-line">
                  <span>{i + 1}. {tp.product_name}</span>
                  <b>{tp.qty_sold} u. ({formatDA(tp.total_sales, lang)})</b>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'tickets' && (
        <>
          <input
            className="input-lg"
            style={{ marginBottom: 12, maxWidth: 400 }}
            placeholder="Rechercher par nÂ° ticket ou client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="card-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>NÂ° Ticket</th>
                  <th>Date</th>
                  <th>Caissier</th>
                  <th>Mode</th>
                  <th className="text-end">Total</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.ticket_number}</b></td>
                    <td>{new Date(s.created_at.replace(' ', 'T') + 'Z').toLocaleString('fr-FR')}</td>
                    <td>{s.cashier_name}</td>
                    <td>{s.payment_method} {s.customer_name && `(${s.customer_name})`}</td>
                    <td className="text-end bold">{formatDA(s.total, lang)}</td>
                    <td>
                      <span className={`pill ${s.status === 'completed' ? 'pill-ok' : 'pill-danger'}`}>
                        {s.status === 'completed' ? 'ValidÃ©' : 'AnnulÃ©'}
                      </span>
                    </td>
                    <td>
                      <button className="btn-sm" onClick={() => handleOpenSale(s.id)}>ðŸ–¨ Voir</button>
                      {s.status === 'completed' && (
                        <button className="btn-sm btn-danger-txt" onClick={() => handleCancelSale(s)}>Annuler</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'cash' && (
        <div className="split-2">
          <div className="card-box">
            {!openReg ? (
              <>
                <h3>Ouvrir la caisse</h3>
                <label className="field-label">Fond de caisse initial (DA)</label>
                <input type="number" className="input-lg" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleOpenCash}>Ouvrir la session de caisse</button>
              </>
            ) : (
              <>
                <h3>Session de caisse ouverte</h3>
                <div className="stat-line"><span>Fond d'ouverture</span><b>{formatDA(openReg.opening_cash, lang)}</b></div>
                <div className="stat-line"><span>Ventes espÃ¨ces encaissÃ©es</span><b>{formatDA(openReg.cash_sales_since_open, lang)}</b></div>
                <div className="stat-line"><span>Total espÃ¨ces attendu</span><b className="txt-ok">{formatDA(openReg.expected_cash, lang)}</b></div>
                <hr />
                <label className="field-label">EspÃ¨ces rÃ©elles comptÃ©es dans le tiroir (DA)</label>
                <input type="number" className="input-xl" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
                {countedCash !== '' && (
                  <div className="stat-line" style={{ marginTop: 8 }}>
                    <span>Ã‰cart de caisse</span>
                    <b className={Number(countedCash) - openReg.expected_cash === 0 ? 'txt-ok' : 'txt-bad'}>
                      {formatDA(Number(countedCash) - openReg.expected_cash, lang)}
                    </b>
                  </div>
                )}
                <label className="field-label" style={{ marginTop: 8 }}>Remarques</label>
                <input className="input-lg" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
                <button className="btn btn-primary btn-lg" style={{ marginTop: 14, width: '100%' }} onClick={handleCloseCash}>
                  ClÃ´turer la caisse (Z)
                </button>
              </>
            )}
          </div>

          <div className="card-table-wrap">
            <h4 style={{ padding: '12px 16px', margin: 0 }}>Historique des clÃ´tures</h4>
            <table className="data-table">
              <thead>
                <tr><th>Date clÃ´ture</th><th>Attendu</th><th>ComptÃ©</th><th>Ã‰cart</th></tr>
              </thead>
              <tbody>
                {regHistory.filter((r) => r.closed_at).map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.closed_at.replace(' ', 'T') + 'Z').toLocaleString('fr-FR')}</td>
                    <td>{formatDA(r.expected_cash, lang)}</td>
                    <td>{formatDA(r.counted_cash, lang)}</td>
                    <td className={r.difference === 0 ? 'txt-ok' : 'txt-bad'}>{formatDA(r.difference, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="split-2">
          <form onSubmit={handleSaveSettings} className="card-box form-grid">
            <h3>Informations du ticket</h3>
            <div>
              <label className="field-label">Nom de la supÃ©rette</label>
              <input className="input-lg" value={storeForm.store_name || ''} onChange={(e) => setStoreForm({ ...storeForm, store_name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Adresse</label>
              <input className="input-lg" value={storeForm.store_address || ''} onChange={(e) => setStoreForm({ ...storeForm, store_address: e.target.value })} />
            </div>
            <div>
              <label className="field-label">TÃ©lÃ©phone</label>
              <input className="input-lg" value={storeForm.store_phone || ''} onChange={(e) => setStoreForm({ ...storeForm, store_phone: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Pied de ticket</label>
              <input className="input-lg" value={storeForm.receipt_footer || ''} onChange={(e) => setStoreForm({ ...storeForm, receipt_footer: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary">Enregistrer les paramÃ¨tres</button>
          </form>

          <div className="card-box">
            <h3>Sauvegarde & Restauration</h3>
            <p className="muted">Exportez ou restaurez toutes vos donnÃ©es (produits, ventes, stock).</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              <button className="btn btn-primary btn-lg" onClick={async () => {
                const path = await posApi.backupExport();
                if (path) alert(`Sauvegarde exportÃ©e (${path})`);
              }}>
                ðŸ’¾ Exporter une sauvegarde
              </button>
              <button className="btn btn-danger" onClick={async () => {
                if (!window.confirm('Attention : les donnÃ©es actuelles seront remplacÃ©es par la sauvegarde choisie. Continuer ?')) return;
                const ok = await posApi.backupRestore();
                if (ok) {
                  alert('Sauvegarde restaurÃ©e avec succÃ¨s.');
                  loadAll();
                }
              }}>
                â™»ï¸ Restaurer une sauvegarde
              </button>
            </div>
          </div>
        </div>
      )}

      {previewSale && (
        <ReceiptModal sale={previewSale} settings={settings} lang={lang} t={t} onClose={() => setPreviewSale(null)} />
      )}
    </div>
  );
}