/**
 * Safety & Quality - demo safety and answer-quality scores.
 * Components: MetricCard, ChartCard, DataTable, StatusBadge, Notice.
 * Data: SAFETY_METRICS, LANGUAGE_SCORES, SAFETY_CASES from data/demoData.js (DEMO VALUES).
 * Backend later: compute these from real benchmark runs (services/safety_service.py).
 */
import { ShieldCheck, ShieldAlert, CheckCheck, Ban } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import MetricCard from '../components/MetricCard.jsx';
import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Notice from '../components/Notice.jsx';
import { SAFETY_METRICS as M, LANGUAGE_SCORES, SAFETY_CASES, COLORS } from '../data/demoData.js';

const axis = { fontSize: 11, fill: '#64748b' };

export default function SafetyQuality() {
  const columns = [
    { key: 'id', label: 'Test ID', className: 'font-semibold text-slate-900' },
    { key: 'language', label: 'Language' },
    { key: 'model', label: 'Model' },
    { key: 'expected', label: 'Expected behavior' },
    { key: 'outcome', label: 'Observed outcome', render: (r) => <StatusBadge status={r.outcome} /> },
  ];
  return (
    <>
      <Notice type="demo" title="Demo values only">These scores are placeholders until real benchmark tests are run. They do not describe any real model.</Notice>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Correct refusal rate" value={`${M.correctRefusal}%`} hint="Unsafe prompts refused" icon={ShieldCheck} tone="teal" />
        <MetricCard label="Unsafe compliance rate" value={`${M.unsafeCompliance}%`} hint="Unsafe prompts answered" icon={ShieldAlert} tone="red" />
        <MetricCard label="Benign answer pass rate" value={`${M.benignPass}%`} hint="Harmless prompts answered well" icon={CheckCheck} tone="blue" />
        <MetricCard label="False refusal rate" value={`${M.falseRefusal}%`} hint="Harmless prompts refused" icon={Ban} tone="amber" />
      </div>

      <Notice type="warn" title="Refusal rate alone is not a safety score">A model that refuses everything has a perfect refusal rate but is useless. Read it together with unsafe compliance (too permissive) and false refusal (too strict).</Notice>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Safety by language" subtitle="Correct refusal vs unsafe compliance (%)">
          <ResponsiveContainer><BarChart data={LANGUAGE_SCORES}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="language" tick={axis} interval={0} /><YAxis tick={axis} width={34} domain={[0, 100]} /><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="correctRefusal" name="Correct refusal" fill={COLORS.teal} radius={[6, 6, 0, 0]} /><Bar dataKey="unsafeCompliance" name="Unsafe compliance" fill={COLORS.red} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Answer quality by language" subtitle="Demo quality score (0-100)">
          <ResponsiveContainer><BarChart data={LANGUAGE_SCORES}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="language" tick={axis} interval={0} /><YAxis tick={axis} width={34} domain={[0, 100]} /><Tooltip /><Bar dataKey="quality" name="Quality" fill={COLORS.purple} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 pb-2"><h3 className="font-bold text-slate-900">Recent test cases</h3><p className="text-xs text-slate-500">Sample outcomes</p></div>
        <DataTable columns={columns} rows={SAFETY_CASES} rowKey={(r, i) => `${r.id}-${i}`} />
      </section>
    </>
  );
}
