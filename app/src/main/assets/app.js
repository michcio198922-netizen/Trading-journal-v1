const STORAGE = {
  trades: 'smcJournal.trades.v1',
  reviews: 'smcJournal.reviews.v1'
};

const CONFLUENCES = [
  'HTF 1D/4H',
  'Liq Sweep',
  'IFVG 15m',
  'BOS 5m',
  'Divergencja',
  'SMT',
  '30m IFVG',
  'Session Sweep'
];

let trades = readJson(STORAGE.trades, []);
let reviews = readJson(STORAGE.reviews, []);
let deferredInstallPrompt = null;

const $ = (id) => document.getElementById(id);
const views = [...document.querySelectorAll('.view')];
const navButtons = [...document.querySelectorAll('.nav-btn')];

init();

function init() {
  renderConfluences();
  setDefaultDate();
  setRating(3);
  bindNavigation();
  bindTradeForm();
  bindHistory();
  bindReviewForm();
  renderAll();
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function saveTrades() {
  localStorage.setItem(STORAGE.trades, JSON.stringify(trades));
}

function saveReviews() {
  localStorage.setItem(STORAGE.reviews, JSON.stringify(reviews));
}

function renderConfluences() {
  const wrap = $('confluenceGrid');
  wrap.innerHTML = CONFLUENCES.map((name, i) => `
    <div class="check-chip">
      <input type="checkbox" id="conf-${i}" value="${escapeHtml(name)}" />
      <label for="conf-${i}">${escapeHtml(name)}</label>
    </div>
  `).join('');
}

function setDefaultDate() {
  $('tradeDate').value = toInputDate(new Date());
}

function bindNavigation() {
  navButtons.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
}

function switchView(name) {
  views.forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'dashboard') renderDashboard();
  if (name === 'history') renderHistory();
  if (name === 'review') renderReviews();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindTradeForm() {
  document.querySelectorAll('#ratingPicker button').forEach(btn => {
    btn.addEventListener('click', () => setRating(Number(btn.dataset.rating)));
  });

  $('tradeForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const result = document.querySelector('input[name="result"]:checked')?.value;
    if (!result) {
      toast('Wybierz wynik trade\'a.');
      return;
    }

    const selectedConfluences = [...document.querySelectorAll('#confluenceGrid input:checked')].map(el => el.value);
    const rr = Number(String($('tradeR').value).replace(',', '.'));
    if (!Number.isFinite(rr)) {
      toast('Wpisz poprawny wynik w R.');
      return;
    }
    const trade = {
      id: cryptoRandomId(),
      date: $('tradeDate').value,
      instrument: $('tradeInstrument').value,
      result,
      rr,
      confluences: selectedConfluences,
      rating: Number($('tradeRating').value || 3),
      note: $('tradeNote').value.trim(),
      createdAt: new Date().toISOString()
    };

    trades.push(trade);
    trades.sort(sortTradesAsc);
    saveTrades();
    $('tradeForm').reset();
    setDefaultDate();
    setRating(3);
    renderAll();
    toast('Trade zapisany.');
    switchView('dashboard');
  });
}

function setRating(value) {
  $('tradeRating').value = String(value);
  document.querySelectorAll('#ratingPicker button').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.rating) === value);
  });
}

function bindHistory() {
  $('historyFilter').addEventListener('change', renderHistory);
  $('historyList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-trade]');
    if (!button) return;
    const id = button.dataset.deleteTrade;
    const trade = trades.find(t => t.id === id);
    if (!trade) return;
    if (!confirm(`Usunąć trade ${trade.instrument} z ${formatDate(trade.date)}?`)) return;
    trades = trades.filter(t => t.id !== id);
    saveTrades();
    renderAll();
    toast('Trade usunięty.');
  });
}

