import { LayoutDashboard, FlaskConical, Table2, GitCompareArrows, ShieldCheck, History, Settings, Languages, X } from 'lucide-react';

// Single source of truth for navigation. `id` is the page key used in App.jsx.
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'evaluate', label: 'Evaluate Prompt', icon: FlaskConical },
  { id: 'lab', label: 'Benchmark Lab', icon: Table2 },
  { id: 'compare', label: 'Model Comparison', icon: GitCompareArrows },
  { id: 'safety', label: 'Safety & Quality', icon: ShieldCheck },
  { id: 'history', label: 'Benchmark History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/** Dark navy sidebar. On screens below `lg` it slides in over the page (open/onClose). */
export default function Sidebar({ active, onNavigate, open, onClose }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-navy-950/60 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-900 text-slate-300 transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400 via-blue-500 to-violet-500 text-white"><Languages size={22} /></span>
            <div>
              <p className="text-base font-extrabold leading-tight text-white">Bhasha Kar</p>
              <p className="text-xs text-slate-400">Language benchmark lab</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const on = active === id;
            return (
              <button key={id} onClick={() => onNavigate(id)} aria-current={on ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${on ? 'bg-gradient-to-r from-teal-500/20 to-violet-500/20 text-white ring-1 ring-teal-400/40' : 'hover:bg-white/5 hover:text-white'}`}>
                <Icon size={18} className={on ? 'text-teal-300' : ''} />{label}
              </button>
            );
          })}
        </nav>
        <div className="m-3 rounded-xl bg-navy-800 p-4 text-xs">
          <p className="font-semibold text-white">Demo mode</p>
          <p className="mt-1 text-slate-400">All results are sample data. Backend not connected.</p>
        </div>
      </aside>
    </>
  );
}
