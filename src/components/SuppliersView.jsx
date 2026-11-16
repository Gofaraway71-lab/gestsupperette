import React, { useState, useEffect, useRef } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';
import { playBeep } from '../utils/sound';
import SupplierAutocomplete from './SupplierAutocomplete';
import CsvSupplierImportModal from './CsvSupplierImportModal';

const emptySupplier = { id: null, name: '', contact_name: '', phone: '', email: '', address: '', nif: '', notes: '' };

const emptyInvoiceForm = () => ({
  supplierId: '',
  invoiceNumber: '',
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  discountAmount: '0',
  amountPaid: '0',
  paymentMethod: 'cash',
  updateStock: true,
  updateBuyPrice: true,
  notes: '',
  items: []
});

export default function SuppliersView({ user, lang, t }) {
  const [tab, setTab] = useState('invoices');
  const [suppliers, setSuppliers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoiceForm);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [pendingBarcode, setPendingBarcode] = useState('');
  const [barcodeFeedback, setBarcodeFeedback] = useState(null);
  const [selectedProdId, setSelectedProdId] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemCost, setItemCost] = useState('');
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceSuggestion, setInvoiceSuggestion] = useState({
    suggestedNumber: '',
    lastInvoiceNumber: null,
    supplierSuggestedNumber: null,
    supplierLastInvoiceNumber: null
  });
  const barcodeRef = useRef(null);

  const [detailInvoice, setDetailInvoice] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [toast, setToast] = useState('');

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadAll = async () => {
    const [sups, invs, prods] = await Promise.all([
      posApi.listSuppliers(),
      posApi.listSupplierInvoices({
        search,
        supplierId: supplierFilter ? Number(supplierFilter) : null,
        status: statusFilter
      }),
      posApi.listProducts()
    ]);
    setSuppliers(sups);
    setInvoices(invs);
    setProducts(prods);
  };

  useEffect(() => {
    loadAll();
  }, [search, supplierFilter, statusFilter]);

  const totalBilledAll = suppliers.reduce((acc, s) => acc + s.total_billed, 0);
  const totalBalanceDueAll = suppliers.reduce((acc, s) => acc + s.balance_due, 0);
  const totalInvoicesCount = suppliers.reduce((acc, s) => acc + s.invoices_count, 0);

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    await posApi.upsertSupplier(supplierForm);
    setShowSupplierModal(false);
    setSupplierForm(emptySupplier);
    await loadAll();
    notify('Fournisseur enregistré.');
  };

  const handleDeleteSupplier = async (s) => {
    if (!window.confirm(`Supprimer le fournisseur "${s.name}" ?`)) return;
    await posApi.deleteSupplier(s.id);
    await loadAll();
  };

  const openNewInvoice = async () => {
    const sug = await posApi.getNextSupplierInvoiceNumber();
    const form = { ...emptyInvoiceForm(), invoiceNumber: sug.suggestedNumber };
    setInvoiceSuggestion(sug);
    setInvoiceForm(form);
    setBarcodeInput('');
    setPendingBarcode('');
    setBarcodeFeedback(null);
    setSelectedProdId('');
    setCustomItemName('');
    setItemQty('1');
    setItemCost('');
    setInvoiceError('');
    setShowInvoiceModal(true);
  };

  const handleSelectCatalogProduct = (pid) => {
    setSelectedProdId(pid);
    setPendingBarcode('');
    setBarcodeFeedback(null);
    const prod = products.find((p) => p.id === Number(pid));
    if (prod) {
      setCustomItemName(prod.name);
      setItemCost(String(prod.buy_price || 0));
    }
  };

  const handleBarcodeLookup = async () => {
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeInput('');
    setInvoiceError('');

    const prod = (await posApi.findByBarcode(code)) || products.find((p) => p.barcode === code);
    if (prod) {
      playBeep('success');
      setPendingBarcode('');
      setInvoiceForm((prev) => {
        const existingIdx = prev.items.findIndex((it) => it.product_id === prod.id);
        if (existingIdx >= 0) {
          const next = [...prev.items];
          next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + 1 };
          return { ...prev, items: next };
        }
        return {
          ...prev,
          items: [
            ...prev.items,
            {
              key: Date.now() + Math.random(),
              product_id: prod.id,
              barcode: prod.barcode,
              product_name: prod.name,
              quantity: 1,
              unit_cost: prod.buy_price || 0
            }
          ]
        };
      });
      setBarcodeFeedback({ type: 'ok', text: `✓ ${prod.name} (${prod.barcode}) ajouté à la facture.` });
      setTimeout(() => barcodeRef.current?.focus(), 20);
    } else {
      playBeep('error');
      setSelectedProdId('');
      setPendingBarcode(code);
      setBarcodeFeedback({
        type: 'warn',
        text: `⚠️ Code-barres "${code}" inconnu dans le catalogue. Saisissez la désignation et le prix ci-dessous pour l'ajouter.`
      });
    }
  };

  const handleAddInvoiceItem = () => {
    const prod = selectedProdId ? products.find((p) => p.id === Number(selectedProdId)) : null;
    const name = (prod ? prod.name : customItemName).trim();
    const qty = Math.max(1, Math.round(Number(itemQty) || 0));
    const cost = Math.max(0, Math.round(Number(itemCost) || 0));
    if (!name) {
      setInvoiceError('Sélectionnez un produit, scannez un code-barres ou saisissez un libellé.');
      return;
    }
    setInvoiceError('');
    setInvoiceForm((prev) => {
      if (prod) {
        const existingIdx = prev.items.findIndex((it) => it.product_id === prod.id);
        if (existingIdx >= 0) {
          const next = [...prev.items];
          next[existingIdx] = {
            ...next[existingIdx],
            quantity: next[existingIdx].quantity + qty,
            unit_cost: cost
          };
          return { ...prev, items: next };
        }
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            key: Date.now() + Math.random(),
            product_id: prod ? prod.id : null,
            barcode: prod?.barcode || pendingBarcode || null,
            product_name: name,
            quantity: qty,
            unit_cost: cost
          }
        ]
      };
    });
    setSelectedProdId('');
    setPendingBarcode('');
    setBarcodeFeedback(null);
    setCustomItemName('');
    setItemQty('1');
    setItemCost('');
  };

  const updateInvoiceItem = (idx, field, val) => {
    setInvoiceForm((prev) => {
      const next = [...prev.items];
      next[idx] = { ...next[idx], [field]: Math.max(0, Math.round(Number(val) || 0)) };
      return { ...prev, items: next };
    });
  };

  const updateInvoiceItemLink = (idx, pid) => {
    const prod = pid ? products.find((p) => p.id === Number(pid)) : null;
    setInvoiceForm((prev) => {
      const next = [...prev.items];
      next[idx] = {
        ...next[idx],
        product_id: prod ? prod.id : null,
        barcode: prod ? (prod.barcode || next[idx].barcode || null) : next[idx].barcode
      };
      return { ...prev, items: next };
    });
  };

  const removeInvoiceItem = (idx) => {
    setInvoiceForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const invSubtotal = invoiceForm.items.reduce((acc, it) => acc + it.quantity * it.unit_cost, 0);
  const invDiscount = Math.max(0, Math.min(invSubtotal, Math.round(Number(invoiceForm.discountAmount) || 0)));
  const invTotal = Math.max(0, invSubtotal - invDiscount);

  const handleSaveInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceForm.supplierId) {
      setInvoiceError('Veuillez sélectionner un fournisseur.');
      return;
    }
    if (invoiceForm.items.length === 0) {
      setInvoiceError('Ajoutez au moins une ligne à la facture.');
      return;
    }
    try {
      const created = await posApi.createSupplierInvoice({
        supplierId: Number(invoiceForm.supplierId),
        invoiceNumber: invoiceForm.invoiceNumber,
        invoiceDate: invoiceForm.invoiceDate,
        dueDate: invoiceForm.dueDate,
        discountAmount: invDiscount,
        amountPaid: Number(invoiceForm.amountPaid) || 0,
        paymentMethod: invoiceForm.paymentMethod,
        updateStock: invoiceForm.updateStock,
        updateBuyPrice: invoiceForm.updateBuyPrice,
        notes: invoiceForm.notes,
        items: invoiceForm.items,
        userId: user?.id || null
      });
      setShowInvoiceModal(false);
      await loadAll();
      notify(`Facture ${created.invoice_number} enregistrée.`);
    } catch (err) {
      setInvoiceError(err?.message || 'Erreur lors de la création de la facture.');
    }
  };

  const openPaymentModal = (inv) => {
    setPayTarget(inv);
    setPayAmount(String(inv.balance_due));
    setPayMethod('cash');
    setPayNotes('');
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!payTarget) return;
    await posApi.recordSupplierPayment({
      invoiceId: payTarget.id,
      amount: Number(payAmount) || 0,
      paymentMethod: payMethod,
      notes: payNotes,
      userId: user?.id || null
    });
    const updatedDetailId = detailInvoice?.id === payTarget.id ? payTarget.id : null;
    setPayTarget(null);
    await loadAll();
    if (updatedDetailId) {
      setDetailInvoice(await posApi.getSupplierInvoiceDetails(updatedDetailId));
    }
    notify('Paiement fournisseur enregistré.');
  };

  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(`Supprimer la facture ${inv.invoice_number} ?`)) return;
    await posApi.deleteSupplierInvoice(inv.id);
    if (detailInvoice?.id === inv.id) setDetailInvoice(null);
    await loadAll();
  };

  const handleLinkDetailItem = async (itemId, productId) => {
    const updated = await posApi.linkInvoiceItemToProduct({ itemId, productId });
    setDetailInvoice(updated);
  };

  const handleApplyInvoiceStock = async (invId) => {
    const res = await posApi.applySupplierInvoiceStock({
      invoiceId: invId,
      updateBuyPrice: true,
      userId: user?.id || null
    });
    setDetailInvoice(res.invoice);
    await loadAll();
    notify(`Stock mis à jour pour ${res.updatedProducts} produit(s) lié(s).`);
  };

  const statusBadge = (status) => {
    if (status === 'paid') return <span className="pill pill-ok">Payée</span>;
    if (status === 'partial') return <span className="pill pill-warn">Partielle</span>;
    return <span className="pill pill-danger">Impayée</span>;
  };

  const methodLabels = { cash: 'Espèces', bank: 'Virement', check: 'Chèque', credit: 'À crédit' };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>🚚 {t.navSuppliers} & Factures</h2>
        <div className="row-actions">
          <button className={`btn ${tab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('invoices')}>
            🧾 Factures fournisseurs ({totalInvoicesCount})
          </button>
          <button className={`btn ${tab === 'suppliers' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('suppliers')}>
            🚚 Fournisseurs ({suppliers.length})
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCsvModal(true)}>
            📥 Importer CSV
          </button>
          <button className="btn btn-secondary" onClick={() => { setSupplierForm(emptySupplier); setShowSupplierModal(true); }}>
            + Nouveau fournisseur
          </button>
          <button className="btn btn-primary" onClick={openNewInvoice} disabled={suppliers.length === 0}>
            + Nouvelle facture
          </button>
        </div>
      </div>

      {toast && <div className="toast-banner" style={{ marginBottom: 14 }}>{toast}</div>}

      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi-card"><span>Fournisseurs actifs</span><strong>{suppliers.length}</strong></div>
        <div className="kpi-card"><span>Factures enregistrées</span><strong>{totalInvoicesCount}</strong></div>
        <div className="kpi-card"><span>Total achats facturés</span><strong>{formatDA(totalBilledAll, lang)}</strong></div>
        <div className="kpi-card">
          <span>Reste à payer (Dettes)</span>
          <strong className={totalBalanceDueAll > 0 ? 'txt-bad' : 'txt-ok'}>
            {formatDA(totalBalanceDueAll, lang)}
          </strong>
        </div>
      </div>

      {tab === 'invoices' && (
        <>
          <div className="row-actions" style={{ marginBottom: 12 }}>
            <input
              className="input-search"
              placeholder="Rechercher n° facture, fournisseur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="input-lg"
              style={{ width: 220 }}
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="">Tous les fournisseurs</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              className="input-lg"
              style={{ width: 170 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              <option value="unpaid">Impayées</option>
              <option value="partial">Partielles</option>
              <option value="paid">Payées</option>
            </select>
          </div>

          <div className="card-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N° Facture</th>
                  <th>Date</th>
                  <th>Fournisseur</th>
                  <th className="text-center">Articles</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Payé</th>
                  <th className="text-end">Reste dû</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center muted">Aucune facture fournisseur trouvée.</td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <b>{inv.invoice_number}</b>
                        {inv.stock_updated === 1 && (
                          <div className="muted" style={{ fontSize: 11 }}>✓ Stock mis à jour</div>
                        )}
                      </td>
                      <td>{inv.invoice_date}</td>
                      <td><b>{inv.supplier_name}</b></td>
                      <td className="text-center">{inv.items_count}</td>
                      <td className="text-end bold">{formatDA(inv.total, lang)}</td>
                      <td className="text-end txt-ok">{formatDA(inv.amount_paid, lang)}</td>
                      <td className={`text-end bold ${inv.balance_due > 0 ? 'txt-bad' : ''}`}>
                        {formatDA(inv.balance_due, lang)}
                      </td>
                      <td>{statusBadge(inv.status)}</td>
                      <td>
                        <button
                          className="btn-sm"
                          onClick={async () => setDetailInvoice(await posApi.getSupplierInvoiceDetails(inv.id))}
                        >
                          👁 Voir
                        </button>
                        {inv.balance_due > 0 && (
                          <button className="btn-sm btn-primary" onClick={() => openPaymentModal(inv)}>
                            💵 Payer
                          </button>
                        )}
                        <button className="btn-sm btn-danger-txt" onClick={() => handleDeleteInvoice(inv)}>🗑</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'suppliers' && (
        <div className="card-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fournisseur</th>
                <th>Contact / Téléphone</th>
                <th>Adresse / Email</th>
                <th className="text-center">Factures</th>
                <th className="text-end">Total facturé</th>
                <th className="text-end">Payé</th>
                <th className="text-end">Solde dû</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.name}</b>
                    {s.nif && <div className="muted" style={{ fontSize: 12 }}>NIF: {s.nif}</div>}
                  </td>
                  <td>
                    {s.contact_name && <div>👤 {s.contact_name}</div>}
                    <div className={s.contact_name ? 'muted' : ''}>{s.phone || '—'}</div>
                  </td>
                  <td>
                    <div>{s.address || '—'}</div>
                    {s.email && <small className="muted">{s.email}</small>}
                  </td>
                  <td className="text-center">{s.invoices_count}</td>
                  <td className="text-end bold">{formatDA(s.total_billed, lang)}</td>
                  <td className="text-end txt-ok">{formatDA(s.total_paid, lang)}</td>
                  <td className={`text-end bold ${s.balance_due > 0 ? 'txt-bad' : 'txt-ok'}`}>
                    {formatDA(s.balance_due, lang)}
                  </td>
                  <td>
                    <button
                      className="btn-sm"
                      onClick={() => {
                        setSupplierFilter(String(s.id));
                        setTab('invoices');
                      }}
                    >
                      🧾 Factures
                    </button>
                    <button
                      className="btn-sm"
                      onClick={() => {
                        setSupplierForm({ ...emptySupplier, ...s });
                        setShowSupplierModal(true);
                      }}
                    >
                      ✏️
                    </button>
                    <button className="btn-sm btn-danger-txt" onClick={() => handleDeleteSupplier(s)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{supplierForm.id ? 'Modifier fournisseur' : 'Nouveau fournisseur'}</h3>
              <button className="btn-icon" onClick={() => setShowSupplierModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveSupplier} className="form-grid">
              <div className="row-2">
                <div>
                  <label className="field-label">Nom / Raison sociale *</label>
                  <input
                    autoFocus
                    required
                    className="input-lg"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Contact principal</label>
                  <input
                    className="input-lg"
                    placeholder="Ex: Karim Benali"
                    value={supplierForm.contact_name || ''}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="row-2">
                <div>
                  <label className="field-label">Téléphone</label>
                  <input
                    className="input-lg"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Email</label>
                  <input
                    type="email"
                    className="input-lg"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="row-2">
                <div>
                  <label className="field-label">Adresse</label>
                  <input
                    className="input-lg"
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">NIF / RC (optionnel)</label>
                  <input
                    className="input-lg"
                    value={supplierForm.nif}
                    onChange={(e) => setSupplierForm({ ...supplierForm, nif: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Notes</label>
                <input
                  className="input-lg"
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSupplierModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvoiceModal && (
        <div className="modal-overlay">
          <div className="modal-card modal-xl">
            <div className="modal-header">
              <h3>🧾 Nouvelle Facture Fournisseur</h3>
              <button className="btn-icon" onClick={() => setShowInvoiceModal(false)}>✕</button>
            </div>
            {invoiceError && <div className="alert-error">{invoiceError}</div>}
            <form onSubmit={handleSaveInvoice} className="form-grid">
              <div className="row-3">
                <div>
                  <label className="field-label">Fournisseur *</label>
                  <SupplierAutocomplete
                    suppliers={suppliers}
                    value={invoiceForm.supplierId}
                    lang={lang}
                    onChange={async (supplierId) => {
                      setInvoiceForm((prev) => ({ ...prev, supplierId }));
                      if (invoiceError) setInvoiceError('');
                      const sug = await posApi.getNextSupplierInvoiceNumber(supplierId || null);
                      setInvoiceSuggestion(sug);
                    }}
                  />
                </div>
                <div>
                  <label className="field-label">N° Facture (auto-suggéré)</label>
                  <div className="row-actions" style={{ gap: 6 }}>
                    <input
                      className="input-lg"
                      style={{ flex: 1 }}
                      placeholder={invoiceSuggestion.suggestedNumber || 'Ex: FF-2026-0001'}
                      value={invoiceForm.invoiceNumber}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                    />
                    {invoiceSuggestion.suggestedNumber && invoiceForm.invoiceNumber !== invoiceSuggestion.suggestedNumber && (
                      <button
                        type="button"
                        className="btn-sm"
                        title={`Utiliser la suggestion (${invoiceSuggestion.suggestedNumber})`}
                        onClick={() => setInvoiceForm({ ...invoiceForm, invoiceNumber: invoiceSuggestion.suggestedNumber })}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                    {invoiceSuggestion.lastInvoiceNumber ? (
                      <>Dernière facture : <code>{invoiceSuggestion.lastInvoiceNumber}</code> → <b>{invoiceSuggestion.suggestedNumber}</b></>
                    ) : (
                      <>Suggestion : <b>{invoiceSuggestion.suggestedNumber}</b></>
                    )}
                    {invoiceSuggestion.supplierSuggestedNumber &&
                      invoiceSuggestion.supplierSuggestedNumber !== invoiceForm.invoiceNumber && (
                        <>
                          {' '}•{' '}
                          <button
                            type="button"
                            className="btn-sm"
                            style={{ padding: '1px 6px', fontSize: 11 }}
                            onClick={() =>
                              setInvoiceForm({
                                ...invoiceForm,
                                invoiceNumber: invoiceSuggestion.supplierSuggestedNumber
                              })
                            }
                          >
                            Ce fournisseur : {invoiceSuggestion.supplierSuggestedNumber}
                          </button>
                        </>
                      )}
                  </div>
                </div>
                <div>
                  <label className="field-label">Date facture</label>
                  <input
                    type="date"
                    className="input-lg"
                    value={invoiceForm.invoiceDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="invoice-box">
                <label className="field-label">Ajouter un article à la facture (par code-barres ou catalogue)</label>
                <div className="row-actions" style={{ marginBottom: 8 }}>
                  <div className="scan-bar" style={{ flex: 1, padding: '4px 10px', borderWidth: 1 }}>
                    <span className="scan-icon" style={{ fontSize: 15 }}>║█║▌</span>
                    <input
                      ref={barcodeRef}
                      type="text"
                      className="scan-input"
                      style={{ fontSize: 14, padding: '4px 6px' }}
                      placeholder="Scanner ou saisir un code-barres + Entrée..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleBarcodeLookup();
                        }
                      }}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleBarcodeLookup}>
                      ⏎ Ajouter par code
                    </button>
                  </div>
                </div>

                {barcodeFeedback && (
                  <div
                    className={barcodeFeedback.type === 'ok' ? 'txt-ok' : 'csv-warn-txt'}
                    style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}
                  >
                    {barcodeFeedback.text}
                  </div>
                )}

                <div className="row-actions">
                  <select
                    className="input-sm"
                    style={{ flex: 2 }}
                    value={selectedProdId}
                    onChange={(e) => handleSelectCatalogProduct(e.target.value)}
                  >
                    <option value="">-- Produit du catalogue (ou saisie libre) --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.barcode ? `(${p.barcode})` : ''}
                      </option>
                    ))}
                  </select>
                  {!selectedProdId && (
                    <input
                      className="input-sm"
                      style={{ flex: 1.5 }}
                      placeholder={pendingBarcode ? `Libellé pour ${pendingBarcode}...` : 'Désignation libre...'}
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                    />
                  )}
                  <input
                    type="number"
                    min="1"
                    className="input-sm"
                    style={{ width: 90 }}
                    placeholder="Qté"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    className="input-sm"
                    style={{ width: 120 }}
                    placeholder="Prix achat (DA)"
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleAddInvoiceItem}>
                    + Ajouter
                  </button>
                </div>

                {invoiceForm.items.length > 0 && (
                  <div className="csv-preview-wrap" style={{ marginTop: 12, maxHeight: 220 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Article</th>
                          <th>Produit lié (Stock)</th>
                          <th className="text-center" style={{ width: 90 }}>Qté</th>
                          <th className="text-end" style={{ width: 120 }}>P.U. Achat</th>
                          <th className="text-end">Sous-total</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceForm.items.map((it, idx) => {
                          const linkedProd = it.product_id ? products.find((p) => p.id === it.product_id) : null;
                          return (
                            <tr key={it.key}>
                              <td>
                                <b>{it.product_name}</b>
                                {it.barcode && (
                                  <div className="muted" style={{ fontSize: 11 }}>
                                    <code>{it.barcode}</code>
                                  </div>
                                )}
                              </td>
                              <td>
                                <select
                                  className="input-sm"
                                  value={it.product_id || ''}
                                  onChange={(e) => updateInvoiceItemLink(idx, e.target.value)}
                                >
                                  <option value="">— Non lié (aucune MAJ stock) —</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} (Stock: {p.stock})
                                    </option>
                                  ))}
                                </select>
                                {linkedProd && invoiceForm.updateStock && (
                                  <div className="txt-ok" style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>
                                    Stock : {linkedProd.stock} → {linkedProd.stock + it.quantity}
                                  </div>
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  className="input-sm text-center"
                                  value={it.quantity}
                                  onChange={(e) => updateInvoiceItem(idx, 'quantity', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  className="input-sm text-end"
                                  value={it.unit_cost}
                                  onChange={(e) => updateInvoiceItem(idx, 'unit_cost', e.target.value)}
                                />
                              </td>
                              <td className="text-end bold">{formatDA(it.quantity * it.unit_cost, lang)}</td>
                              <td className="text-center">
                                <button type="button" className="btn-del" onClick={() => removeInvoiceItem(idx)}>🗑</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="row-2">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={invoiceForm.updateStock}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, updateStock: e.target.checked })}
                  />
                  <span>Ajouter les quantités au stock des produits liés</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={invoiceForm.updateBuyPrice}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, updateBuyPrice: e.target.checked })}
                  />
                  <span>Mettre à jour le prix d&apos;achat dans le catalogue</span>
                </label>
              </div>

              <div className="row-3">
                <div>
                  <label className="field-label">Remise facture (DA)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-lg"
                    value={invoiceForm.discountAmount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, discountAmount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">
                    Montant payé (DA) —{' '}
                    <button
                      type="button"
                      className="btn-sm"
                      onClick={() => setInvoiceForm({ ...invoiceForm, amountPaid: String(invTotal) })}
                    >
                      Tout payer ({formatDA(invTotal, lang)})
                    </button>
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-lg"
                    value={invoiceForm.amountPaid}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amountPaid: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Mode de règlement</label>
                  <select
                    className="input-lg"
                    value={invoiceForm.paymentMethod}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value })}
                  >
                    <option value="cash">Espèces</option>
                    <option value="bank">Virement bancaire</option>
                    <option value="check">Chèque</option>
                    <option value="credit">À crédit</option>
                  </select>
                </div>
              </div>

              <div className="row-2" style={{ alignItems: 'center' }}>
                <div className="pay-total-banner" style={{ marginBottom: 0 }}>
                  <span>Total Facture (Net à payer)</span>
                  <strong>{formatDA(invTotal, lang)}</strong>
                </div>
                <div>
                  <label className="field-label">Notes / Bon de livraison (optionnel)</label>
                  <input
                    className="input-lg"
                    placeholder="Ex: BL n° 45, livraison matin..."
                    value={invoiceForm.notes}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInvoiceModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary btn-lg">Enregistrer la facture</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailInvoice && (
        <div className="modal-overlay">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h3>🧾 Facture {detailInvoice.invoice_number}</h3>
              <button className="btn-icon" onClick={() => setDetailInvoice(null)}>✕</button>
            </div>
            <div className="split-2" style={{ marginBottom: 14 }}>
              <div className="invoice-box">
                <div><b>Fournisseur :</b> {detailInvoice.supplier_name}</div>
                {detailInvoice.supplier?.phone && <div><b>Tél :</b> {detailInvoice.supplier.phone}</div>}
                {detailInvoice.supplier?.address && <div><b>Adresse :</b> {detailInvoice.supplier.address}</div>}
              </div>
              <div className="invoice-box">
                <div><b>Date :</b> {detailInvoice.invoice_date}</div>
                <div><b>Statut :</b> {statusBadge(detailInvoice.status)}</div>
                <div>
                  <b>Stock MAJ :</b>{' '}
                  {detailInvoice.stock_updated === 1 ? (
                    <span className="txt-ok bold">Oui (Réceptionné)</span>
                  ) : (
                    <span className="csv-warn-txt">En attente</span>
                  )}
                </div>
                {detailInvoice.notes && <div><b>Notes :</b> {detailInvoice.notes}</div>}
              </div>
            </div>

            <div className="card-table-wrap" style={{ marginBottom: 14 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Produit lié (Catalogue)</th>
                    <th className="text-center">Qté</th>
                    <th className="text-end">P.U. Achat</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detailInvoice.items.map((it) => {
                    const linkedProd = it.product_id ? products.find((p) => p.id === it.product_id) : null;
                    return (
                      <tr key={it.id}>
                        <td>
                          {it.product_name}
                          {it.barcode && (
                            <div className="muted" style={{ fontSize: 11 }}><code>{it.barcode}</code></div>
                          )}
                        </td>
                        <td>
                          {detailInvoice.stock_updated === 0 ? (
                            <select
                              className="input-sm"
                              value={it.product_id || ''}
                              onChange={(e) => handleLinkDetailItem(it.id, e.target.value)}
                            >
                              <option value="">— Non lié —</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Stock: {p.stock})
                                </option>
                              ))}
                            </select>
                          ) : linkedProd ? (
                            <span className="pill pill-ok">✓ {linkedProd.name}</span>
                          ) : (
                            <span className="muted">Non lié</span>
                          )}
                        </td>
                        <td className="text-center">{it.quantity}</td>
                        <td className="text-end">{formatDA(it.unit_cost, lang)}</td>
                        <td className="text-end bold">{formatDA(it.line_total, lang)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="invoice-box">
              <div className="stat-line"><span>Sous-total</span><b>{formatDA(detailInvoice.subtotal, lang)}</b></div>
              {detailInvoice.discount_amount > 0 && (
                <div className="stat-line"><span>Remise</span><b>-{formatDA(detailInvoice.discount_amount, lang)}</b></div>
              )}
              <div className="stat-line"><span>Total Facture</span><b>{formatDA(detailInvoice.total, lang)}</b></div>
              <div className="stat-line"><span>Montant payé</span><b className="txt-ok">{formatDA(detailInvoice.amount_paid, lang)}</b></div>
              <div className="stat-line">
                <span>Reste à payer</span>
                <b className={detailInvoice.balance_due > 0 ? 'txt-bad' : 'txt-ok'}>
                  {formatDA(detailInvoice.balance_due, lang)}
                </b>
              </div>
            </div>

            {detailInvoice.payments?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <label className="field-label">Historique des paiements</label>
                {detailInvoice.payments.map((p) => (
                  <div key={p.id} className="stat-line">
                    <span>{p.created_at.slice(0, 10)} — {methodLabels[p.payment_method] || p.payment_method} {p.notes && `(${p.notes})`}</span>
                    <b className="txt-ok">{formatDA(p.amount, lang)}</b>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              {detailInvoice.stock_updated === 0 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => handleApplyInvoiceStock(detailInvoice.id)}
                >
                  📦 Réceptionner &amp; MAJ Stock
                </button>
              )}
              {detailInvoice.balance_due > 0 && (
                <button className="btn btn-primary" onClick={() => openPaymentModal(detailInvoice)}>
                  💵 Enregistrer un paiement
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setDetailInvoice(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {payTarget && (
        <div className="modal-overlay">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>💵 Paiement {payTarget.invoice_number}</h3>
              <button className="btn-icon" onClick={() => setPayTarget(null)}>✕</button>
            </div>
            <p className="muted">
              Fournisseur : <b>{payTarget.supplier_name}</b><br />
              Reste dû : <b className="txt-bad">{formatDA(payTarget.balance_due, lang)}</b>
            </p>
            <form onSubmit={handleConfirmPayment} className="form-grid">
              <div>
                <label className="field-label">Montant à verser (DA)</label>
                <input
                  autoFocus
                  required
                  type="number"
                  min="1"
                  max={payTarget.balance_due}
                  className="input-xl"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Mode de paiement</label>
                <select className="input-lg" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="cash">Espèces</option>
                  <option value="bank">Virement bancaire</option>
                  <option value="check">Chèque</option>
                </select>
              </div>
              <div>
                <label className="field-label">Notes</label>
                <input
                  className="input-lg"
                  placeholder="Ex: Chèque n°..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setPayTarget(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Valider le paiement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCsvModal && (
        <CsvSupplierImportModal
          suppliers={suppliers}
          onImported={async (res) => {
            setShowCsvModal(false);
            setTab('suppliers');
            await loadAll();
            notify(`Import fournisseurs terminé : ${res.createdCount} créé(s), ${res.updatedCount} mis à jour.`);
          }}
          onClose={() => setShowCsvModal(false)}
        />
      )}
    </div>
  );
}
