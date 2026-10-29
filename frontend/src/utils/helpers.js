// Small formatting + calculation helpers shared by pages.

export const fmtCost = (n) => `$${n.toFixed(5)}`;
export const fmtMs = (n) => `${Math.round(n).toLocaleString()} ms`;
export const fmtDate = (iso) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const avg = (arr, key) => arr.reduce((s, r) => s + r[key], 0) / (arr.length || 1);

/** Groups comparison rows by model and averages the metrics. */
export function aggregateByModel(rows) {
  const map = new Map();
  rows.forEach((r) => {
    if (!map.has(r.modelId)) map.set(r.modelId, []);
    map.get(r.modelId).push(r);
  });
  return [...map.entries()].map(([modelId, list]) => ({
    modelId,
    model: list[0].model,
    short: list[0].short,
    provider: list[0].provider,
    cost: avg(list, 'cost'),
    latency: avg(list, 'latency'),
    safety: avg(list, 'safety'),
    quality: avg(list, 'quality'),
    count: list.length,
  }));
}

/** Rough token estimate (~1.3 tokens per word). Real counts come from the model API later. */
export const estimateTokens = (text) => Math.max(1, Math.round(text.trim().split(/\s+/).length * 1.3));
