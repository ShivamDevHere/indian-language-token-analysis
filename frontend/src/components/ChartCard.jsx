// Card wrapper for Recharts charts. Children should be a <ResponsiveContainer>.
export default function ChartCard({ title, subtitle, children, height = 260, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">Sample data</span>
      </div>
      <div style={{ height }}>{children}</div>
    </section>
  );
}
