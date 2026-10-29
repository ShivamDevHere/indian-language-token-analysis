/**
 * Dashboard - overview of benchmark activity.
 * Components: MetricCard, ChartCard, DataTable, StatusBadge, Button.
 * Data: DASHBOARD_STATS, COMPARISON_ROWS, RUN_HISTORY, LANGUAGE_SCORES from data/demoData.js (SAMPLE DATA).
 * Interaction: "New evaluation" calls onNavigate('evaluate'); "View all" opens Benchmark History.
 * Backend later: replace the demo imports with fetchBenchmarkRuns() / summary endpoints in services/api.js.
 */
import { Activity, Languages, Cpu, Clock, DollarSign, ShieldCheck, Plus } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import MetricCard from '../components/MetricCard.jsx';
import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Button from '../components/Buttons.jsx';
import Notice from '../components/Notice.jsx';
import { DASHBOARD_STATS as S, COMPARISON_ROWS, RUN_HISTORY, LANGUAGE_SCORES, COLORS } from '../data/demoData.js';
import { aggregateByModel, fmtCost, fmtMs, fmtDate } from '../utils/helpers.js';

const axis = { fontSize: 11, fill: '#64748b' };

export const RUN_COLUMNS = [
  { key: 'id', label: 'Run ID', className: 'font-semibold text-slate-900' },
  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
  { key: 'models', label: 'Models', render: (r) => r.models.join(', ') },
  { key: 'tests', label: 'Tests' },
  { key: 'latency', label: 'Avg latency', render: (r) => fmtMs(r.latency) },
  { key: 'cost', label: 'Est. cost', render: (r) => fmtCost(r.cost) },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

export default function Dashboard({ onNavigate }) {
  const byModel = aggregateByModel(COMPARISON_ROWS).map((m) => ({ name: m.short, cost: +(m.cost * 1000).toFixed(3) }));
  const latencyTrend = [...RUN_HISTORY].slice(0, 10).reverse().map((r) => ({ run: r.id.replace('RUN-', '#'), latency: r.latency }));
  const recent = RUN_HISTORY.slice(0, 5);

  return (
    <>
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-navy-900 via-navy-800 to-violet-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold">Compare cost, speed and safety across Indian languages</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-300">Run the same prompt on several models and languages, then see where each model is cheaper, faster or safer.</p>
        </div>
        <Button onClick={() => onNavigate('evaluate')} className="shrink-0" style={{ backgroundColor: '#fff', backgroundImage: 'none', color: '#0b1437' }}>
          <Plus size={16} /> New evaluation
        </Button>
      </div>

      <Notice type="demo" title="Demo mode">Every number on this page is SAMPLE DATA, not a real API measurement. Backend integration is pending.</Notice>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Total benchmark runs" value={S.totalRuns} hint="Sample value" icon={Activity} tone="teal" />
        <MetricCard label="Languages tested" value={S.languagesTested} hint="English, Hindi, Bengali, Tamil, Telugu" icon={Languages} tone="blue" />
        <MetricCard label="Models evaluated" value={S.modelsEvaluated} hint="Placeholder models" icon={Cpu} tone="purple" />
        <MetricCard label="Average response latency" value={fmtMs(S.avgLatencyMs)} hint="Sample value" icon={Clock} tone="amber" />
        <MetricCard label="Average estimated cost" value={`$${S.avgCostUsd.toFixed(5)}`} hint="Per request, illustrative" icon={DollarSign} tone="teal" />
        <MetricCard label="Safety pass rate" value={`${S.safetyPassRate}%`} hint="Demo value, not a real result" icon={ShieldCheck} tone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Cost comparison" subtitle="Avg estimated cost per 1,000 requests (USD)">
          <ResponsiveContainer><BarChart data={byModel}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={axis} interval={0} /><YAxis tick={axis} width={40} /><Tooltip formatter={(v) => `$${v}`} /><Bar dataKey="cost" name="Cost" fill={COLORS.teal} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Response latency" subtitle="Avg latency of the last 10 runs (ms)">
          <ResponsiveContainer><LineChart data={latencyTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="run" tick={axis} /><YAxis tick={axis} width={44} /><Tooltip formatter={(v) => `${v} ms`} /><Line type="monotone" dataKey="latency" name="Latency" stroke={COLORS.blue} strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Safety by language" subtitle="Demo safety pass rate (%)">
          <ResponsiveContainer><BarChart data={LANGUAGE_SCORES}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="language" tick={axis} interval={0} /><YAxis domain={[60, 100]} tick={axis} width={36} /><Tooltip /><Bar dataKey="benignPass" name="Pass rate" fill={COLORS.purple} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between p-5 pb-2">
          <div><h3 className="font-bold text-slate-900">Recent benchmark runs</h3><p className="text-xs text-slate-500">Sample runs, not stored in a database</p></div>
          <Button variant="secondary" onClick={() => onNavigate('history')}>View all</Button>
        </div>
        <DataTable columns={RUN_COLUMNS} rows={recent} />
      </section>
    </>
  );
}
