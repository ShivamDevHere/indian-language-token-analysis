/**
 * Evaluate Prompt - form -> loading -> demo results.
 * Components: PromptForm (validation), StatusBadge, Notice, Button.
 * Data: MODELS from data/demoData.js. Results are generated LOCALLY by runDemoEvaluation().
 * Interaction: handleSubmit() runs the demo; "Run another" resets to the form.
 * Backend later: replace runDemoEvaluation() with runEvaluation(values) from services/api.js
 * (POST /api/evaluate) and render the real response with the same cards.
 */
import { useState } from 'react';
import { Loader2, RotateCcw, Clock, Coins, Hash } from 'lucide-react';
import PromptForm from '../components/PromptForm.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Notice from '../components/Notice.jsx';
import Button from '../components/Buttons.jsx';
import MetricCard from '../components/MetricCard.jsx';
import { MODELS } from '../data/demoData.js';
import { estimateTokens, fmtCost, fmtMs } from '../utils/helpers.js';

const rand = (min, max) => min + Math.random() * (max - min);

/** Builds fake results (one per model x target language). No network call is made. */
function runDemoEvaluation(values) {
  const inputTokens = estimateTokens(values.prompt);
  const results = [];
  values.models.forEach((id) => {
    const m = MODELS.find((x) => x.id === id);
    values.targets.forEach((lang) => {
      const outputTokens = Math.round(rand(150, 320) * (lang === 'English' ? 1 : 1.8));
      results.push({
        key: `${id}-${lang}`, model: m.name, provider: m.provider, language: lang,
        inputTokens, outputTokens, latency: Math.round(m.latency * rand(0.8, 1.3)),
        cost: (inputTokens * m.inPrice + outputTokens * m.outPrice) / 1e6,
        status: Math.random() > 0.2 ? 'Pass' : 'Needs review',
        text: values.category === 'Translation'
          ? `[Demo output] A ${lang} translation from ${m.provider} would appear here once the backend is connected.`
          : `[Demo output] A ${lang} answer from ${m.provider} would appear here once the backend is connected.`,
      });
    });
  });
  return results;
}

export default function EvaluatePrompt({ settings }) {
  const [phase, setPhase] = useState('form'); // 'form' | 'loading' | 'results' | 'error'
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');

  function handleSubmit(values) {
    setPhase('loading');
    setMeta(values);
    // setTimeout fakes the waiting time of a real API call.
    setTimeout(() => {
      try { setResults(runDemoEvaluation(values)); setPhase('results'); }
      catch (e) { setError(e.message); setPhase('error'); }
    }, 1600);
  }

  const reset = () => { setPhase('form'); setError(''); };

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm" role="status">
        <Loader2 className="animate-spin text-teal-500" size={36} />
        <p className="font-bold text-slate-900">Running demo evaluation...</p>
        <p className="text-sm text-slate-500">This is a local simulation. No API is being called.</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (<div className="space-y-4"><Notice type="error" title="The demo evaluation failed">{error || 'Something went wrong. Try again.'}</Notice><Button onClick={reset}><RotateCcw size={16} /> Back to form</Button></div>);
  }

  if (phase === 'results') {
    const avgLat = results.reduce((s, r) => s + r.latency, 0) / results.length;
    const total = results.reduce((s, r) => s + r.cost, 0);
    const pass = results.filter((r) => r.status === 'Pass').length;
    return (
      <>
        <Notice type="demo" title="Sample results">These cards are generated in your browser for demonstration. Backend integration is pending, so tokens, latency and cost are NOT real measurements.</Notice>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Average latency" value={fmtMs(avgLat)} icon={Clock} tone="blue" hint="Simulated" />
          <MetricCard label="Total estimated cost" value={fmtCost(total)} icon={Coins} tone="teal" hint="Placeholder prices" />
          <MetricCard label="Passed checks" value={`${pass} / ${results.length}`} icon={Hash} tone="purple" hint={meta.category} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((r) => (
            <article key={r.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-bold text-slate-900">{r.model}</h3><p className="text-xs text-slate-500">{r.provider} &middot; {r.language}</p></div>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{r.text}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><dt className="text-slate-500">Input tokens</dt><dd className="font-bold text-slate-800">{r.inputTokens}</dd></div>
                <div><dt className="text-slate-500">Output tokens</dt><dd className="font-bold text-slate-800">{r.outputTokens}</dd></div>
                <div><dt className="text-slate-500">Latency</dt><dd className="font-bold text-slate-800">{fmtMs(r.latency)}</dd></div>
                <div><dt className="text-slate-500">Est. cost</dt><dd className="font-bold text-slate-800">{fmtCost(r.cost)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <Button variant="secondary" onClick={reset}><RotateCcw size={16} /> Run another evaluation</Button>
      </>
    );
  }

  return (
    <>
      <Notice type="demo" title="Frontend demo only">Running an evaluation simulates results locally. No external API is called until the backend is implemented.</Notice>
      <PromptForm settings={settings} onSubmit={handleSubmit} loading={false} />
    </>
  );
}
