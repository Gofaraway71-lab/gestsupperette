
$ErrorActionPreference = "Stop"

# Le projet sera créé dans un sous-dossier "gestsupperette",
# à côté de ce script (même si PowerShell est lancé depuis un autre dossier).
$scriptDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptDir)) {
    $scriptDir = (Get-Location).Path
}

$repoDir = Join-Path $scriptDir "gestsupperette"
New-Item -ItemType Directory -Force -Path $repoDir | Out-Null
Set-Location -LiteralPath $repoDir

function Write-RepoFile($relPath, $content) {
    $fullPath = Join-Path $repoDir $relPath
    $parent = Split-Path -Path $fullPath -Parent

    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    # UTF-8 sans BOM pour les fichiers JavaScript, JSON, HTML et CSS.
    [System.IO.File]::WriteAllText(
        $fullPath,
        $content,
        ([System.Text.UTF8Encoding]::new($false))
    )
}

function Write-RepoFile($relPath, $content) {
  $fullPath = Join-Path $repoDir $relPath
  $parent = Split-Path $fullPath -Parent
  if (!(Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  [System.IO.File]::WriteAllText($fullPath, $content, [System.Text.UTF8Encoding]::new($false))
}

Write-RepoFile ".gitignore" @'
node_modules/
dist/
release/
*.db
*.db-wal
*.db-shm
.DS_Store
'@

Write-RepoFile "package.json" @'
{
  "name": "gestsupperette",
  "version": "1.0.0",
  "description": "gestsupperette - Application POS pour supérette hors ligne",
  "main": "electron/main.cjs",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "electron:dev": "concurrently -k \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "dist:win": "npm run build && electron-builder --win",
    "dist:linux": "npm run build && electron-builder --linux"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.4.1",
    "vite": "^6.3.5"
  },
  "optionalDependencies": {
    "concurrently": "^9.1.2",
    "electron": "^39.2.0",
    "electron-builder": "^26.0.12",
    "wait-on": "^8.0.3"
  },
  "build": {
    "appId": "com.gestsupperette.pos",
    "productName": "gestsupperette",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ]
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "gestsupperette"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Office"
    }
  }
}
'@

Write-RepoFile "vite.config.js" @'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true
  }
});
'@

Write-RepoFile "index.html" @'
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>gestsupperette</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
'@

Write-RepoFile "electron/db.cjs" @'
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
'@

Write-RepoFile "electron/main.cjs" @'
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { initDatabase, getBackupDir, createBackupFile, restoreBackupFile, api } = require('./db.cjs');

let mainWindow = null;

