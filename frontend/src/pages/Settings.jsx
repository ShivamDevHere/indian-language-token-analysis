/**
 * Settings - frontend-only preferences.
 * Components: Field, LanguageSelector, Button, Notice.
 * Data: DEFAULT_SETTINGS (data/demoData.js). Saved settings live in App.jsx state and reset on refresh.
 * Interactions: handleSave() validates + saves, handleReset() restores defaults.
 * API keys: typed into local state only, never saved or sent. Backend later: keys go in backend/.env.
 */
import { useState } from 'react';
import { Save, RotateCcw, KeyRound } from 'lucide-react';
import Field, { inputClass } from '../components/Field.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import Button from '../components/Buttons.jsx';
import Notice from '../components/Notice.jsx';
import { DEFAULT_SETTINGS, CATEGORIES } from '../data/demoData.js';

const WEIGHTS = [['cost', 'Cost'], ['speed', 'Speed'], ['safety', 'Safety'], ['quality', 'Quality']];
const Card = ({ title, children }) => (
  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">{title}</h3>{children}</section>
);

export default function Settings({ settings, onSaveSettings }) {
  const [draft, setDraft] = useState(settings);
  const [keys, setKeys] = useState({ gemini: '', openrouter: '' }); // never persisted
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setDraft((p) => ({ ...p, [k]: v }));
  const total = Object.values(draft.weights).reduce((s, n) => s + n, 0);

  function handleSave() {
    const e = {};
    if (draft.targetLanguages.length === 0) e.targets = 'Select at least one default target language.';
    const rep = Number(draft.repetitions);
    if (!Number.isInteger(rep) || rep < 1 || rep > 10) e.repetitions = 'Enter a whole number from 1 to 10.';
    if (total === 0) e.weights = 'Set at least one weight above zero.';
    setErrors(e);
    if (Object.keys(e).length) { setMsg({ type: 'error', text: 'Fix the highlighted fields and save again.' }); return; }
    onSaveSettings({ ...draft, repetitions: rep });
    setKeys({ gemini: '', openrouter: '' }); // clear secrets on save
    setMsg({ type: 'success', text: 'Settings saved for this session. They reset when you refresh the page.' });
  }

  function handleReset() {
    setDraft(DEFAULT_SETTINGS); onSaveSettings(DEFAULT_SETTINGS); setKeys({ gemini: '', openrouter: '' }); setErrors({});
    setMsg({ type: 'success', text: 'Settings reset to defaults.' });
  }

  return (
    <>
      {msg && <Notice type={msg.type}>{msg.text}</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Defaults">
          <Field label="Preferred theme" htmlFor="theme">
            <select id="theme" className={inputClass} value={draft.theme} onChange={(e) => set('theme', e.target.value)}>
              <option value="light">Light</option><option value="dark">Dark</option><option value="system">Match system</option>
            </select>
          </Field>
          <LanguageSelector id="src" label="Default source language" value={draft.sourceLanguage} onChange={(v) => set('sourceLanguage', v)} />
          <LanguageSelector multiple label="Default target languages" value={draft.targetLanguages} onChange={(v) => set('targetLanguages', v)} error={errors.targets} />
          <Field label="Default test category" htmlFor="cat">
            <select id="cat" className={inputClass} value={draft.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Benchmark repetitions" htmlFor="rep" error={errors.repetitions} hint="How many times each test runs. Applied once the backend exists.">
            <input id="rep" type="number" min="1" max="10" className={inputClass} value={draft.repetitions} onChange={(e) => set('repetitions', e.target.value)} />
          </Field>
        </Card>

        <div className="space-y-4">
          <Card title="Recommendation weights">
            <p className="text-sm text-slate-500">Choose what matters most when recommending a model. Weights are normalized, so they do not need to add up to 100.</p>
            {WEIGHTS.map(([key, label]) => (
              <div key={key}>
                <div className="flex justify-between text-sm font-semibold text-slate-700"><label htmlFor={`w-${key}`}>{label}</label><span>{draft.weights[key]} ({total ? Math.round((draft.weights[key] / total) * 100) : 0}%)</span></div>
                <input id={`w-${key}`} type="range" min="0" max="100" value={draft.weights[key]} className="w-full accent-teal-600"
                  onChange={(e) => set('weights', { ...draft.weights, [key]: Number(e.target.value) })} />
              </div>
            ))}
            {errors.weights && <p role="alert" className="text-xs font-medium text-red-600">{errors.weights}</p>}
          </Card>

          <Card title="Provider configuration">
            <Notice type="warn" title="Secure backend required">Keys typed here are NOT saved or sent anywhere, and are cleared when you save. API keys must be configured in the backend .env file before real models can be used.</Notice>
            <Field label="Gemini API key" htmlFor="k-gem"><div className="relative"><KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input id="k-gem" type="password" autoComplete="off" className={`${inputClass} pl-9`} placeholder="Not stored" value={keys.gemini} onChange={(e) => setKeys({ ...keys, gemini: e.target.value })} /></div></Field>
            <Field label="OpenRouter API key" htmlFor="k-or"><div className="relative"><KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input id="k-or" type="password" autoComplete="off" className={`${inputClass} pl-9`} placeholder="Not stored" value={keys.openrouter} onChange={(e) => setKeys({ ...keys, openrouter: e.target.value })} /></div></Field>
          </Card>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleReset}><RotateCcw size={16} /> Reset settings</Button>
        <Button onClick={handleSave}><Save size={16} /> Save settings</Button>
      </div>
    </>
  );
}
