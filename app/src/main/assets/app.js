const STORAGE = {
  trades: 'smcJournal.trades.v1',
  reviews: 'smcJournal.reviews.v1'
};

const IMAGE_DB = {
  name: 'smcJournal.images.db',
  store: 'tradeScreenshots'
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

let trades = migrateTrades(readJson(STORAGE.trades, []));
let reviews = readJson(STORAGE.reviews, []);
let deferredInstallPrompt = null;
let imageDbPromise = null;

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
  bindBackup();
  bindScreenshotPreview();
  bindLightbox();
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

function migrateTrades(source) {
  return (Array.isArray(source) ? source : []).map((trade) => ({
    ...trade,
    direction: trade.direction || '',
    session: trade.session || '',
    model: trade.model || '',
    rr: Number.isFinite(Number(trade.rr)) ? Number(trade.rr) : (trade.result === 'TP' ? 1 : trade.result === 'SL' ? -1 : 0),
    confluences: Array.isArray(trade.confluences) ? trade.confluences : [],
    rating: Number(trade.rating || 3),
    note: trade.note || '',
    mistake: Boolean(trade.mistake),
    planFollowed: trade.planFollowed !== false,
    mistakeType: trade.mistakeType || '',
    emotion: trade.emotion || 'Neutral',
    screenshotCount: Number(trade.screenshotCount || 0),
    createdAt: trade.createdAt || new Date().toISOString()
  }));
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

  $('tradeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = document.querySelector('input[name="result"]:checked')?.value;
    if (!result) {
      toast('Wybierz wynik trade\'a.');
      return;
    }

    const direction = document.querySelector('input[name="direction"]:checked')?.value;
    if (!direction) {
      toast('Wybierz LONG albo SHORT.');
      return;
    }

    const model = $('tradeModel').value.trim();
    if (!model) {
      toast('Wpisz setup / model wejścia.');
      return;
    }

    const selectedConfluences = [...document.querySelectorAll('#confluenceGrid input:checked')].map(el => el.value);
    const rr = Number(String($('tradeR').value).replace(',', '.'));
    if (!Number.isFinite(rr)) {
      toast('Wpisz poprawny wynik w R.');
      return;
    }

    const screenshotFiles = [...($('tradeScreenshots').files || [])];

    const trade = {
      id: cryptoRandomId(),
      date: $('tradeDate').value,
      instrument: $('tradeInstrument').value,
      direction,
      session: $('tradeSession').value,
      model,
      result,
      rr,
      confluences: selectedConfluences,
      rating: Number($('tradeRating').value || 3),
      note: $('tradeNote').value.trim(),
      mistake: $('tradeMistake').checked,
      planFollowed: $('tradePlanFollowed').checked,
      mistakeType: $('tradeMistakeType').value,
      emotion: $('tradeEmotion').value,
      screenshotCount: screenshotFiles.length,
      createdAt: new Date().toISOString()
    };

    try {
      if (screenshotFiles.length) {
        const shots = await Promise.all(screenshotFiles.map(fileToCompressedDataUrl));
        await saveTradeScreenshots(trade.id, shots);
      }

      trades.push(trade);
      trades.sort(sortTradesAsc);
      saveTrades();
      $('tradeForm').reset();
      setDefaultDate();
      setRating(3);
      clearScreenshotPreview();
      renderAll();
      toast('Trade zapisany.');
      switchView('dashboard');
    } catch (error) {
      console.error(error);
      toast('Nie udało się zapisać screenshotów. Spróbuj z mniejszymi obrazkami.');
    }
  });
}

function setRating(value) {
  $('tradeRating').value = String(value);
  document.querySelectorAll('#ratingPicker button').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.rating) === value);
  });
}

