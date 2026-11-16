import React from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';

export default function ReceiptModal({ sale, settings, lang, t, onClose }) {
  if (!sale) return null;

  const paymentLabels = {
    cash: t.cash,
    card: t.card,
    credit: t.credit
  };

  const handlePrint = async () => {
    await posApi.printReceipt();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-sm">
        <div className="modal-header no-print">
          <h3>{t.receiptTitle}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div id="printable-receipt" className="receipt-paper">
          <div className="receipt-center">
            <strong className="receipt-store">{settings.store_name || 'gestsupperette'}</strong>
            <div>{settings.store_address}</div>
            <div>Tél : {settings.store_phone}</div>
          </div>
          <hr className="receipt-hr" />
          <div className="receipt-meta">
            <div>Ticket : <b>{sale.ticket_number}</b></div>
            <div>Date : {new Date(sale.created_at.replace(' ', 'T') + 'Z').toLocaleString('fr-FR')}</div>
            <div>Caissier : {sale.cashier_name}</div>
            {sale.customer_name && <div>Client : {sale.customer_name}</div>}
          </div>
          <hr className="receipt-hr" />

          <table className="receipt-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Qté</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.product_name}
                    <div className="receipt-sub">{formatDA(it.unit_price, lang)}</div>
                  </td>
                  <td>x{it.quantity}</td>
                  <td className="text-end">{formatDA(it.line_total, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <hr className="receipt-hr" />
          {sale.discount_amount > 0 && (
            <div className="receipt-row">
              <span>{t.discount}</span>
              <span>-{formatDA(sale.discount_amount, lang)}</span>
            </div>
          )}
          <div className="receipt-row receipt-total">
            <span>TOTAL</span>
            <span>{formatDA(sale.total, lang)}</span>
          </div>
          <div className="receipt-row">
            <span>Paiement ({paymentLabels[sale.payment_method]})</span>
            <span>{formatDA(sale.amount_received, lang)}</span>
          </div>
          {sale.change_given > 0 && (
            <div className="receipt-row">
              <span>{t.changeDue}</span>
              <span>{formatDA(sale.change_given, lang)}</span>
            </div>
          )}
          <hr className="receipt-hr" />
          <div className="receipt-center receipt-footer">
            {settings.receipt_footer || 'Merci pour votre visite !'}
          </div>
        </div>

        <div className="modal-actions no-print">
          <button className="btn btn-secondary" onClick={onClose}>{t.newSale}</button>
          <button className="btn btn-primary" onClick={handlePrint}>🖨 {t.print}</button>
        </div>
      </div>
    </div>
  );
}