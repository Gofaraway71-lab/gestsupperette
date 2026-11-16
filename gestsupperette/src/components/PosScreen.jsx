import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';
import { playBeep } from '../utils/sound';
import PaymentModal from './PaymentModal';
import ReceiptModal from './ReceiptModal';

export default function PosScreen({ user, settings, lang, t }) {
  const [cart, setCart] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [flashId, setFlashId] = useState(null);

  const [scanInput, setScanInput] = useState('');
  const [unknownBarcode, setUnknownBarcode] = useState(null);
  const [quickProd, setQuickProd] = useState({ name: '', sell_price: '', buy_price: '', stock: '20', category: 'GÃ©nÃ©ral' });

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');

  const [ticketDiscount, setTicketDiscount] = useState({ type: 'amount', value: 0 });
  const [heldCarts, setHeldCarts] = useState([]);
  const [showHeldList, setShowHeldList] = useState(false);

  const [showPayment, setShowPayment] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [toast, setToast] = useState('');

  const scanRef = useRef(null);
  const searchRef = useRef(null);

  const focusScanner = () => {
    if (!showSearch && !showDiscount && !showPayment && !lastReceipt && !unknownBarcode && !showHeldList) {
      setTimeout(() => scanRef.current?.focus(), 30);
    }
  };

  useEffect(() => {
    posApi.listHeldCarts().then(setHeldCarts);
    focusScanner();
  }, []);

  useEffect(() => {
    focusScanner();
  }, [showSearch, showDiscount, showPayment, lastReceipt, unknownBarcode, showHeldList]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowSearch(true);
        posApi.searchProducts('').then(setSearchResults);
        setTimeout(() => searchRef.current?.focus(), 50);
      } else if (e.key === 'F2' && cart.length > 0) {
        e.preventDefault();
        setShowDiscount(true);
      } else if (e.key === 'F4' && cart.length > 0 && !showPayment) {
        e.preventDefault();
        setShowPayment(true);
      } else if (e.key === 'Delete' && selectedIdx !== null && !showPayment && !showSearch && !unknownBarcode) {
        e.preventDefault();
        removeLine(selectedIdx);
      } else if (e.key === 'Escape') {
        if (showSearch || showDiscount || showPayment || unknownBarcode || showHeldList) {
          setShowSearch(false);
          setShowDiscount(false);
          setShowPayment(false);
          setUnknownBarcode(null);
          setShowHeldList(false);
        } else {
          setScanInput('');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cart, selectedIdx, showPayment, showSearch, showDiscount, unknownBarcode, showHeldList]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const addProductToCart = (prod) => {
    playBeep('success');
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product_id === prod.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        setSelectedIdx(idx);
        return updated;
      }
      const next = [
        ...prev,
        {
          product_id: prod.id,
          barcode: prod.barcode,
          name: lang === 'ar' && prod.name_ar ? prod.name_ar : prod.name,
          unit_price: prod.sell_price,
          quantity: 1,
          discount_amount: 0,
          stock: prod.stock
        }
      ];
      setSelectedIdx(next.length - 1);
      return next;
    });
    setFlashId(prod.id);
    setTimeout(() => setFlashId(null), 400);
  };

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    const code = scanInput.trim();
    setScanInput('');
    if (!code) return;

    const prod = await posApi.findByBarcode(code);
    if (prod) {
      addProductToCart(prod);
    } else {
      playBeep('error');
      setUnknownBarcode(code);
      setQuickProd({ name: '', sell_price: '', buy_price: '', stock: '20', category: 'GÃ©nÃ©ral' });
    }
  };

  const handleQuickCreate = async (e) => {
    e.preventDefault();
    if (!quickProd.name.trim() || !quickProd.sell_price) return;
    const created = await posApi.upsertProduct({
      barcode: unknownBarcode,
      name: quickProd.name,
      sell_price: Number(quickProd.sell_price),
      buy_price: Number(quickProd.buy_price) || 0,
      stock: Number(quickProd.stock) || 0,
      category: quickProd.category
    });
    setUnknownBarcode(null);
    addProductToCart(created);
  };

  const updateQty = (idx, deltaOrValue, exact = false) => {
    setCart((prev) => {
      const next = [...prev];
      const newQty = exact ? Math.max(1, Number(deltaOrValue) || 1) : next[idx].quantity + deltaOrValue;
      if (newQty <= 0) {
        next.splice(idx, 1);
        setSelectedIdx(null);
      } else {
        next[idx] = { ...next[idx], quantity: newQty };
      }
      return next;
    });
  };

  const removeLine = (idx) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIdx(null);
    focusScanner();
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (!window.confirm('Vider le ticket en cours ?')) return;
    setCart([]);
    setTicketDiscount({ type: 'amount', value: 0 });
    setSelectedIdx(null);
    focusScanner();
  };

  const { subtotal, discountAmount, grandTotal } = useMemo(() => {
    const sub = cart.reduce((acc, it) => acc + Math.max(0, it.unit_price * it.quantity - (it.discount_amount || 0)), 0);
    const disc =
      ticketDiscount.type === 'percent'
        ? Math.round((sub * ticketDiscount.value) / 100)
        : Math.min(sub, Math.round(ticketDiscount.value || 0));
    return { subtotal: sub, discountAmount: disc, grandTotal: Math.max(0, sub - disc) };
  }, [cart, ticketDiscount]);

  const applyDiscount = () => {
    const val = Number(discountValue) || 0;
    setTicketDiscount({ type: discountType, value: Math.max(0, val) });
    setShowDiscount(false);
    setDiscountValue('');
  };

  const holdCurrentCart = async () => {
    if (cart.length === 0) return;
    const label = `Ticket ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (${formatDA(grandTotal, lang)})`;
    await posApi.saveHeldCart({
      label,
      itemsJson: JSON.stringify(cart),
      discountJson: JSON.stringify(ticketDiscount)
    });
    setCart([]);
    setTicketDiscount({ type: 'amount', value: 0 });
    setHeldCarts(await posApi.listHeldCarts());
    showToast('Ticket mis en attente');
  };

  const resumeHeldCart = async (hc) => {
    if (cart.length > 0 && !window.confirm('Remplacer le ticket actuel par le ticket en attente ?')) return;
    setCart(JSON.parse(hc.items_json));
    setTicketDiscount(JSON.parse(hc.discount_json));
    await posApi.deleteHeldCart(hc.id);
    setHeldCarts(await posApi.listHeldCarts());
    setShowHeldList(false);
  };

  const handleCompleteSale = async ({ paymentMethod, amountReceived, changeGiven, customerName, shouldPrint }) => {
    const payload = {
      userId: user.id,
      subtotal,
      discountAmount,
      total: grandTotal,
      paymentMethod,
      amountReceived,
      changeGiven,
      customerName,
      items: cart.map((it) => ({
        ...it,
        line_total: Math.max(0, it.unit_price * it.quantity - (it.discount_amount || 0))
      }))
    };

    const savedSale = await posApi.createSale(payload);
    playBeep('cash');
    setShowPayment(false);
    setCart([]);
    setTicketDiscount({ type: 'amount', value: 0 });
    setSelectedIdx(null);

    if (shouldPrint) {
      setLastReceipt(savedSale);
    } else {
      showToast(`Vente ${savedSale.ticket_number} enregistrÃ©e (${formatDA(savedSale.total, lang)})`);
    }
  };

  const handleSearchChange = async (val) => {
    setSearchQuery(val);
    setSearchResults(await posApi.searchProducts(val));
  };

  return (
    <div className="pos-layout" onClick={(e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') focusScanner();
    }}>
      <div className="pos-left">
        <form onSubmit={handleScanSubmit} className="scan-bar">
          <span className="scan-icon">â•‘â–ˆâ•‘â–Œ</span>
          <input
            ref={scanRef}
            type="text"
            className="scan-input"
            placeholder={t.scanPlaceholder}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setShowSearch(true);
              posApi.searchProducts('').then(setSearchResults);
              setTimeout(() => searchRef.current?.focus(), 50);
            }}
          >
            ðŸ” {t.searchManual}
          </button>
        </form>

        {toast && <div className="toast-banner">{toast}</div>}

        <div className="ticket-table-wrap">
          {cart.length === 0 ? (
            <div className="empty-ticket">
              <div className="empty-icon">ðŸ›’</div>
              <p>{t.emptyCart}</p>
              <small>Douchette prÃªte â€¢ Raccourcis : F1 Recherche â€¢ F4 Encaisser</small>
            </div>
          ) : (
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>{t.product}</th>
                  <th className="text-end">{t.unitPrice}</th>
                  <th className="text-center">{t.qty}</th>
                  <th className="text-end">{t.total}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => {
                  const lineTotal = item.unit_price * item.quantity - (item.discount_amount || 0);
                  return (
                    <tr
                      key={item.product_id}
                      onClick={() => setSelectedIdx(idx)}
                      className={`${selectedIdx === idx ? 'row-selected' : ''} ${flashId === item.product_id ? 'row-flash' : ''}`}
                    >
                      <td>
                        <div className="prod-title">{item.name}</div>
                        {item.stock < item.quantity && (
                          <span className="badge-warn">Stock bas ({item.stock})</span>
                        )}
                      </td>
                      <td className="text-end">{formatDA(item.unit_price, lang)}</td>
                      <td>
                        <div className="qty-control">
                          <button className="qty-btn" onClick={(e) => { e.stopPropagation(); updateQty(idx, -1); }}>âˆ’</button>
                          <input
                            type="number"
                            className="qty-input"
                            value={item.quantity}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateQty(idx, e.target.value, true)}
                          />
                          <button className="qty-btn" onClick={(e) => { e.stopPropagation(); updateQty(idx, 1); }}>+</button>
                        </div>
                      </td>
                      <td className="text-end bold">{formatDA(lineTotal, lang)}</td>
                      <td className="text-center">
                        <button className="btn-del" onClick={(e) => { e.stopPropagation(); removeLine(idx); }}>ðŸ—‘</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="pos-right">
        <div className="total-card">
          <div className="total-label">{t.grandTotal}</div>
          <div className="total-amount">{formatDA(grandTotal, lang)}</div>
          <div className="total-meta">
            <span>{cart.reduce((s, i) => s + i.quantity, 0)} article(s)</span>
            {discountAmount > 0 && (
              <span className="badge-discount">{t.discount}: -{formatDA(discountAmount, lang)}</span>
            )}
          </div>
        </div>

        <button
          className="btn-pay-hero"
          disabled={cart.length === 0}
          onClick={() => setShowPayment(true)}
        >
          {t.payBtn}
        </button>

        <div className="pos-actions-grid">
          <button className="btn btn-tile" disabled={cart.length === 0} onClick={() => setShowDiscount(true)}>
            ðŸ· {t.discountBtn}
          </button>
          <button className="btn btn-tile" disabled={cart.length === 0} onClick={holdCurrentCart}>
            â¸ {t.holdBtn}
          </button>
          <button className="btn btn-tile" onClick={() => setShowHeldList(true)}>
            ðŸ“‹ {t.resumeBtn} ({heldCarts.length})
          </button>
          <button className="btn btn-tile btn-danger-soft" disabled={cart.length === 0} onClick={clearCart}>
            âœ• {t.clearBtn}
          </button>
        </div>

        <div className="shortcuts-box">
          <b>Raccourcis clavier</b>
          <div><span>F1</span> Recherche / Vrac</div>
          <div><span>F2</span> Remise ticket</div>
          <div><span>F4</span> Encaisser</div>
          <div><span>Suppr</span> Supprimer ligne</div>
        </div>
      </div>

      {unknownBarcode && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>âš ï¸ {t.unknownBarcode} : <code>{unknownBarcode}</code></h3>
              <button className="btn-icon" onClick={() => setUnknownBarcode(null)}>âœ•</button>
            </div>
            <p className="muted">{t.quickAddAsk}</p>
            <form onSubmit={handleQuickCreate} className="form-grid">
              <div>
                <label className="field-label">Nom du produit *</label>
                <input
                  autoFocus
                  required
                  className="input-lg"
                  value={quickProd.name}
                  onChange={(e) => setQuickProd({ ...quickProd, name: e.target.value })}
                />
              </div>
              <div className="row-2">
                <div>
                  <label className="field-label">Prix de vente (DA) *</label>
                  <input
                    required
                    type="number"
                    className="input-lg"
                    value={quickProd.sell_price}
                    onChange={(e) => setQuickProd({ ...quickProd, sell_price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Prix d'achat (DA)</label>
                  <input
                    type="number"
                    className="input-lg"
                    value={quickProd.buy_price}
                    onChange={(e) => setQuickProd({ ...quickProd, buy_price: e.target.value })}
                  />
                </div>
              </div>
              <div className="row-2">
                <div>
                  <label className="field-label">Stock initial</label>
                  <input
                    type="number"
                    className="input-lg"
                    value={quickProd.stock}
                    onChange={(e) => setQuickProd({ ...quickProd, stock: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">CatÃ©gorie</label>
                  <input
                    className="input-lg"
                    value={quickProd.category}
                    onChange={(e) => setQuickProd({ ...quickProd, category: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setUnknownBarcode(null)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary">{t.quickAddBtn}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="modal-overlay">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h3>ðŸ” {t.searchManual}</h3>
              <button className="btn-icon" onClick={() => setShowSearch(false)}>âœ•</button>
            </div>
            <input
              ref={searchRef}
              type="text"
              className="input-lg"
              placeholder="Nom du produit (ex: pain, Å“ufs, lait)..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <div className="search-grid">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  className="search-item-card"
                  onClick={() => {
                    addProductToCart(p);
                    setShowSearch(false);
                    setSearchQuery('');
                  }}
                >
                  <div className="search-item-cat">{p.category}</div>
                  <div className="search-item-name">{lang === 'ar' && p.name_ar ? p.name_ar : p.name}</div>
                  <div className="search-item-price">{formatDA(p.sell_price, lang)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showDiscount && (
        <div className="modal-overlay">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>ðŸ· {t.discount}</h3>
              <button className="btn-icon" onClick={() => setShowDiscount(false)}>âœ•</button>
            </div>
            <div className="pay-methods">
              <button className={`pay-method-btn ${discountType === 'amount' ? 'active' : ''}`} onClick={() => setDiscountType('amount')}>Montant (DA)</button>
              <button className={`pay-method-btn ${discountType === 'percent' ? 'active' : ''}`} onClick={() => setDiscountType('percent')}>Pourcentage (%)</button>
            </div>
            <input
              autoFocus
              type="number"
              className="input-xl"
              placeholder={discountType === 'amount' ? 'Ex: 50' : 'Ex: 10'}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDiscount(false)}>{t.cancel}</button>
              <button className="btn btn-primary" onClick={applyDiscount}>{t.confirm}</button>
            </div>
          </div>
        </div>
      )}

      {showHeldList && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>ðŸ“‹ {t.resumeBtn}</h3>
              <button className="btn-icon" onClick={() => setShowHeldList(false)}>âœ•</button>
            </div>
            {heldCarts.length === 0 ? (
              <p className="muted">Aucun ticket en attente.</p>
            ) : (
              <div className="held-list">
                {heldCarts.map((hc) => (
                  <div key={hc.id} className="held-row">
                    <span>{hc.label}</span>
                    <div className="row-actions">
                      <button className="btn btn-primary" onClick={() => resumeHeldCart(hc)}>Reprendre</button>
                      <button className="btn btn-danger" onClick={async () => {
                        await posApi.deleteHeldCart(hc.id);
                        setHeldCarts(await posApi.listHeldCarts());
                      }}>ðŸ—‘</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showPayment && (
        <PaymentModal
          total={grandTotal}
          lang={lang}
          t={t}
          onConfirm={handleCompleteSale}
          onClose={() => setShowPayment(false)}
        />
      )}

      {lastReceipt && (
        <ReceiptModal
          sale={lastReceipt}
          settings={settings}
          lang={lang}
          t={t}
          onClose={() => setLastReceipt(null)}
        />
      )}
    </div>
  );
}