function bindHistory() {
  ['historyFilter','historyInstrument','historySession','historyDirection'].forEach(id => $(id).addEventListener('change', renderHistory));
  $('historyList').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-trade]');
    if (button) {
      const id = button.dataset.deleteTrade;
      const trade = trades.find(t => t.id === id);
      if (!trade) return;
      if (!confirm(`Usunąć trade ${trade.instrument} z ${formatDate(trade.date)}?`)) return;
      trades = trades.filter(t => t.id !== id);
      saveTrades();
      await deleteTradeScreenshots(id);
      renderAll();
      toast('Trade usunięty.');
      return;
    }

    const image = event.target.closest('[data-shot-src]');
    if (image) openLightbox(image.dataset.shotSrc);
  });

  $('recentTrades').addEventListener('click', (event) => {
    const image = event.target.closest('[data-shot-src]');
    if (image) openLightbox(image.dataset.shotSrc);
  });
}

function bindBackup() {
  const exportBtn = $('exportBackupBtn');
  const importBtn = $('importBackupBtn');
  const importFile = $('backupImportFile');
  if (!exportBtn || !importBtn || !importFile) return;

  exportBtn.addEventListener('click', async () => {
    try {
      toast('Przygotowuję backup...');
      const payload = await buildBackupPayload();
      const json = JSON.stringify(payload);

      if (window.AndroidBackupBridge?.exportBackup) {
        window.AndroidBackupBridge.exportBackup(json);
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backupFileName();
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast('Backup wyeksportowany.');
      }
    } catch (error) {
      console.error(error);
      toast('Nie udało się utworzyć backupu.');
    }
  });

  importBtn.addEventListener('click', () => {
    if (window.AndroidBackupBridge?.importBackup) {
      window.AndroidBackupBridge.importBackup();
    } else {
      importFile.click();
    }
  });

  importFile.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await restoreBackup(await file.text());
    } catch (error) {
      console.error(error);
      toast('Nie udało się wczytać backupu.');
    } finally {
      importFile.value = '';
    }
  });
}

window.importBackupFromNative = async function(rawJson) {
  try {
    await restoreBackup(rawJson);
  } catch (error) {
    console.error(error);
    toast('Nie udało się wczytać backupu.');
  }
};

window.backupExportFinished = function(success) {
  toast(success ? 'Backup zapisany.' : 'Anulowano zapis backupu.');
};

async function buildBackupPayload() {
  const screenshots = {};
  for (const trade of trades) {
    const shots = await getTradeScreenshots(trade.id);
    if (shots.length) screenshots[trade.id] = shots;
  }

  return {
    type: 'SMC_TRADING_JOURNAL_BACKUP',
    schemaVersion: 1,
    appVersion: '5.1',
    exportedAt: new Date().toISOString(),
    trades,
    reviews,
    screenshots
  };
}

async function restoreBackup(rawJson) {
  const parsed = JSON.parse(rawJson);
  if (!parsed || parsed.type !== 'SMC_TRADING_JOURNAL_BACKUP' || !Array.isArray(parsed.trades) || !Array.isArray(parsed.reviews)) {
    throw new Error('Nieprawidłowy format backupu');
  }

  if (!confirm(`Import zastąpi obecne dane. Przywrócić ${parsed.trades.length} trade'ów i ${parsed.reviews.length} review?`)) {
    toast('Import anulowany.');
    return;
  }

  const importedTrades = migrateTrades(parsed.trades);
  const importedReviews = parsed.reviews;
  const screenshots = parsed.screenshots && typeof parsed.screenshots === 'object' ? parsed.screenshots : {};

  await clearAllScreenshots();
  for (const trade of importedTrades) {
    const shots = Array.isArray(screenshots[trade.id]) ? screenshots[trade.id] : [];
    if (shots.length) await saveTradeScreenshots(trade.id, shots);
    trade.screenshotCount = shots.length;
  }

  trades = importedTrades.sort(sortTradesAsc);
  reviews = importedReviews;
  saveTrades();
  saveReviews();
  renderAll();
  toast('Backup przywrócony.');
}

