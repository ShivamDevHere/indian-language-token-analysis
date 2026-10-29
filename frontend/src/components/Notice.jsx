import { Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Inline banner. type: 'demo' | 'warn' | 'error' | 'success'
const STYLES = {
  demo: ['border-violet-200 bg-violet-50 text-violet-800', Info],
  warn: ['border-amber-200 bg-amber-50 text-amber-800', AlertTriangle],
  error: ['border-red-200 bg-red-50 text-red-800', AlertTriangle],
  success: ['border-emerald-200 bg-emerald-50 text-emerald-800', CheckCircle2],
};
export default function Notice({ type = 'demo', title, children }) {
  const [cls, Icon] = STYLES[type];
  return (
    <div role={type === 'error' ? 'alert' : 'note'} className={`flex gap-3 rounded-xl border p-3 text-sm ${cls}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>{title && <p className="font-semibold">{title}</p>}<div className={title ? 'mt-0.5' : ''}>{children}</div></div>
    </div>
  );
}
