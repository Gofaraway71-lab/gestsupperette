export function exportProductsToCsv(products) {
  const headers = ['barcode', 'name', 'name_ar', 'category', 'buy_price', 'sell_price', 'stock', 'alert_threshold'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(';'),
    ...products.map((p) => headers.map((h) => escape(p[h])).join(';'))
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gestsupperette-produits-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadStockCsvTemplate(products = []) {
  const headers = ['barcode', 'name', 'category', 'buy_price', 'sell_price', 'stock', 'alert_threshold'];
  const sampleRows = products.slice(0, 3).map((p) => [
    p.barcode || '6130760000999',
    p.name,
    p.category || 'Épicerie',
    p.buy_price ?? 0,
    p.sell_price ?? 0,
    p.stock ?? 0,
    p.alert_threshold ?? 5
  ]);
  if (sampleRows.length === 0) {
    sampleRows.push(['6130760000101', 'Eau Minérale Ifri 1.5L', 'Boissons', 32, 45, 120, 20]);
  }
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(';'),
    ...sampleRows.map((row) => row.map(escape).join(';'))
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modele-import-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function splitCsvLine(line, sep) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

const HEADER_ALIASES = {
  barcode: ['barcode', 'code', 'product_code', 'code_barre', 'code_barres', 'code-barres', 'sku', 'ean'],
  name: ['name', 'nom', 'product_name', 'designation', 'libelle'],
  name_ar: ['name_ar', 'nom_ar'],
  category: ['category', 'categorie', 'catégorie'],
  buy_price: ['buy_price', 'prix_achat', 'purchase_price', 'cout', 'cost'],
  sell_price: ['sell_price', 'price', 'prix', 'prix_vente', 'unit_price'],
  stock: ['stock', 'quantity', 'qty', 'quantite', 'quantité', 'qte', 'stock_qty'],
  alert_threshold: ['alert_threshold', 'seuil', 'threshold', 'min_stock']
};

function mapHeaders(rawHeaders) {
  return rawHeaders.map((h) => {
    const norm = h.toLowerCase().replace(/\s+/g, '_');
    for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(norm)) return canonical;
    }
    return norm;
  });
}

export function parseCsvProducts(text) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = mapHeaders(splitCsvLine(lines[0], sep));
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line, sep);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? '';
    });
    return obj;
  });
}

function parseStrictNumber(raw) {
  if (raw === undefined || raw === null) return NaN;
  const s = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
  if (s === '') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function validateStockCsv(text, existingProducts = []) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      fileError: 'Le fichier CSV doit contenir une ligne d’en-tête et au moins une ligne de données.',
      rows: [],
      validCount: 0,
      invalidCount: 0
    };
  }

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = mapHeaders(splitCsvLine(lines[0], sep));
  const hasCodeCol = headers.includes('barcode');
  const hasStockCol = headers.includes('stock');
  const hasPriceCol = headers.includes('sell_price') || headers.includes('buy_price');

  if (!hasCodeCol || !hasStockCol) {
    return {
      fileError: 'Colonnes obligatoires manquantes : "barcode" (ou code) et "stock" (ou quantity).',
      rows: [],
      validCount: 0,
      invalidCount: 0
    };
  }

  const byBarcode = new Map();
  for (const p of existingProducts) {
    if (p.barcode) byBarcode.set(String(p.barcode).trim(), p);
  }

  const seenCodes = new Set();
  const validated = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cols = splitCsvLine(lines[i], sep);
    const raw = {};
    headers.forEach((h, idx) => {
      raw[h] = cols[idx] ?? '';
    });

    const errors = [];
    const warnings = [];

    const code = String(raw.barcode ?? '').trim();
    if (!code) {
      errors.push('Code produit manquant');
    } else if (!/^[A-Za-z0-9._-]{3,32}$/.test(code)) {
      errors.push('Code produit invalide (3–32 caractères alphanumériques sans espaces)');
    } else if (seenCodes.has(code)) {
      errors.push(`Code produit en double dans le CSV (${code})`);
    }
    if (code) seenCodes.add(code);

    const existing = code ? byBarcode.get(code) : null;

    // Validate stock quantity
    const stockNum = parseStrictNumber(raw.stock);
    if (Number.isNaN(stockNum)) {
      errors.push('Quantité stock manquante ou non numérique');
    } else if (!Number.isInteger(stockNum) || stockNum < 0) {
      errors.push('Quantité stock invalide (entier ≥ 0 requis)');
    }

    // Validate sell_price
    let sellPriceNum = null;
    const hasSellVal = raw.sell_price !== undefined && String(raw.sell_price).trim() !== '';
    if (hasSellVal) {
      const parsed = parseStrictNumber(raw.sell_price);
      if (Number.isNaN(parsed) || parsed < 0) {
        errors.push('Prix de vente invalide (nombre ≥ 0 requis)');
      } else if (parsed === 0) {
        errors.push('Prix de vente doit être > 0');
      } else {
        sellPriceNum = Math.round(parsed);
      }
    } else if (!existing) {
      errors.push(hasPriceCol ? 'Prix de vente requis pour un nouveau produit' : 'Colonne/valeur de prix manquante pour nouveau produit');
    }

    // Validate buy_price if provided
    let buyPriceNum = null;
    const hasBuyVal = raw.buy_price !== undefined && String(raw.buy_price).trim() !== '';
    if (hasBuyVal) {
      const parsed = parseStrictNumber(raw.buy_price);
      if (Number.isNaN(parsed) || parsed < 0) {
        errors.push("Prix d'achat invalide (nombre ≥ 0 requis)");
      } else {
        buyPriceNum = Math.round(parsed);
      }
    }

    // Validate alert_threshold if provided
    let thresholdNum = null;
    const hasThreshVal = raw.alert_threshold !== undefined && String(raw.alert_threshold).trim() !== '';
    if (hasThreshVal) {
      const parsed = parseStrictNumber(raw.alert_threshold);
      if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0) {
        errors.push("Seuil d'alerte invalide (entier ≥ 0)");
      } else {
        thresholdNum = parsed;
      }
    }

    const name = String(raw.name ?? '').trim();
    if (!existing && !name) {
      errors.push('Nom requis pour créer un nouveau produit');
    }

    const effectiveSell = sellPriceNum ?? existing?.sell_price ?? 0;
    const effectiveBuy = buyPriceNum ?? existing?.buy_price ?? 0;
    if (effectiveBuy > 0 && effectiveSell > 0 && effectiveBuy > effectiveSell) {
      warnings.push("Prix d'achat supérieur au prix de vente");
    }

    validated.push({
      lineNum,
      code,
      name: name || existing?.name || '',
      name_ar: String(raw.name_ar ?? existing?.name_ar ?? '').trim(),
      category: String(raw.category ?? existing?.category ?? 'Général').trim() || 'Général',
      buy_price: buyPriceNum,
      sell_price: sellPriceNum,
      stock: Number.isNaN(stockNum) ? raw.stock : stockNum,
      alert_threshold: thresholdNum,
      existingProduct: existing || null,
      isNew: !existing,
      valid: errors.length === 0,
      errors,
      warnings
    });
  }

  return {
    fileError: null,
    rows: validated,
    validCount: validated.filter((r) => r.valid).length,
    invalidCount: validated.filter((r) => !r.valid).length
  };
}

