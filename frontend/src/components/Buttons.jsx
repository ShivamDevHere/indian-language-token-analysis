// Shared button styles so every page looks consistent.
const BASE = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';
const VARIANTS = {
  primary: 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-sm hover:from-teal-600 hover:to-blue-600',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
};
export default function Button({ variant = 'primary', className = '', ...props }) {
  return <button type="button" className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}
