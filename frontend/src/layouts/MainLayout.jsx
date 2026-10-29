import { useEffect, useState } from 'react';
import Sidebar, { NAV_ITEMS } from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';

/** Sidebar + header + page area. Also applies the dark theme class from Settings. */
export default function MainLayout({ page, onNavigate, onSearch, theme, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  const title = NAV_ITEMS.find((n) => n.id === page)?.label ?? '';
  const go = (id) => { onNavigate(id); setMenuOpen(false); };

  return (
    <div className={`min-h-screen bg-slate-50 ${dark ? 'theme-dark' : ''}`}>
      <Sidebar active={page} onNavigate={go} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <Header title={title} onMenu={() => setMenuOpen(true)} onSearch={onSearch} />
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
