import Field, { inputClass } from './Field.jsx';
import { LANGUAGES } from '../data/demoData.js';

/**
 * multiple=false -> dropdown (value is a string)
 * multiple=true  -> toggle chips (value is an array of strings)
 */
export default function LanguageSelector({ id, label, value, onChange, multiple = false, error, hint }) {
  if (!multiple) {
    return (
      <Field label={label} htmlFor={id} error={error} hint={hint}>
        <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
      </Field>
    );
  }
  const toggle = (l) => onChange(value.includes(l) ? value.filter((x) => x !== l) : [...value, l]);
  return (
    <Field label={label} error={error} hint={hint}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {LANGUAGES.map((l) => {
          const on = value.includes(l);
          return (
            <button key={l} type="button" aria-pressed={on} onClick={() => toggle(l)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              {l}
            </button>
          );
        })}
      </div>
    </Field>
  );
}
