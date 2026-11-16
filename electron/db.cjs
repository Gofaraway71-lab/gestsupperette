const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

let db = null;
let dbFilePath = '';

function runTransaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function initDatabase(userDataPath) {
  fs.mkdirSync(userDataPath, { recursive: true });
  dbFilePath = path.join(userDataPath, 'gestsupperette.db');
  db = new DatabaseSync(dbFilePath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('cashier', 'manager')),
      pin TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      name_ar TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Général',
      buy_price INTEGER NOT NULL DEFAULT 0,
      sell_price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      alert_threshold INTEGER NOT NULL DEFAULT 5,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      subtotal INTEGER NOT NULL,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'card', 'credit')),
      amount_received INTEGER NOT NULL DEFAULT 0,
      change_given INTEGER NOT NULL DEFAULT 0,
      customer_name TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'cancelled')),
      cancel_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      buy_price INTEGER NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      line_total INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS held_carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      items_json TEXT NOT NULL,
      discount_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cash_registers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opened_by INTEGER NOT NULL REFERENCES users(id),
      closed_by INTEGER REFERENCES users(id),
      opening_cash INTEGER NOT NULL DEFAULT 0,
      expected_cash INTEGER,
      counted_cash INTEGER,
      difference INTEGER,
      notes TEXT DEFAULT '',
      opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  seedInitialData();
  return dbFilePath;
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const insertUser = db.prepare('INSERT INTO users (name, role, pin) VALUES (?, ?, ?)');
    insertUser.run('Caissier 1', 'cashier', '1234');
    insertUser.run('Gérant', 'manager', '0000');
  }

  const settingsCount = db.prepare('SELECT COUNT(*) AS c FROM settings').get().c;
  if (settingsCount === 0) {
    const setStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    setStmt.run('store_name', 'gestsupperette');
    setStmt.run('store_address', 'Rue Didouche Mourad, Alger');
    setStmt.run('store_phone', '0550 12 34 56');
    setStmt.run('receipt_footer', 'Merci pour votre visite !');
  }

  const prodCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (prodCount === 0) {
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
    const insertProd = db.prepare(`
      INSERT INTO products (barcode, name, name_ar, category, buy_price, sell_price, stock, alert_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    runTransaction(() => {
      for (const p of demoProducts) insertProd.run(...p);
    });
  }
}

function getBackupDir(userDataPath) {
  const dir = path.join(userDataPath, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createBackupFile(targetPath) {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  fs.copyFileSync(dbFilePath, targetPath);
}

function restoreBackupFile(sourcePath) {
  db.close();
  fs.copyFileSync(sourcePath, dbFilePath);
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(dbFilePath + suffix)) fs.unlinkSync(dbFilePath + suffix);
  }
  db = new DatabaseSync(dbFilePath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
}

const api = {
  login(pin) {
    return db.prepare('SELECT id, name, role FROM users WHERE pin = ? AND active = 1').get(String(pin)) || null;
  },
  listUsers() {
    return db.prepare('SELECT id, name, role, active FROM users ORDER BY role DESC, id ASC').all();
  },
  updateUserPin(userId, newPin) {
    db.prepare('UPDATE users SET pin = ? WHERE id = ?').run(String(newPin), userId);
    return true;
  },

  listProducts() {
    return db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name ASC').all();
  },
  findByBarcode(barcode) {
    const clean = String(barcode || '').trim();
    if (!clean) return null;
    return db.prepare('SELECT * FROM products WHERE barcode = ? AND active = 1').get(clean) || null;
  },
  searchProducts(query) {
    const q = `%${String(query || '').trim()}%`;
    return db.prepare(`
      SELECT * FROM products
      WHERE active = 1 AND (name LIKE ? OR name_ar LIKE ? OR barcode LIKE ? OR category LIKE ?)
      ORDER BY name ASC LIMIT 60
    `).all(q, q, q, q);
  },
  upsertProduct(p) {
    const barcode = p.barcode && String(p.barcode).trim() !== '' ? String(p.barcode).trim() : null;
    if (p.id) {
      db.prepare(`
        UPDATE products
        SET barcode = ?, name = ?, name_ar = ?, category = ?,
            buy_price = ?, sell_price = ?, stock = ?, alert_threshold = ?
        WHERE id = ?
      `).run(
        barcode, p.name.trim(), (p.name_ar || '').trim(), (p.category || 'Général').trim(),
        Math.round(Number(p.buy_price) || 0), Math.round(Number(p.sell_price) || 0),
        Math.round(Number(p.stock) || 0), Math.round(Number(p.alert_threshold) || 5), p.id
      );
      return db.prepare('SELECT * FROM products WHERE id = ?').get(p.id);
    }
    const info = db.prepare(`
      INSERT INTO products (barcode, name, name_ar, category, buy_price, sell_price, stock, alert_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      barcode, p.name.trim(), (p.name_ar || '').trim(), (p.category || 'Général').trim(),
      Math.round(Number(p.buy_price) || 0), Math.round(Number(p.sell_price) || 0),
      Math.round(Number(p.stock) || 0), Math.round(Number(p.alert_threshold) || 5)
    );
    return db.prepare('SELECT * FROM products WHERE id = ?').get(Number(info.lastInsertRowid));
  },
  deleteProduct(id) {
    db.prepare('UPDATE products SET active = 0, barcode = NULL WHERE id = ?').run(id);
    return true;
  },
  importProductsCsv(rows) {
    let imported = 0;
    const findBc = db.prepare('SELECT id FROM products WHERE barcode = ? AND active = 1');
    const insertStmt = db.prepare(`
      INSERT INTO products (barcode, name, name_ar, category, buy_price, sell_price, stock, alert_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStmt = db.prepare(`
      UPDATE products SET name = ?, name_ar = ?, category = ?, buy_price = ?, sell_price = ?, stock = ?, alert_threshold = ?
      WHERE id = ?
    `);
    runTransaction(() => {
      for (const r of rows) {
        if (!r.name || !r.sell_price) continue;
        const bc = r.barcode ? String(r.barcode).trim() : null;
        const existing = bc ? findBc.get(bc) : null;
        if (existing) {
          updateStmt.run(
            r.name.trim(), r.name_ar || '', r.category || 'Général',
            Math.round(Number(r.buy_price) || 0), Math.round(Number(r.sell_price) || 0),
            Math.round(Number(r.stock) || 0), Math.round(Number(r.alert_threshold) || 5), existing.id
          );
        } else {
          insertStmt.run(
            bc, r.name.trim(), r.name_ar || '', r.category || 'Général',
            Math.round(Number(r.buy_price) || 0), Math.round(Number(r.sell_price) || 0),
            Math.round(Number(r.stock) || 0), Math.round(Number(r.alert_threshold) || 5)
          );
        }
        imported++;
      }
    });
    return imported;
  },

  adjustStock({ productId, delta, reason, userId }) {
    return runTransaction(() => {
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(Math.round(delta), productId);
      db.prepare('INSERT INTO stock_movements (product_id, delta, reason, user_id) VALUES (?, ?, ?, ?)')
        .run(productId, Math.round(delta), reason || 'Ajustement manuel', userId || null);
      return db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    });
  },
  listStockMovements(limit = 100) {
    return db.prepare(`
      SELECT m.*, p.name AS product_name, u.name AS user_name
      FROM stock_movements m
      JOIN products p ON p.id = m.product_id
      LEFT JOIN users u ON u.id = m.user_id
      ORDER BY m.id DESC LIMIT ?
    `).all(limit);
  },

  createSale(payload) {
    return runTransaction(() => {
      const now = new Date();
      const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const countToday = db.prepare("SELECT COUNT(*) AS c FROM sales WHERE date(created_at, 'localtime') = date('now', 'localtime')").get().c;
      const ticketNumber = `TK-${prefix}-${String(countToday + 1).padStart(4, '0')}`;

      const info = db.prepare(`
        INSERT INTO sales (ticket_number, user_id, subtotal, discount_amount, total, payment_method, amount_received, change_given, customer_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ticketNumber, payload.userId, payload.subtotal, payload.discountAmount,
        payload.total, payload.paymentMethod, payload.amountReceived,
        payload.changeGiven, payload.customerName || ''
      );
      const saleId = Number(info.lastInsertRowid);

      const insertItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, buy_price, quantity, discount_amount, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
      const addMvt = db.prepare('INSERT INTO stock_movements (product_id, delta, reason, user_id) VALUES (?, ?, ?, ?)');
      const getProd = db.prepare('SELECT buy_price FROM products WHERE id = ?');

      for (const item of payload.items) {
        const prod = getProd.get(item.product_id);
        insertItem.run(
          saleId, item.product_id, item.name, item.unit_price,
          prod ? prod.buy_price : 0, item.quantity, item.discount_amount || 0, item.line_total
        );
        decStock.run(item.quantity, item.product_id);
        addMvt.run(item.product_id, -item.quantity, `Vente ${ticketNumber}`, payload.userId);
      }
      return api.getSaleDetails(saleId);
    });
  },

  listSales({ search = '' } = {}) {
    const q = `%${search.trim()}%`;
    return db.prepare(`
      SELECT s.*, u.name AS cashier_name
      FROM sales s
      JOIN users u ON u.id = s.user_id
      WHERE s.ticket_number LIKE ? OR s.customer_name LIKE ?
      ORDER BY s.id DESC LIMIT 200
    `).all(q, q);
  },

  getSaleDetails(saleId) {
    const sale = db.prepare(`
      SELECT s.*, u.name AS cashier_name
      FROM sales s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `).get(saleId);
    if (!sale) return null;
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
    return { ...sale, items };
  },

  cancelSale({ saleId, reason, userId }) {
    return runTransaction(() => {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
      if (!sale || sale.status === 'cancelled') throw new Error('Ticket introuvable ou déjà annulé');

      db.prepare("UPDATE sales SET status = 'cancelled', cancel_reason = ? WHERE id = ?").run(reason || 'Annulation gérant', saleId);
      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
      const incStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
      const addMvt = db.prepare('INSERT INTO stock_movements (product_id, delta, reason, user_id) VALUES (?, ?, ?, ?)');
      for (const it of items) {
        incStock.run(it.quantity, it.product_id);
        addMvt.run(it.product_id, it.quantity, `Annulation ${sale.ticket_number}`, userId);
      }
      return true;
    });
  },

  listHeldCarts() {
    return db.prepare('SELECT * FROM held_carts ORDER BY id DESC').all();
  },
  saveHeldCart({ label, itemsJson, discountJson }) {
    const info = db.prepare('INSERT INTO held_carts (label, items_json, discount_json) VALUES (?, ?, ?)')
      .run(label, itemsJson, discountJson);
    return Number(info.lastInsertRowid);
  },
  deleteHeldCart(id) {
    db.prepare('DELETE FROM held_carts WHERE id = ?').run(id);
    return true;
  },

  getDashboardStats() {
    const today = db.prepare(`
      SELECT
        COUNT(*) AS tickets_count,
        COALESCE(SUM(total), 0) AS revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) AS card_total,
        COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN total ELSE 0 END), 0) AS credit_total
      FROM sales
      WHERE status = 'completed' AND date(created_at, 'localtime') = date('now', 'localtime')
    `).get();

    const profitRow = db.prepare(`
      SELECT COALESCE(SUM(si.line_total - (si.buy_price * si.quantity)), 0) AS profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed' AND date(s.created_at, 'localtime') = date('now', 'localtime')
    `).get();

    const topProducts = db.prepare(`
      SELECT si.product_name, SUM(si.quantity) AS qty_sold, SUM(si.line_total) AS total_sales
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed' AND date(s.created_at, 'localtime') >= date('now', 'localtime', '-30 days')
      GROUP BY si.product_id
      ORDER BY qty_sold DESC LIMIT 10
    `).all();

    const lowStockCount = db.prepare('SELECT COUNT(*) AS c FROM products WHERE active = 1 AND stock <= alert_threshold').get().c;

    return {
      ...today,
      avg_basket: today.tickets_count > 0 ? Math.round(today.revenue / today.tickets_count) : 0,
      estimated_profit: profitRow.profit,
      low_stock_count: lowStockCount,
      top_products: topProducts
    };
  },

  getOpenRegister() {
    const reg = db.prepare(`
      SELECT r.*, u.name AS opened_by_name
      FROM cash_registers r JOIN users u ON u.id = r.opened_by
      WHERE r.closed_at IS NULL ORDER BY r.id DESC LIMIT 1
    `).get();
    if (!reg) return null;
    const cashSales = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS total_cash
      FROM sales
      WHERE status = 'completed' AND payment_method = 'cash' AND created_at >= ?
    `).get(reg.opened_at).total_cash;
    return { ...reg, cash_sales_since_open: cashSales, expected_cash: reg.opening_cash + cashSales };
  },
  openRegister({ openingCash, userId }) {
    const existing = api.getOpenRegister();
    if (existing) return existing;
    db.prepare('INSERT INTO cash_registers (opened_by, opening_cash) VALUES (?, ?)').run(userId, Math.round(openingCash || 0));
    return api.getOpenRegister();
  },
  closeRegister({ id, countedCash, notes, userId }) {
    const reg = api.getOpenRegister();
    if (!reg || reg.id !== id) throw new Error('Caisse non ouverte');
    const expected = reg.expected_cash;
    const counted = Math.round(Number(countedCash) || 0);
    const diff = counted - expected;
    db.prepare(`
      UPDATE cash_registers
      SET closed_by = ?, expected_cash = ?, counted_cash = ?, difference = ?, notes = ?, closed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userId, expected, counted, diff, notes || '', id);
    return true;
  },
  listRegisterHistory() {
    return db.prepare(`
      SELECT r.*, u1.name AS opened_by_name, u2.name AS closed_by_name
      FROM cash_registers r
      JOIN users u1 ON u1.id = r.opened_by
      LEFT JOIN users u2 ON u2.id = r.closed_by
      ORDER BY r.id DESC LIMIT 30
    `).all();
  },

  getSettings() {
    const rows = db.prepare('SELECT * FROM settings').all();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
  updateSettings(obj) {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    runTransaction(() => {
      for (const [k, v] of Object.entries(obj)) stmt.run(k, String(v ?? ''));
    });
    return api.getSettings();
  }
};

module.exports = { initDatabase, getBackupDir, createBackupFile, restoreBackupFile, api };