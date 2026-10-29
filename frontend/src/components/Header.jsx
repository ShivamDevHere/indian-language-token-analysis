import { useState } from 'react';
import { Bell, Menu, Search } from 'lucide-react';
import { NOTIFICATIONS } from '../data/demoData.js';

/**
 * Top bar: menu button (mobile), page title, search, notifications, profile.
 * Searching sends the text to the Benchmark Lab via onSearch (handled in App.jsx).
 */
export default function Header({ title, onMenu, onSearch }) {
  const [q, setQ] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
      <button onClick={onMenu} aria-label="Open menu" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button>
      <h1 className="text-lg font-extrabold text-slate-900 sm:text-xl">{title}</h1>
      <form className="relative ml-auto hidden w-full max-w-xs sm:block" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { onSearch(q.trim()); setQ(''); } }}>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search test cases" placeholder="Search test cases..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none" />
      </form>
      <div className="relative ml-auto sm:ml-0">
        <button onClick={() => setShowNotes((s) => !s)} aria-label="Notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
          <Bell size={20} /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet-500" />
        </button>
        {showNotes && (
          <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {NOTIFICATIONS.map((n) => (
              <div key={n.id} className="rounded-lg p-2 text-sm hover:bg-slate-50"><p className="text-slate-700">{n.text}</p><p className="text-xs text-slate-400">{n.time}</p></div>
            ))}
          </div>
        )}
      </div>
      <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white" title="Profile placeholder">BK</div>
    </header>
  );
}
