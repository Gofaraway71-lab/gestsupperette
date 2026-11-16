import React, { useState, useMemo } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';

function computePreviewPrice(current, mode, val) {
  if (mode === 'none') return current;
  const num = Number(val);
  if (Number.isNaN(num)) return current;
  if (mode === 'set') return Math.max(0, Math.round(num));
  if (mode === 'adjust_amount') return Math.max(0, Math.round(current + num));
  if (mode === 'adjust_percent') return Math.max(0, Math.round(current * (1 + num / 100)));
  return current;
}

export default function BulkEditModal({
  selectedProducts = [],
  existingCategories = [],
  lang = 'fr',
  t,
  onApplied,
  onClose
}) {
  const [categoryMode, setCategoryMode] = useState('none'); // 'none' | 'set'
  const [categoryValue, setCategoryValue] = useState('');

  const [sellPriceMode, setSellPriceMode] = useState('none'); // 'none' | 'set' | 'adjust_amount' | 'adjust_percent'
  const [sellPriceValue, setSellPriceValue] = useState('');

  const [buyPriceMode, setBuyPriceMode] = useState('none');
  const [buyPriceValue, setBuyPriceValue] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasCategoryChange = categoryMode === 'set' && categoryValue.trim() !== '';
  const hasSellChange = sellPriceMode !== 'none' && sellPriceValue !== '' && !Number.isNaN(Number(sellPriceValue));
  const hasBuyChange = buyPriceMode !== 'none' && buyPriceValue !== '' && !Number.isNaN(Number(buyPriceValue));
  const hasAnyChange = hasCategoryChange || hasSellChange || hasBuyChange;

  const previewRows = useMemo(() => {
    return selectedProducts.map((p) => {
      const nextCategory = hasCategoryChange ? categoryValue.trim() : p.category;
      const nextSell = hasSellChange ? computePreviewPrice(p.sell_price, sellPriceMode, sellPriceValue) : p.sell_price;
      const nextBuy = hasBuyChange ? computePreviewPrice(p.buy_price, buyPriceMode, buyPriceValue) : p.buy_price;
      return {
        ...p,
        nextCategory,
        nextSell,
        nextBuy
      };
    });
  }, [selectedProducts, hasCategoryChange, categoryValue, hasSellChange, sellPriceMode, sellPriceValue, hasBuyChange, buyPriceMode, buyPriceValue]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!hasAnyChange) {
      setError(t.bulkNoChangesHint);
      return;
    }
    setSaving(true);
    try {
      const count = await posApi.bulkUpdateProducts({
        ids: selectedProducts.map((p) => p.id),
        category: hasCategoryChange ? categoryValue.trim() : null,
        sellPriceMode: hasSellChange ? sellPriceMode : 'none',
        sellPriceValue: hasSellChange ? Number(sellPriceValue) : 0,
        buyPriceMode: hasBuyChange ? buyPriceMode : 'none',
        buyPriceValue: hasBuyChange ? Number(buyPriceValue) : 0
      });
      onApplied?.(count);
    } catch (err) {
      setError(err?.message || 'Erreur lors de la mise à jour en masse.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>✏️ {t.bulkEditTitle} ({selectedProducts.length} {t.bulkSelectedCount})</h3>
          <button type="button" className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form-grid">
          <div className="invoice-box">
            <div className="row-2" style={{ alignItems: 'end' }}>
              <div>
                <label className="field-label">{t.bulkCategoryLabel}</label>
                <select
                  className="input-lg"
                  value={categoryMode}
                  onChange={(e) => setCategoryMode(e.target.value)}
                >
                  <option value="none">{t.bulkKeepUnchanged}</option>
                  <option value="set">{t.bulkSetCategory}</option>
                </select>
              </div>
              <div>
                <label className="field-label">{t.bulkSetCategory}</label>
                <input
                  type="text"
                  list="bulk-category-list"
                  className="input-lg"
                  disabled={categoryMode === 'none'}
                  placeholder={t.bulkCategoryPlaceholder}
                  value={categoryValue}
                  onChange={(e) => setCategoryValue(e.target.value)}
                />
                <datalist id="bulk-category-list">
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="row-2" style={{ marginTop: 12, alignItems: 'end' }}>
              <div>
                <label className="field-label">{t.bulkSellPriceLabel}</label>
                <select
                  className="input-lg"
                  value={sellPriceMode}
                  onChange={(e) => setSellPriceMode(e.target.value)}
                >
                  <option value="none">{t.bulkKeepUnchanged}</option>
                  <option value="set">{t.bulkPriceSet}</option>
                  <option value="adjust_amount">{t.bulkPriceAdjustAmt}</option>
                  <option value="adjust_percent">{t.bulkPriceAdjustPct}</option>
                </select>
              </div>
              <div>
                <label className="field-label">
                  {sellPriceMode === 'adjust_percent' ? '%' : 'DA'}
                </label>
                <input
                  type="number"
                  step="any"
                  className="input-lg"
                  disabled={sellPriceMode === 'none'}
                  placeholder={sellPriceMode === 'adjust_percent' ? 'Ex: 10 ou -5' : 'Ex: 150'}
                  value={sellPriceValue}
                  onChange={(e) => setSellPriceValue(e.target.value)}
                />
              </div>
            </div>

            <div className="row-2" style={{ marginTop: 12, alignItems: 'end' }}>
              <div>
                <label className="field-label">{t.bulkBuyPriceLabel}</label>
                <select
                  className="input-lg"
                  value={buyPriceMode}
                  onChange={(e) => setBuyPriceMode(e.target.value)}
                >
                  <option value="none">{t.bulkKeepUnchanged}</option>
                  <option value="set">{t.bulkPriceSet}</option>
                  <option value="adjust_amount">{t.bulkPriceAdjustAmt}</option>
                  <option value="adjust_percent">{t.bulkPriceAdjustPct}</option>
                </select>
              </div>
              <div>
                <label className="field-label">
                  {buyPriceMode === 'adjust_percent' ? '%' : 'DA'}
                </label>
                <input
                  type="number"
                  step="any"
                  className="input-lg"
                  disabled={buyPriceMode === 'none'}
                  placeholder={buyPriceMode === 'adjust_percent' ? 'Ex: 10 ou -5' : 'Ex: 120'}
                  value={buyPriceValue}
                  onChange={(e) => setBuyPriceValue(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="field-label">{t.bulkPreviewCol}</div>
            <div className="csv-preview-wrap" style={{ maxHeight: 220 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t.product}</th>
                    <th>{t.bulkCategoryLabel}</th>
                    <th className="text-end">Achat</th>
                    <th className="text-end">Vente</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.id}>
                      <td><b>{lang === 'ar' && r.name_ar ? r.name_ar : r.name}</b></td>
                      <td>
                        <span className="pill">{r.category}</span>
                        {r.nextCategory !== r.category && (
                          <> → <span className="pill pill-ok">{r.nextCategory}</span></>
                        )}
                      </td>
                      <td className="text-end">
                        {formatDA(r.buy_price, lang)}
                        {r.nextBuy !== r.buy_price && (
                          <> → <b className="txt-ok">{formatDA(r.nextBuy, lang)}</b></>
                        )}
                      </td>
                      <td className="text-end">
                        {formatDA(r.sell_price, lang)}
                        {r.nextSell !== r.sell_price && (
                          <> → <b className="txt-ok">{formatDA(r.nextSell, lang)}</b></>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!hasAnyChange || saving}
            >
              ✓ {t.bulkApplyBtn} ({selectedProducts.length})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
