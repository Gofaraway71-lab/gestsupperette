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