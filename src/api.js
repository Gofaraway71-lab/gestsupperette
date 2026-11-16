const STORAGE_KEY = 'gestsupperette_db_v1';

const utcNowSql = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const localDateStr = (sqlTs) => {
  const d = new Date(sqlTs.replace(' ', 'T') + 'Z');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function createSeedDb() {
  const demoProducts = [
    ['6130760000101', 'Eau Minérale Ifri 1.5L', 'مياه معدنية إفري 1.5 ل', 'Boissons', 32, 45, 120, 20],
    ['6130760000118', 'Eau Gazeuse Ifri Gazouz 1L', 'إفري غازوز 1 ل', 'Boissons', 75, 100, 48, 10],
    ['6130210001015', 'Lait UHT Candia Demi-Écrémé 1L', 'حليب كانديا 1 ل', 'Crèmerie', 115, 140, 60, 12],
    ['6130540002019', 'Yaourt Soummam Acti+ Fraise', 'ياغورت صومام', 'Crèmerie', 28, 40, 90, 15],
    ['6130540002026', 'Lben Soummam 1L', 'لبن صومام 1 ل', 'Crèmerie', 95, 125, 35, 8],
    ['6130120003011', 'Huile Végétale Fleurial 2L', 'زيت نباتي فلوريال 2 ل', 'Épicerie', 230, 265, 40, 10],
    ['6130120003028', 'Sucre Blanc Cevital 1Kg', 'سكر أبيض سيفيتال 1 كغ', 'Épicerie', 85, 105, 80, 15],
    ['6130120003035', 'Semoule Fine Mama 2Kg', 'سميد ناعم ماما 2 كغ', 'Épicerie', 150, 190, 50, 10],
    ['6130880004012', 'Pâtes Spaghetti Sim 500g', 'معكرونة سيم 500 غ', 'Épicerie', 60, 80, 70, 12],
    ['6130910005018', 'Tomate Concentrée Amor Benamor 400g', 'طماطم مصبرة بن عمر', 'Épicerie', 145, 185, 45, 10],
    ['6130440006014', 'Café Moulu Facto 250g', 'قهوة فاكتو 250 غ', 'Café & Thé', 260, 320, 30, 6],
    ['6130330007010', 'Soda Hamoud Boualem Selecto 1L', 'حمود بوعلام سيليكتو 1 ل', 'Boissons', 95, 120, 55, 12],
    ['6130660008016', 'Jus Rouiba Cocktail 1L', 'عصير رويبة 1 ل', 'Boissons', 140, 180, 42, 10],
    ['6130770009012', 'Biscuit Bimo Tango Chocolat', 'بسكويت بيمو تانغو', 'Biscuiterie', 35, 50, 100, 20],
    ['6130770009029', 'Gaufrettes Palmera Vanille', 'بالميرا فانيليا', 'Biscuiterie', 25, 40, 85, 15],
    ['6130550010014', 'Fromage La Vache Qui Rit 8 Portions', 'جبن لافاش كيري 8 قطع', 'Crèmerie', 195, 240, 36, 8],
    ['6130220011012', "Thon à l'Huile El Manar 160g", 'تونة المنار بالزيت', 'Conserves', 190, 240, 28, 6],
    ['6130990012018', 'Lessive Isis Machine 1Kg', 'مسحوق غسيل إيزيس 1 كغ', 'Hygiène', 220, 280, 24, 5],
    ['6130990012025', 'Liquide Vaisselle Pril Isis 650ml', 'سائل غسل الأواني بريل', 'Hygiène', 145, 190, 30, 6],
    ['6130990012032', 'Papier Essuie-Tout Ouatex x2', 'ورق مطبخ', 'Hygiène', 130, 170, 25, 5],
    [null, 'Pain Baguette Traditionnel', 'خبز تقليدي', 'Boulangerie (Vrac)', 10, 15, 100, 20],
    [null, 'Œufs Frais (Pièce)', 'بيض طازج (بالحبة)', 'Crèmerie (Vrac)', 17, 22, 180, 30]
  ];

  const demoSuppliers = [
    {
      id: 1,
      name: 'SARL Distribution Alger',
      phone: '0555 44 33 22',
      email: 'commandes@distalger.dz',
      address: 'Zone Industrielle Oued Smar, Alger',
      nif: '001216009874512',
      notes: 'Livraison mardi et jeudi',
      active: 1,
      created_at: utcNowSql()
    },
    {
      id: 2,
      name: 'EURL Boissons & Laiterie',
      phone: '0661 88 77 66',
      email: 'ventes@boissons-dz.com',
      address: 'Rouiba, Alger',
      nif: '001516004411223',
      notes: 'Eaux minérales, jus et crèmerie',
      active: 1,
      created_at: utcNowSql()
    },
    {
      id: 3,
      name: 'Grossiste Épicerie El Bahdja',
      phone: '0770 19 28 37',
      email: '',
      address: 'El Harrach, Alger',
      nif: '',
      notes: 'Paiement à 15 jours',
      active: 1,
      created_at: utcNowSql()
    }
  ];

  const todayDate = new Date().toISOString().slice(0, 10);

  return {
    seq: {
      products: 22,
      sales: 0,
      sale_items: 0,
      stock_movements: 0,
      held_carts: 0,
      cash_registers: 0,
      suppliers: 3,
      supplier_invoices: 2,
      supplier_invoice_items: 4,
      supplier_payments: 1
    },
    users: [
      { id: 1, name: 'Caissier 1', role: 'cashier', pin: '1234', active: 1 },
      { id: 2, name: 'Gérant', role: 'manager', pin: '0000', active: 1 }
    ],
    products: demoProducts.map((p, idx) => {
      const defaultFavIndices = new Set([0, 2, 3, 6, 10, 11, 20, 21]);
      return {
        id: idx + 1,
        barcode: p[0], name: p[1], name_ar: p[2], category: p[3],
        buy_price: p[4], sell_price: p[5], stock: p[6], alert_threshold: p[7],
        image: '',
        is_favorite: defaultFavIndices.has(idx) ? 1 : 0,
        active: 1, created_at: utcNowSql()
      };
    }),
    sales: [],
    sale_items: [],
    stock_movements: [],
    held_carts: [],
    cash_registers: [],
    suppliers: demoSuppliers,
    supplier_invoices: [
      {
        id: 1,
        invoice_number: 'FF-2026-0001',
        supplier_id: 2,
        invoice_date: todayDate,
        due_date: todayDate,
        subtotal: 7440,
        discount_amount: 0,
        total: 7440,
        amount_paid: 7440,
        status: 'paid',
        payment_method: 'cash',
        stock_updated: 1,
        notes: 'Livraison boissons semaine',
        user_id: 2,
        created_at: utcNowSql()
      },
      {
        id: 2,
        invoice_number: 'FF-2026-0002',
        supplier_id: 1,
        invoice_date: todayDate,
        due_date: todayDate,
        subtotal: 15800,
        discount_amount: 300,
        total: 15500,
        amount_paid: 8000,
        status: 'partial',
        payment_method: 'credit',
        stock_updated: 1,
        notes: 'Acompte versé à la livraison',
        user_id: 2,
        created_at: utcNowSql()
      }
    ],
    supplier_invoice_items: [
      { id: 1, invoice_id: 1, product_id: 1, barcode: '6130760000101', product_name: 'Eau Minérale Ifri 1.5L', quantity: 120, unit_cost: 32, line_total: 3840 },
      { id: 2, invoice_id: 1, product_id: 2, barcode: '6130760000118', product_name: 'Eau Gazeuse Ifri Gazouz 1L', quantity: 48, unit_cost: 75, line_total: 3600 },
      { id: 3, invoice_id: 2, product_id: 6, barcode: '6130120003011', product_name: 'Huile Végétale Fleurial 2L', quantity: 40, unit_cost: 230, line_total: 9200 },
      { id: 4, invoice_id: 2, product_id: 7, barcode: '6130120003028', product_name: 'Sucre Blanc Cevital 1Kg', quantity: 77, unit_cost: 85, line_total: 6600 }
    ],
    supplier_payments: [
      { id: 1, invoice_id: 2, amount: 8000, payment_method: 'cash', notes: 'Acompte livraison', user_id: 2, created_at: utcNowSql() }
    ],
    settings: {
      store_name: 'gestsupperette',
      store_address: 'Rue Didouche Mourad, Alger',
      store_phone: '0550 12 34 56',
      receipt_footer: 'Merci pour votre visite !'
    }
  };
}

function ensureDbShape(db) {
  let changed = false;
  if (!db.seq) { db.seq = {}; changed = true; }
  const seqDefaults = {
    products: 0, sales: 0, sale_items: 0, stock_movements: 0, held_carts: 0, cash_registers: 0,
    suppliers: 0, supplier_invoices: 0, supplier_invoice_items: 0, supplier_payments: 0
  };
  for (const [k, v] of Object.entries(seqDefaults)) {
    if (db.seq[k] === undefined) { db.seq[k] = v; changed = true; }
  }
  if (!Array.isArray(db.suppliers)) {
    const seed = createSeedDb();
    db.suppliers = seed.suppliers;
    db.supplier_invoices = seed.supplier_invoices;
    db.supplier_invoice_items = seed.supplier_invoice_items;
    db.supplier_payments = seed.supplier_payments;
    db.seq.suppliers = seed.seq.suppliers;
    db.seq.supplier_invoices = seed.seq.supplier_invoices;
    db.seq.supplier_invoice_items = seed.seq.supplier_invoice_items;
    db.seq.supplier_payments = seed.seq.supplier_payments;
    changed = true;
  }
  if (!Array.isArray(db.supplier_invoices)) { db.supplier_invoices = []; changed = true; }
  if (!Array.isArray(db.supplier_invoice_items)) { db.supplier_invoice_items = []; changed = true; }
  if (!Array.isArray(db.supplier_payments)) { db.supplier_payments = []; changed = true; }
  if (Array.isArray(db.products) && db.products.length > 0 && db.products.every((p) => p.is_favorite === undefined)) {
    const defaultFavNames = new Set([
      'Eau Minérale Ifri 1.5L',
      'Lait UHT Candia Demi-Écrémé 1L',
      'Yaourt Soummam Acti+ Fraise',
      'Sucre Blanc Cevital 1Kg',
      'Café Moulu Facto 250g',
      'Soda Hamoud Boualem Selecto 1L',
      'Pain Baguette Traditionnel',
      'Œufs Frais (Pièce)'
    ]);
    for (const p of db.products) {
      p.is_favorite = defaultFavNames.has(p.name) ? 1 : 0;
      if (p.image === undefined) p.image = '';
    }
    changed = true;
  }
  if (changed) saveDb(db);
  return db;
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return ensureDbShape(JSON.parse(raw));
  } catch { }
  const seed = createSeedDb();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function saveDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

const browserApi = {
  async login(pin) {
    const db = loadDb();
    const u = db.users.find((x) => x.pin === String(pin) && x.active === 1);
    return u ? { id: u.id, name: u.name, role: u.role } : null;
  },
  async listUsers() {
    return loadDb().users.map(({ id, name, role, active }) => ({ id, name, role, active }));
  },
  async updateUserPin(userId, newPin) {
    const db = loadDb();
    const u = db.users.find((x) => x.id === userId);
    if (u) u.pin = String(newPin);
    saveDb(db);
    return true;
  },

  async listProducts() {
    return loadDb().products.filter((p) => p.active === 1).sort((a, b) => a.name.localeCompare(b.name));
  },
  async findByBarcode(bc) {
    const clean = String(bc || '').trim();
    if (!clean) return null;
    return loadDb().products.find((p) => p.active === 1 && p.barcode === clean) || null;
  },
  async searchProducts(query) {
    const q = String(query || '').trim().toLowerCase();
    return loadDb().products
      .filter((p) => p.active === 1 && `${p.name} ${p.name_ar} ${p.barcode || ''} ${p.category}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 60);
  },
  async listFavorites() {
    return loadDb().products
      .filter((p) => p.active === 1 && Number(p.is_favorite) === 1)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async toggleProductFavorite(id) {
    const db = loadDb();
    const p = db.products.find((x) => x.id === id);
    if (!p) return null;
    p.is_favorite = Number(p.is_favorite) === 1 ? 0 : 1;
    saveDb(db);
    return p;
  },
  async upsertProduct(p) {
    const db = loadDb();
    const barcode = p.barcode && String(p.barcode).trim() !== '' ? String(p.barcode).trim() : null;
    if (barcode && db.products.some((x) => x.active === 1 && x.barcode === barcode && x.id !== p.id)) {
      throw new Error('Code-barres déjà utilisé');
    }
    if (p.id) {
      const idx = db.products.findIndex((x) => x.id === p.id);
      if (idx >= 0) {
        db.products[idx] = {
          ...db.products[idx],
          barcode,
          name: p.name.trim(),
          name_ar: (p.name_ar || '').trim(),
          category: (p.category || 'Général').trim(),
          buy_price: Math.round(Number(p.buy_price) || 0),
          sell_price: Math.round(Number(p.sell_price) || 0),
          stock: Math.round(Number(p.stock) || 0),
          alert_threshold: Math.round(Number(p.alert_threshold) || 5),
          image: p.image !== undefined ? String(p.image || '').trim() : (db.products[idx].image || ''),
          is_favorite: p.is_favorite !== undefined ? (p.is_favorite ? 1 : 0) : (db.products[idx].is_favorite || 0)
        };
        saveDb(db);
        return db.products[idx];
      }
    }
    const prod = {
      id: ++db.seq.products,
      barcode,
      name: p.name.trim(),
      name_ar: (p.name_ar || '').trim(),
      category: (p.category || 'Général').trim(),
      buy_price: Math.round(Number(p.buy_price) || 0),
      sell_price: Math.round(Number(p.sell_price) || 0),
      stock: Math.round(Number(p.stock) || 0),
      alert_threshold: Math.round(Number(p.alert_threshold) || 5),
      image: String(p.image || '').trim(),
      is_favorite: p.is_favorite ? 1 : 0,
      active: 1,
      created_at: utcNowSql()
    };
    db.products.push(prod);
    saveDb(db);
    return prod;
  },
  async deleteProduct(id) {
    const db = loadDb();
    const p = db.products.find((x) => x.id === id);
    if (p) { p.active = 0; p.barcode = null; }
    saveDb(db);
    return true;
  },
  async bulkUpdateProducts({
    ids = [],
    category = null,
    sellPriceMode = 'none',
    sellPriceValue = 0,
    buyPriceMode = 'none',
    buyPriceValue = 0
  }) {
    const db = loadDb();
    const idSet = new Set(ids.map(Number));
    let updatedCount = 0;

    const computeNextPrice = (current, mode, val) => {
      const num = Number(val) || 0;
      if (mode === 'set') return Math.max(0, Math.round(num));
      if (mode === 'adjust_amount') return Math.max(0, Math.round(current + num));
      if (mode === 'adjust_percent') return Math.max(0, Math.round(current * (1 + num / 100)));
      return current;
    };

    for (const p of db.products) {
      if (p.active !== 1 || !idSet.has(p.id)) continue;
      if (category !== null && String(category).trim() !== '') {
        p.category = String(category).trim();
      }
      if (sellPriceMode !== 'none') {
        p.sell_price = computeNextPrice(p.sell_price, sellPriceMode, sellPriceValue);
      }
      if (buyPriceMode !== 'none') {
        p.buy_price = computeNextPrice(p.buy_price, buyPriceMode, buyPriceValue);
      }
      updatedCount++;
    }

    saveDb(db);
    return updatedCount;
  },
  async importCsv(rows) {
    let count = 0;
    for (const r of rows) {
      if (!r.name || !r.sell_price) continue;
      const existing = r.barcode ? await browserApi.findByBarcode(r.barcode) : null;
      await browserApi.upsertProduct(existing ? { ...existing, ...r, id: existing.id } : r);
      count++;
    }
    return count;
  },
  async importStockCsv({ rows, mode = 'set', userId = null }) {
    const db = loadDb();
    let updatedCount = 0;
    let createdCount = 0;

    for (const r of rows) {
      if (!r.valid) continue;
      const code = String(r.code || '').trim();
      if (!code) continue;
      const qty = Math.max(0, Math.round(Number(r.stock) || 0));
      const existing = db.products.find((p) => p.active === 1 && p.barcode === code);

      if (existing) {
        const prevStock = existing.stock;
        const nextStock = mode === 'add' ? prevStock + qty : qty;
        const delta = nextStock - prevStock;
        existing.stock = nextStock;
        if (r.sell_price !== null && r.sell_price !== undefined) {
          existing.sell_price = Math.round(Number(r.sell_price));
        }
        if (r.buy_price !== null && r.buy_price !== undefined) {
          existing.buy_price = Math.round(Number(r.buy_price));
        }
        if (r.name && r.name.trim()) existing.name = r.name.trim();
        if (r.category && r.category.trim()) existing.category = r.category.trim();
        if (r.alert_threshold !== null && r.alert_threshold !== undefined) {
          existing.alert_threshold = Math.round(Number(r.alert_threshold));
        }
        if (delta !== 0) {
          db.stock_movements.unshift({
            id: ++db.seq.stock_movements,
            product_id: existing.id,
            delta,
            reason: mode === 'add' ? 'Import CSV (Entrée)' : 'Import CSV (Mise à jour)',
            user_id: userId,
            created_at: utcNowSql()
          });
        }
        updatedCount++;
      } else if (r.name && r.sell_price) {
        const prod = {
          id: ++db.seq.products,
          barcode: code,
          name: r.name.trim(),
          name_ar: (r.name_ar || '').trim(),
          category: (r.category || 'Général').trim(),
          buy_price: Math.round(Number(r.buy_price) || 0),
          sell_price: Math.round(Number(r.sell_price) || 0),
          stock: qty,
          alert_threshold: r.alert_threshold !== null && r.alert_threshold !== undefined ? Math.round(Number(r.alert_threshold)) : 5,
          active: 1,
          created_at: utcNowSql()
        };
        db.products.push(prod);
        if (qty > 0) {
          db.stock_movements.unshift({
            id: ++db.seq.stock_movements,
            product_id: prod.id,
            delta: qty,
            reason: 'Import CSV (Nouveau produit)',
            user_id: userId,
            created_at: utcNowSql()
          });
        }
        createdCount++;
      }
    }
    saveDb(db);
    return { updatedCount, createdCount, totalCount: updatedCount + createdCount };
  },

  async adjustStock({ productId, delta, reason, userId }) {
    const db = loadDb();
    const p = db.products.find((x) => x.id === productId);
    if (!p) return null;
    p.stock += Math.round(delta);
    db.stock_movements.unshift({
      id: ++db.seq.stock_movements,
      product_id: productId,
      delta: Math.round(delta),
      reason: reason || 'Ajustement manuel',
      user_id: userId || null,
      created_at: utcNowSql()
    });
    saveDb(db);
    return p;
  },
  async listStockMovements(limit = 100) {
    const db = loadDb();
    return db.stock_movements.slice(0, limit).map((m) => {
      const p = db.products.find((x) => x.id === m.product_id);
      const u = db.users.find((x) => x.id === m.user_id);
      return { ...m, product_name: p?.name || '', user_name: u?.name || '' };
    });
  },

  async createSale(payload) {
    const db = loadDb();
    const now = new Date();
    const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const todayStr = localDateStr(utcNowSql());
    const countToday = db.sales.filter((s) => localDateStr(s.created_at) === todayStr).length;
    const ticket_number = `TK-${prefix}-${String(countToday + 1).padStart(4, '0')}`;

    const sale = {
      id: ++db.seq.sales,
      ticket_number,
      user_id: payload.userId,
      subtotal: payload.subtotal,
      discount_amount: payload.discountAmount,
      total: payload.total,
      payment_method: payload.paymentMethod,
      amount_received: payload.amountReceived,
      change_given: payload.changeGiven,
      customer_name: payload.customerName || '',
      status: 'completed',
      cancel_reason: '',
      created_at: utcNowSql()
    };
    db.sales.unshift(sale);

    for (const item of payload.items) {
      const prod = db.products.find((x) => x.id === item.product_id);
      db.sale_items.push({
        id: ++db.seq.sale_items,
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.name,
        unit_price: item.unit_price,
        buy_price: prod ? prod.buy_price : 0,
        quantity: item.quantity,
        discount_amount: item.discount_amount || 0,
        line_total: item.line_total
      });
      if (prod) {
        prod.stock -= item.quantity;
        db.stock_movements.unshift({
          id: ++db.seq.stock_movements,
          product_id: item.product_id,
          delta: -item.quantity,
          reason: `Vente ${ticket_number}`,
          user_id: payload.userId,
          created_at: utcNowSql()
        });
      }
    }
    saveDb(db);
    return browserApi.getSaleDetails(sale.id);
  },
  async listSales({ search = '' } = {}) {
    const db = loadDb();
    const q = search.trim().toLowerCase();
    return db.sales
      .filter((s) => `${s.ticket_number} ${s.customer_name}`.toLowerCase().includes(q))
      .slice(0, 200)
      .map((s) => ({
        ...s,
        cashier_name: db.users.find((u) => u.id === s.user_id)?.name || ''
      }));
  },
  async getSaleDetails(saleId) {
    const db = loadDb();
    const s = db.sales.find((x) => x.id === saleId);
    if (!s) return null;
    return {
      ...s,
      cashier_name: db.users.find((u) => u.id === s.user_id)?.name || '',
      items: db.sale_items.filter((it) => it.sale_id === saleId)
    };
  },
  async cancelSale({ saleId, reason, userId }) {
    const db = loadDb();
    const s = db.sales.find((x) => x.id === saleId);
    if (!s || s.status === 'cancelled') throw new Error('Ticket introuvable');
    s.status = 'cancelled';
    s.cancel_reason = reason || 'Annulation gérant';
    for (const it of db.sale_items.filter((x) => x.sale_id === saleId)) {
      const p = db.products.find((x) => x.id === it.product_id);
      if (p) p.stock += it.quantity;
      db.stock_movements.unshift({
        id: ++db.seq.stock_movements,
        product_id: it.product_id,
        delta: it.quantity,
        reason: `Annulation ${s.ticket_number}`,
        user_id: userId,
        created_at: utcNowSql()
      });
    }
    saveDb(db);
    return true;
  },

  async listHeldCarts() {
    return loadDb().held_carts;
  },
  async saveHeldCart({ label, itemsJson, discountJson }) {
    const db = loadDb();
    const hc = { id: ++db.seq.held_carts, label, items_json: itemsJson, discount_json: discountJson, created_at: utcNowSql() };
    db.held_carts.unshift(hc);
    saveDb(db);
    return hc.id;
  },
  async deleteHeldCart(id) {
    const db = loadDb();
    db.held_carts = db.held_carts.filter((x) => x.id !== id);
    saveDb(db);
    return true;
  },

  async getDashboardStats() {
    const db = loadDb();
    const todayStr = localDateStr(utcNowSql());
    const completedSales = db.sales.filter((s) => s.status === 'completed');
    const todaySales = completedSales.filter((s) => localDateStr(s.created_at) === todayStr);
    const revenue = todaySales.reduce((acc, s) => acc + s.total, 0);
    const tickets_count = todaySales.length;
    const todayIds = new Set(todaySales.map((s) => s.id));
    const estimated_profit = db.sale_items
      .filter((it) => todayIds.has(it.sale_id))
      .reduce((acc, it) => acc + (it.line_total - it.buy_price * it.quantity), 0);

    const validIds = new Set(completedSales.map((s) => s.id));
    const total_sales_revenue = completedSales.reduce((acc, s) => acc + s.total, 0);
    const supplier_invoice_costs = db.supplier_invoices.reduce((acc, inv) => acc + inv.total, 0);
    const net_margin_amount = total_sales_revenue - supplier_invoice_costs;
    const profit_margin_pct =
      total_sales_revenue > 0
        ? Math.round((net_margin_amount / total_sales_revenue) * 1000) / 10
        : 0;

    // Average supplier invoice unit cost per product
    const invoiceCostByProd = {};
    for (const invItem of db.supplier_invoice_items || []) {
      if (!invItem.product_id) continue;
      if (!invoiceCostByProd[invItem.product_id]) {
        invoiceCostByProd[invItem.product_id] = { qty: 0, totalCost: 0 };
      }
      invoiceCostByProd[invItem.product_id].qty += invItem.quantity;
      invoiceCostByProd[invItem.product_id].totalCost += invItem.line_total;
    }

    const topMap = {};
    const profitMap = {};
    for (const it of db.sale_items) {
      if (!validIds.has(it.sale_id)) continue;
      if (!topMap[it.product_id]) {
        topMap[it.product_id] = { product_name: it.product_name, qty_sold: 0, total_sales: 0 };
      }
      topMap[it.product_id].qty_sold += it.quantity;
      topMap[it.product_id].total_sales += it.line_total;

      const invStats = invoiceCostByProd[it.product_id];
      const hasInvoiceCost = Boolean(invStats && invStats.qty > 0);
      const unitCost = hasInvoiceCost
        ? invStats.totalCost / invStats.qty
        : Number(it.buy_price || 0);

      if (!profitMap[it.product_id]) {
        profitMap[it.product_id] = {
          product_id: it.product_id,
          product_name: it.product_name,
          qty_sold: 0,
          sales_revenue: 0,
          total_cost: 0,
          invoiced_cost: hasInvoiceCost ? Math.round(invStats.totalCost) : 0,
          cost_source: hasInvoiceCost ? 'invoice' : 'catalog'
        };
      }
      profitMap[it.product_id].qty_sold += it.quantity;
      profitMap[it.product_id].sales_revenue += it.line_total;
      profitMap[it.product_id].total_cost += Math.round(unitCost * it.quantity);
    }

    const product_profitability = Object.values(profitMap)
      .map((row) => {
        const profit = row.sales_revenue - row.total_cost;
        const margin_pct =
          row.sales_revenue > 0 ? Math.round((profit / row.sales_revenue) * 1000) / 10 : 0;
        return { ...row, profit, margin_pct };
      })
      .sort((a, b) => b.profit - a.profit);

    return {
      tickets_count,
      revenue,
      cash_total: todaySales.filter((s) => s.payment_method === 'cash').reduce((a, s) => a + s.total, 0),
      card_total: todaySales.filter((s) => s.payment_method === 'card').reduce((a, s) => a + s.total, 0),
      credit_total: todaySales.filter((s) => s.payment_method === 'credit').reduce((a, s) => a + s.total, 0),
      avg_basket: tickets_count > 0 ? Math.round(revenue / tickets_count) : 0,
      estimated_profit,
      total_sales_revenue,
      supplier_invoice_costs,
      net_margin_amount,
      profit_margin_pct,
      product_profitability,
      low_stock_count: db.products.filter((p) => p.active === 1 && p.stock <= p.alert_threshold).length,
      top_products: Object.values(topMap).sort((a, b) => b.qty_sold - a.qty_sold).slice(0, 10)
    };
  },

  async getOpenRegister() {
    const db = loadDb();
    const reg = db.cash_registers.find((r) => !r.closed_at);
    if (!reg) return null;
    const cashSales = db.sales
      .filter((s) => s.status === 'completed' && s.payment_method === 'cash' && s.created_at >= reg.opened_at)
      .reduce((a, s) => a + s.total, 0);
    return {
      ...reg,
      opened_by_name: db.users.find((u) => u.id === reg.opened_by)?.name || '',
      cash_sales_since_open: cashSales,
      expected_cash: reg.opening_cash + cashSales
    };
  },
  async openRegister({ openingCash, userId }) {
    const existing = await browserApi.getOpenRegister();
    if (existing) return existing;
    const db = loadDb();
    db.cash_registers.unshift({
      id: ++db.seq.cash_registers,
      opened_by: userId,
      closed_by: null,
      opening_cash: Math.round(openingCash || 0),
      expected_cash: null,
      counted_cash: null,
      difference: null,
      notes: '',
      opened_at: utcNowSql(),
      closed_at: null
    });
    saveDb(db);
    return browserApi.getOpenRegister();
  },
  async closeRegister({ id, countedCash, notes, userId }) {
    const open = await browserApi.getOpenRegister();
    if (!open || open.id !== id) throw new Error('Caisse non ouverte');
    const db = loadDb();
    const reg = db.cash_registers.find((r) => r.id === id);
    reg.closed_by = userId;
    reg.expected_cash = open.expected_cash;
    reg.counted_cash = Math.round(Number(countedCash) || 0);
    reg.difference = reg.counted_cash - open.expected_cash;
    reg.notes = notes || '';
    reg.closed_at = utcNowSql();
    saveDb(db);
    return true;
  },
  async listRegisterHistory() {
    return loadDb().cash_registers.slice(0, 30);
  },

  async getSettings() {
    return loadDb().settings;
  },
  async updateSettings(obj) {
    const db = loadDb();
    db.settings = { ...db.settings, ...obj };
    saveDb(db);
    return db.settings;
  },

  async printReceipt() {
    window.print();
  },
  async backupExport() {
    const blob = new Blob([JSON.stringify(loadDb(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestsupperette-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return 'Téléchargements';
  },
  async backupRestore() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return resolve(false);
        const parsed = JSON.parse(await file.text());
        if (!parsed.products || !parsed.users) return resolve(false);
        saveDb(parsed);
        resolve(true);
      };
      input.click();
    });
  },

  async listSuppliers() {
    const db = loadDb();
    return db.suppliers
      .filter((s) => s.active === 1)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => {
        const invs = db.supplier_invoices.filter((inv) => inv.supplier_id === s.id);
        const total_billed = invs.reduce((acc, inv) => acc + inv.total, 0);
        const total_paid = invs.reduce((acc, inv) => acc + inv.amount_paid, 0);
        return {
          ...s,
          invoices_count: invs.length,
          total_billed,
          total_paid,
          balance_due: Math.max(0, total_billed - total_paid)
        };
      });
  },
  async upsertSupplier(s) {
    const db = loadDb();
    const name = String(s.name || '').trim();
    if (!name) throw new Error('Le nom du fournisseur est requis');
    if (s.id) {
      const idx = db.suppliers.findIndex((x) => x.id === s.id);
      if (idx >= 0) {
        db.suppliers[idx] = {
          ...db.suppliers[idx],
          name,
          contact_name: String(s.contact_name || '').trim(),
          phone: String(s.phone || '').trim(),
          email: String(s.email || '').trim(),
          address: String(s.address || '').trim(),
          nif: String(s.nif || '').trim(),
          notes: String(s.notes || '').trim()
        };
        saveDb(db);
        return db.suppliers[idx];
      }
    }
    const created = {
      id: ++db.seq.suppliers,
      name,
      contact_name: String(s.contact_name || '').trim(),
      phone: String(s.phone || '').trim(),
      email: String(s.email || '').trim(),
      address: String(s.address || '').trim(),
      nif: String(s.nif || '').trim(),
      notes: String(s.notes || '').trim(),
      active: 1,
      created_at: utcNowSql()
    };
    db.suppliers.push(created);
    saveDb(db);
    return created;
  },
  async importSuppliersCsv(rows = []) {
    const db = loadDb();
    let createdCount = 0;
    let updatedCount = 0;

    for (const r of rows) {
      if (!r.valid) continue;
      const name = String(r.name || '').trim();
      if (!name) continue;

      const existing = db.suppliers.find(
        (s) => s.active === 1 && s.name.trim().toLowerCase() === name.toLowerCase()
      );

      if (existing) {
        if (r.contact_name) existing.contact_name = r.contact_name;
        if (r.phone) existing.phone = r.phone;
        if (r.email) existing.email = r.email;
        if (r.address) existing.address = r.address;
        if (r.nif) existing.nif = r.nif;
        if (r.notes) existing.notes = r.notes;
        updatedCount++;
      } else {
        db.suppliers.push({
          id: ++db.seq.suppliers,
          name,
          contact_name: String(r.contact_name || '').trim(),
          phone: String(r.phone || '').trim(),
          email: String(r.email || '').trim(),
          address: String(r.address || '').trim(),
          nif: String(r.nif || '').trim(),
          notes: String(r.notes || '').trim(),
          active: 1,
          created_at: utcNowSql()
        });
        createdCount++;
      }
    }

    saveDb(db);
    return { createdCount, updatedCount };
  },
  async deleteSupplier(id) {
    const db = loadDb();
    const s = db.suppliers.find((x) => x.id === id);
    if (s) s.active = 0;
    saveDb(db);
    return true;
  },

  async listSupplierInvoices({ search = '', supplierId = null, status = 'all' } = {}) {
    const db = loadDb();
    const q = String(search || '').trim().toLowerCase();
    return db.supplier_invoices
      .filter((inv) => {
        if (supplierId && inv.supplier_id !== Number(supplierId)) return false;
        if (status !== 'all' && inv.status !== status) return false;
        const sup = db.suppliers.find((s) => s.id === inv.supplier_id);
        const hay = `${inv.invoice_number} ${sup?.name || ''} ${inv.notes || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .map((inv) => {
        const sup = db.suppliers.find((s) => s.id === inv.supplier_id);
        const itemsCount = db.supplier_invoice_items.filter((it) => it.invoice_id === inv.id).length;
        return {
          ...inv,
          supplier_name: sup?.name || 'Fournisseur supprimé',
          supplier_phone: sup?.phone || '',
          items_count: itemsCount,
          balance_due: Math.max(0, inv.total - inv.amount_paid)
        };
      });
  },
  async getSupplierInvoiceDetails(invoiceId) {
    const db = loadDb();
    const inv = db.supplier_invoices.find((x) => x.id === invoiceId);
    if (!inv) return null;
    const supplier = db.suppliers.find((s) => s.id === inv.supplier_id) || null;
    const items = db.supplier_invoice_items.filter((it) => it.invoice_id === invoiceId);
    const payments = db.supplier_payments.filter((p) => p.invoice_id === invoiceId);
    return {
      ...inv,
      supplier,
      supplier_name: supplier?.name || '',
      balance_due: Math.max(0, inv.total - inv.amount_paid),
      items,
      payments
    };
  },
  async getNextSupplierInvoiceNumber(supplierId = null) {
    const db = loadDb();
    const allInvs = db.supplier_invoices || [];
    const existingSet = new Set(allInvs.map((inv) => String(inv.invoice_number || '').trim().toLowerCase()));

    const incrementInvoiceCode = (baseCode) => {
      const clean = String(baseCode || '').trim();
      const year = new Date().getFullYear();
      if (!clean) {
        let n = 1;
        let candidate = `FF-${year}-${String(n).padStart(4, '0')}`;
        while (existingSet.has(candidate.toLowerCase())) {
          n++;
          candidate = `FF-${year}-${String(n).padStart(4, '0')}`;
        }
        return candidate;
      }

      const match = clean.match(/^([\s\S]*?)(\d+)(\D*)$/);
      if (match) {
        const [, prefix, digits, suffix] = match;
        let num = Number(digits) + 1;
        const width = digits.length;
        let candidate = `${prefix}${String(num).padStart(width, '0')}${suffix}`;
        while (existingSet.has(candidate.toLowerCase())) {
          num++;
          candidate = `${prefix}${String(num).padStart(width, '0')}${suffix}`;
        }
        return candidate;
      }

      let seq = 2;
      let candidate = `${clean}-${seq}`;
      while (existingSet.has(candidate.toLowerCase())) {
        seq++;
        candidate = `${clean}-${seq}`;
      }
      return candidate;
    };

    const getLatestById = (list) =>
      list.length === 0 ? null : list.reduce((latest, cur) => (cur.id > latest.id ? cur : latest), list[0]);

    const lastGlobal = getLatestById(allInvs);
    const suggestedNumber = incrementInvoiceCode(lastGlobal?.invoice_number || '');

    let supplierLastInvoiceNumber = null;
    let supplierSuggestedNumber = null;
    if (supplierId) {
      const supInvs = allInvs.filter((inv) => inv.supplier_id === Number(supplierId));
      const lastSup = getLatestById(supInvs);
      if (lastSup?.invoice_number) {
        supplierLastInvoiceNumber = lastSup.invoice_number;
        supplierSuggestedNumber = incrementInvoiceCode(lastSup.invoice_number);
      }
    }

    return {
      suggestedNumber,
      lastInvoiceNumber: lastGlobal?.invoice_number || null,
      supplierSuggestedNumber,
      supplierLastInvoiceNumber
    };
  },
  async createSupplierInvoice(payload) {
    const db = loadDb();
    const supplierId = Number(payload.supplierId);
    const supplier = db.suppliers.find((s) => s.id === supplierId && s.active === 1);
    if (!supplier) throw new Error('Fournisseur invalide');
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('Ajoutez au moins un article à la facture');
    }

    const { suggestedNumber } = await browserApi.getNextSupplierInvoiceNumber();
    const invoice_number = String(payload.invoiceNumber || '').trim() || suggestedNumber;

    const normalizedItems = payload.items.map((it) => {
      const quantity = Math.max(1, Math.round(Number(it.quantity) || 0));
      const unit_cost = Math.max(0, Math.round(Number(it.unit_cost) || 0));
      return {
        product_id: it.product_id ? Number(it.product_id) : null,
        barcode: it.barcode || null,
        product_name: String(it.product_name || '').trim(),
        quantity,
        unit_cost,
        line_total: quantity * unit_cost
      };
    });

    const subtotal = normalizedItems.reduce((acc, it) => acc + it.line_total, 0);
    const discount_amount = Math.max(0, Math.min(subtotal, Math.round(Number(payload.discountAmount) || 0)));
    const total = Math.max(0, subtotal - discount_amount);
    const amount_paid = Math.max(0, Math.min(total, Math.round(Number(payload.amountPaid) || 0)));
    const status = amount_paid >= total ? 'paid' : amount_paid > 0 ? 'partial' : 'unpaid';

    const inv = {
      id: ++db.seq.supplier_invoices,
      invoice_number,
      supplier_id: supplierId,
      invoice_date: payload.invoiceDate || new Date().toISOString().slice(0, 10),
      due_date: payload.dueDate || payload.invoiceDate || new Date().toISOString().slice(0, 10),
      subtotal,
      discount_amount,
      total,
      amount_paid,
      status,
      payment_method: payload.paymentMethod || (amount_paid > 0 ? 'cash' : 'credit'),
      stock_updated: payload.updateStock ? 1 : 0,
      notes: String(payload.notes || '').trim(),
      user_id: payload.userId || null,
      created_at: utcNowSql()
    };
    db.supplier_invoices.unshift(inv);

    for (const item of normalizedItems) {
      db.supplier_invoice_items.push({
        id: ++db.seq.supplier_invoice_items,
        invoice_id: inv.id,
        ...item
      });
      if (item.product_id) {
        const prod = db.products.find((p) => p.id === item.product_id && p.active === 1);
        if (prod) {
          if (payload.updateStock) {
            prod.stock += item.quantity;
            db.stock_movements.unshift({
              id: ++db.seq.stock_movements,
              product_id: prod.id,
              delta: item.quantity,
              reason: `Facture fournisseur ${invoice_number}`,
              user_id: payload.userId || null,
              created_at: utcNowSql()
            });
          }
          if (payload.updateBuyPrice && item.unit_cost > 0) {
            prod.buy_price = item.unit_cost;
          }
        }
      }
    }

    if (amount_paid > 0) {
      db.supplier_payments.unshift({
        id: ++db.seq.supplier_payments,
        invoice_id: inv.id,
        amount: amount_paid,
        payment_method: inv.payment_method,
        notes: 'Paiement initial',
        user_id: payload.userId || null,
        created_at: utcNowSql()
      });
    }

    saveDb(db);
    return browserApi.getSupplierInvoiceDetails(inv.id);
  },
  async recordSupplierPayment({ invoiceId, amount, paymentMethod = 'cash', notes = '', userId = null }) {
    const db = loadDb();
    const inv = db.supplier_invoices.find((x) => x.id === invoiceId);
    if (!inv) throw new Error('Facture introuvable');
    const remaining = Math.max(0, inv.total - inv.amount_paid);
    const payAmt = Math.max(0, Math.min(remaining, Math.round(Number(amount) || 0)));
    if (payAmt <= 0) throw new Error('Montant invalide');

    inv.amount_paid += payAmt;
    inv.status = inv.amount_paid >= inv.total ? 'paid' : 'partial';
    db.supplier_payments.unshift({
      id: ++db.seq.supplier_payments,
      invoice_id: inv.id,
      amount: payAmt,
      payment_method: paymentMethod,
      notes: String(notes || '').trim(),
      user_id: userId,
      created_at: utcNowSql()
    });
    saveDb(db);
    return browserApi.getSupplierInvoiceDetails(inv.id);
  },
  async linkInvoiceItemToProduct({ itemId, productId }) {
    const db = loadDb();
    const item = db.supplier_invoice_items.find((it) => it.id === Number(itemId));
    if (!item) throw new Error('Ligne de facture introuvable');
    const prod = productId ? db.products.find((p) => p.id === Number(productId) && p.active === 1) : null;
    item.product_id = prod ? prod.id : null;
    if (prod && !item.barcode) item.barcode = prod.barcode || null;
    saveDb(db);
    return browserApi.getSupplierInvoiceDetails(item.invoice_id);
  },
  async applySupplierInvoiceStock({ invoiceId, updateBuyPrice = true, userId = null }) {
    const db = loadDb();
    const inv = db.supplier_invoices.find((x) => x.id === Number(invoiceId));
    if (!inv) throw new Error('Facture introuvable');
    if (inv.stock_updated === 1) throw new Error('Le stock a déjà été mis à jour pour cette facture.');

    const items = db.supplier_invoice_items.filter((it) => it.invoice_id === inv.id);
    let updatedProducts = 0;

    for (const item of items) {
      if (!item.product_id) continue;
      const prod = db.products.find((p) => p.id === item.product_id && p.active === 1);
      if (!prod) continue;
      prod.stock += item.quantity;
      db.stock_movements.unshift({
        id: ++db.seq.stock_movements,
        product_id: prod.id,
        delta: item.quantity,
        reason: `Facture fournisseur ${inv.invoice_number}`,
        user_id: userId,
        created_at: utcNowSql()
      });
      if (updateBuyPrice && item.unit_cost > 0) {
        prod.buy_price = item.unit_cost;
      }
      updatedProducts++;
    }

    inv.stock_updated = 1;
    saveDb(db);
    return {
      invoice: await browserApi.getSupplierInvoiceDetails(inv.id),
      updatedProducts
    };
  },
  async deleteSupplierInvoice(invoiceId) {
    const db = loadDb();
    db.supplier_invoices = db.supplier_invoices.filter((x) => x.id !== invoiceId);
    db.supplier_invoice_items = db.supplier_invoice_items.filter((x) => x.invoice_id !== invoiceId);
    db.supplier_payments = db.supplier_payments.filter((x) => x.invoice_id !== invoiceId);
    saveDb(db);
    return true;
  }
};

export const posApi = typeof window !== 'undefined' && window.posApi ? window.posApi : browserApi;