function runAutoBackup() {
  try {
    const backupDir = getBackupDir(app.getPath('userData'));
    const stamp = new Date().toISOString().slice(0, 10);
    const file = path.join(backupDir, `backup-auto-${stamp}.db`);
    createBackupFile(file);

    const files = fs.readdirSync(backupDir)
      .filter((f) => f.startsWith('backup-auto-'))
      .sort()
      .reverse();
    for (const old of files.slice(14)) {
      fs.unlinkSync(path.join(backupDir, old));
    }
  } catch (err) {
    console.error('Auto-backup error:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: 'gestsupperette',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function registerIpcHandlers() {
  ipcMain.handle('auth:login', (_, pin) => api.login(pin));
  ipcMain.handle('auth:listUsers', () => api.listUsers());
  ipcMain.handle('auth:updatePin', (_, { userId, newPin }) => api.updateUserPin(userId, newPin));

  ipcMain.handle('products:list', () => api.listProducts());
  ipcMain.handle('products:findByBarcode', (_, bc) => api.findByBarcode(bc));
  ipcMain.handle('products:search', (_, q) => api.searchProducts(q));
  ipcMain.handle('products:upsert', (_, prod) => api.upsertProduct(prod));
  ipcMain.handle('products:delete', (_, id) => api.deleteProduct(id));
  ipcMain.handle('products:importCsv', (_, rows) => api.importProductsCsv(rows));

  ipcMain.handle('stock:adjust', (_, payload) => api.adjustStock(payload));
  ipcMain.handle('stock:movements', (_, limit) => api.listStockMovements(limit));

  ipcMain.handle('sales:create', (_, payload) => api.createSale(payload));
  ipcMain.handle('sales:list', (_, filter) => api.listSales(filter));
  ipcMain.handle('sales:details', (_, id) => api.getSaleDetails(id));
  ipcMain.handle('sales:cancel', (_, payload) => api.cancelSale(payload));

  ipcMain.handle('held:list', () => api.listHeldCarts());
  ipcMain.handle('held:save', (_, payload) => api.saveHeldCart(payload));
  ipcMain.handle('held:delete', (_, id) => api.deleteHeldCart(id));

  ipcMain.handle('reports:dashboard', () => api.getDashboardStats());
  ipcMain.handle('cash:getOpen', () => api.getOpenRegister());
  ipcMain.handle('cash:open', (_, payload) => api.openRegister(payload));
  ipcMain.handle('cash:close', (_, payload) => api.closeRegister(payload));
  ipcMain.handle('cash:history', () => api.listRegisterHistory());

  ipcMain.handle('settings:get', () => api.getSettings());
  ipcMain.handle('settings:update', (_, obj) => api.updateSettings(obj));

  ipcMain.handle('system:print', () => {
    if (mainWindow) {
      mainWindow.webContents.print({ silent: false, printBackground: true });
    }
  });

  ipcMain.handle('system:backupExport', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter une sauvegarde SQLite',
      defaultPath: `gestsupperette-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'Base SQLite', extensions: ['db'] }]
    });
    if (canceled || !filePath) return null;
    createBackupFile(filePath);
    return filePath;
  });

  ipcMain.handle('system:backupRestore', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Restaurer une sauvegarde SQLite',
      filters: [{ name: 'Base SQLite', extensions: ['db'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths.length) return false;
    restoreBackupFile(filePaths[0]);
    return true;
  });
}

app.whenReady().then(() => {
  initDatabase(app.getPath('userData'));
  runAutoBackup();
  registerIpcHandlers();
  createWindow();
});

app.on('before-quit', () => {
  runAutoBackup();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
'@

Write-RepoFile "electron/preload.cjs" @'
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posApi', {
  login: (pin) => ipcRenderer.invoke('auth:login', pin),
  listUsers: () => ipcRenderer.invoke('auth:listUsers'),
  updatePin: (userId, newPin) => ipcRenderer.invoke('auth:updatePin', { userId, newPin }),

  listProducts: () => ipcRenderer.invoke('products:list'),
  findByBarcode: (bc) => ipcRenderer.invoke('products:findByBarcode', bc),
  searchProducts: (q) => ipcRenderer.invoke('products:search', q),
  upsertProduct: (p) => ipcRenderer.invoke('products:upsert', p),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),
  importCsv: (rows) => ipcRenderer.invoke('products:importCsv', rows),

  adjustStock: (payload) => ipcRenderer.invoke('stock:adjust', payload),
  listStockMovements: (limit) => ipcRenderer.invoke('stock:movements', limit),

  createSale: (payload) => ipcRenderer.invoke('sales:create', payload),
  listSales: (filter) => ipcRenderer.invoke('sales:list', filter),
  getSaleDetails: (id) => ipcRenderer.invoke('sales:details', id),
  cancelSale: (payload) => ipcRenderer.invoke('sales:cancel', payload),

  listHeldCarts: () => ipcRenderer.invoke('held:list'),
  saveHeldCart: (payload) => ipcRenderer.invoke('held:save', payload),
  deleteHeldCart: (id) => ipcRenderer.invoke('held:delete', id),

  getDashboardStats: () => ipcRenderer.invoke('reports:dashboard'),
  getOpenRegister: () => ipcRenderer.invoke('cash:getOpen'),
  openRegister: (payload) => ipcRenderer.invoke('cash:open', payload),
  closeRegister: (payload) => ipcRenderer.invoke('cash:close', payload),
  listRegisterHistory: () => ipcRenderer.invoke('cash:history'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (obj) => ipcRenderer.invoke('settings:update', obj),

  printReceipt: () => ipcRenderer.invoke('system:print'),
  backupExport: () => ipcRenderer.invoke('system:backupExport'),
  backupRestore: () => ipcRenderer.invoke('system:backupRestore')
});
'@

Write-RepoFile "src/main.jsx" @'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
'@

Write-RepoFile "src/styles.css" @'
:root {
  --bg: #f1f5f9;
  --surface: #ffffff;
  --surface-alt: #f8fafc;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --accent: #0f766e;
  --accent-hover: #0d9488;
  --danger: #dc2626;
  --ok: #16a34a;
  --warn: #d97706;
  --radius: 10px;
}

[data-theme="dark"] {
  --bg: #0b1120;
  --surface: #1e293b;
  --surface-alt: #0f172a;
  --text: #f8fafc;
  --muted: #94a3b8;
  --border: #334155;
  --accent: #14b8a6;
  --accent-hover: #2dd4bf;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  user-select: none;
}

.app-shell { display: flex; flex-direction: column; height: 100vh; }

.topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 18px; background: var(--surface); border-bottom: 1px solid var(--border);
}
.topbar-left, .topbar-right { display: flex; align-items: center; gap: 12px; }
.brand { font-weight: 800; font-size: 18px; color: var(--accent); margin-inline-end: 12px; }
.nav-tabs { display: flex; gap: 6px; }
.nav-btn {
  padding: 9px 16px; border: none; border-radius: var(--radius);
  background: transparent; color: var(--text); font-weight: 600; font-size: 15px; cursor: pointer;
}
.nav-btn.active { background: var(--accent); color: #fff; }
.nav-badge { background: var(--danger); color: #fff; border-radius: 99px; padding: 2px 7px; font-size: 12px; }
.user-pill { background: var(--surface-alt); border: 1px solid var(--border); padding: 6px 12px; border-radius: 99px; font-size: 13px; font-weight: 600; }

.main-content { flex: 1; overflow: hidden; }

.pos-layout { display: grid; grid-template-columns: 1.55fr 1fr; gap: 16px; padding: 16px; height: 100%; }
.pos-left { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
.pos-right { display: flex; flex-direction: column; gap: 14px; }

.scan-bar {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface); border: 2px solid var(--accent); border-radius: var(--radius); padding: 8px 12px;
}
.scan-icon { font-weight: 900; color: var(--accent); font-size: 18px; }
.scan-input {
  flex: 1; border: none; outline: none; background: transparent; color: var(--text);
  font-size: 18px; padding: 6px;
}

.ticket-table-wrap {
  flex: 1; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); overflow-y: auto;
}
.empty-ticket { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--muted); }
.empty-icon { font-size: 54px; opacity: 0.5; }

.ticket-table, .data-table { width: 100%; border-collapse: collapse; }
.ticket-table th, .data-table th {
  position: sticky; top: 0; background: var(--surface-alt); text-align: start;
  padding: 12px; font-size: 13px; color: var(--muted); border-bottom: 1px solid var(--border);
}
.ticket-table td, .data-table td { padding: 12px; border-bottom: 1px solid var(--border); font-size: 15px; }
.prod-title { font-weight: 600; font-size: 16px; }
.row-selected { background: rgba(15, 118, 110, 0.1); }
@keyframes flashAdd { 0% { background: rgba(20, 184, 166, 0.35); } 100% { background: transparent; } }
.row-flash { animation: flashAdd 0.4s ease-out; }

.qty-control { display: inline-flex; align-items: center; gap: 4px; }
.qty-btn {
  width: 34px; height: 34px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface-alt); color: var(--text); font-size: 18px; font-weight: bold; cursor: pointer;
}
.qty-input {
  width: 48px; height: 34px; text-align: center; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface); color: var(--text); font-size: 15px; font-weight: 700;
}

.total-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 20px; text-align: center;
}
.total-label { font-size: 14px; font-weight: 700; color: var(--muted); letter-spacing: 1px; }
.total-amount { font-size: 48px; font-weight: 900; color: var(--accent); margin: 6px 0; }
.total-meta { display: flex; justify-content: space-between; font-size: 14px; color: var(--muted); }

.btn-pay-hero {
  background: var(--accent); color: #fff; border: none; border-radius: var(--radius);
  padding: 22px; font-size: 24px; font-weight: 800; cursor: pointer;
  box-shadow: 0 6px 18px rgba(15, 118, 110, 0.25);
}
.btn-pay-hero:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-pay-hero:not(:disabled):hover { background: var(--accent-hover); }

.pos-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.btn-tile { padding: 16px 12px; font-size: 15px; font-weight: 600; background: var(--surface); border: 1px solid var(--border); color: var(--text); }
.shortcuts-box {
  margin-top: auto; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 12px 16px; font-size: 13px; color: var(--muted);
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}
.shortcuts-box b { grid-column: 1 / -1; color: var(--text); }
.shortcuts-box span { display: inline-block; background: var(--surface-alt); border: 1px solid var(--border); padding: 1px 6px; border-radius: 4px; font-weight: 700; }

.btn { padding: 10px 16px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; font-size: 14px; }
.btn-lg { padding: 14px 20px; font-size: 16px; }
.btn-sm { padding: 6px 10px; font-size: 13px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-alt); color: var(--text); cursor: pointer; margin-inline-end: 4px; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-secondary { background: var(--surface-alt); color: var(--text); border: 1px solid var(--border); }
.btn-outline { background: transparent; border: 2px solid var(--accent); color: var(--accent); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-danger-soft { color: var(--danger); }
.btn-danger-txt { color: var(--danger); }
.btn-del { background: transparent; border: none; font-size: 18px; cursor: pointer; }
.btn-icon { background: transparent; border: none; font-size: 18px; color: var(--text); cursor: pointer; }
.btn-icon-txt { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; color: var(--text); cursor: pointer; font-weight: 700; }
.btn-chip { background: var(--surface-alt); border: 1px solid var(--border); color: var(--text); padding: 12px; font-size: 15px; }

.input-lg, .input-xl, .input-search {
  width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface-alt); color: var(--text); font-size: 15px;
}
.input-xl { font-size: 26px; font-weight: 800; text-align: center; }
.input-search { width: 260px; }
.field-label { display: block; font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 4px; }

.modal-overlay, .login-backdrop {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65);
  display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px;
}
.modal-card, .login-card {
  background: var(--surface); border-radius: 14px; padding: 22px; width: 100%; max-width: 540px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3); max-height: 90vh; overflow-y: auto;
}
.modal-sm { max-width: 400px; }
.modal-lg { max-width: 780px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.modal-header h3 { margin: 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

.login-card { max-width: 360px; text-align: center; }
.login-logo { font-size: 22px; font-weight: 900; color: var(--accent); margin-bottom: 6px; }
.pin-dots { display: flex; justify-content: center; gap: 14px; margin: 18px 0; }
.pin-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border); }
.pin-dot.filled { background: var(--accent); border-color: var(--accent); }
.keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.key-btn { padding: 18px; font-size: 22px; font-weight: 700; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-alt); color: var(--text); cursor: pointer; }
.key-ok { background: var(--accent); color: #fff; border-color: var(--accent); }
.demo-hints { margin-top: 14px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-around; }

.pay-total-banner { display: flex; justify-content: space-between; align-items: center; background: var(--surface-alt); padding: 14px; border-radius: 10px; margin-bottom: 14px; }
.pay-total-banner strong { font-size: 26px; color: var(--accent); }
.pay-methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
.pay-method-btn { padding: 12px 8px; border: 2px solid var(--border); background: var(--surface-alt); color: var(--text); border-radius: 8px; font-weight: 700; cursor: pointer; }
.pay-method-btn.active { border-color: var(--accent); background: rgba(15, 118, 110, 0.12); }
.quick-cash-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 10px; }
.change-box { display: flex; justify-content: space-between; padding: 14px; border-radius: 10px; margin-top: 14px; font-size: 18px; }
.change-box.good { background: rgba(22, 163, 74, 0.12); color: var(--ok); }
.change-box.bad { background: rgba(220, 38, 38, 0.12); color: var(--danger); }

.search-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; margin-top: 14px; max-height: 55vh; overflow-y: auto; }
.search-item-card { text-align: start; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-alt); color: var(--text); cursor: pointer; }
.search-item-card:hover { border-color: var(--accent); }
.search-item-cat { font-size: 11px; color: var(--muted); }
.search-item-name { font-weight: 700; margin: 4px 0; }
.search-item-price { color: var(--accent); font-weight: 800; }

.page-container { padding: 18px; height: 100%; overflow-y: auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.card-table-wrap, .card-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.card-box { padding: 18px; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.kpi-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 6px; }
.kpi-card span { font-size: 13px; color: var(--muted); }
.kpi-card strong { font-size: 24px; }
.split-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stat-line { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed var(--border); }

.form-grid { display: flex; flex-direction: column; gap: 12px; }
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.row-actions { display: flex; gap: 8px; align-items: center; }
.held-list { display: flex; flex-direction: column; gap: 10px; }
.held-row { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--surface-alt); border-radius: 8px; }

.pill { padding: 3px 9px; border-radius: 99px; font-size: 12px; font-weight: 700; background: var(--surface-alt); }
.pill-ok { background: rgba(22, 163, 74, 0.15); color: var(--ok); }
.pill-danger { background: rgba(220, 38, 38, 0.15); color: var(--danger); }
.badge-warn { display: inline-block; font-size: 11px; color: var(--warn); font-weight: 700; }
.badge-discount { color: var(--ok); font-weight: 700; }
.alert-error { background: rgba(220, 38, 38, 0.15); color: var(--danger); padding: 8px; border-radius: 8px; margin-bottom: 10px; font-weight: 600; }
.toast-banner { background: var(--accent); color: #fff; padding: 8px 14px; border-radius: 8px; font-weight: 600; }
.txt-ok { color: var(--ok); }
.txt-bad { color: var(--danger); }
.muted { color: var(--muted); }
.bold { font-weight: 700; }
.text-end { text-align: end; }
.text-center { text-align: center; }

.receipt-paper {
  background: #fff; color: #000; padding: 14px; font-family: 'Courier New', monospace;
  font-size: 12px; border: 1px dashed #ccc; max-width: 300px; margin: 0 auto;
}
.receipt-center { text-align: center; }
.receipt-store { font-size: 15px; display: block; }
.receipt-hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
.receipt-table { width: 100%; border-collapse: collapse; }
.receipt-table th, .receipt-table td { padding: 3px 0; vertical-align: top; }
.receipt-sub { font-size: 10px; color: #444; }
.receipt-row { display: flex; justify-content: space-between; margin: 3px 0; }
.receipt-total { font-size: 15px; font-weight: 900; }

@media print {
  body * { visibility: hidden; }
  .no-print { display: none !important; }
  #printable-receipt, #printable-receipt * { visibility: visible; }
  #printable-receipt {
    position: fixed; left: 0; top: 0; width: 76mm; border: none; margin: 0; padding: 4mm;
  }
}
'@

Write-RepoFile "src/i18n.js" @'
export const translations = {
  fr: {
    appTitle: 'gestsupperette',
    cashier: 'Caissier',
    manager: 'Gérant',
    loginTitle: 'Connexion Caisse',
    enterPin: 'Saisissez votre code PIN',
    invalidPin: 'Code PIN incorrect',
    logout: 'Changer caissier',
    navPos: 'Caisse',
    navProducts: 'Produits',
    navStock: 'Stock',
    navReports: 'Rapports & Clôture',
    scanPlaceholder: 'Scannez un code-barres ou tapez le code + Entrée...',
    searchManual: 'Recherche (F1)',
    discountBtn: 'Remise (F2)',
    payBtn: 'ENCAISSER (F4)',
    holdBtn: 'Mettre en attente',
    resumeBtn: 'En attente',
    clearBtn: 'Vider (Échap)',
    emptyCart: 'Scannez un article pour démarrer la vente',
    product: 'Article',
    unitPrice: 'P.U.',
    qty: 'Qté',
    total: 'Total',
    subtotal: 'Sous-total',
    discount: 'Remise',
    grandTotal: 'TOTAL À PAYER',
    unknownBarcode: 'Code-barres inconnu',
    quickAddAsk: 'Ce produit n’existe pas dans la base. Voulez-vous l’ajouter maintenant ?',
    quickAddBtn: 'Ajouter rapidement',
    close: 'Fermer',
    cancel: 'Annuler',
    save: 'Enregistrer',
    confirm: 'Confirmer',
    paymentTitle: 'Encaissement',
    cash: 'Espèces',
    card: 'Carte / CIB',
    credit: 'Crédit client',
    amountReceived: 'Montant reçu',
    changeDue: 'Monnaie à rendre',
    missingAmount: 'Montant insuffisant',
    customerName: 'Nom / Téléphone du client',
    validateSale: 'Valider & Imprimer (Entrée)',
    validateOnly: 'Valider sans imprimer',
    receiptTitle: 'Ticket de Caisse',
    print: 'Imprimer',
    newSale: 'Nouvelle vente',
    lowStock: 'Stock bas',
    da: 'DA'
  },
  ar: {
    appTitle: 'gestsupperette',
    cashier: 'أمين الصندوق',
    manager: 'المسير',
    loginTitle: 'تسجيل الدخول',
    enterPin: 'أدخل الرمز السري (PIN)',
    invalidPin: 'الرمز السري غير صحيح',
    logout: 'تغيير المستخدم',
    navPos: 'الصندوق',
    navProducts: 'المنتجات',
    navStock: 'المخزون',
    navReports: 'التقارير والإغلاق',
    scanPlaceholder: 'امسح الباركود أو أدخل الرمز + Enter...',
    searchManual: 'بحث يدوي (F1)',
    discountBtn: 'تخفيض (F2)',
    payBtn: 'دفع (F4)',
    holdBtn: 'تعليق التذكرة',
    resumeBtn: 'تذاكر معلقة',
    clearBtn: 'إفراغ (Esc)',
    emptyCart: 'امسح منتجاً للبدء في البيع',
    product: 'المنتج',
    unitPrice: 'السعر',
    qty: 'الكمية',
    total: 'المجموع',
    subtotal: 'المجموع الفرعي',
    discount: 'التخفيض',
    grandTotal: 'المبلغ المطلوب',
    unknownBarcode: 'باركود غير معروف',
    quickAddAsk: 'هذا المنتج غير مسجل. هل تريد إضافته الآن؟',
    quickAddBtn: 'إضافة سريعة',
    close: 'إغلاق',
    cancel: 'إلغاء',
    save: 'حفظ',
    confirm: 'تأكيد',
    paymentTitle: 'الدفع والتحصيل',
    cash: 'نقداً',
    card: 'بطاقة',
    credit: 'دين (كريدي)',
    amountReceived: 'المبلغ المستلم',
    changeDue: 'الباقي للزبون',
    missingAmount: 'المبلغ غير كافٍ',
    customerName: 'اسم أو هاتف الزبون',
    validateSale: 'تأكيد وطباعة (Enter)',
    validateOnly: 'تأكيد بدون طباعة',
    receiptTitle: 'وصل الشراء',
    print: 'طباعة',
    newSale: 'بيع جديد',
    lowStock: 'مخزون منخفض',
    da: 'دج'
  }
};

export function formatDA(amount, lang = 'fr') {
  const val = Math.round(Number(amount) || 0);
  return `${val.toLocaleString('fr-FR')} ${translations[lang].da}`;
}
'@

Write-RepoFile "src/api.js" @'
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
'@

Write-RepoFile "src/utils/sound.js" @'
let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

export function playBeep(type = 'success') {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.setValueAtTime(190, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'cash') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.07);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch { }
}
'@

Write-RepoFile "src/utils/csv.js" @'
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

export function parseCsvProducts(text) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const splitLine = (line) =>
    line.split(sep).map((c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? '';
    });
    return obj;
  });
}
'@

Write-RepoFile "src/App.jsx" @'
import React, { useState, useEffect } from 'react';
import { translations } from './i18n';
import { posApi } from './api';
import PinLogin from './components/PinLogin';
import PosScreen from './components/PosScreen';
import ProductsView from './components/ProductsView';
import StockView from './components/StockView';
import ReportsView from './components/ReportsView';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('pos');
  const [lang, setLang] = useState(() => localStorage.getItem('pos_lang') || 'fr');
  const [dark, setDark] = useState(() => localStorage.getItem('pos_dark') === '1');
  const [settings, setSettings] = useState({});
  const [lowStockCount, setLowStockCount] = useState(0);

  const t = translations[lang];

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('pos_lang', lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('pos_dark', dark ? '1' : '0');
  }, [dark]);

  useEffect(() => {
    posApi.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (user) {
      posApi.getDashboardStats().then((s) => setLowStockCount(s.low_stock_count));
    }
  }, [user, view]);

  if (!user) {
    return <PinLogin t={t} onLoginSuccess={(u) => { setUser(u); setView('pos'); }} />;
  }

  const isManager = user.role === 'manager';

  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <div className="topbar-left">
          <span className="brand">🛒 {settings.store_name || t.appTitle}</span>
          <nav className="nav-tabs">
            <button className={`nav-btn ${view === 'pos' ? 'active' : ''}`} onClick={() => setView('pos')}>
              {t.navPos}
            </button>
            {isManager && (
              <>
                <button className={`nav-btn ${view === 'products' ? 'active' : ''}`} onClick={() => setView('products')}>
                  {t.navProducts}
                </button>
                <button className={`nav-btn ${view === 'stock' ? 'active' : ''}`} onClick={() => setView('stock')}>
                  {t.navStock} {lowStockCount > 0 && <span className="nav-badge">{lowStockCount}</span>}
                </button>
                <button className={`nav-btn ${view === 'reports' ? 'active' : ''}`} onClick={() => setView('reports')}>
                  {t.navReports}
                </button>
              </>
            )}
          </nav>
        </div>

        <div className="topbar-right">
          <button className="btn-icon-txt" onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}>
            {lang === 'fr' ? 'العربية' : 'FR'}
          </button>
          <button className="btn-icon-txt" onClick={() => setDark(!dark)}>
            {dark ? '☀️' : '🌙'}
          </button>
          <span className="user-pill">
            👤 {user.name} ({isManager ? t.manager : t.cashier})
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setUser(null)}>{t.logout}</button>
        </div>
      </header>

      <main className="main-content">
        {view === 'pos' && <PosScreen user={user} settings={settings} lang={lang} t={t} />}
        {view === 'products' && isManager && <ProductsView lang={lang} t={t} />}
        {view === 'stock' && isManager && <StockView user={user} />}
        {view === 'reports' && isManager && (
          <ReportsView user={user} settings={settings} onSettingsUpdated={setSettings} lang={lang} t={t} />
        )}
      </main>
    </div>
  );
}
'@

Write-RepoFile "src/components/PinLogin.jsx" @'
import React, { useState } from 'react';
import { posApi } from '../api';
import { playBeep } from '../utils/sound';

export default function PinLogin({ t, onLoginSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submitPin = async (code) => {
    const user = await posApi.login(code);
    if (user) {
      playBeep('success');
      onLoginSuccess(user);
    } else {
      playBeep('error');
      setError(t.invalidPin);
      setPin('');
    }
  };

  const handleDigit = (d) => {
    setError('');
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      submitPin(next);
    }
  };

  const handleKeyDown = (e) => {
    if (/^\d$/.test(e.key)) handleDigit(e.key);
    else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    else if (e.key === 'Enter' && pin.length > 0) submitPin(pin);
  };

  return (
    <div className="login-backdrop" tabIndex={0} onKeyDown={handleKeyDown} autoFocus>
      <div className="login-card">
        <div className="login-logo">🛒 {t.appTitle}</div>
        <h2>{t.loginTitle}</h2>
        <p className="muted">{t.enterPin}</p>

        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
          ))}
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="key-btn" onClick={() => handleDigit(d)}>{d}</button>
          ))}
          <button className="key-btn key-sec" onClick={() => setPin('')}>C</button>
          <button className="key-btn" onClick={() => handleDigit('0')}>0</button>
          <button className="key-btn key-ok" onClick={() => submitPin(pin)}>OK</button>
        </div>

        <div className="demo-hints">
          <span>PIN Démo — {t.cashier}: <b>1234</b></span>
          <span>{t.manager}: <b>0000</b></span>
        </div>
      </div>
    </div>
  );
}
'@

Write-RepoFile "src/components/PosScreen.jsx" @'
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
      setQuickProd({ name: '', sell_price: '', buy_price: '', stock: '20', category: 'Général' });
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
      showToast(`Vente ${savedSale.ticket_number} enregistrée (${formatDA(savedSale.total, lang)})`);
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
          <span className="scan-icon">║█║▌</span>
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
            🔍 {t.searchManual}
          </button>
        </form>

        {toast && <div className="toast-banner">{toast}</div>}

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
            <input
              ref={searchRef}
              type="text"
              className="input-lg"
              placeholder="Nom du produit (ex: pain, œufs, lait)..."
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
'@

Write-RepoFile "src/components/PaymentModal.jsx" @'
import React, { useState, useEffect, useRef } from 'react';
import { formatDA } from '../i18n';

export default function PaymentModal({ total, lang, t, onConfirm, onClose }) {
  const [method, setMethod] = useState('cash');
  const [received, setReceived] = useState(String(total));
  const [customerName, setCustomerName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [method]);

  const receivedNum = Math.round(Number(received) || 0);
  const change = method === 'cash' ? receivedNum - total : 0;
  const canValidate =
    method === 'card' ||
    (method === 'credit' && customerName.trim().length > 0) ||
    (method === 'cash' && receivedNum >= total);

  const quickAmounts = [total, 500, 1000, 2000, 5000];

  const handleSubmit = (shouldPrint) => {
    if (!canValidate) return;
    onConfirm({
      paymentMethod: method,
      amountReceived: method === 'cash' ? receivedNum : method === 'card' ? total : 0,
      changeGiven: method === 'cash' ? Math.max(0, change) : 0,
      customerName: customerName.trim(),
      shouldPrint
    });
  };

  return (
    <div className="modal-overlay" onKeyDown={(e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && canValidate) handleSubmit(true);
    }}>
      <div className="modal-card">
        <div className="modal-header">
          <h3>{t.paymentTitle}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="pay-total-banner">
          <span>{t.grandTotal}</span>
          <strong>{formatDA(total, lang)}</strong>
        </div>

        <div className="pay-methods">
          {[
            ['cash', `💵 ${t.cash}`],
            ['card', `💳 ${t.card}`],
            ['credit', `📒 ${t.credit}`]
          ].map(([key, label]) => (
            <button
              key={key}
              className={`pay-method-btn ${method === key ? 'active' : ''}`}
              onClick={() => setMethod(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <>
            <label className="field-label">{t.amountReceived} ({t.da})</label>
            <input
              ref={inputRef}
              type="number"
              className="input-xl"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
            />

            <div className="quick-cash-grid">
              {quickAmounts.map((amt, idx) => (
                <button
                  key={`${amt}-${idx}`}
                  className="btn btn-chip"
                  onClick={() => setReceived(String(amt))}
                >
                  {idx === 0 ? 'Exact' : formatDA(amt, lang)}
                </button>
              ))}
            </div>

            <div className={`change-box ${change < 0 ? 'bad' : 'good'}`}>
              <span>{change < 0 ? t.missingAmount : t.changeDue}</span>
              <strong>{formatDA(Math.abs(change), lang)}</strong>
            </div>
          </>
        )}

        {method === 'credit' && (
          <div style={{ marginTop: 14 }}>
            <label className="field-label">{t.customerName}</label>
            <input
              ref={inputRef}
              type="text"
              className="input-lg"
              placeholder="Ex: Karim — 0551 00 11 22"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
          <button
            className="btn btn-outline"
            disabled={!canValidate}
            onClick={() => handleSubmit(false)}
          >
            {t.validateOnly}
          </button>
          <button
            className="btn btn-primary btn-lg"
            disabled={!canValidate}
            onClick={() => handleSubmit(true)}
          >
            {t.validateSale}
          </button>
        </div>
      </div>
    </div>
  );
}
'@

Write-RepoFile "src/components/ReceiptModal.jsx" @'
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
'@

Write-RepoFile "src/components/ProductsView.jsx" @'
import React, { useState, useEffect, useRef } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';
import { exportProductsToCsv, parseCsvProducts } from '../utils/csv';

const emptyForm = {
  id: null, barcode: '', name: '', name_ar: '', category: 'Épicerie',
  buy_price: '', sell_price: '', stock: '0', alert_threshold: '5'
};

export default function ProductsView({ lang, t }) {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    setProducts(await posApi.listProducts());
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) =>
    `${p.name} ${p.name_ar} ${p.barcode || ''} ${p.category}`.toLowerCase().includes(filter.toLowerCase())
  );

  const openEdit = (p) => {
    setForm({ ...p, barcode: p.barcode || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await posApi.upsertProduct(form);
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch {
      alert('Erreur : ce code-barres existe déjà sur un autre produit.');
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Supprimer le produit "${p.name}" ?`)) return;
    await posApi.deleteProduct(p.id);
    load();
  };

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvProducts(text);
    const count = await posApi.importCsv(rows);
    alert(`${count} produit(s) importé(s) ou mis à jour.`);
    e.target.value = '';
    load();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>📦 Catalogue Produits ({products.length})</h2>
        <div className="row-actions">
          <input
            className="input-search"
            placeholder="Filtrer par nom, code-barres..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleImportCsv} />
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>📥 Importer CSV</button>
          <button className="btn btn-secondary" onClick={() => exportProductsToCsv(products)}>📤 Exporter CSV</button>
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setShowModal(true); }}>+ Nouveau produit</button>
        </div>
      </div>

      <div className="card-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code-barres</th>
              <th>Nom</th>
              <th>Catégorie</th>
              <th className="text-end">Achat</th>
              <th className="text-end">Vente</th>
              <th className="text-center">Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td><code>{p.barcode || 'Vrac'}</code></td>
                <td><b>{p.name}</b> {p.name_ar && <small className="muted">({p.name_ar})</small>}</td>
                <td><span className="pill">{p.category}</span></td>
                <td className="text-end">{formatDA(p.buy_price, lang)}</td>
                <td className="text-end bold">{formatDA(p.sell_price, lang)}</td>
                <td className="text-center">
                  <span className={`pill ${p.stock <= p.alert_threshold ? 'pill-danger' : 'pill-ok'}`}>
                    {p.stock}
                  </span>
                </td>
                <td>
                  <button className="btn-sm" onClick={() => openEdit(p)}>✏️</button>
                  <button className="btn-sm btn-danger-txt" onClick={() => handleDelete(p)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{form.id ? 'Modifier produit' : 'Nouveau produit'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="form-grid">
              <div>
                <label className="field-label">Code-barres (scannez directement ici, laisser vide si vrac)</label>
                <input
                  autoFocus
                  className="input-lg"
                  value={form.barcode}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                />
              </div>
              <div className="row-2">
                <div>
                  <label className="field-label">Nom (FR) *</label>
                  <input required className="input-lg" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Nom (AR optionnel)</label>
                  <input dir="rtl" className="input-lg" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
                </div>
              </div>
              <div className="row-2">
                <div>
                  <label className="field-label">Prix d'achat (DA)</label>
                  <input type="number" className="input-lg" value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Prix de vente (DA) *</label>
                  <input required type="number" className="input-lg" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} />
                </div>
              </div>
              <div className="row-3">
                <div>
                  <label className="field-label">Catégorie</label>
                  <input className="input-lg" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Stock actuel</label>
                  <input type="number" className="input-lg" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Seuil d'alerte</label>
                  <input type="number" className="input-lg" value={form.alert_threshold} onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
'@

Write-RepoFile "src/components/StockView.jsx" @'
import React, { useState, useEffect } from 'react';
import { posApi } from '../api';

export default function StockView({ user }) {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [onlyLow, setOnlyLow] = useState(true);
  const [selected, setSelected] = useState(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('Réapprovisionnement fournisseur');

  const load = async () => {
    setProducts(await posApi.listProducts());
    setMovements(await posApi.listStockMovements(50));
  };

  useEffect(() => { load(); }, []);

  const visibleProducts = onlyLow
    ? products.filter((p) => p.stock <= p.alert_threshold)
    : products;

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!selected || !delta) return;
    await posApi.adjustStock({
      productId: selected.id,
      delta: Number(delta),
      reason,
      userId: user.id
    });
    setSelected(null);
    setDelta('');
    load();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>📊 Gestion du Stock</h2>
        <div className="row-actions">
          <button className={`btn ${onlyLow ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOnlyLow(true)}>
            ⚠️ Alertes stock bas ({products.filter((p) => p.stock <= p.alert_threshold).length})
          </button>
          <button className={`btn ${!onlyLow ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOnlyLow(false)}>
            Tous les produits
          </button>
        </div>
      </div>

      <div className="split-2">
        <div className="card-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th className="text-center">Stock</th>
                <th className="text-center">Seuil</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b></td>
                  <td className="text-center">
                    <span className={`pill ${p.stock <= p.alert_threshold ? 'pill-danger' : 'pill-ok'}`}>{p.stock}</span>
                  </td>
                  <td className="text-center">{p.alert_threshold}</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => { setSelected(p); setDelta('10'); }}>
                      ± Mouvement
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card-table-wrap">
          <h4 style={{ padding: '12px 16px', margin: 0 }}>Derniers mouvements</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Variation</th>
                <th>Motif</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.product_name}</td>
                  <td><b className={m.delta >= 0 ? 'txt-ok' : 'txt-bad'}>{m.delta > 0 ? `+${m.delta}` : m.delta}</b></td>
                  <td><small>{m.reason}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="modal-overlay">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>Ajustement : {selected.name}</h3>
              <button className="btn-icon" onClick={() => setSelected(null)}>✕</button>
            </div>
            <p className="muted">Stock actuel : <b>{selected.stock}</b></p>
            <form onSubmit={handleAdjust} className="form-grid">
              <div>
                <label className="field-label">Quantité (+ entrée / − perte ou inventaire)</label>
                <input autoFocus required type="number" className="input-lg" value={delta} onChange={(e) => setDelta(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Motif</label>
                <input className="input-lg" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
'@

Write-RepoFile "src/components/ReportsView.jsx" @'
import React, { useState, useEffect } from 'react';
import { formatDA } from '../i18n';
import { posApi } from '../api';
import ReceiptModal from './ReceiptModal';

export default function ReportsView({ user, settings, onSettingsUpdated, lang, t }) {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [previewSale, setPreviewSale] = useState(null);

  const [openReg, setOpenReg] = useState(null);
  const [regHistory, setRegHistory] = useState([]);
  const [openingCash, setOpeningCash] = useState('5000');
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const [storeForm, setStoreForm] = useState(settings);

  useEffect(() => {
    setStoreForm(settings);
  }, [settings]);

  const loadAll = async () => {
    setStats(await posApi.getDashboardStats());
    setSales(await posApi.listSales({ search }));
    setOpenReg(await posApi.getOpenRegister());
    setRegHistory(await posApi.listRegisterHistory());
  };

  useEffect(() => { loadAll(); }, [search]);

  const handleOpenSale = async (id) => {
    setPreviewSale(await posApi.getSaleDetails(id));
  };

  const handleCancelSale = async (sale) => {
    const reason = window.prompt(`Motif d'annulation du ticket ${sale.ticket_number} ?`);
    if (!reason) return;
    await posApi.cancelSale({ saleId: sale.id, reason, userId: user.id });
    loadAll();
  };

  const handleOpenCash = async () => {
    await posApi.openRegister({ openingCash: Number(openingCash) || 0, userId: user.id });
    loadAll();
  };

  const handleCloseCash = async () => {
    if (!openReg || countedCash === '') return;
    if (!window.confirm('Confirmer la clôture définitive de la caisse ?')) return;
    await posApi.closeRegister({
      id: openReg.id,
      countedCash: Number(countedCash),
      notes: closeNotes,
      userId: user.id
    });
    setCountedCash('');
    setCloseNotes('');
    loadAll();
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const updated = await posApi.updateSettings(storeForm);
    onSettingsUpdated(updated);
    alert('Paramètres enregistrés.');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>📈 Rapports, Historique & Clôture</h2>
        <div className="row-actions">
          <button className={`btn ${tab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('dashboard')}>Synthèse du jour</button>
          <button className={`btn ${tab === 'tickets' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('tickets')}>Historique tickets</button>
          <button className={`btn ${tab === 'cash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('cash')}>Clôture de caisse</button>
          <button className={`btn ${tab === 'settings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('settings')}>Paramètres & Sauvegarde</button>
        </div>
      </div>

      {tab === 'dashboard' && stats && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card"><span>Chiffre d'affaires (Jour)</span><strong>{formatDA(stats.revenue, lang)}</strong></div>
            <div className="kpi-card"><span>Tickets validés</span><strong>{stats.tickets_count}</strong></div>
            <div className="kpi-card"><span>Panier moyen</span><strong>{formatDA(stats.avg_basket, lang)}</strong></div>
            <div className="kpi-card"><span>Bénéfice estimé</span><strong className="txt-ok">{formatDA(stats.estimated_profit, lang)}</strong></div>
          </div>

          <div className="split-2" style={{ marginTop: 18 }}>
            <div className="card-box">
              <h4>Répartition paiements (Jour)</h4>
              <div className="stat-line"><span>💵 Espèces</span><b>{formatDA(stats.cash_total, lang)}</b></div>
              <div className="stat-line"><span>💳 Carte / CIB</span><b>{formatDA(stats.card_total, lang)}</b></div>
              <div className="stat-line"><span>📒 Crédit client</span><b>{formatDA(stats.credit_total, lang)}</b></div>
            </div>
            <div className="card-box">
              <h4>Top 10 produits</h4>
              {stats.top_products.map((tp, i) => (
                <div key={i} className="stat-line">
                  <span>{i + 1}. {tp.product_name}</span>
                  <b>{tp.qty_sold} u. ({formatDA(tp.total_sales, lang)})</b>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'tickets' && (
        <>
          <input
            className="input-lg"
            style={{ marginBottom: 12, maxWidth: 400 }}
            placeholder="Rechercher par n° ticket ou client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="card-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N° Ticket</th>
                  <th>Date</th>
                  <th>Caissier</th>
                  <th>Mode</th>
                  <th className="text-end">Total</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.ticket_number}</b></td>
                    <td>{new Date(s.created_at.replace(' ', 'T') + 'Z').toLocaleString('fr-FR')}</td>
                    <td>{s.cashier_name}</td>
                    <td>{s.payment_method} {s.customer_name && `(${s.customer_name})`}</td>
                    <td className="text-end bold">{formatDA(s.total, lang)}</td>
                    <td>
                      <span className={`pill ${s.status === 'completed' ? 'pill-ok' : 'pill-danger'}`}>
                        {s.status === 'completed' ? 'Validé' : 'Annulé'}
                      </span>
                    </td>
                    <td>
                      <button className="btn-sm" onClick={() => handleOpenSale(s.id)}>🖨 Voir</button>
                      {s.status === 'completed' && (
                        <button className="btn-sm btn-danger-txt" onClick={() => handleCancelSale(s)}>Annuler</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'cash' && (
        <div className="split-2">
          <div className="card-box">
            {!openReg ? (
              <>
                <h3>Ouvrir la caisse</h3>
                <label className="field-label">Fond de caisse initial (DA)</label>
                <input type="number" className="input-lg" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleOpenCash}>Ouvrir la session de caisse</button>
              </>
            ) : (
              <>
                <h3>Session de caisse ouverte</h3>
                <div className="stat-line"><span>Fond d'ouverture</span><b>{formatDA(openReg.opening_cash, lang)}</b></div>
                <div className="stat-line"><span>Ventes espèces encaissées</span><b>{formatDA(openReg.cash_sales_since_open, lang)}</b></div>
                <div className="stat-line"><span>Total espèces attendu</span><b className="txt-ok">{formatDA(openReg.expected_cash, lang)}</b></div>
                <hr />
                <label className="field-label">Espèces réelles comptées dans le tiroir (DA)</label>
                <input type="number" className="input-xl" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
                {countedCash !== '' && (
                  <div className="stat-line" style={{ marginTop: 8 }}>
                    <span>Écart de caisse</span>
                    <b className={Number(countedCash) - openReg.expected_cash === 0 ? 'txt-ok' : 'txt-bad'}>
                      {formatDA(Number(countedCash) - openReg.expected_cash, lang)}
                    </b>
                  </div>
                )}
                <label className="field-label" style={{ marginTop: 8 }}>Remarques</label>
                <input className="input-lg" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
                <button className="btn btn-primary btn-lg" style={{ marginTop: 14, width: '100%' }} onClick={handleCloseCash}>
                  Clôturer la caisse (Z)
                </button>
              </>
            )}
          </div>

          <div className="card-table-wrap">
            <h4 style={{ padding: '12px 16px', margin: 0 }}>Historique des clôtures</h4>
            <table className="data-table">
              <thead>
                <tr><th>Date clôture</th><th>Attendu</th><th>Compté</th><th>Écart</th></tr>
              </thead>
              <tbody>
                {regHistory.filter((r) => r.closed_at).map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.closed_at.replace(' ', 'T') + 'Z').toLocaleString('fr-FR')}</td>
                    <td>{formatDA(r.expected_cash, lang)}</td>
                    <td>{formatDA(r.counted_cash, lang)}</td>
                    <td className={r.difference === 0 ? 'txt-ok' : 'txt-bad'}>{formatDA(r.difference, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="split-2">
          <form onSubmit={handleSaveSettings} className="card-box form-grid">
            <h3>Informations du ticket</h3>
            <div>
              <label className="field-label">Nom de la supérette</label>
              <input className="input-lg" value={storeForm.store_name || ''} onChange={(e) => setStoreForm({ ...storeForm, store_name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Adresse</label>
              <input className="input-lg" value={storeForm.store_address || ''} onChange={(e) => setStoreForm({ ...storeForm, store_address: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Téléphone</label>
              <input className="input-lg" value={storeForm.store_phone || ''} onChange={(e) => setStoreForm({ ...storeForm, store_phone: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Pied de ticket</label>
              <input className="input-lg" value={storeForm.receipt_footer || ''} onChange={(e) => setStoreForm({ ...storeForm, receipt_footer: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary">Enregistrer les paramètres</button>
          </form>

          <div className="card-box">
            <h3>Sauvegarde & Restauration</h3>
            <p className="muted">Exportez ou restaurez toutes vos données (produits, ventes, stock).</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              <button className="btn btn-primary btn-lg" onClick={async () => {
                const path = await posApi.backupExport();
                if (path) alert(`Sauvegarde exportée (${path})`);
              }}>
                💾 Exporter une sauvegarde
              </button>
              <button className="btn btn-danger" onClick={async () => {
                if (!window.confirm('Attention : les données actuelles seront remplacées par la sauvegarde choisie. Continuer ?')) return;
                const ok = await posApi.backupRestore();
                if (ok) {
                  alert('Sauvegarde restaurée avec succès.');
                  loadAll();
                }
              }}>
                ♻️ Restaurer une sauvegarde
              </button>
            </div>
          </div>
        </div>
      )}

      {previewSale && (
        <ReceiptModal sale={previewSale} settings={settings} lang={lang} t={t} onClose={() => setPreviewSale(null)} />
      )}
    </div>
  );
}
'@


Write-Host ""
Write-Host "Projet gestsupperette créé avec succès :" -ForegroundColor Green
Write-Host $repoDir -ForegroundColor Cyan
Write-Host ""
Write-Host "Étape suivante : ouvrez ce dossier et exécutez npm install, puis npm run dev." -ForegroundColor Yellow
