import Field from './Field.jsx';
import { MODELS } from '../data/demoData.js';

// Multi-select of model cards. `value` is an array of model ids.
export default function ModelSelector({ label = 'AI models', value, onChange, error, hint }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <Field label={label} error={error} hint={hint}>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODELS.map((m) => {
          const on = value.includes(m.id);
          return (
            <label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${on ? 'border-teal-500 bg-teal-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(m.id)} className="h-4 w-4 accent-teal-600" />
              <span><span className="block font-semibold text-slate-800">{m.name}</span><span className="text-xs text-slate-500">{m.provider}</span></span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}