function backupFileName() {
  const now = new Date();
  return `SMC-Trading-Journal-backup-${toInputDate(now)}.json`;
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

function bindScreenshotPreview() {
  $('tradeScreenshots').addEventListener('change', async (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) {
      clearScreenshotPreview();
      return;
    }
    $('screenshotPreview').classList.remove('empty-state');
    $('screenshotPreview').innerHTML = '<div class="mini-loading">Ładowanie podglądu...</div>';
    try {
      const previews = await Promise.all(files.map(fileToCompressedDataUrl));
      $('screenshotPreview').innerHTML = previews.map((src, index) => `
        <button type="button" class="shot-thumb preview-thumb" data-shot-src="${src}" aria-label="Podgląd screenshotu ${index + 1}">
          <img src="${src}" alt="Podgląd screenshotu ${index + 1}" />
        </button>
      `).join('');
    } catch (error) {
      console.error(error);
      clearScreenshotPreview();
      toast('Nie udało się wczytać screenshotów.');
    }
  });

  $('screenshotPreview').addEventListener('click', (event) => {
    const image = event.target.closest('[data-shot-src]');
    if (image) openLightbox(image.dataset.shotSrc);
  });
}

function clearScreenshotPreview() {
  const preview = $('screenshotPreview');
  preview.innerHTML = 'Nie wybrano screenshotów.';
  preview.classList.add('empty-state');
}

function bindLightbox() {
  $('lightboxClose').addEventListener('click', closeLightbox);
  $('lightbox').addEventListener('click', (event) => {
    if (event.target.id === 'lightbox') closeLightbox();
  });
}

function openLightbox(src) {
  $('lightboxImage').src = src;
  $('lightbox').hidden = false;
  document.body.classList.add('lightbox-open');
}

function closeLightbox() {
  $('lightbox').hidden = true;
  $('lightboxImage').src = '';
  document.body.classList.remove('lightbox-open');
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
  const mistakes = trades.filter(t => t.mistake).length;
  const mistakeRate = trades.length ? Math.round((mistakes / trades.length) * 100) : 0;

  $('statWinRate').textContent = `${winRate}%`;
  $('statClosed').textContent = `${closed} rozstrzygniętych`;
  $('statTP').textContent = tp;
  $('statSL').textContent = sl;
  $('statBE').textContent = be;
  $('statMistakes').textContent = mistakes;
  $('statMistakeRate').textContent = `${mistakeRate}% wszystkich trade'ów`;
  const expectancy = trades.length ? totalR / trades.length : 0;
  const grossWin = trades.filter(t => tradeToR(t) > 0).reduce((sum,t) => sum + tradeToR(t), 0);
  const grossLossAbs = Math.abs(trades.filter(t => tradeToR(t) < 0).reduce((sum,t) => sum + tradeToR(t), 0));
  const profitFactor = grossLossAbs ? grossWin / grossLossAbs : (grossWin > 0 ? Infinity : 0);
  const winners = trades.filter(t => tradeToR(t) > 0);
  const losers = trades.filter(t => tradeToR(t) < 0);
  const avgWinner = winners.length ? winners.reduce((s,t) => s + tradeToR(t), 0) / winners.length : 0;
  const avgLoser = losers.length ? losers.reduce((s,t) => s + tradeToR(t), 0) / losers.length : 0;
  $('statExpectancy').textContent = formatR(expectancy);
  $('statProfitFactor').textContent = Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞';
  $('statDrawdown').textContent = formatR(calculateMaxDrawdown(trades));
  $('statAvgWL').textContent = `${formatR(avgWinner)} / ${formatR(avgLoser)}`;
  $('statTotalR').textContent = formatR(totalR);
  $('statAvgR').textContent = formatR(avgR);
  $('equityValue').textContent = formatR(totalR);

  const latest = [...trades].sort(sortTradesDesc).slice(0, 4);
  $('recentTrades').innerHTML = latest.length ? latest.map(t => tradeCardHtml(t, false)).join('') : 'Brak trade\'ów. Dodaj pierwszy setup.';
  $('recentTrades').classList.toggle('empty-state', latest.length === 0);
  renderEdgeAnalytics();
  drawEquityChart();
  hydrateVisibleScreenshots();
}