function bindReviewForm() {
  $('reviewForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const weekKey = getWeekKey(new Date());
    const review = {
      id: cryptoRandomId(),
      weekKey,
      savedAt: new Date().toISOString(),
      bias: $('reviewBias').value.trim(),
      confluences: $('reviewConfluences').value.trim(),
      worked: $('reviewWorked').value.trim(),
      change: $('reviewChange').value.trim(),
      plan: $('reviewPlan').value.trim()
    };

    const existingIndex = reviews.findIndex(r => r.weekKey === weekKey);
    if (existingIndex >= 0) {
      review.id = reviews[existingIndex].id;
      reviews[existingIndex] = review;
    } else {
      reviews.push(review);
    }
    reviews.sort((a,b) => b.weekKey.localeCompare(a.weekKey));
    saveReviews();
    renderReviews();
    toast(existingIndex >= 0 ? 'Review zaktualizowany.' : 'Review zapisany.');
  });
}

function renderAll() {
  renderDashboard();
  renderHistory();
  renderReviews();
}

function renderDashboard() {
  const tp = trades.filter(t => t.result === 'TP').length;
  const sl = trades.filter(t => t.result === 'SL').length;
  const be = trades.filter(t => t.result === 'BE').length;
  const closed = tp + sl;
  const winRate = closed ? Math.round((tp / closed) * 100) : 0;
  const totalR = trades.reduce((sum, trade) => sum + tradeToR(trade), 0);
  const avgR = trades.length ? totalR / trades.length : 0;

  $('statWinRate').textContent = `${winRate}%`;
  $('statClosed').textContent = `${closed} rozstrzygniętych`;
  $('statTP').textContent = tp;
  $('statSL').textContent = sl;
  $('statBE').textContent = be;
  $('statTotalR').textContent = formatR(totalR);
  $('statAvgR').textContent = formatR(avgR);
  $('equityValue').textContent = formatR(totalR);

  const latest = [...trades].sort(sortTradesDesc).slice(0, 4);
  $('recentTrades').innerHTML = latest.length ? latest.map(t => tradeCardHtml(t, false)).join('') : 'Brak trade\'ów. Dodaj pierwszy setup.';
  $('recentTrades').classList.toggle('empty-state', latest.length === 0);
  drawEquityChart();
}

function renderHistory() {
  const filter = $('historyFilter').value;
  const list = [...trades].filter(t => filter === 'ALL' || t.result === filter).sort(sortTradesDesc);
  $('historyList').innerHTML = list.length ? list.map(t => tradeCardHtml(t, true)).join('') : 'Brak trade\'ów dla wybranego filtra.';
  $('historyList').classList.toggle('empty-state', list.length === 0);
}

function tradeCardHtml(trade, deletable) {
  const confluences = trade.confluences?.length
    ? trade.confluences.map(c => `<span class="mini-chip">${escapeHtml(c)}</span>`).join('')
    : '<span class="mini-chip">bez zaznaczonych confluencji</span>';

  return `
    <article class="trade-card">
      <div class="trade-top">
        <div class="trade-main">
          <div class="trade-title">
            <span class="result-badge ${trade.result}">${trade.result}</span>
            <span>${escapeHtml(trade.instrument || 'NQ')}</span>
            <span class="rr-badge ${tradeToR(trade) > 0 ? 'positive' : tradeToR(trade) < 0 ? 'negative' : 'flat'}">${formatR(tradeToR(trade))}</span>
            <span>Setup ${Number(trade.rating || 0)}/5</span>
          </div>
          <div class="trade-meta">${formatDate(trade.date)} • ${trade.confluences?.length || 0} confluencji</div>
        </div>
        ${deletable ? `<button class="danger-btn" type="button" data-delete-trade="${trade.id}">Usuń</button>` : ''}
      </div>
      <div class="confluence-row">${confluences}</div>
      ${trade.note ? `<div class="trade-note">${escapeHtml(trade.note)}</div>` : ''}
    </article>
  `;
}

