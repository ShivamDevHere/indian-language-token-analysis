import { useState } from 'react';
import MainLayout from './layouts/MainLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EvaluatePrompt from './pages/EvaluatePrompt.jsx';
import BenchmarkLab from './pages/BenchmarkLab.jsx';
import ModelComparison from './pages/ModelComparison.jsx';
import SafetyQuality from './pages/SafetyQuality.jsx';
import BenchmarkHistory from './pages/BenchmarkHistory.jsx';
import SettingsPage from './pages/Settings.jsx';
import { DEFAULT_SETTINGS } from './data/demoData.js';

// No router library: the current page is just a string in state.
// To add a page: create it in pages/, add it here and in NAV_ITEMS (components/Sidebar.jsx).
const PAGES = {
  dashboard: Dashboard, evaluate: EvaluatePrompt, lab: BenchmarkLab, compare: ModelComparison,
  safety: SafetyQuality, history: BenchmarkHistory, settings: SettingsPage,
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS); // frontend-only; resets on refresh
  const [labSearch, setLabSearch] = useState('');             // set by the header search box
  const Page = PAGES[page];

  const handleSearch = (text) => { setLabSearch(text); setPage('lab'); };
  const navigate = (id) => { setLabSearch(''); setPage(id); };

  return (
    <MainLayout page={page} onNavigate={navigate} onSearch={handleSearch} theme={settings.theme}>
      <Page key={`${page}-${labSearch}`} onNavigate={navigate} settings={settings} onSaveSettings={setSettings} initialSearch={labSearch} />
    </MainLayout>
  );
}
