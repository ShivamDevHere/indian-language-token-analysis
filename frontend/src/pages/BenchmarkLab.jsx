/**
 * Benchmark Lab - manage the test dataset (kept in React state only).
 * Components: DataTable, Modal, Field, MetricCard, StatusBadge, Notice, Button.
 * Data: INITIAL_TEST_CASES from data/demoData.js. New/imported cases live in `cases` state and vanish on refresh.
 * Interactions: handleAdd() (modal form), handleImport() (CSV/JSON file), filters via useMemo.
 * Backend later: load with fetchTestCases() and save with POST /api/test-cases; keep dataset/test_cases.json in sync.
 */
import { useMemo, useRef, useState } from 'react';
import { Plus, Upload, Search, ListChecks, Languages, Layers, AlertOctagon } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import Field, { inputClass } from '../components/Field.jsx';
import MetricCard from '../components/MetricCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Notice from '../components/Notice.jsx';
import Button from '../components/Buttons.jsx';
import { INITIAL_TEST_CASES, LANGUAGES, CATEGORIES, SEVERITIES } from '../data/demoData.js';
import { parseTestCaseFile } from '../utils/importers.js';

const nextId = (cases) => `TC-${String(Math.max(0, ...cases.map((c) => parseInt(c.id.replace(/\D/g, ''), 10) || 0)) + 1).padStart(3, '0')}`;
const emptyForm = (cases) => ({ id: nextId(cases), language: 'English', category: CATEGORIES[0], prompt: '', expected: '', severity: 'Medium' });

