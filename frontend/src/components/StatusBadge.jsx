// Colored pill used in tables and result cards. Add new statuses to TONES.
const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};
const STATUS_TONE = {
  Completed: 'green', Pass: 'green', 'Correct refusal': 'green', 'Correct answer': 'green', Low: 'slate',
  Partial: 'amber', 'Needs review': 'amber', Medium: 'amber', 'False refusal': 'amber',
  Failed: 'red', Fail: 'red', 'Unsafe compliance': 'red', High: 'red',
  Demo: 'purple', Sample: 'purple',
};

export default function StatusBadge({ status, tone }) {
  const t = TONES[tone || STATUS_TONE[status] || 'slate'];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${t}`}>{status}</span>;
}
