/**
 * Benchmark History - searchable, filterable list of SAMPLE past runs.
 * Components: DataTable, Modal, StatusBadge, Notice, Button.
 * Data: RUN_HISTORY from data/demoData.js (not a real database).
 * Interaction: filters via useMemo, `visible` count for "Load more", `selected` run for the details modal.
 * Backend later: replace RUN_HISTORY with fetchBenchmarkRuns() and load details from GET /api/benchmarks/<id>.
 */
import { useMemo, useState } from 'react';
import { Search, Eye } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import Notice from '../components/Notice.jsx';
import Button from '../components/Buttons.jsx';
import { inputClass } from '../components/Field.jsx';
import { RUN_HISTORY, LANGUAGES } from '../data/demoData.js';
import { RUN_COLUMNS } from './Dashboard.jsx';
import { fmtCost, fmtDate, fmtMs } from '../utils/helpers.js';

const PAGE_SIZE = 6;

export default function BenchmarkHistory() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [lang, setLang] = useState('All');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => RUN_HISTORY.filter((r) =>
    (status === 'All' || r.status === status) && (lang === 'All' || r.languages.includes(lang)) &&
    (!search.trim() || `${r.id} ${r.models.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()))
  ), [search, status, lang]);

  const columns = [
    ...RUN_COLUMNS.filter((c) => c.key !== 'models'),
    { key: 'models', label: 'Models tested', render: (r) => r.models.join(', ') },
    { key: 'languages', label: 'Languages', render: (r) => r.languages.join(', ') },
    { key: 'actions', label: '', render: (r) => <Button variant="secondary" className="!px-3 !py-1.5" onClick={() => setSelected(r)}><Eye size={14} /> View details</Button> },
  ];
  // Reorder so the table follows: ID, date, models, languages, tests, latency, cost, status, actions
  const order = ['id', 'date', 'models', 'languages', 'tests', 'latency', 'cost', 'status', 'actions'];
  const ordered = order.map((k) => columns.find((c) => c.key === k));
  const reset = (setter) => (e) => { setter(e.target.value); setVisible(PAGE_SIZE); };

  return (
    <>
      <Notice type="demo" title="Sample history">These runs are local sample data. Nothing is stored in a database yet.</Notice>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputClass} pl-9`} placeholder="Search by run ID or model" aria-label="Search runs" value={search} onChange={reset(setSearch)} />
          </div>
          <select className={`${inputClass} !w-auto`} aria-label="Status filter" value={status} onChange={reset(setStatus)}>
            <option value="All">All statuses</option><option>Completed</option><option>Partial</option><option>Failed</option>
          </select>
          <select className={`${inputClass} !w-auto`} aria-label="Language filter" value={lang} onChange={reset(setLang)}>
            <option value="All">All languages</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <DataTable columns={ordered} rows={filtered.slice(0, visible)} emptyTitle="No runs found" emptyHint="Try a different search or clear the filters." />
        <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-500">
          <span>Showing {Math.min(visible, filtered.length)} of {filtered.length} runs</span>
          {visible < filtered.length && <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>Load more</Button>}
        </div>
      </section>

      <Modal open={!!selected} title={selected ? `Run ${selected.id}` : ''} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              {[['Date', fmtDate(selected.date)], ['Status', selected.status], ['Models', selected.models.join(', ')], ['Languages', selected.languages.join(', ')],
                ['Test count', selected.tests], ['Avg latency', fmtMs(selected.latency)], ['Estimated cost', fmtCost(selected.cost)]].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold text-slate-800">{v}</dd></div>
              ))}
            </dl>
            <Notice type="demo">Per-test results for this run will appear here once the backend stores real benchmark data.</Notice>
          </div>
        )}
      </Modal>
    </>
  );
}