function renderReviews() {
  const currentWeek = getWeekKey(new Date());
  $('reviewWeekLabel').textContent = `Tydzień ${formatWeekLabel(currentWeek)}`;

  const current = reviews.find(r => r.weekKey === currentWeek);
  $('reviewBias').value = current?.bias || '';
  $('reviewConfluences').value = current?.confluences || '';
  $('reviewWorked').value = current?.worked || '';
  $('reviewChange').value = current?.change || '';
  $('reviewPlan').value = current?.plan || '';

  const sorted = [...reviews].sort((a,b) => b.weekKey.localeCompare(a.weekKey)).slice(0, 8);
  $('reviewHistory').innerHTML = sorted.length ? sorted.map(review => `
    <details class="review-card">
      <summary>Tydzień ${formatWeekLabel(review.weekKey)}</summary>
      <dl>
        <dt>Bias</dt><dd>${escapeHtml(review.bias || '—')}</dd>
        <dt>Confluencje</dt><dd>${escapeHtml(review.confluences || '—')}</dd>
        <dt>Co zadziałało</dt><dd>${escapeHtml(review.worked || '—')}</dd>
        <dt>Co zmienić</dt><dd>${escapeHtml(review.change || '—')}</dd>
        <dt>Plan</dt><dd>${escapeHtml(review.plan || '—')}</dd>
      </dl>
    </details>
  `).join('') : 'Brak zapisanych review.';
  $('reviewHistory').classList.toggle('empty-state', sorted.length === 0);
}

function drawEquityChart() {
  const canvas = $('equityChart');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { l: 34, r: 12, t: 16, b: 26 };
  ctx.clearRect(0, 0, w, h);

  const ordered = [...trades].sort(sortTradesAsc);
  const series = [0];
  ordered.forEach(t => series.push(series[series.length - 1] + tradeToR(t)));

  if (series.length === 1) {
    ctx.fillStyle = '#707b8e';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Dodaj trade, aby zobaczyć equity curve', w / 2, h / 2);
    return;
  }

  const min = Math.min(...series, 0);
  const max = Math.max(...series, 0);
  const range = Math.max(2, max - min);
  const yMin = min - Math.max(.5, range * .15);
  const yMax = max + Math.max(.5, range * .15);
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const xFor = i => pad.l + (i / Math.max(1, series.length - 1)) * plotW;
  const yFor = v => pad.t + ((yMax - v) / (yMax - yMin)) * plotH;

  ctx.strokeStyle = '#222a36';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#768195';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const value = yMin + (i / 4) * (yMax - yMin);
    const y = yFor(value);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    ctx.fillText(`${value.toFixed(value % 1 ? 1 : 0)}R`, pad.l - 6, y + 3);
  }

  const gradient = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
  gradient.addColorStop(0, 'rgba(111,140,255,.28)');
  gradient.addColorStop(1, 'rgba(111,140,255,0)');

  ctx.beginPath();
  series.forEach((v, i) => {
    const x = xFor(i), y = yFor(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xFor(series.length - 1), h - pad.b);
  ctx.lineTo(xFor(0), h - pad.b);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  series.forEach((v, i) => {
    const x = xFor(i), y = yFor(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#7690ff';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  const last = series[series.length - 1];
  ctx.beginPath();
  ctx.arc(xFor(series.length - 1), yFor(last), 4, 0, Math.PI * 2);
  ctx.fillStyle = last > 0 ? '#28d17c' : last < 0 ? '#ff5d65' : '#f5c84c';
  ctx.fill();
}

function tradeToR(trade) {
  const value = Number(trade?.rr);
  if (Number.isFinite(value)) return value;
  if (trade?.result === 'TP') return 1;
  if (trade?.result === 'SL') return -1;
  return 0;
}

function formatR(value) {
  const n = Number(value) || 0;
  const rounded = Math.round(n * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded}R`;
}

function sortTradesAsc(a, b) {
  return `${a.date}|${a.createdAt}`.localeCompare(`${b.date}|${b.createdAt}`);
}

function sortTradesDesc(a, b) {
  return `${b.date}|${b.createdAt}`.localeCompare(`${a.date}|${a.createdAt}`);
}

function formatDate(value) {
  if (!value) return '—';
  const [y,m,d] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
}

function toInputDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function formatWeekLabel(key) {
  return key.replace('-W', ' / ');
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

window.addEventListener('resize', () => {
  if ($('view-dashboard').classList.contains('active')) drawEquityChart();
});
