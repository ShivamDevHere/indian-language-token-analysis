import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import Field, { inputClass } from './Field.jsx';
import LanguageSelector from './LanguageSelector.jsx';
import ModelSelector from './ModelSelector.jsx';
import Button from './Buttons.jsx';
import { CATEGORIES } from '../data/demoData.js';

/**
 * Evaluation form. Owns the field values + validation.
 * Calls onSubmit(values) only when everything is valid; the parent page runs the demo.
 */
export default function PromptForm({ settings, onSubmit, loading }) {
  const [v, setV] = useState({
    prompt: '', source: settings.sourceLanguage, targets: settings.targetLanguages,
    models: ['gemini-flash', 'or-model-a'], category: settings.category,
  });
  const [errors, setErrors] = useState({});
  const set = (key, val) => setV((p) => ({ ...p, [key]: val }));

  function validate() {
    const e = {};
    if (v.prompt.trim().length < 10) e.prompt = 'Enter a prompt of at least 10 characters.';
    if (v.targets.length === 0) e.targets = 'Select at least one target language.';
    else if (v.category === 'Translation' && v.targets.every((t) => t === v.source))
      e.targets = 'For translation tests, pick a target language different from the source.';
    if (v.models.length === 0) e.models = 'Select at least one model.';
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) onSubmit(v);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Field label="Prompt" htmlFor="prompt" error={errors.prompt} hint={`${v.prompt.length} characters`}>
        <textarea id="prompt" rows={5} className={inputClass} placeholder="Type the prompt you want to test across languages and models..."
          value={v.prompt} onChange={(e) => set('prompt', e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <LanguageSelector id="source" label="Source language" value={v.source} onChange={(x) => set('source', x)} />
        <Field label="Test category" htmlFor="category">
          <select id="category" className={inputClass} value={v.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <LanguageSelector multiple label="Target languages" value={v.targets} onChange={(x) => set('targets', x)} error={errors.targets} />
      <ModelSelector value={v.models} onChange={(x) => set('models', x)} error={errors.models}
        hint="Placeholder models. Real model names are configured in the backend later." />
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {loading ? 'Running demo...' : 'Run evaluation'}
        </Button>
      </div>
    </form>
  );
}
