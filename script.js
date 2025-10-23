const $ = (sel) => document.querySelector(sel);

// API key injected at runtime by Docker (placeholder replaced on container start)
const __RACETAG_API_KEY__ = "__RACETAG_FRONTEND_API_KEY__";
// Backend URL injected at runtime by Docker (placeholder replaced on container start)
const __RACETAG_BACKEND_URL__ = "__RACETAG_FRONTEND_BACKEND_URL__";

const isPlaceholder = (v) => typeof v === 'string' && v.startsWith('__RACETAG_');

const state = {
  backend:
    ( localStorage.getItem('racetag.backend') 
    || !isPlaceholder(__RACETAG_BACKEND_URL__) && __RACETAG_BACKEND_URL__)
    || 'http://localhost:8600',
  es: null,
  standingsByTag: new Map(),
};

// Mapeo de tag_id a número de bib (race number)
const tagToBib = {
  '000000000000000001B541C0': '6064',
  'C5A1BE1B694E02089950CE2217F46FBA': '3420',
  'EE6B4AADB6F002FC353CE1BFD8D3C3DF': '3476',
  '281C5AACBA0E0283B93B419B55EB5407': '24859'
};

function setStatus(text) {
  $('#status').textContent = text;
}

function saveBackend(url) {
  state.backend = url.replace(/\/$/, '');
  localStorage.setItem('racetag.backend', state.backend);
}

function renderStandings(items) {
  const tbody = $('#standingsTable tbody');
  tbody.innerHTML = '';
  items.forEach((p, idx) => {
    const gap = typeof p.gap_ms === 'number' ? formatMs(p.gap_ms) : '';
    const bib = tagToBib[p.tag_id] || 'N/A';
    const tr = document.createElement('tr');
    const total = typeof p.total_time_ms === 'number' ? secondsWithMs(p.total_time_ms) : '';
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${p.tag_id}</td>
      <td>${bib}</td>
      <td>${p.laps}</td>
      <td class="${p.finished ? 'finished' : ''}">${p.finished ? 'Yes' : 'No'}</td>
      <td>${p.last_pass_time || ''}</td>
      <td>${gap}</td>
      <td>${total}</td>
    `;
    tbody.appendChild(tr);
  });
}

function formatMs(ms) {
  if (ms <= 0) return '0.000';
  const s = Math.floor(ms / 1000);
  const remMs = ms % 1000;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}.${String(remMs).padStart(3, '0')}`;
}

function secondsWithMs(ms) {
  if (ms == null) return '';
  const s = (ms / 1000);
  // Always 3 decimals for ms
  return s.toFixed(3);
}

async function loadSnapshot() {
  const url = `${state.backend}/classification`;
  const headers = getApiHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET /classification failed: ${res.status}`);
  const data = await res.json();
  renderStandings(data.standings || []);
}

function connectSSE() {
  const url = `${state.backend}/stream`;
  if (state.es) state.es.close();
  state.es = connectSSEWithHeaders(url, getApiHeaders(), {
    onOpen: () => setStatus('Connected'),
    onError: () => setStatus('Connection error'),
    onMessage: (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === 'standings') {
          renderStandings(data.items || []);
        }
      } catch {
        // ignore non-JSON payloads
      }
    },
  });
}

function init() {
  const input = $('#backendUrl');
  input.value = state.backend;
  $('#connectBtn').addEventListener('click', async () => {
    saveBackend(input.value);
    setStatus('Connecting...');
    try {
      await loadSnapshot();
      connectSSE();
    } catch (e) {
      console.error(e);
      setStatus('Failed to connect');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  init();
  // Auto-connect on load using stored backend URL
  try {
    setStatus('Connecting...');
    await loadSnapshot();
    connectSSE();
  } catch (e) {
    console.warn('Auto-connect failed, please set backend URL and click Connect');
    setStatus('Disconnected');
  }
});

