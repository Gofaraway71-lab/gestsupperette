import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';
import { playBeep } from '../utils/sound';
import PaymentModal from './PaymentModal';
import ReceiptModal from './ReceiptModal';
import ProductThumb from './ProductThumb';

const SCAN_HISTORY_KEY = 'gestsupperette_scan_history_v1';
const SHOW_FAVS_KEY = 'gestsupperette_show_favs';
const SCANNER_MODE_KEY = 'gestsupperette_scanner_mode';

export default function PosScreen({ user, settings, lang, t, onOpenHelp }) {
  const [cart, setCart] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [showFavorites, setShowFavorites] = useState(() => localStorage.getItem(SHOW_FAVS_KEY) !== '0');
  const [scannerMode, setScannerMode] = useState(() => localStorage.getItem(SCANNER_MODE_KEY) !== '0');
  const [searchFavOnly, setSearchFavOnly] = useState(false);
  const [scanHistory, setScanHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(SCAN_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [scanInput, setScanInput] = useState('');
  const [unknownBarcode, setUnknownBarcode] = useState(null);
  const [quickProd, setQuickProd] = useState({ name: '', sell_price: '', buy_price: '', stock: '20', category: 'Général' });

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
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [qtyModalValue, setQtyModalValue] = useState('');
  const [qtyModalFresh, setQtyModalFresh] = useState(true);
  const [directQtyBuffer, setDirectQtyBuffer] = useState(null);
  const [editingQty, setEditingQty] = useState(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceModalMode, setPriceModalMode] = useState('line');
  const [priceModalValue, setPriceModalValue] = useState('');
  const [priceModalName, setPriceModalName] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);
  const [toast, setToast] = useState('');

  const scanRef = useRef(null);
  const searchRef = useRef(null);
  const qtyInputRef = useRef(null);
  const priceInputRef = useRef(null);
  const scannerModeRef = useRef(scannerMode);
  const directQtyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (directQtyTimerRef.current) clearTimeout(directQtyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    scannerModeRef.current = scannerMode;
  }, [scannerMode]);

  const getTargetIdx = () => {
    if (cart.length === 0) return null;
    if (selectedIdx !== null && selectedIdx >= 0 && selectedIdx < cart.length) return selectedIdx;
    return cart.length - 1;
  };

  const focusScanner = (force = false) => {
    if (!scannerModeRef.current && !force) return;
    if (document.querySelector('.modal-overlay')) return;
    if (!showSearch && !showDiscount && !showPayment && !showQtyModal && !showPriceModal && !lastReceipt && !unknownBarcode && !showHeldList) {
      setTimeout(() => {
        if (!document.querySelector('.modal-overlay')) {
          scanRef.current?.focus();
        }
      }, 20);
    }
  };

  useEffect(() => {
    posApi.listHeldCarts().then(setHeldCarts);
    posApi.listFavorites().then(setFavorites);
    if (scannerMode) focusScanner(true);
  }, []);

  const toggleScannerMode = () => {
    setScannerMode((prev) => {
      const next = !prev;
      localStorage.setItem(SCANNER_MODE_KEY, next ? '1' : '0');
      if (next) {
        setTimeout(() => scanRef.current?.focus(), 20);
      }
      return next;
    });
  };

  const toggleFavoritesPanel = () => {
    setShowFavorites((prev) => {
      const next = !prev;
      localStorage.setItem(SHOW_FAVS_KEY, next ? '1' : '0');
      return next;
    });
  };

  const clearDirectQtyBuffer = () => {
    if (directQtyTimerRef.current) {
      clearTimeout(directQtyTimerRef.current);
      directQtyTimerRef.current = null;
    }
    setDirectQtyBuffer(null);
  };

  const openQtyMultiplier = () => {
    const idx = getTargetIdx();
    if (idx === null) return;
    clearDirectQtyBuffer();
    setSelectedIdx(idx);
    setQtyModalValue(String(cart[idx].quantity));
    setQtyModalFresh(true);
    setShowQtyModal(true);
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 30);
  };

  const openDirectPrice = (forcedMode) => {
    const idx = getTargetIdx();
    const mode = forcedMode || (idx !== null ? 'line' : 'custom');
    setPriceModalMode(mode);
    if (mode === 'line' && idx !== null) {
      setSelectedIdx(idx);
      setPriceModalValue(String(cart[idx].unit_price));
      setPriceModalName(cart[idx].name);
    } else {
      setPriceModalValue('');
      setPriceModalName('');
    }
    setShowPriceModal(true);
    setTimeout(() => {
      priceInputRef.current?.focus();
      priceInputRef.current?.select();
    }, 30);
  };

  useEffect(() => {
    if (scannerMode) focusScanner(true);
  }, [scannerMode, showSearch, showDiscount, showPayment, showQtyModal, showPriceModal, lastReceipt, unknownBarcode, showHeldList]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const anyModalOpen =
        showSearch || showDiscount || showPayment || showQtyModal || showPriceModal ||
        unknownBarcode || showHeldList || lastReceipt || Boolean(document.querySelector('.modal-overlay'));

      if (e.key === 'Escape') {
        if (directQtyBuffer) {
          e.preventDefault();
          updateQty(directQtyBuffer.idx, directQtyBuffer.prevQty, true);
          clearDirectQtyBuffer();
          return;
        }
        if (showSearch || showDiscount || showPayment || showQtyModal || showPriceModal || unknownBarcode || showHeldList) {
          setShowSearch(false);
          setShowDiscount(false);
          setShowPayment(false);
          setShowQtyModal(false);
          setShowPriceModal(false);
          setUnknownBarcode(null);
          setShowHeldList(false);
        } else {
          setScanInput('');
        }
        return;
      }

      if (anyModalOpen) return;

      const activeEl = document.activeElement;
      const isInScanInput = activeEl === scanRef.current;
      const isInOtherInput = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) && !isInScanInput;
      const scanIsEmpty = (scanRef.current ? scanRef.current.value : scanInput).trim() === '';
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
      const canUseSingleKey = !hasModifier && !isInOtherInput && (!isInScanInput || scanIsEmpty);

      if (directQtyBuffer && !isInScanInput && !isInOtherInput) {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearDirectQtyBuffer();
          playBeep('success');
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          const nextDigits = directQtyBuffer.digits.slice(0, -1);
          if (!nextDigits) {
            updateQty(directQtyBuffer.idx, directQtyBuffer.prevQty, true);
            clearDirectQtyBuffer();
          } else {
            updateQty(directQtyBuffer.idx, Number(nextDigits), true);
            if (directQtyTimerRef.current) clearTimeout(directQtyTimerRef.current);
            directQtyTimerRef.current = setTimeout(() => setDirectQtyBuffer(null), 1500);
            setDirectQtyBuffer({ ...directQtyBuffer, digits: nextDigits });
          }
          return;
        }
      }

      if (e.key === 'F1') {
        e.preventDefault();
        clearDirectQtyBuffer();
        setShowSearch(true);
        posApi.searchProducts('').then(setSearchResults);
        setTimeout(() => searchRef.current?.focus(), 50);
      } else if (e.key === 'F2' && cart.length > 0) {
        e.preventDefault();
        clearDirectQtyBuffer();
        setShowDiscount(true);
      } else if (e.key === 'F3') {
        e.preventDefault();
        clearDirectQtyBuffer();
        openDirectPrice();
      } else if (e.key === 'F4' && cart.length > 0) {
        e.preventDefault();
        clearDirectQtyBuffer();
        setShowPayment(true);
      } else if (e.key === 'Delete' && selectedIdx !== null && !isInOtherInput) {
        e.preventDefault();
        clearDirectQtyBuffer();
        removeLine(selectedIdx);
      } else if (canUseSingleKey && cart.length > 0 && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        clearDirectQtyBuffer();
        const cur = getTargetIdx() ?? 0;
        const nextIdx = e.key === 'ArrowUp'
          ? Math.max(0, cur - 1)
          : Math.min(cart.length - 1, cur + 1);
        setSelectedIdx(nextIdx);
      } else if (canUseSingleKey && cart.length > 0 && (e.key === '+' || e.code === 'NumpadAdd' || (e.key === '=' && !e.shiftKey))) {
        e.preventDefault();
        clearDirectQtyBuffer();
        const idx = getTargetIdx();
        if (idx !== null) {
          setSelectedIdx(idx);
          updateQty(idx, 1);
        }
      } else if (canUseSingleKey && cart.length > 0 && (e.key === '-' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        clearDirectQtyBuffer();
        const idx = getTargetIdx();
        if (idx !== null) {
          setSelectedIdx(idx);
          updateQty(idx, -1);
        }
      } else if (canUseSingleKey && cart.length > 0 && (e.key === 'x' || e.key === 'X' || e.key === 'q' || e.key === 'Q' || e.key === '*' || e.code === 'NumpadMultiply')) {
        e.preventDefault();
        openQtyMultiplier();
      } else if (canUseSingleKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        clearDirectQtyBuffer();
        openDirectPrice();
      } else if (!hasModifier && !isInScanInput && !isInOtherInput && cart.length > 0 && /^[0-9]$/.test(e.key)) {
        const idx = getTargetIdx();
        if (idx === null) return;
        const digit = e.key;
        if (!directQtyBuffer && digit === '0') return;
        e.preventDefault();
        setSelectedIdx(idx);
        const isContinuing = directQtyBuffer && directQtyBuffer.idx === idx;
        const baseDigits = isContinuing ? directQtyBuffer.digits : '';
        const nextDigits = (baseDigits + digit).slice(0, 4);
        const prevQty = isContinuing ? directQtyBuffer.prevQty : cart[idx].quantity;
        const parsed = Math.max(1, Number(nextDigits) || 1);
        updateQty(idx, parsed, true);
        if (directQtyTimerRef.current) clearTimeout(directQtyTimerRef.current);
        directQtyTimerRef.current = setTimeout(() => {
          setDirectQtyBuffer(null);
        }, 1500);
        setDirectQtyBuffer({ idx, digits: nextDigits, prevQty });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cart, selectedIdx, scanInput, directQtyBuffer, showPayment, showSearch, showDiscount, showQtyModal, showPriceModal, unknownBarcode, showHeldList, lastReceipt]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const logScanEntry = (prod) => {
    const entry = {
      scanId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      scannedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      product: {
        id: prod.id,
        barcode: prod.barcode,
        name: prod.name,
        name_ar: prod.name_ar || '',
        sell_price: prod.sell_price,
        stock: prod.stock
      }
    };
    setScanHistory((prev) => {
      const next = [entry, ...prev].slice(0, 10);
      try {
        localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(next));
      } catch { }
      return next;
    });
  };

  const clearScanHistory = () => {
    setScanHistory([]);
    try {
      localStorage.removeItem(SCAN_HISTORY_KEY);
    } catch { }
  };

  const addProductToCart = (prod, recordHistory = true, qtyToAdd = 1) => {
    const qty = Math.max(1, Math.round(Number(qtyToAdd) || 1));
    if (recordHistory) {
      logScanEntry(prod);
    }
    playBeep('success');
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product_id === prod.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty };
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
          quantity: qty,
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

  const handleRecoverScan = (entry) => {
    addProductToCart(entry.product, false);
    const displayName = lang === 'ar' && entry.product.name_ar ? entry.product.name_ar : entry.product.name;
    showToast(`"${displayName}" récupéré dans le ticket`);
    focusScanner();
  };

  const lookupAndAddBarcode = async (rawCode) => {
    let code = String(rawCode || '').trim();
    setScanInput('');
    if (scanRef.current) scanRef.current.value = '';
    if (!code) {
      if (scannerMode) scanRef.current?.focus();
      return;
    }

    // Standalone multiplier like "5*", "5x", "*5", or "q5" applies quantity to selected line
    const standaloneMult = code.match(/^(\d+)\s*[xX*]$/) || code.match(/^[xX*qQ]\s*(\d+)$/);
    if (standaloneMult && cart.length > 0) {
      const target = getTargetIdx();
      if (target !== null) {
        const nextQty = Math.max(1, Number(standaloneMult[1]) || 1);
        updateQty(target, nextQty, true);
        playBeep('success');
      }
      if (scannerMode) requestAnimationFrame(() => scanRef.current?.focus());
      return;
    }

    // Prefix multiplier like "5*6130760000101" or "5x6130760000101"
    let qtyToAdd = 1;
    const prefixMult = code.match(/^(\d+)\s*[xX*]\s*(.+)$/);
    if (prefixMult) {
      qtyToAdd = Math.max(1, Number(prefixMult[1]) || 1);
      code = prefixMult[2].trim();
    }

    const prod = await posApi.findByBarcode(code);
    if (prod) {
      addProductToCart(prod, true, qtyToAdd);
      setScanInput('');
      if (scanRef.current) {
        scanRef.current.value = '';
        requestAnimationFrame(() => scanRef.current?.focus());
      }
    } else {
      playBeep('error');
      setUnknownBarcode(code);
      setQuickProd({ name: '', sell_price: '', buy_price: '', stock: '20', category: 'Général' });
    }
  };

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    await lookupAndAddBarcode(scanInput);
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
    addProductToCart(created, true);
    setScanInput('');
    if (scannerMode) {
      setTimeout(() => scanRef.current?.focus(), 20);
    }
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

  const handleApplyQtyMultiplier = (e) => {
    e.preventDefault();
    const idx = getTargetIdx();
    if (idx === null) return;
    const nextQty = Math.max(1, Math.round(Number(qtyModalValue) || 1));
    updateQty(idx, nextQty, true);
    setShowQtyModal(false);
    playBeep('success');
    focusScanner();
  };

  const handleApplyDirectPrice = (e) => {
    e.preventDefault();
    const parsedPrice = Math.max(0, Math.round(Number(priceModalValue) || 0));
    if (priceModalMode === 'line') {
      const idx = getTargetIdx();
      if (idx === null) return;
      setCart((prev) => prev.map((it, i) => (i === idx ? { ...it, unit_price: parsedPrice } : it)));
      showToast(`${cart[idx].name} → ${formatDA(parsedPrice, lang)}`);
    } else {
      if (parsedPrice <= 0) return;
      const customId = -Date.now();
      const label = priceModalName.trim() || t.customItemDefault;
      setCart((prev) => {
        const next = [
          ...prev,
          {
            product_id: customId,
            barcode: '',
            name: label,
            unit_price: parsedPrice,
            quantity: 1,
            discount_amount: 0,
            stock: 9999
          }
        ];
        setSelectedIdx(next.length - 1);
        return next;
      });
    }
    setShowPriceModal(false);
    playBeep('success');
    focusScanner();
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
      showToast(`Vente ${savedSale.ticket_number} enregistrée (${formatDA(savedSale.total, lang)})`);
    }
  };

  const handleSearchChange = async (val) => {
    setSearchQuery(val);
    setSearchResults(await posApi.searchProducts(val));
  };

  return (
    <div className="pos-layout" onClick={(e) => {
      if (scannerMode && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        focusScanner();
      }
    }}>
      <div className="pos-left">
        <form onSubmit={handleScanSubmit} className={`scan-bar ${scannerMode ? 'scanner-active' : ''}`}>
          <span className="scan-icon">║█║▌</span>
          <input
            ref={scanRef}
            type="text"
            className="scan-input"
            placeholder={t.scanPlaceholder}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => {
              if (scannerMode && e.key === 'Tab' && scanInput.trim()) {
                e.preventDefault();
                lookupAndAddBarcode(scanInput);
              }
            }}
            onBlur={(e) => {
              if (!scannerMode) return;
              const next = e.relatedTarget;
              if (next && (next.tagName === 'INPUT' || next.tagName === 'SELECT' || next.tagName === 'TEXTAREA')) {
                return;
              }
              setTimeout(() => focusScanner(), 50);
            }}
            autoFocus={scannerMode}
          />
          <button
            type="button"
            className={`scanner-mode-btn ${scannerMode ? 'active' : ''}`}
            title={t.scannerModeHint}
            aria-pressed={scannerMode}
            onClick={toggleScannerMode}
          >
            <span className="scanner-dot" />
            <span>{scannerMode ? t.scannerModeOn : t.scannerModeOff}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setShowSearch(true);
              posApi.searchProducts('').then(setSearchResults);
              setTimeout(() => searchRef.current?.focus(), 50);
            }}
          >
            🔍 {t.searchManual}
          </button>
          {onOpenHelp && (
            <div className="scan-help-wrap">
              <button
                type="button"
                className="scan-help-btn"
                aria-label={t.scanHelpTooltip}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenHelp();
                }}
              >
                ?
              </button>
              <span className="scan-help-tooltip" role="tooltip">
                ⌨️ {t.scanHelpTooltip}
              </span>
            </div>
          )}
        </form>

        {toast && <div className="toast-banner">{toast}</div>}

        <div className="fav-panel">
          <div className="fav-panel-header">
            <span>⭐ {t.favoriteProducts} ({favorites.length})</span>
            <button type="button" className="btn-sm" onClick={toggleFavoritesPanel}>
              {showFavorites ? '▾' : '▸'}
            </button>
          </div>
          {showFavorites && (
            favorites.length === 0 ? (
              <div className="scan-history-empty">{t.noFavorites}</div>
            ) : (
              <div className="fav-grid">
                {favorites.map((p) => {
                  const displayName = lang === 'ar' && p.name_ar ? p.name_ar : p.name;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="fav-card"
                      onClick={() => {
                        addProductToCart(p, true);
                        focusScanner();
                      }}
                    >
                      <ProductThumb product={p} size={46} />
                      <div className="fav-card-body">
                        <div className="fav-card-name" title={displayName}>{displayName}</div>
                        <div className="fav-card-barcode">
                          ║█║▌ {p.barcode || 'Vrac'}
                        </div>
                        <div className="fav-card-price">{formatDA(p.sell_price, lang)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>

        <div className="ticket-table-wrap">
          {cart.length === 0 ? (
            <div className="empty-ticket">
              <div className="empty-icon">🛒</div>
              <p>{t.emptyCart}</p>
              <small>Douchette prête • Raccourcis : F1 Recherche • F4 Encaisser</small>
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
                          <button className="qty-btn" onClick={(e) => { e.stopPropagation(); updateQty(idx, -1); }}>−</button>
                          <input
                            type="number"
                            min="1"
                            className="qty-input"
                            value={editingQty && editingQty.idx === idx ? editingQty.value : item.quantity}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => {
                              setSelectedIdx(idx);
                              setEditingQty({ idx, value: String(item.quantity) });
                              setTimeout(() => e.target.select(), 0);
                            }}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setEditingQty({ idx, value: raw });
                              const n = Math.round(Number(raw));
                              if (n >= 1) updateQty(idx, n, true);
                            }}
                            onBlur={() => {
                              if (editingQty && editingQty.idx === idx) {
                                const n = Math.max(1, Math.round(Number(editingQty.value) || 1));
                                updateQty(idx, n, true);
                                setEditingQty(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                e.preventDefault();
                                e.currentTarget.blur();
                                if (scannerMode) setTimeout(() => scanRef.current?.focus(), 20);
                              }
                            }}
                          />
                          <button className="qty-btn" onClick={(e) => { e.stopPropagation(); updateQty(idx, 1); }}>+</button>
                        </div>
                        {directQtyBuffer && directQtyBuffer.idx === idx && (
                          <div className="text-center">
                            <span className="qty-direct-badge">⌨ {t.qtyDirectEntryHint}: {directQtyBuffer.digits}_</span>
                          </div>
                        )}
                      </td>
                      <td className="text-end bold">{formatDA(lineTotal, lang)}</td>
                      <td className="text-center">
                        <button className="btn-del" onClick={(e) => { e.stopPropagation(); removeLine(idx); }}>🗑</button>
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
          <button className="btn btn-tile" disabled={cart.length === 0} onClick={openQtyMultiplier}>
            ✖ {t.qtyMultiplyTitle} (X)
          </button>
          <button className="btn btn-tile" onClick={() => openDirectPrice()}>
            💶 {t.directPriceBtn}
          </button>
          <button className="btn btn-tile" disabled={cart.length === 0} onClick={() => setShowDiscount(true)}>
            🏷 {t.discountBtn}
          </button>
          <button className="btn btn-tile" disabled={cart.length === 0} onClick={holdCurrentCart}>
            ⏸ {t.holdBtn}
          </button>
          <button className="btn btn-tile" onClick={() => setShowHeldList(true)}>
            📋 {t.resumeBtn} ({heldCarts.length})
          </button>
          <button className="btn btn-tile btn-danger-soft" disabled={cart.length === 0} onClick={clearCart}>
            ✕ {t.clearBtn}
          </button>
        </div>

        <div className="scan-history-card">
          <div className="scan-history-header">
            <span>🕒 {t.scanHistory}</span>
            {scanHistory.length > 0 && (
              <button type="button" className="btn-sm" onClick={clearScanHistory}>
                {t.clearHistory}
              </button>
            )}
          </div>
          <div className="scan-history-list">
            {scanHistory.length === 0 ? (
              <div className="scan-history-empty">{t.scanHistoryEmpty}</div>
            ) : (
              scanHistory.map((entry) => {
                const cartLine = cart.find((c) => c.product_id === entry.product.id);
                const displayName =
                  lang === 'ar' && entry.product.name_ar ? entry.product.name_ar : entry.product.name;
                return (
                  <div
                    key={entry.scanId}
                    className={`scan-history-row ${!cartLine ? 'is-removed' : ''}`}
                  >
                    <div className="scan-history-info">
                      <div className="scan-history-name" title={displayName}>{displayName}</div>
                      <div className="scan-history-meta">
                        <span>{entry.scannedAt}</span>
                        <span>• {formatDA(entry.product.sell_price, lang)}</span>
                        {cartLine ? (
                          <span className="txt-ok">• {t.inCart} (x{cartLine.quantity})</span>
                        ) : (
                          <span className="badge-warn">• {t.removedFromCart}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn-sm ${!cartLine ? 'btn-primary' : ''}`}
                      onClick={() => handleRecoverScan(entry)}
                    >
                      ↩ {t.recoverItem}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="shortcuts-box">
          <div className="shortcuts-box-header">
            <b>Raccourcis clavier</b>
            {onOpenHelp && (
              <button type="button" className="btn-sm" onClick={onOpenHelp}>
                ❓ {t.helpBtn} (F9)
              </button>
            )}
          </div>
          <div><span>F1</span> Recherche / Vrac</div>
          <div><span>F2</span> Remise ticket</div>
          <div><span>F3</span> / <span>P</span> Prix direct</div>
          <div><span>F4</span> Encaisser</div>
          <div><span>+</span> / <span>−</span> Quantité ±1</div>
          <div><span>Q</span> / <span>x</span> / <span>*</span> Saisir qté</div>
          <div><span>0–9</span> Qté directe (OFF)</div>
          <div><span>↑</span> / <span>↓</span> / <span>Suppr</span> Ligne</div>
        </div>
      </div>

      {unknownBarcode && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>⚠️ {t.unknownBarcode} : <code>{unknownBarcode}</code></h3>
              <button className="btn-icon" onClick={() => setUnknownBarcode(null)}>✕</button>
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
                  <label className="field-label">Catégorie</label>
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
              <h3>🔍 {t.searchManual}</h3>
              <button className="btn-icon" onClick={() => setShowSearch(false)}>✕</button>
            </div>
            <div className="row-actions" style={{ marginBottom: 10 }}>
              <input
                ref={searchRef}
                type="text"
                className="input-lg"
                style={{ flex: 1 }}
                placeholder="Nom du produit ou code-barres (ex: pain, œufs, lait)..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <button
                type="button"
                className={`btn ${searchFavOnly ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSearchFavOnly((prev) => !prev)}
              >
                ⭐ {t.favoritesOnly}
              </button>
            </div>
            <div className="search-grid">
              {searchResults
                .filter((p) => (searchFavOnly ? Number(p.is_favorite) === 1 : true))
                .map((p) => (
                  <button
                    key={p.id}
                    className="search-item-card"
                    onClick={() => {
                      addProductToCart(p, true);
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ProductThumb product={p} size={42} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="search-item-cat">
                          {Number(p.is_favorite) === 1 && '⭐ '}
                          {p.category}
                        </div>
                        <div className="search-item-name">{lang === 'ar' && p.name_ar ? p.name_ar : p.name}</div>
                        <div className="fav-card-barcode">║█║▌ {p.barcode || 'Vrac'}</div>
                        <div className="search-item-price">{formatDA(p.sell_price, lang)}</div>
                      </div>
                    </div>
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
              <h3>🏷 {t.discount}</h3>
              <button className="btn-icon" onClick={() => setShowDiscount(false)}>✕</button>
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
              <h3>📋 {t.resumeBtn}</h3>
              <button className="btn-icon" onClick={() => setShowHeldList(false)}>✕</button>
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
                      }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showQtyModal && (
        <div className="modal-overlay" onClick={() => setShowQtyModal(false)}>
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✖ {t.qtyMultiplyTitle}</h3>
              <button type="button" className="btn-icon" onClick={() => setShowQtyModal(false)}>✕</button>
            </div>
            <form onSubmit={handleApplyQtyMultiplier} className="form-grid">
              {getTargetIdx() !== null && (
                <div className="muted" style={{ fontSize: 13 }}>
                  {t.product} : <b>{cart[getTargetIdx()].name}</b>
                </div>
              )}
              <div>
                <label className="field-label">{t.qtyLabel}</label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="1"
                  required
                  className="input-xl"
                  value={qtyModalValue}
                  onChange={(e) => {
                    setQtyModalFresh(false);
                    setQtyModalValue(e.target.value);
                  }}
                />
              </div>
              <div className="qty-keypad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="qty-key-btn"
                    onClick={() => {
                      setQtyModalValue((prev) => {
                        const base = qtyModalFresh ? '' : String(prev || '');
                        return (base + d).slice(0, 4);
                      });
                      setQtyModalFresh(false);
                      qtyInputRef.current?.focus();
                    }}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  className="qty-key-btn qty-key-fn"
                  title={t.qtyKeypadClear}
                  onClick={() => {
                    setQtyModalValue('');
                    setQtyModalFresh(false);
                    qtyInputRef.current?.focus();
                  }}
                >
                  C
                </button>
                <button
                  type="button"
                  className="qty-key-btn"
                  onClick={() => {
                    setQtyModalValue((prev) => {
                      const base = qtyModalFresh ? '' : String(prev || '');
                      return base ? (base + '0').slice(0, 4) : '';
                    });
                    setQtyModalFresh(false);
                    qtyInputRef.current?.focus();
                  }}
                >
                  0
                </button>
                <button
                  type="button"
                  className="qty-key-btn qty-key-fn"
                  onClick={() => {
                    setQtyModalValue((prev) => (qtyModalFresh ? '' : String(prev || '').slice(0, -1)));
                    setQtyModalFresh(false);
                    qtyInputRef.current?.focus();
                  }}
                >
                  ⌫
                </button>
              </div>
              <div className="row-actions" style={{ justifyContent: 'center' }}>
                {[2, 3, 5, 10, 12].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="btn btn-chip"
                    onClick={() => {
                      setQtyModalValue(String(n));
                      setQtyModalFresh(false);
                      qtyInputRef.current?.focus();
                    }}
                  >
                    ×{n}
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowQtyModal(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary">{t.confirm}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPriceModal && (
        <div className="modal-overlay" onClick={() => setShowPriceModal(false)}>
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💶 {t.directPriceTitle}</h3>
              <button type="button" className="btn-icon" onClick={() => setShowPriceModal(false)}>✕</button>
            </div>
            <div className="pay-methods" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                disabled={cart.length === 0}
                className={`pay-method-btn ${priceModalMode === 'line' ? 'active' : ''}`}
                onClick={() => {
                  const idx = getTargetIdx();
                  setPriceModalMode('line');
                  if (idx !== null) {
                    setPriceModalValue(String(cart[idx].unit_price));
                    setPriceModalName(cart[idx].name);
                  }
                  setTimeout(() => { priceInputRef.current?.focus(); priceInputRef.current?.select(); }, 20);
                }}
              >
                {t.priceModeLine}
              </button>
              <button
                type="button"
                className={`pay-method-btn ${priceModalMode === 'custom' ? 'active' : ''}`}
                onClick={() => {
                  setPriceModalMode('custom');
                  setPriceModalValue('');
                  setPriceModalName('');
                  setTimeout(() => priceInputRef.current?.focus(), 20);
                }}
              >
                {t.priceModeCustom}
              </button>
            </div>
            <form onSubmit={handleApplyDirectPrice} className="form-grid">
              {priceModalMode === 'line' && getTargetIdx() !== null ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  {t.product} : <b>{cart[getTargetIdx()].name}</b>
                </div>
              ) : (
                <div>
                  <label className="field-label">{t.customItemLabel}</label>
                  <input
                    type="text"
                    className="input-lg"
                    placeholder={t.customItemDefault}
                    value={priceModalName}
                    onChange={(e) => setPriceModalName(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="field-label">{t.unitPriceLabel}</label>
                <input
                  ref={priceInputRef}
                  type="number"
                  min={priceModalMode === 'custom' ? '1' : '0'}
                  required
                  className="input-xl"
                  placeholder="0"
                  value={priceModalValue}
                  onChange={(e) => setPriceModalValue(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPriceModal(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary">{t.confirm}</button>
              </div>
            </form>
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