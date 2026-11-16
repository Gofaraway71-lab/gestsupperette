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