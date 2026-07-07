/* ═══════════════════════════════════════════════════════════
   DIY Guardian v2 — Content Script (Gemini API)
   Flow: YouTube page → extract title+desc → Gemini → render
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  let panelHidden    = false;
  let currentVideoId = null;
  let currentRating  = 0;
  let checkedSteps   = new Set();

  // ── DOM refs ─────────────────────────────────────────────────────────────
  let $panel, $tab, $btnAnalyze, $body,
      $placeholder, $loading, $error, $results;

  // ── Boot ─────────────────────────────────────────────────────────────────
  injectFonts();
  buildPanel();
  watchNavigation();

  // ── Font injection ────────────────────────────────────────────────────────
  function injectFonts() {
    if (document.getElementById('dg-fonts')) return;
    const l = document.createElement('link');
    l.id   = 'dg-fonts';
    l.rel  = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=Outfit:wght@400;600;800&display=swap';
    document.head.appendChild(l);
  }

  // ── Build panel DOM ───────────────────────────────────────────────────────
  function buildPanel() {
    if (document.getElementById('diy-guardian-root')) return;

    const root = document.createElement('div');
    root.id = 'diy-guardian-root';

    // Toggle tab
    $tab = document.createElement('div');
    $tab.id        = 'dg-tab';
    $tab.textContent = 'DIY';
    $tab.title     = 'Tunjuk / Sorok panel';
    $tab.addEventListener('click', togglePanel);

    // Panel
    $panel = document.createElement('div');
    $panel.id = 'dg-panel';
    $panel.innerHTML = `
      <div id="dg-head">
        <div class="dg-logo">
          <div class="dg-logo-icon">🛡️</div>
          <div>
            <div>DIY Guardian</div>
            <div class="dg-powered">GEMINI AI</div>
          </div>
        </div>
        <button id="dg-btn-analyze">⚡ Analisis</button>
      </div>

      <div id="dg-body">
        <div id="dg-error"></div>

        <div id="dg-loading">
          <div class="dg-spinner"></div>
          <p>Menganalisis video…</p>
          <div class="dg-loading-sub">Mengesan kategori → Menganalisis risiko</div>
        </div>

        <div id="dg-placeholder">
          <div class="dg-big-icon">🔍</div>
          <p>Tekan <strong>⚡ Analisis</strong> untuk<br/>
          mendapatkan maklumat keselamatan,<br/>
          tahap kesukaran &amp; senarai langkah.</p>
        </div>

        <div id="dg-results" style="display:none"></div>
      </div>
    `;

    root.appendChild($tab);
    root.appendChild($panel);
    document.body.appendChild(root);

    // Cache refs
    $btnAnalyze  = $panel.querySelector('#dg-btn-analyze');
    $body        = $panel.querySelector('#dg-body');
    $placeholder = $panel.querySelector('#dg-placeholder');
    $loading     = $panel.querySelector('#dg-loading');
    $error       = $panel.querySelector('#dg-error');
    $results     = $panel.querySelector('#dg-results');

    $btnAnalyze.addEventListener('click', runAnalysis);
  }

  function togglePanel() {
    panelHidden = !panelHidden;
    $panel.classList.toggle('hidden', panelHidden);
    $tab.textContent = panelHidden ? '▶' : 'DIY';
  }

  // ── YouTube SPA navigation watcher ───────────────────────────────────────
  function watchNavigation() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        onUrlChange();
      }
    }).observe(document.body, { childList: true, subtree: true });
    onUrlChange();
  }

  function onUrlChange() {
    const vid = getVid();
    if (!vid || vid === currentVideoId) return;
    currentVideoId = vid;
    resetPanel();
    // Load cached analysis if available
    chrome.storage.local.get([`dg_v2_${vid}`, `dg_notes_${vid}`, `dg_rating_${vid}`, `dg_checked_${vid}`], (r) => {
      if (r[`dg_v2_${vid}`]) {
        currentRating = r[`dg_rating_${vid}`] || 0;
        checkedSteps  = new Set(r[`dg_checked_${vid}`] || []);
        renderResults(r[`dg_v2_${vid}`], r[`dg_notes_${vid}`] || '');
      }
    });
  }

  function getVid() {
    return new URLSearchParams(location.search).get('v');
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function resetPanel() {
    currentRating = 0;
    checkedSteps  = new Set();
    $results.style.display = 'none';
    $results.innerHTML     = '';
    $error.style.display   = 'none';
    $loading.style.display = 'none';
    $placeholder.style.display = 'block';
    $btnAnalyze.disabled   = false;
    $btnAnalyze.textContent = '⚡ Analisis';
  }

  // ── Scrape video metadata ─────────────────────────────────────────────────
  async function scrapeVideoMeta() {
    // Give YouTube time to render
    await sleep(900);

    const title = (
      document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent ||
      document.querySelector('#title h1')?.textContent ||
      document.querySelector('h1.title')?.textContent ||
      document.title.replace(' - YouTube', '')
    ).trim();

    // Try expanding description first
    const expandBtn = document.querySelector('#expand, #description tp-yt-paper-button');
    if (expandBtn) expandBtn.click();
    await sleep(300);

    const descEl = (
      document.querySelector('#description-inline-expander yt-attributed-string') ||
      document.querySelector('#description yt-formatted-string') ||
      document.querySelector('#meta-contents #description') ||
      document.querySelector('#snippet-text')
    );
    const description = (descEl?.textContent || '').trim().slice(0, 1000);

    const channel = (
      document.querySelector('#channel-name a')?.textContent ||
      document.querySelector('ytd-channel-name a')?.textContent ||
      ''
    ).trim();

    return { title, description, channel };
  }

  // ── Build Gemini prompt ───────────────────────────────────────────────────
  function buildPrompt({ title, description, channel }) {
    return `Anda adalah pakar keselamatan kerja DIY. Analisis maklumat video YouTube berikut.

TAJUK VIDEO: "${title}"
CHANNEL: "${channel}"
DESKRIPSI: "${description}"

Tentukan sama ada ini adalah video DIY/tutorial/kerja teknikal atau bukan.

Balas HANYA dengan JSON yang sah (tiada teks lain, tiada markdown backtick):

{
  "isDIY": true,
  "category": "kategori ringkas cth: Elektrik, Paip, Automotif, Kayu, dll",
  "summary": "1-2 ayat ringkasan apa yang dilakukan dalam video",
  "difficulty": "Mudah" | "Sederhana" | "Sukar",
  "difficultyScore": 1-10,
  "risk": "Rendah" | "Sederhana" | "Tinggi",
  "riskScore": 1-10,
  "safetyAlerts": [
    { "level": "danger" | "warning" | "info", "text": "amaran atau nota penting" }
  ],
  "ppe": [
    { "name": "nama alat perlindungan", "emoji": "emoji", "required": true | false }
  ],
  "steps": [
    "langkah 1 ringkas",
    "langkah 2",
    "langkah 3"
  ],
  "safeTips": [
    "tip keselamatan 1",
    "tip keselamatan 2"
  ],
  "notDIYReason": ""
}

Jika BUKAN video DIY: set isDIY ke false, isi notDIYReason, kosongkan array lain.
Had: 3 safetyAlerts, 4 ppe, 6 steps, 3 safeTips.
WAJIB balas dalam Bahasa Malaysia. WAJIB JSON sahaja, tanpa sebarang teks lain.`;
  }

  // ── Main analysis flow ────────────────────────────────────────────────────
  async function runAnalysis() {
    const vid = getVid();
    if (!vid) return;

    // UI: loading
    $placeholder.style.display = 'none';
    $results.style.display     = 'none';
    $error.style.display       = 'none';
    $loading.style.display     = 'block';
    $btnAnalyze.disabled       = true;
    $btnAnalyze.textContent    = '⏳ Menganalisis…';

    try {
      // ① Extract metadata
      const meta = await scrapeVideoMeta();
      if (!meta.title) throw new Error('Tidak dapat mengesan tajuk video. Cuba refresh halaman.');

      // ② Hantar ke background untuk rule-based analysis
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'ANALYZE', payload: { title: meta.title, description: meta.description } },
          (response) => {
            if (chrome.runtime.lastError) {
              return reject(new Error('Background tidak aktif. Cuba refresh halaman.'));
            }
            if (!response) {
              return reject(new Error('Tiada respons dari background.'));
            }
            if (!response.ok) {
              return reject(new Error(response.error));
            }
            resolve(response.data);
          }
        );
      });

      // ③ Cache & render
      chrome.storage.local.set({ [`dg_v2_${vid}`]: result });
      $loading.style.display = 'none';
      renderResults(result, '');

    } catch (err) {
      $loading.style.display = 'none';
      showError(`❌ ${err.message}`);
      $btnAnalyze.disabled    = false;
      $btnAnalyze.textContent = '⚡ Cuba Semula';
    }
  }

  // ── Render results ─────────────────────────────────────────────────────────
  function renderResults(r, savedNotes) {
    $placeholder.style.display = 'none';
    $loading.style.display     = 'none';
    $btnAnalyze.disabled       = false;
    $btnAnalyze.textContent    = '🔄 Semula';

    if (!r.isDIY) {
      $results.innerHTML = `
        <div class="dg-card">
          <div class="dg-card-title">📹 Pengesanan Video</div>
          <div class="dg-not-diy">
            <div class="big">🤷</div>
            <p>${r.notDIYReason || 'Video ini nampaknya bukan video DIY atau tutorial kerja tangan.'}</p>
          </div>
        </div>`;
      $results.style.display = 'block';
      return;
    }

    // ── helpers ──
    const diff     = (r.difficulty || '').toLowerCase();   // mudah/sederhana/sukar
    const riskKey  = (r.risk || '').toLowerCase();         // rendah/sederhana/tinggi

    // risk CSS class (avoid clash with difficulty 'sederhana')
    const riskClass = riskKey === 'sederhana' ? 'risiko-sederhana' : riskKey;

    const alertIconMap = { danger: '🚨', warning: '⚠️', info: 'ℹ️', safe: '✅' };

    // ── Build HTML sections ──
    const htmlCategory = `
      <div class="dg-card">
        <div class="dg-card-title">📹 Jenis Kerja</div>
        <div class="dg-category-badge">🔧 ${r.category || 'DIY'}</div>
        <div class="dg-summary-text">${r.summary || ''}</div>
      </div>`;

    const htmlMeters = `
      <div class="dg-meters-row">
        <div class="dg-meter-box">
          <div class="dg-meter-label">📊 Kesukaran</div>
          <div class="dg-meter-value ${diff}">${r.difficulty || '—'}</div>
          <div class="dg-bar"><div class="dg-bar-fill ${diff}"></div></div>
        </div>
        <div class="dg-meter-box">
          <div class="dg-meter-label">⚠️ Risiko</div>
          <div class="dg-meter-value ${riskClass === 'risiko-sederhana' ? 'sederhana' : riskKey}">${r.risk || '—'}</div>
          <div class="dg-bar"><div class="dg-bar-fill ${riskClass}"></div></div>
        </div>
      </div>`;

    const alertsHTML = (r.safetyAlerts || []).map(a => `
      <div class="dg-alert ${a.level}">
        <div class="dg-alert-icon">${alertIconMap[a.level] || '⚠️'}</div>
        <div class="dg-alert-text">${a.text}</div>
      </div>`).join('');
    const htmlAlerts = alertsHTML ? `
      <div class="dg-card">
        <div class="dg-card-title">🚨 Amaran Keselamatan</div>
        ${alertsHTML}
      </div>` : '';

    const ppeHTML = (r.ppe || []).map(p => `
      <div class="dg-ppe-item ${p.required ? 'req' : ''}">
        <span class="dg-ppe-emoji">${p.emoji || '🔧'}</span>
        <span>${p.name}</span>
      </div>`).join('');
    const htmlPPE = ppeHTML ? `
      <div class="dg-card">
        <div class="dg-card-title">🦺 Kelengkapan PPE</div>
        <div style="font-size:10px;color:var(--muted);margin-bottom:8px;">Merah = wajib dipakai</div>
        <div class="dg-ppe-grid">${ppeHTML}</div>
      </div>` : '';

    const stepsHTML = (r.steps || []).map((s, i) => `
      <li class="dg-step ${checkedSteps.has(i) ? 'done' : ''}" data-i="${i}">
        <div class="dg-step-num">${checkedSteps.has(i) ? '✓' : i + 1}</div>
        <div>${s}</div>
      </li>`).join('');
    const htmlSteps = stepsHTML ? `
      <div class="dg-card">
        <div class="dg-card-title">📋 Senarai Langkah</div>
        <ul class="dg-steps" id="dg-steps">${stepsHTML}</ul>
      </div>` : '';

    const tipsHTML = (r.safeTips || []).map(t => `
      <div class="dg-alert safe">
        <div class="dg-alert-icon">✅</div>
        <div class="dg-alert-text">${t}</div>
      </div>`).join('');
    const htmlTips = tipsHTML ? `
      <div class="dg-card">
        <div class="dg-card-title">💡 Tip Selamat</div>
        ${tipsHTML}
      </div>` : '';

    const ratingLabels = ['', 'Masih keliru', 'Faham sedikit', 'Faham', 'Faham dengan baik', 'Faham sepenuhnya'];
    const starsHTML = [1,2,3,4,5].map(n => `
      <span class="dg-star ${currentRating >= n ? 'on' : ''}" data-n="${n}">⭐</span>`).join('');
    const htmlRating = `
      <div class="dg-card">
        <div class="dg-card-title">⭐ Tahap Kefahaman Anda</div>
        <div class="dg-stars" id="dg-stars">${starsHTML}</div>
        <div class="dg-rating-label" id="dg-rlabel">${currentRating ? ratingLabels[currentRating] : 'Klik bintang untuk nilai kefahaman'}</div>
      </div>`;

    const htmlNotes = `
      <div class="dg-card">
        <div class="dg-card-title">📝 Nota Saya</div>
        <textarea id="dg-notes" placeholder="Tulis nota untuk video ini…">${savedNotes}</textarea>
        <button id="dg-save-note">💾 Simpan Nota</button>
      </div>`;

    $results.innerHTML = htmlCategory + htmlMeters + htmlAlerts + htmlPPE + htmlSteps + htmlTips + htmlRating + htmlNotes;
    $results.style.display = 'block';

    bindEvents();
  }

  // ── Bind interactive events ───────────────────────────────────────────────
  function bindEvents() {
    const vid = getVid();

    // Checklist
    const stepsList = $results.querySelector('#dg-steps');
    if (stepsList) {
      stepsList.addEventListener('click', e => {
        const li = e.target.closest('.dg-step');
        if (!li) return;
        const i = parseInt(li.dataset.i);
        checkedSteps.has(i) ? checkedSteps.delete(i) : checkedSteps.add(i);
        li.classList.toggle('done');
        const num = li.querySelector('.dg-step-num');
        if (num) num.textContent = checkedSteps.has(i) ? '✓' : i + 1;
        chrome.storage.local.set({ [`dg_checked_${vid}`]: [...checkedSteps] });
      });
    }

    // Stars
    const starsEl = $results.querySelector('#dg-stars');
    const rlabel  = $results.querySelector('#dg-rlabel');
    const labels  = ['','Masih keliru','Faham sedikit','Faham','Faham dengan baik','Faham sepenuhnya'];
    if (starsEl) {
      starsEl.addEventListener('click', e => {
        const star = e.target.closest('.dg-star');
        if (!star) return;
        currentRating = parseInt(star.dataset.n);
        starsEl.querySelectorAll('.dg-star').forEach((s, i) => s.classList.toggle('on', i < currentRating));
        if (rlabel) rlabel.textContent = labels[currentRating];
        chrome.storage.local.set({ [`dg_rating_${vid}`]: currentRating });
      });
    }

    // Notes save
    const saveBtn  = $results.querySelector('#dg-save-note');
    const notesEl  = $results.querySelector('#dg-notes');
    if (saveBtn && notesEl) {
      saveBtn.addEventListener('click', () => {
        chrome.storage.local.set({ [`dg_notes_${vid}`]: notesEl.value });
        saveBtn.classList.add('saved');
        saveBtn.textContent = '✅ Tersimpan!';
        setTimeout(() => { saveBtn.classList.remove('saved'); saveBtn.textContent = '💾 Simpan Nota'; }, 2200);
      });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function showError(html) {
    $error.innerHTML     = html;
    $error.style.display = 'block';
    $placeholder.style.display = 'none';
  }

  function getStorage(keys) {
    return new Promise(r => chrome.storage.local.get(keys, r));
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

})();