function renderHistory() {
  const filter = $('historyFilter').value;
  const instrument = $('historyInstrument').value;
  const session = $('historySession').value;
  const direction = $('historyDirection').value;
  const list = [...trades].filter(t => {
    const resultOk = filter === 'ALL' || (filter === 'MISTAKE' ? t.mistake : t.result === filter);
    const instrumentOk = instrument === 'ALL' || t.instrument === instrument;
    const sessionOk = session === 'ALL' || t.session === session;
    const directionOk = direction === 'ALL' || t.direction === direction;
    return resultOk && instrumentOk && sessionOk && directionOk;
  }).sort(sortTradesDesc);
  $('historyList').innerHTML = list.length ? list.map(t => tradeCardHtml(t, true)).join('') : 'Brak trade\'ów dla wybranego filtra.';
  $('historyList').classList.toggle('empty-state', list.length === 0);
  hydrateVisibleScreenshots();
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
            ${trade.direction ? `<span class="direction-badge ${trade.direction}">${escapeHtml(trade.direction)}</span>` : ''}
            <span class="rr-badge ${tradeToR(trade) > 0 ? 'positive' : tradeToR(trade) < 0 ? 'negative' : 'flat'}">${formatR(tradeToR(trade))}</span>
            <span>Setup ${Number(trade.rating || 0)}/5</span>
            ${trade.mistake ? '<span class="mistake-badge">BŁĄD</span>' : '<span class="mistake-badge clean">PLAN</span>'}
          </div>
          <div class="trade-meta">${formatDate(trade.date)} • ${escapeHtml(trade.session || 'bez sesji')} • ${trade.confluences?.length || 0} confluencji • ${trade.screenshotCount || 0} screenów</div>
          ${trade.model ? `<div class="trade-model">${escapeHtml(trade.model)}</div>` : ''}
          <div class="process-row"><span class="mini-chip">${trade.planFollowed !== false ? 'Plan ✓' : 'Plan ✕'}</span><span class="mini-chip">Emocja: ${escapeHtml(trade.emotion || 'Neutral')}</span>${trade.mistakeType ? `<span class="mini-chip mistake-chip">${escapeHtml(trade.mistakeType)}</span>` : ''}</div>
        </div>
        ${deletable ? `<button class="danger-btn" type="button" data-delete-trade="${trade.id}">Usuń</button>` : ''}
      </div>
      <div class="confluence-row">${confluences}</div>
      ${trade.note ? `<div class="trade-note">${escapeHtml(trade.note)}</div>` : ''}
      <div class="screenshot-grid trade-shot-grid" data-trade-shots="${trade.id}">
        ${trade.screenshotCount ? '<div class="mini-loading">Ładowanie screenshotów...</div>' : '<div class="no-shots">Brak screenshotów.</div>'}
      </div>
    </article>
  `;
}

function renderEdgeAnalytics() {
  renderConfluenceStats();
  renderGroupedStats('sessionStats', trades.filter(t => t.session), t => t.session, 4);
  renderGroupedStats('directionStats', trades.filter(t => t.direction), t => t.direction, 2);
  renderGroupedStats('mistakeStats', trades, t => t.mistake ? 'Z błędem' : 'Bez błędu', 2);
  renderGroupedStats('modelStats', trades.filter(t => t.model), t => t.model.trim(), 8);
}

function renderConfluenceStats() {
  const rows = CONFLUENCES.map(name => {
    const sample = trades.filter(t => Array.isArray(t.confluences) && t.confluences.includes(name));
    return buildEdgeRow(name, sample);
  }).filter(row => row.count > 0)
    .sort((a, b) => b.avgR - a.avgR || b.winRate - a.winRate || b.count - a.count);

  renderEdgeRows('confluenceStats', rows, 8);
}

function renderGroupedStats(targetId, sourceTrades, keyFn, limit = 8) {
  const groups = new Map();
  sourceTrades.forEach(trade => {
    const rawKey = keyFn(trade);
    const key = String(rawKey || '').trim();
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  });

  const rows = [...groups.entries()]
    .map(([name, sample]) => buildEdgeRow(name, sample))
    .sort((a, b) => b.avgR - a.avgR || b.winRate - a.winRate || b.count - a.count);

  renderEdgeRows(targetId, rows, limit);
}

function buildEdgeRow(name, sample) {
  const tp = sample.filter(t => t.result === 'TP').length;
  const sl = sample.filter(t => t.result === 'SL').length;
  const closed = tp + sl;
  const winRate = closed ? (tp / closed) * 100 : 0;
  const totalR = sample.reduce((sum, trade) => sum + tradeToR(trade), 0);
  const avgR = sample.length ? totalR / sample.length : 0;
  return { name, count: sample.length, winRate, totalR, avgR };
}

function renderEdgeRows(targetId, rows, limit) {
  const target = $(targetId);
  const visible = rows.slice(0, limit);
  if (!visible.length) {
    target.innerHTML = 'Brak danych do analizy.';
    target.classList.add('empty-state');
    return;
  }

  target.classList.remove('empty-state');
  target.innerHTML = `
    <div class="edge-row edge-head">
      <span>Nazwa</span><span>Trade</span><span>WR</span><span>Śr. R</span><span>Σ R</span>
    </div>
    ${visible.map(row => `
      <div class="edge-row">
        <strong>${escapeHtml(row.name)}</strong>
        <span>${row.count}</span>
        <span>${Math.round(row.winRate)}%</span>
        <span class="${row.avgR > 0 ? 'metric-positive' : row.avgR < 0 ? 'metric-negative' : 'metric-flat'}">${formatR(row.avgR)}</span>
        <span class="${row.totalR > 0 ? 'metric-positive' : row.totalR < 0 ? 'metric-negative' : 'metric-flat'}">${formatR(row.totalR)}</span>
      </div>
    `).join('')}
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

async function hydrateVisibleScreenshots() {
  const containers = [...document.querySelectorAll('[data-trade-shots]')];
  await Promise.all(containers.map(async (container) => {
    const tradeId = container.dataset.tradeShots;
    const shots = await getTradeScreenshots(tradeId);
    if (!shots.length) {
      container.innerHTML = '<div class="no-shots">Brak screenshotów.</div>';
      return;
    }
    container.innerHTML = shots.map((src, index) => `
      <button type="button" class="shot-thumb" data-shot-src="${src}" aria-label="Otwórz screenshot ${index + 1}">
        <img src="${src}" alt="Screenshot trade\'a ${index + 1}" />
      </button>
    `).join('');
  }));
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

function calculateMaxDrawdown(source) {
  const ordered = [...source].sort(sortTradesAsc);
  let equity = 0, peak = 0, maxDd = 0;
  ordered.forEach(t => {
    equity += tradeToR(t);
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak - equity);
  });
  return -maxDd;
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

async function fileToCompressedDataUrl(file) {
  const imgData = await readFileAsDataUrl(file);
  const image = await loadImage(imgData);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function openImageDb() {
  if (imageDbPromise) return imageDbPromise;
  imageDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB.name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_DB.store)) {
        db.createObjectStore(IMAGE_DB.store);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return imageDbPromise;
}

async function saveTradeScreenshots(tradeId, shots) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_DB.store, 'readwrite');
    tx.objectStore(IMAGE_DB.store).put(shots, tradeId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getTradeScreenshots(tradeId) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_DB.store, 'readonly');
    const req = tx.objectStore(IMAGE_DB.store).get(tradeId);
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
    req.onerror = () => reject(req.error);
  }).catch(() => []);
}

async function deleteTradeScreenshots(tradeId) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_DB.store, 'readwrite');
    tx.objectStore(IMAGE_DB.store).delete(tradeId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  }).catch(() => false);
}

async function clearAllScreenshots() {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_DB.store, 'readwrite');
    tx.objectStore(IMAGE_DB.store).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  }).catch(() => false);
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
