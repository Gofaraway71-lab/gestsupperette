// src/api.js
// Pont universel : utilise Electron (SQLite) si disponible, sinon le stockage local navigateur (pour Google AI Studio)

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

  return {
    seq: { products: 22, sales: 0, sale_items: 0, stock_movements: 0, held_carts: 0, cash_registers: 0 },
    users: [
      { id: 1, name: 'Caissier 1', role: 'cashier', pin: '1234', active: 1 },
      { id: 2, name: 'Gérant', role: 'manager', pin: '0000', active: 1 }
    ],
    products: demoProducts.map((p, idx) => ({
      id: idx + 1,
      barcode: p[0], name: p[1], name_ar: p[2], category: p[3],
      buy_price: p[4], sell_price: p[5], stock: p[6], alert_threshold: p[7],
      active: 1, created_at: utcNowSql()
    })),
    sales: [],
    sale_items: [],
    stock_movements: [],
    held_carts: [],
    cash_registers: [],
    settings: {
      store_name: 'gestsupperette',
      store_address: 'Rue Didouche Mourad, Alger',
      store_phone: '0550 12 34 56',
      receipt_footer: 'Merci pour votre visite !'
    }
  };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
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
          alert_threshold: Math.round(Number(p.alert_threshold) || 5)
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
      if (prod) prod.stock -= item.quantity;
      db.stock_movements.unshift({
        id: ++db.seq.stock_movements,
        product_id: item.product_id,
        delta: -item.quantity,
        reason: `Vente ${ticket_number}`,
        user_id: payload.userId,
        created_at: utcNowSql()
      });
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
    const todaySales = db.sales.filter((s) => s.status === 'completed' && localDateStr(s.created_at) === todayStr);
    const revenue = todaySales.reduce((acc, s) => acc + s.total, 0);
    const tickets_count = todaySales.length;
    const todayIds = new Set(todaySales.map((s) => s.id));
    const estimated_profit = db.sale_items
      .filter((it) => todayIds.has(it.sale_id))
      .reduce((acc, it) => acc + (it.line_total - it.buy_price * it.quantity), 0);

    const validIds = new Set(db.sales.filter((s) => s.status === 'completed').map((s) => s.id));
    const topMap = {};
    for (const it of db.sale_items) {
      if (!validIds.has(it.sale_id)) continue;
      if (!topMap[it.product_id]) topMap[it.product_id] = { product_name: it.product_name, qty_sold: 0, total_sales: 0 };
      topMap[it.product_id].qty_sold += it.quantity;
      topMap[it.product_id].total_sales += it.line_total;
    }

    return {
      tickets_count,
      revenue,
      cash_total: todaySales.filter((s) => s.payment_method === 'cash').reduce((a, s) => a + s.total, 0),
      card_total: todaySales.filter((s) => s.payment_method === 'card').reduce((a, s) => a + s.total, 0),
      credit_total: todaySales.filter((s) => s.payment_method === 'credit').reduce((a, s) => a + s.total, 0),
      avg_basket: tickets_count > 0 ? Math.round(revenue / tickets_count) : 0,
      estimated_profit,
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
  }
};

export const posApi = typeof window !== 'undefined' && window.posApi ? window.posApi : browserApi;
