/**
 * api.js - placeholder for the future Flask integration.
 *
 * The frontend works WITHOUT the backend: every page imports demo data from
 * src/data/demoData.js. When the Flask API exists, replace the demo imports in
 * each page with calls to the functions below.
 *
 * TODO (later):
 *   - runEvaluation(payload)  -> POST /api/evaluate
 *   - fetchBenchmarkRuns()    -> GET  /api/benchmarks
 *   - fetchTestCases()        -> GET  /api/test-cases
 * API keys must live in backend/.env, never in this frontend.
 */
export const API_BASE_URL = 'http://localhost:5000/api'; // not used yet

export async function runEvaluation() {
  throw new Error('Backend not connected yet. The Evaluate Prompt page uses a local demo simulation.');
}
