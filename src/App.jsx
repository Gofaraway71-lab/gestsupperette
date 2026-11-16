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