/**
 * Model Comparison - compare sample metrics for the models you pick.
 * Components: ModelSelector, LanguageSelector, ChartCard, DataTable, Notice.
 * Data: COMPARISON_ROWS (one row per model x language) from data/demoData.js, ILLUSTRATIVE DEMO DATA.
 * Interaction: `selected` models and `lang` filter drive the table, charts and indicator cards.
 * Backend later: replace COMPARISON_ROWS with real benchmark results from the API.
 */
import { useMemo, useState } from 'react';
import { Coins, Zap, ShieldCheck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ModelSelector from '../components/ModelSelector.jsx';
import Field, { inputClass } from '../components/Field.jsx';
import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import Notice from '../components/Notice.jsx';
import { COMPARISON_ROWS, LANGUAGES, COLORS } from '../data/demoData.js';
import { aggregateByModel, fmtCost, fmtMs } from '../utils/helpers.js';

const axis = { fontSize: 11, fill: '#64748b' };

function Indicator({ icon: Icon, label, name, value, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span>
      <div><p className="text-xs text-slate-500">{label}</p><p className="font-bold text-slate-900">{name}</p><p className="text-xs text-slate-500">{value}</p></div>
    </div>
  );
}

export default function ModelComparison() {
  const [selected, setSelected] = useState(['gemini-flash', 'gemini-pro', 'or-model-a']);
  const [lang, setLang] = useState('All');

  const rows = useMemo(() => COMPARISON_ROWS.filter((r) => selected.includes(r.modelId) && (lang === 'All' || r.language === lang)), [selected, lang]);
  const agg = useMemo(() => aggregateByModel(rows), [rows]);
  const best = (key, dir) => agg.reduce((a, b) => (dir === 'min' ? (b[key] < a[key] ? b : a) : (b[key] > a[key] ? b : a)));

  const columns = [
    { key: 'model', label: 'Model', className: 'font-semibold text-slate-900' },
    { key: 'provider', label: 'Provider' },
    { key: 'language', label: 'Language' },
    { key: 'inputTokens', label: 'Input tokens' },
    { key: 'outputTokens', label: 'Output tokens' },
    { key: 'latency', label: 'Latency', render: (r) => fmtMs(r.latency) },
    { key: 'cost', label: 'Est. cost', render: (r) => fmtCost(r.cost) },
    { key: 'safety', label: 'Safety score' },
    { key: 'quality', label: 'Quality score' },
  ];

  return (
    <>
      <Notice type="demo" title="Illustrative demo data">All metrics below are made-up sample values for the UI. Prices are placeholders per 1M tokens. They are not real measurements of any model.</Notice>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <ModelSelector label="Models to compare" value={selected} onChange={setSelected} />
        <div className="max-w-xs">
          <Field label="Language" htmlFor="cmp-lang">
            <select id="cmp-lang" className={inputClass} value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="All">All languages (average)</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </div>
      </section>

      {agg.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="font-semibold text-slate-700">No models selected</p>
          <p className="text-sm text-slate-500">Pick at least one model above to see the comparison.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Indicator icon={Coins} tone="bg-teal-50 text-teal-600" label="Lowest-cost model" name={best('cost', 'min').short} value={`${fmtCost(best('cost', 'min').cost)} avg per request`} />
            <Indicator icon={Zap} tone="bg-blue-50 text-blue-600" label="Fastest model" name={best('latency', 'min').short} value={`${fmtMs(best('latency', 'min').latency)} avg`} />
            <Indicator icon={ShieldCheck} tone="bg-violet-50 text-violet-600" label="Best observed safety score" name={best('safety', 'max').short} value={`${best('safety', 'max').safety.toFixed(1)} / 100 (demo)`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Cost comparison" subtitle="Avg estimated cost per request (USD)">
              <ResponsiveContainer><BarChart data={agg.map((m) => ({ name: m.short, cost: +m.cost.toFixed(5) }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={axis} interval={0} /><YAxis tick={axis} width={56} /><Tooltip formatter={(v) => `$${v}`} /><Bar dataKey="cost" name="Cost" fill={COLORS.teal} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Latency comparison" subtitle="Avg response latency (ms)">
              <ResponsiveContainer><BarChart data={agg.map((m) => ({ name: m.short, latency: Math.round(m.latency) }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={axis} interval={0} /><YAxis tick={axis} width={44} /><Tooltip formatter={(v) => `${v} ms`} /><Bar dataKey="latency" name="Latency" fill={COLORS.blue} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
            </ChartCard>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5 pb-2"><h3 className="font-bold text-slate-900">Comparison table</h3><p className="text-xs text-slate-500">{rows.length} rows of sample data</p></div>
            <DataTable columns={columns} rows={rows} />
          </section>
        </>
      )}
    </>
  );
}
