// Local CSV / JSON import for the Benchmark Lab. Nothing is uploaded anywhere.

/** Minimal CSV parser: handles quoted cells, commas and line breaks inside quotes. */
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

// Accepts headers like "Test ID", "test_id", "testId" -> "testid"
const norm = (k) => String(k).toLowerCase().replace(/[^a-z]/g, '');
const FIELD_MAP = { testid: 'id', id: 'id', language: 'language', category: 'category', prompt: 'prompt',
  expectedbehavior: 'expected', expected: 'expected', severity: 'severity' };

function toCase(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => { const f = FIELD_MAP[norm(k)]; if (f) out[f] = String(v ?? '').trim(); });
  return out;
}

/** Returns { cases, skipped } from the text of an uploaded .csv or .json file. */
export function parseTestCaseFile(fileName, text) {
  let objects;
  if (fileName.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(text);
    objects = Array.isArray(data) ? data : data.test_cases || data.testCases;
    if (!Array.isArray(objects)) throw new Error('JSON must be an array of test cases.');
  } else {
    const [header, ...body] = parseCSV(text);
    if (!header) throw new Error('The CSV file is empty.');
    objects = body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
  }
  const all = objects.map(toCase);
  const cases = all.filter((c) => c.language && c.category && c.prompt && c.expected);
  return { cases, skipped: all.length - cases.length };
}
