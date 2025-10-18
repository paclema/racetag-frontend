const $ = (sel) => document.querySelector(sel);

const state = {
  backend: localStorage.getItem('racetag.backend') || 'http://localhost:8000',
  es: null,
  standingsByTag: new Map(),
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
    const tr = document.createElement('tr');
    const total = typeof p.total_time_ms === 'number' ? secondsWithMs(p.total_time_ms) : '';
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${p.tag_id}</td>
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET /classification failed: ${res.status}`);
  const data = await res.json();
  renderStandings(data.standings || []);
}

function connectSSE() {
  const url = `${state.backend}/stream`;
  if (state.es) state.es.close();
  const es = new EventSource(url);
  state.es = es;
  es.onopen = () => setStatus('Connected');
  es.onerror = () => setStatus('Connection error');
  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data?.type === 'standings') {
        renderStandings(data.items || []);
      }
    } catch {
      // ignore non-JSON payloads
    }
  };
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