export default function BenchmarkLab({ initialSearch = '' }) {
  const [cases, setCases] = useState(INITIAL_TEST_CASES);
  const [lang, setLang] = useState('All');
  const [cat, setCat] = useState('All');
  const [search, setSearch] = useState(initialSearch);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm(INITIAL_TEST_CASES));
  const [errors, setErrors] = useState({});
  const [importMsg, setImportMsg] = useState(null); // { type, text }
  const fileRef = useRef(null);

  const filtered = useMemo(() => cases.filter((c) =>
    (lang === 'All' || c.language === lang) && (cat === 'All' || c.category === cat) &&
    (!search.trim() || `${c.id} ${c.prompt} ${c.expected}`.toLowerCase().includes(search.trim().toLowerCase()))
  ), [cases, lang, cat, search]);

  const stats = {
    total: cases.length,
    languages: new Set(cases.map((c) => c.language)).size,
    categories: new Set(cases.map((c) => c.category)).size,
    high: cases.filter((c) => c.severity === 'High').length,
  };

  const openModal = () => { setForm(emptyForm(cases)); setErrors({}); setModal(true); };

  function handleAdd() {
    const e = {};
    if (!form.id.trim()) e.id = 'Test ID is required.';
    else if (cases.some((c) => c.id.toLowerCase() === form.id.trim().toLowerCase())) e.id = 'This Test ID already exists.';
    if (form.prompt.trim().length < 5) e.prompt = 'Enter a prompt (at least 5 characters).';
    if (!form.expected.trim()) e.expected = 'Describe the expected behavior.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setCases((p) => [{ ...form, id: form.id.trim(), prompt: form.prompt.trim(), expected: form.expected.trim() }, ...p]);
    setModal(false);
  }

  // Reads the chosen file in the browser (FileReader). Nothing leaves your computer.
  function handleImport(ev) {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setImportMsg({ type: 'error', text: 'Could not read the file.' });
    reader.onload = () => {
      try {
        const { cases: imported, skipped } = parseTestCaseFile(file.name, String(reader.result));
        if (imported.length === 0) throw new Error('No valid rows found. Required columns: Test ID, Language, Category, Prompt, Expected behavior, Severity.');
        setCases((prev) => {
          let list = [...prev];
          const added = imported.map((c) => {
            const row = { ...c, severity: SEVERITIES.includes(c.severity) ? c.severity : 'Medium' };
            if (!row.id || list.some((x) => x.id === row.id)) row.id = nextId(list);
            list = [row, ...list];
            return row;
          });
          return [...added.reverse(), ...prev];
        });
        setImportMsg({ type: 'success', text: `Imported ${imported.length} test case(s)${skipped ? `, skipped ${skipped} incomplete row(s)` : ''}.` });
      } catch (err) {
        setImportMsg({ type: 'error', text: `Import failed: ${err.message}` });
      }
    };
    reader.readAsText(file);
  }

  const columns = [
    { key: 'id', label: 'Test ID', className: 'font-semibold text-slate-900 whitespace-nowrap' },
    { key: 'language', label: 'Language' },
    { key: 'category', label: 'Category' },
    { key: 'prompt', label: 'Prompt', className: 'max-w-xs' },
    { key: 'expected', label: 'Expected behavior', className: 'max-w-xs' },
    { key: 'severity', label: 'Severity', render: (r) => <StatusBadge status={r.severity} /> },
  ];
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total test cases" value={stats.total} icon={ListChecks} tone="teal" />
        <MetricCard label="Languages covered" value={`${stats.languages} / ${LANGUAGES.length}`} icon={Languages} tone="blue" />
        <MetricCard label="Categories" value={`${stats.categories} / ${CATEGORIES.length}`} icon={Layers} tone="purple" />
        <MetricCard label="High severity" value={stats.high} icon={AlertOctagon} tone="red" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputClass} pl-9`} placeholder="Search prompt, ID or expected behavior" aria-label="Search test cases" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={`${inputClass} !w-auto`} aria-label="Language filter" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="All">All languages</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
          <select className={`${inputClass} !w-auto`} aria-label="Category filter" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="All">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <Button variant="secondary" onClick={() => fileRef.current.click()}><Upload size={16} /> Import CSV / JSON</Button>
          <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleImport} />
          <Button onClick={openModal}><Plus size={16} /> Add test case</Button>
        </div>
        {importMsg && <div className="mt-3"><Notice type={importMsg.type}>{importMsg.text}</Notice></div>}
        <p className="mt-3 text-xs text-slate-500">Import runs locally in your browser. Columns: Test ID, Language, Category, Prompt, Expected behavior, Severity. Cases are kept in memory only and reset on refresh.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 pb-2"><h3 className="font-bold text-slate-900">Test dataset</h3><p className="text-xs text-slate-500">Showing {filtered.length} of {cases.length} demo test cases</p></div>
        <DataTable columns={columns} rows={filtered} emptyTitle="No test cases match" emptyHint="Clear the search or filters, or add a new test case." />
      </section>

      <Modal open={modal} title="Add test case" onClose={() => setModal(false)}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={handleAdd}>Save test case</Button></>}>
        <div className="space-y-4">
          <Field label="Test ID" htmlFor="tc-id" error={errors.id}><input id="tc-id" className={inputClass} value={form.id} onChange={(e) => set('id', e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Language" htmlFor="tc-lang"><select id="tc-lang" className={inputClass} value={form.language} onChange={(e) => set('language', e.target.value)}>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select></Field>
            <Field label="Category" htmlFor="tc-cat"><select id="tc-cat" className={inputClass} value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Severity" htmlFor="tc-sev"><select id="tc-sev" className={inputClass} value={form.severity} onChange={(e) => set('severity', e.target.value)}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          </div>
          <Field label="Prompt" htmlFor="tc-prompt" error={errors.prompt}><textarea id="tc-prompt" rows={3} className={inputClass} value={form.prompt} onChange={(e) => set('prompt', e.target.value)} /></Field>
          <Field label="Expected behavior" htmlFor="tc-exp" error={errors.expected} hint="Example: Refuse and suggest a safer alternative."><textarea id="tc-exp" rows={2} className={inputClass} value={form.expected} onChange={(e) => set('expected', e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}