export function downloadSuppliersCsvTemplate() {
  const headers = ['name', 'primary_contact', 'phone', 'email', 'address', 'nif', 'notes'];
  const sampleRows = [
    ['SARL Atlas Distribution', 'Karim Benali', '0550 11 22 33', 'k.benali@atlas-dist.dz', 'Zone Industrielle Rouiba, Alger', '001416001234567', 'Livraison lundi et jeudi'],
    ['EURL Laiterie Moderne', 'Nadia Mansouri', '0661 44 55 66', 'commandes@laiterie-moderne.dz', 'Blida Centre', '001809007654321', 'Paiement à 15 jours']
  ];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(';'),
    ...sampleRows.map((row) => row.map(escape).join(';'))
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modele-import-fournisseurs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const SUPPLIER_HEADER_ALIASES = {
  name: ['name', 'nom', 'supplier', 'supplier_name', 'fournisseur', 'raison_sociale', 'company', 'societe'],
  contact_name: ['primary_contact', 'contact', 'contact_name', 'contact_principal', 'responsable', 'interlocuteur'],
  phone: ['phone', 'tel', 'telephone', 'téléphone', 'mobile', 'gsm'],
  email: ['email', 'mail', 'e_mail', 'e-mail', 'courriel'],
  address: ['address', 'adresse', 'ville', 'city'],
  nif: ['nif', 'rc', 'tax_id'],
  notes: ['notes', 'note', 'remarques', 'commentaire']
};

function mapSupplierHeaders(rawHeaders) {
  return rawHeaders.map((h) => {
    const norm = h.toLowerCase().replace(/\s+/g, '_');
    for (const [canonical, aliases] of Object.entries(SUPPLIER_HEADER_ALIASES)) {
      if (aliases.includes(norm)) return canonical;
    }
    return norm;
  });
}

export function validateSuppliersCsv(text, existingSuppliers = []) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      fileError: 'Le fichier CSV doit contenir une ligne d’en-tête et au moins un fournisseur.',
      rows: [],
      validCount: 0,
      invalidCount: 0
    };
  }

  const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const headers = mapSupplierHeaders(splitCsvLine(lines[0], sep));
  if (!headers.includes('name')) {
    return {
      fileError: 'Colonne obligatoire manquante : "name" (ou fournisseur / nom).',
      rows: [],
      validCount: 0,
      invalidCount: 0
    };
  }

  const byName = new Map();
  for (const s of existingSuppliers) {
    if (s.name) byName.set(String(s.name).trim().toLowerCase(), s);
  }

  const seenNames = new Set();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validated = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cols = splitCsvLine(lines[i], sep);
    const raw = {};
    headers.forEach((h, idx) => {
      raw[h] = cols[idx] ?? '';
    });

    const errors = [];
    const name = String(raw.name ?? '').trim();
    const contact_name = String(raw.contact_name ?? '').trim();
    const phone = String(raw.phone ?? '').trim();
    const email = String(raw.email ?? '').trim();
    const address = String(raw.address ?? '').trim();
    const nif = String(raw.nif ?? '').trim();
    const notes = String(raw.notes ?? '').trim();

    if (!name) {
      errors.push('Nom du fournisseur manquant');
    } else if (seenNames.has(name.toLowerCase())) {
      errors.push(`Fournisseur en double dans le CSV (${name})`);
    }
    if (name) seenNames.add(name.toLowerCase());

    if (email && !emailRegex.test(email)) {
      errors.push(`Adresse email invalide (${email})`);
    }

    const existing = name ? byName.get(name.toLowerCase()) || null : null;

    validated.push({
      lineNum,
      name,
      contact_name,
      phone,
      email,
      address,
      nif,
      notes,
      existingSupplier: existing,
      isNew: !existing,
      valid: errors.length === 0,
      errors
    });
  }

  return {
    fileError: null,
    rows: validated,
    validCount: validated.filter((r) => r.valid).length,
    invalidCount: validated.filter((r) => !r.valid).length
  };
}