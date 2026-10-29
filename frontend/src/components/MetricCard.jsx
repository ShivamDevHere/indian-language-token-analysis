// KPI tile: icon, label, big value, small hint. `tone` picks the icon color.
const TONES = { teal: 'bg-teal-50 text-teal-600', blue: 'bg-blue-50 text-blue-600', purple: 'bg-violet-50 text-violet-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600' };

export default function MetricCard({ label, value, hint, icon: Icon, tone = 'teal' }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
        </div>
        {Icon && <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}><Icon size={20} /></span>}
      </div>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
