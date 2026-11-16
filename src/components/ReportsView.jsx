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
    if (!window.confirm('Confirmer la clôture définitive de la caisse ?')) return;
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
    alert('Paramètres enregistrés.');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>📈 Rapports, Historique & Clôture</h2>
        <div className="row-actions">
          <button className={`btn ${tab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('dashboard')}>Synthèse du jour</button>
          <button className={`btn ${tab === 'tickets' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('tickets')}>Historique tickets</button>
          <button className={`btn ${tab === 'cash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('cash')}>Clôture de caisse</button>
          <button className={`btn ${tab === 'settings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('settings')}>Paramètres & Sauvegarde</button>
        </div>
      </div>

      {tab === 'dashboard' && stats && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card"><span>Chiffre d'affaires (Jour)</span><strong>{formatDA(stats.revenue, lang)}</strong></div>
            <div className="kpi-card"><span>Tickets validés</span><strong>{stats.tickets_count}</strong></div>
            <div className="kpi-card"><span>Panier moyen</span><strong>{formatDA(stats.avg_basket, lang)}</strong></div>
            <div className="kpi-card"><span>Bénéfice estimé (Jour)</span><strong className="txt-ok">{formatDA(stats.estimated_profit, lang)}</strong></div>
            <div className="kpi-card">
              <span>📊 {t.profitMarginKpi}</span>
              <strong className={stats.net_margin_amount >= 0 ? 'txt-ok' : 'txt-bad'}>
                {stats.total_sales_revenue > 0 ? `${stats.profit_margin_pct.toFixed(1)} %` : '—'}
              </strong>
              <div className="kpi-sub">
                <div>{t.totalSalesLabel} : <b>{formatDA(stats.total_sales_revenue, lang)}</b></div>
                <div>{t.invoiceCostsLabel} : <b>{formatDA(stats.supplier_invoice_costs, lang)}</b></div>
                <div>
                  {t.netMarginLabel} :{' '}
                  <b className={stats.net_margin_amount >= 0 ? 'txt-ok' : 'txt-bad'}>
                    {stats.net_margin_amount > 0 ? '+' : ''}
                    {formatDA(stats.net_margin_amount, lang)}
                  </b>
                </div>
              </div>
            </div>
          </div>

          <div className="split-2" style={{ marginTop: 18 }}>
            <div className="card-box">
              <h4>Répartition paiements (Jour)</h4>
              <div className="stat-line"><span>💵 Espèces</span><b>{formatDA(stats.cash_total, lang)}</b></div>
              <div className="stat-line"><span>💳 Carte / CIB</span><b>{formatDA(stats.card_total, lang)}</b></div>
              <div className="stat-line"><span>📒 Crédit client</span><b>{formatDA(stats.credit_total, lang)}</b></div>
            </div>
            <div className="card-box">
              <h4>Top 10 produits</h4>
              {stats.top_products.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>{t.noSalesProfitYet}</div>
              ) : (
                stats.top_products.map((tp, i) => (
                  <div key={i} className="stat-line">
                    <span>{i + 1}. {tp.product_name}</span>
                    <b>{tp.qty_sold} u. ({formatDA(tp.total_sales, lang)})</b>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card-table-wrap" style={{ marginTop: 18 }}>
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <h4 style={{ margin: 0 }}>💹 {t.productProfitabilityTitle}</h4>
              <span className="muted" style={{ fontSize: 12 }}>
                {t.totalSalesLabel} : {formatDA(stats.total_sales_revenue, lang)} • {t.invoiceCostsLabel} : {formatDA(stats.supplier_invoice_costs, lang)}
              </span>
            </div>
            {(!stats.product_profitability || stats.product_profitability.length === 0) ? (
              <div style={{ padding: 18 }} className="muted">{t.noSalesProfitYet}</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t.product}</th>
                    <th className="text-center">{t.qty}</th>
                    <th className="text-end">{t.totalSalesLabel}</th>
                    <th className="text-end">{t.unitCostCol}</th>
                    <th className="text-end">{t.profitCol}</th>
                    <th className="text-center">{t.marginPctCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.product_profitability.map((row) => {
                    const pillCls = row.margin_pct >= 20 ? 'pill-ok' : row.margin_pct >= 0 ? 'pill-warn' : 'pill-danger';
                    return (
                      <tr key={row.product_id}>
                        <td>
                          <b>{row.product_name}</b>{' '}
                          <span className={`pill ${row.cost_source === 'invoice' ? 'pill-ok' : ''}`} style={{ fontSize: 11 }}>
                            {row.cost_source === 'invoice' ? t.costSourceInvoice : t.costSourceCatalog}
                          </span>
                        </td>
                        <td className="text-center">{row.qty_sold}</td>
                        <td className="text-end">{formatDA(row.sales_revenue, lang)}</td>
                        <td className="text-end muted">{formatDA(row.total_cost, lang)}</td>
                        <td className={`text-end bold ${row.profit >= 0 ? 'txt-ok' : 'txt-bad'}`}>
                          {row.profit > 0 ? '+' : ''}{formatDA(row.profit, lang)}
                        </td>
                        <td className="text-center">
                          <span className={`pill ${pillCls}`}>{row.margin_pct.toFixed(1)} %</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'tickets' && (
        <>
          <input
            className="input-lg"
            style={{ marginBottom: 12, maxWidth: 400 }}
            placeholder="Rechercher par n° ticket ou client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="card-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N° Ticket</th>
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
                        {s.status === 'completed' ? 'Validé' : 'Annulé'}
                      </span>
                    </td>
                    <td>
                      <button className="btn-sm" onClick={() => handleOpenSale(s.id)}>🖨 Voir</button>
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
                <div className="stat-line"><span>Ventes espèces encaissées</span><b>{formatDA(openReg.cash_sales_since_open, lang)}</b></div>
                <div className="stat-line"><span>Total espèces attendu</span><b className="txt-ok">{formatDA(openReg.expected_cash, lang)}</b></div>
                <hr />
                <label className="field-label">Espèces réelles comptées dans le tiroir (DA)</label>
                <input type="number" className="input-xl" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
                {countedCash !== '' && (
                  <div className="stat-line" style={{ marginTop: 8 }}>
                    <span>Écart de caisse</span>
                    <b className={Number(countedCash) - openReg.expected_cash === 0 ? 'txt-ok' : 'txt-bad'}>
                      {formatDA(Number(countedCash) - openReg.expected_cash, lang)}
                    </b>
                  </div>
                )}
                <label className="field-label" style={{ marginTop: 8 }}>Remarques</label>
                <input className="input-lg" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
                <button className="btn btn-primary btn-lg" style={{ marginTop: 14, width: '100%' }} onClick={handleCloseCash}>
                  Clôturer la caisse (Z)
                </button>
              </>
            )}
          </div>

          <div className="card-table-wrap">
            <h4 style={{ padding: '12px 16px', margin: 0 }}>Historique des clôtures</h4>
            <table className="data-table">
              <thead>
                <tr><th>Date clôture</th><th>Attendu</th><th>Compté</th><th>Écart</th></tr>
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
              <label className="field-label">Nom de la supérette</label>
              <input className="input-lg" value={storeForm.store_name || ''} onChange={(e) => setStoreForm({ ...storeForm, store_name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Adresse</label>
              <input className="input-lg" value={storeForm.store_address || ''} onChange={(e) => setStoreForm({ ...storeForm, store_address: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Téléphone</label>
              <input className="input-lg" value={storeForm.store_phone || ''} onChange={(e) => setStoreForm({ ...storeForm, store_phone: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Pied de ticket</label>
              <input className="input-lg" value={storeForm.receipt_footer || ''} onChange={(e) => setStoreForm({ ...storeForm, receipt_footer: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary">Enregistrer les paramètres</button>
          </form>

          <div className="card-box">
            <h3>Sauvegarde & Restauration</h3>
            <p className="muted">Exportez ou restaurez toutes vos données (produits, ventes, stock).</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              <button className="btn btn-primary btn-lg" onClick={async () => {
                const path = await posApi.backupExport();
                if (path) alert(`Sauvegarde exportée (${path})`);
              }}>
                💾 Exporter une sauvegarde
              </button>
              <button className="btn btn-danger" onClick={async () => {
                if (!window.confirm('Attention : les données actuelles seront remplacées par la sauvegarde choisie. Continuer ?')) return;
                const ok = await posApi.backupRestore();
                if (ok) {
                  alert('Sauvegarde restaurée avec succès.');
                  loadAll();
                }
              }}>
                ♻️ Restaurer une sauvegarde
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