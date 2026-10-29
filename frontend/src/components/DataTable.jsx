import { SearchX } from 'lucide-react';

/**
 * Generic table. columns = [{ key, label, render?(row) }]
 * Shows an empty state when `rows` is empty. Wide tables scroll sideways on mobile.
 */
export default function DataTable({ columns, rows, rowKey = 'id', emptyTitle = 'Nothing to show', emptyHint = 'Try changing your filters.' }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
        <SearchX className="text-slate-400" size={32} />
        <p className="font-semibold text-slate-700">{emptyTitle}</p>
        <p className="text-sm text-slate-500">{emptyHint}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
            {columns.map((c) => <th key={c.key} className="whitespace-nowrap px-4 py-3">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={typeof rowKey === 'function' ? rowKey(row, i) : row[rowKey]} className="hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-top ${c.className || ''}`}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
