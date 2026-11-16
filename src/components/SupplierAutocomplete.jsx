import React, { useState, useEffect, useRef } from 'react';
import { formatDA } from '../i18n';

export default function SupplierAutocomplete({
  suppliers = [],
  value,
  onChange,
  lang = 'fr',
  placeholder = 'Rechercher un fournisseur (nom, contact, tél, email)...'
}) {
  const selectedSupplier = suppliers.find((s) => String(s.id) === String(value)) || null;
  const [query, setQuery] = useState(selectedSupplier ? selectedSupplier.name : '');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (selectedSupplier) {
      setQuery(selectedSupplier.name);
    }
  }, [value, selectedSupplier]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        if (!selectedSupplier) {
          setQuery('');
        } else {
          setQuery(selectedSupplier.name);
        }
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [selectedSupplier]);

  const searchTerm = selectedSupplier && query === selectedSupplier.name ? '' : query.trim().toLowerCase();
  const filtered = suppliers.filter((s) =>
    `${s.name} ${s.contact_name || ''} ${s.phone || ''} ${s.email || ''} ${s.address || ''} ${s.nif || ''}`
      .toLowerCase()
      .includes(searchTerm)
  );

  useEffect(() => {
    setHighlightIdx(0);
  }, [searchTerm, open]);

  const selectSupplier = (sup) => {
    onChange(String(sup.id));
    setQuery(sup.name);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    const next = e.target.value;
    setQuery(next);
    setOpen(true);
    if (value) {
      onChange('');
    }
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => (filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length));
    } else if (e.key === 'Enter') {
      if (filtered.length > 0) {
        e.preventDefault();
        selectSupplier(filtered[highlightIdx] || filtered[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="autocomplete-wrap" ref={wrapRef}>
      <div className={`autocomplete-input-box ${selectedSupplier ? 'has-selection' : ''}`}>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className="autocomplete-input"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            className="autocomplete-action-btn"
            title="Effacer"
            onClick={handleClear}
          >
            ✕
          </button>
        )}
        <button
          type="button"
          className="autocomplete-action-btn"
          title="Afficher les fournisseurs"
          onClick={() => setOpen((prev) => !prev)}
        >
          ▾
        </button>
      </div>

      {open && (
        <div className="autocomplete-dropdown" role="listbox">
          {filtered.length === 0 ? (
            <div className="autocomplete-empty">
              Aucun fournisseur correspondant trouvé dans la base.
            </div>
          ) : (
            filtered.map((s, idx) => {
              const isSelected = String(s.id) === String(value);
              const isHighlighted = idx === highlightIdx;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`autocomplete-option ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}`}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSupplier(s);
                  }}
                >
                  <div className="autocomplete-option-main">
                    <b>{s.name}</b>
                    {s.balance_due > 0 && (
                      <span className="csv-error-txt">Dû : {formatDA(s.balance_due, lang)}</span>
                    )}
                  </div>
                  <div className="autocomplete-option-sub">
                    {s.contact_name ? `👤 ${s.contact_name} • ` : ''}
                    {s.phone ? `📞 ${s.phone}` : 'Sans tél'}
                    {s.email ? ` • ✉ ${s.email}` : ''}
                    {s.address ? ` • ${s.address}` : ''}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
