# PS 1.4: Bhasha Kar,  AI language cost, speed and safety benchmarking platform.
Analyzes how tokenization in Indian languages affects AI model speed, cost, and safety.

## PROBLEM:
AI splits text into small pieces called tokens. Some Indian languages need more pieces, making answers slower and more expensive. Splitting can also hide harmful phrases from safety checks. Developers need to compare speed, cost and safety before choosing a model.

## Objectives
- Measure token counts, cost, response time and safety for each language and model.
- Compare token counts across Indian languages.
- Measure speed and tokenization costs.
- Evaluate safety-check challenges.

## Run it (Windows PowerShell, VS Code)

1. Install Node.js LTS from https://nodejs.org (one time), then reopen VS Code.
2. In VS Code: File > Open Folder > choose `bhasha-kar`, then open a terminal with Ctrl + `.
3. Run:

```powershell
cd frontend
npm install
npm run dev
```

4. Open the address shown (usually http://localhost:5173). Press Ctrl+C to stop.

If PowerShell blocks `npm` with an execution-policy error, run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Production check: `npm run build`

## Important files

| File | Purpose |
|---|---|
| `frontend/src/App.jsx` | Page switching (state-based navigation) and saved settings |
| `frontend/src/data/demoData.js` | ALL sample data: models, languages, runs, test cases, scores |
| `frontend/src/services/api.js` | Placeholder for the future Flask API calls |
| `frontend/src/layouts/MainLayout.jsx` | Sidebar + header shell, dark theme switch |
| `frontend/src/pages/*.jsx` | The 7 pages (each starts with a comment explaining it) |
| `frontend/src/components/*.jsx` | Reusable parts: Sidebar, Header, MetricCard, ChartCard, DataTable, StatusBadge, LanguageSelector, ModelSelector, PromptForm, Modal, Field, Buttons, Notice |
| `frontend/src/utils/helpers.js` | Formatting and averaging helpers |
| `frontend/src/utils/importers.js` | Local CSV/JSON parsing for the Benchmark Lab |
| `backend/*` | Documented placeholders for the Flask backend |

## Frontend features implemented

- Working sidebar navigation (mobile slide-in menu), header search, notifications, profile placeholder
- Dashboard: 6 KPI cards, cost / latency / safety charts, recent runs table, Demo Mode status, New Evaluation button
- Evaluate Prompt: validated form, loading state, local demo simulation, result cards (tokens, latency, cost, status)
- Benchmark Lab: filters, search, add-test-case modal with validation, working local CSV/JSON import, dataset stats
- Model Comparison: model and language selection, table, cost and latency charts, lowest-cost / fastest / best-safety indicators
- Safety & Quality: four rate cards, language charts, test-case outcomes, explanation that refusal rate alone is not safety
- Benchmark History: search, status and language filters, Load more, run-details modal
- Settings: theme (light/dark/system), defaults, repetitions, recommendation weights, Save/Reset, API key fields that are never stored
- Empty states, loading states and error messages

## Backend features still pending

- Flask app, CORS and API routes
- Gemini and OpenRouter provider calls
- Real translation, token counting, latency measurement and cost calculation
- Safety and quality scoring logic
- Database storage for runs and test cases
- Secure API-key handling through `backend/.env`
- Connecting `frontend/src/services/api.js` and replacing the imports from `demoData.js`

## Notes

- Model names and prices in `demoData.js` are placeholders. Check each provider for real availability and pricing.
- Settings and imported test cases live in memory and reset on refresh.



