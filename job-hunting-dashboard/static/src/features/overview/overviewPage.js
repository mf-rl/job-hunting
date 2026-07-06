
import { ICONS } from '../../shared/icons.js';
import { esc, timeAgo } from '../../shared/formatters.js';
import { setGaugeArc, setGaugeValue, setFunnelValue } from '../../shared/widgets.js';
import { overviewService } from './overviewService.js';

let pollInterval = null;
const overviewTailorState = {};
// ── Overview page ──────────────────────────────────────
function buildOverviewView() {
  const div = document.createElement('div');
  div.className = 'fx-view active';
  div.dataset.view = 'overview';

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  div.innerHTML = `
    <!-- Hero Panel -->
    <div class="card card-accent" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
        <div>
          <div class="eyebrow-line">Good Morning</div>
          <h1 class="hero-title">FORGE · Job-Hunting Mission Control</h1>
          <p style="color:var(--text-secondary);font-size:13px;margin-top:6px;">${dateStr} — Coordinating <strong style="color:var(--text);">Forge</strong>, <strong style="color:var(--text);">Scout</strong>, <strong style="color:var(--text);">Job Reader</strong>, and <strong style="color:var(--text);">CV Adapter</strong> to find your next opportunity.</p>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;" id="hero-chips">
                    <span class="chip"><span class="chip-dot on"></span><span id="chip-model-hero">--</span></span>
                    <span class="chip"><span class="chip-dot on"></span>Gateway</span>
                    <span class="chip"><span class="chip-dot on"></span>Slack</span>
                    <button class="btn btn-primary" id="btn-find" style="padding:6px 16px;font-size:12px;display:inline-flex;align-items:center;gap:6px;"><span id="btn-find-icon">&#9889;</span> <span id="btn-find-text">Find Jobs</span></button>
                  </div>
        </div>
      </div>
    </div>

    <!-- Two Ring Gauges side by side -->
    <div class="grid grid-2" style="margin-bottom:20px;">
      <!-- Tokenized Load Gauge -->
      <div class="card card-accent gauge-card" id="gauge-token-card">
        <div class="card-label">Tokenized Load</div>
        <div class="gauge-wrap">
          <div class="gauge-ring" id="gauge-tokens-ring">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle class="gauge-bg" cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
              <circle class="gauge-arc" id="gauge-tokens-arc" cx="70" cy="70" r="58" fill="none" stroke="url(#goldGrad)" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="364.42" stroke-dashoffset="364.42" data-gauge-arc="tokens"/>
              <defs><linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#EAC266"/><stop offset="100%" stop-color="#D4A84A"/></linearGradient></defs>
            </svg>
            <div class="gauge-value" data-gauge-value="tokens">--</div>
          </div>
          <div class="gauge-sub-text"><span data-gauge-sub="tokens">--</span> / <span data-gauge-total="tokens">1M</span> used</div>
          <div style="display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:12px;color:var(--text-faint);">
            <span>Matched: <strong style="color:var(--gold);" id="gauge-matched-sub">--</strong></span>
            <span>Read: <strong style="color:var(--sky);" id="gauge-read-sub">--</strong></span>
          </div>
        </div>
      </div>
      <!-- Jobs Indexed Gauge -->
      <div class="card card-accent gauge-card" id="gauge-jobs-card">
        <div class="card-label">Jobs Indexed</div>
        <div class="gauge-wrap">
          <div class="gauge-ring" id="gauge-jobs-ring">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle class="gauge-bg" cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
              <circle class="gauge-arc" id="gauge-jobs-arc" cx="70" cy="70" r="58" fill="none" stroke="url(#goldGrad)" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="364.42" stroke-dashoffset="364.42" data-gauge-arc="jobs"/>
            </svg>
            <div class="gauge-value" data-gauge-value="jobs">--</div>
          </div>
          <div class="gauge-sub-text">total across all sources</div>
          <div style="display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:12px;color:var(--text-faint);">
            <span>Matched: <strong style="color:var(--gold);" id="gauge-matched2-sub">--</strong></span>
            <span>Tailored: <strong style="color:var(--coral);" id="gauge-tailored-sub">--</strong></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Fleet Cards -->
    <div class="fleet-grid" id="fleet-grid">
      <div class="card fleet-card" data-agent="forge" style="--agent-color:var(--color-forge)">
        <div class="fleet-avatar">FRG</div>
        <div class="fleet-name">Forge</div>
        <div class="fleet-role">Coordinator</div>
        <div class="fleet-status live"><span class="fleet-status-dot"></span><span class="fleet-label">LIVE</span></div>
        <div class="fleet-count" style="color:var(--color-forge)" id="fcnt-forge">--</div>
        <div class="fleet-rate" id="frate-forge">--</div>
        <div class="fleet-last" id="flast-forge">--</div>
        <div class="fleet-model" id="fmodel-forge">--</div>
      </div>
      <div class="card fleet-card" data-agent="scout" style="--agent-color:var(--color-scout)">
        <div class="fleet-avatar">SCT</div>
        <div class="fleet-name">Scout</div>
        <div class="fleet-role">Job Search</div>
        <div class="fleet-status live"><span class="fleet-status-dot"></span><span class="fleet-label">LIVE</span></div>
        <div class="fleet-count" style="color:var(--color-scout)" id="fcnt-scout">--</div>
        <div class="fleet-rate" id="frate-scout">--</div>
        <div class="fleet-last" id="flast-scout">--</div>
        <div class="fleet-model" id="fmodel-scout">--</div>
      </div>
      <div class="card fleet-card" data-agent="job-reader" style="--agent-color:var(--color-reader)">
        <div class="fleet-avatar">RDR</div>
        <div class="fleet-name">Job Reader</div>
        <div class="fleet-role">JD Analysis</div>
        <div class="fleet-status live"><span class="fleet-status-dot"></span><span class="fleet-label">LIVE</span></div>
        <div class="fleet-count" style="color:var(--color-reader)" id="fcnt-job-reader">--</div>
        <div class="fleet-rate" id="frate-job-reader">--</div>
        <div class="fleet-last" id="flast-job-reader">--</div>
        <div class="fleet-model" id="fmodel-job-reader">--</div>
      </div>
      <div class="card fleet-card" data-agent="cv-adapter" style="--agent-color:var(--color-adapter)">
        <div class="fleet-avatar">ADP</div>
        <div class="fleet-name">CV Adapter</div>
        <div class="fleet-role">CV Tailoring</div>
        <div class="fleet-status live"><span class="fleet-status-dot"></span><span class="fleet-label">LIVE</span></div>
        <div class="fleet-count" style="color:var(--color-adapter)" id="fcnt-cv-adapter">--</div>
        <div class="fleet-rate" id="frate-cv-adapter">--</div>
        <div class="fleet-last" id="flast-cv-adapter">--</div>
        <div class="fleet-model" id="fmodel-cv-adapter">--</div>
      </div>
    </div>

    <!-- Conversion Funnel + Status row -->
    <div class="grid grid-3">
      <div class="card" style="grid-column:span 2;">
        <div class="card-label">Conversion Funnel</div>
        <div style="display:flex;gap:24px;align-items:flex-end;min-height:160px;padding-top:20px;" id="ov-funnel">
          <div style="flex:1;text-align:center;"><div class="funnel-bar" data-funnel="found" style="height:16px;width:100%;background:linear-gradient(to top,rgba(234,194,102,0.4),transparent);border-radius:6px 6px 0 0;"></div><div style="font-size:11px;color:var(--text-faint);margin-top:6px;">Found<br><span style="font-weight:700;color:var(--text);" data-funnel="found-value">--</span></div></div>
          <div style="flex:1;text-align:center;"><div class="funnel-bar" data-funnel="matched" style="height:16px;width:100%;background:linear-gradient(to top,rgba(0,200,156,0.4),transparent);border-radius:6px 6px 0 0;"></div><div style="font-size:11px;color:var(--text-faint);margin-top:6px;">Matched<br><span style="font-weight:700;color:var(--text);" data-funnel="matched-value">--</span></div></div>
          <div style="flex:1;text-align:center;"><div class="funnel-bar" data-funnel="read" style="height:16px;width:100%;background:linear-gradient(to top,rgba(110,184,255,0.4),transparent);border-radius:6px 6px 0 0;"></div><div style="font-size:11px;color:var(--text-faint);margin-top:6px;">Read<br><span style="font-weight:700;color:var(--text);" data-funnel="read-value">--</span></div></div>
          <div style="flex:1;text-align:center;"><div class="funnel-bar" data-funnel="cvs" style="height:16px;width:100%;background:linear-gradient(to top,rgba(255,124,104,0.4),transparent);border-radius:6px 6px 0 0;"></div><div style="font-size:11px;color:var(--text-faint);margin-top:6px;">CVs Done<br><span style="font-weight:700;color:var(--text);" data-funnel="cvs-value">--</span></div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-label">Status</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;" id="ov-status">
          <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:var(--text-faint);">Model</span><span id="ov-model" style="color:var(--gold);font-weight:600;">--</span></div>
          <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:var(--text-faint);">Actions (24h)</span><span id="ov-24h" style="font-weight:600;">--</span></div>
          <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:var(--text-faint);">Success Rate</span><span id="ov-success-rate" style="font-weight:600;">--</span></div>
          <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:var(--text-faint);">Last Activity</span><span id="ov-last-activity" style="font-weight:600;">--</span></div>
        </div>
      </div>
    </div>

    <!-- Activity Stream -->
    <div class="card">
      <div class="card-label">Activity Stream</div>
      <div id="activity-stream"><div style="color:var(--text-faint);padding:12px;text-align:center;">Loading...</div></div>
    </div>

    <!-- Matches Table -->
    <div class="card" id="ov-matches-card" style="display:none;margin-bottom:20px;">
      <div class="card-label">Top Matches</div>
      <div style="overflow-x:auto;">
        <table class="fx-table" id="ov-matches-table">
          <thead><tr><th>#</th><th>Score</th><th>Title</th><th>Company</th><th>Location</th><th></th></tr></thead>
          <tbody id="ov-matches-rows"></tbody>
        </table>
      </div>
    </div>
  `;
  return div;
}

async function pollData() {
  try {
    // Update greeting based on time of day
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Good Morning' : hr < 18 ? 'Good Afternoon' : 'Good Evening';
    const el = document.querySelector('.eyebrow-line');
    if (el) el.textContent = greet;

    // Get overview
    const ov = await overviewService.getOverview();
    setGaugeValue('tokens', ov.total_logged_actions);
    setGaugeArc('tokens', Math.min(ov.total_logged_actions / 1000000, 1));
    setGaugeValue('jobs', ov.total_jobs_seen);
    setGaugeArc('jobs', Math.min(ov.total_jobs_seen / 1000, 1));

    // Update gauge sub-texts
    const tokensSub = document.querySelector('[data-gauge-sub="tokens"]');
    if (tokensSub) tokensSub.textContent = ov.total_logged_actions;
    document.getElementById('ov-last-activity').textContent = timeAgo(ov.last_activity);

    // Run status pill + button + agent glow
    var isRunning = ov.live_run !== null && ov.live_run !== undefined;
    var runChip = document.getElementById('chip-run');
    var runDot = document.getElementById('chip-run-dot');
    var runText = document.getElementById('chip-run-text');
    var findBtn = document.getElementById('btn-find');
    var findIcon = document.getElementById('btn-find-icon');
    var findText = document.getElementById('btn-find-text');
    var scanTopBtn = document.getElementById('btn-scan-top');
    var scanTopIcon = document.getElementById('btn-scan-icon');
    var scanTopText = document.getElementById('btn-scan-text');

    if (isRunning) {
      if (runDot) { runDot.className = 'chip-dot on'; runDot.style.background = 'var(--gold)'; runDot.style.boxShadow = '0 0 8px var(--gold-glow)'; }
      if (runText) runText.textContent = 'RUNNING\u2026';
      if (runChip) runChip.style.borderColor = 'var(--gold)';
      if (findBtn) { findBtn.disabled = true; findBtn.style.opacity = '0.6'; }
      if (findIcon) findIcon.innerHTML = '\u23F3';
      if (findText) findText.textContent = 'Scanning\u2026';
      if (scanTopBtn) { scanTopBtn.disabled = true; scanTopBtn.style.opacity = '0.6'; }
      if (scanTopIcon) scanTopIcon.innerHTML = '\u23F3';
      if (scanTopText) scanTopText.textContent = 'Scanning\u2026';
      // Glow the scout fleet card
      var scoutCard = document.querySelector('.fleet-card[data-agent="scout"]');
      if (scoutCard) {
        scoutCard.style.borderColor = 'var(--color-scout)';
        scoutCard.style.boxShadow = '0 0 24px rgba(110,184,255,0.25)';
      }
    } else {
      if (runDot) { runDot.className = 'chip-dot on'; runDot.style.background = 'var(--teal)'; runDot.style.boxShadow = '0 0 6px rgba(0,200,156,0.4)'; }
      if (findBtn) { findBtn.disabled = false; findBtn.style.opacity = '1'; }
      if (findIcon) findIcon.innerHTML = '\u26A1';
      if (findText) findText.textContent = 'Find Jobs';
      if (scanTopBtn) { scanTopBtn.disabled = false; scanTopBtn.style.opacity = '1'; }
      if (scanTopIcon) scanTopIcon.innerHTML = '\u26A1';
      if (scanTopText) scanTopText.textContent = 'Scan Now';
      var scoutCard = document.querySelector('.fleet-card[data-agent="scout"]');
      if (scoutCard) {
        scoutCard.style.borderColor = '';
        scoutCard.style.boxShadow = '';
      }
      // Show last run summary
      if (ov.last_run && ov.last_run.summary) {
        var s = ov.last_run.summary;
        if (runText) runText.textContent = 'LAST FIND \u00B7 ' + (s.matched_count || '?') + ' matched';
      } else {
        if (runText) runText.textContent = 'Idle';
      }
    }

    // Get agents + populate fleet cards
    const ag = await overviewService.getAgents();
    let onlineCount = 0;
    ag.agents.forEach(a => {
      const key = a.name.toLowerCase().replace(/\s+/g, '-');
      const countEl = document.getElementById(`fcnt-${key}`);
      const lastEl = document.getElementById(`flast-${key}`);
      const rateEl = document.getElementById(`frate-${key}`);
      const modelEl = document.getElementById(`fmodel-${key}`);
      if (countEl) countEl.textContent = a.total_actions;
      if (lastEl) lastEl.textContent = a.last_active ? timeAgo(a.last_active) : 'never';
      if (rateEl) rateEl.textContent = `${a.last_status === 'completed' ? 100 : 0}%`;
      if (modelEl) modelEl.textContent = ov.active_model || '--';

      // Status badge: working if active within 2 min, idle if >2 min, live by default
      const card = document.querySelector(`.fleet-card[data-agent="${key}"]`);
      const statusEl = card?.querySelector('.fleet-status');
      if (card && statusEl) {
        const activeMs = a.last_active ? Date.now() - new Date(a.last_active).getTime() : Infinity;
        if (activeMs < 120000) {
          statusEl.className = 'fleet-status working';
          statusEl.querySelector('.fleet-label').textContent = 'WORKING';
          card.classList.add('working');
          onlineCount++;
        } else if (activeMs < 3600000) {
          statusEl.className = 'fleet-status live';
          statusEl.querySelector('.fleet-label').textContent = 'LIVE';
          card.classList.remove('working');
          onlineCount++;
        } else {
          statusEl.className = 'fleet-status idle';
          statusEl.querySelector('.fleet-label').textContent = 'IDLE';
          card.classList.remove('working');
        }
      }
    });
    document.getElementById('mini-online').textContent = onlineCount;

    // Derive matched/read/tailored counts from agent data
    const totalActions = ag.agents.reduce((s, a) => s + a.total_actions, 0);
    document.getElementById('gauge-matched-sub').textContent = totalActions;
    document.getElementById('gauge-matched2-sub').textContent = totalActions;
    document.getElementById('gauge-read-sub').textContent = ov.total_logged_actions || 0;
    document.getElementById('gauge-tailored-sub').textContent = ov.total_pipeline_runs || 0;

    // Get telemetry for success rate
    const tl = await overviewService.getTelemetry();
    const total = tl.total_actions || 0;
    const completed = tl.status_breakdown?.completed || 0;
    const rate = total > 0 ? Math.round(completed / total * 100) + '%' : '--';
    document.getElementById('ov-success-rate').textContent = rate;

    // 24h count
    const today = new Date().toISOString().slice(0,10);
    const dayCount = tl.per_day?.[today] || 0;
    document.getElementById('ov-24h').textContent = dayCount;

    // Funnel
    setFunnelValue('found', ov.total_jobs_seen || 0);
    const matches = ag.agents.reduce((s, a) => s + a.total_actions, 0);
    setFunnelValue('matched', Math.min(matches, ov.total_jobs_seen || matches));
    setFunnelValue('read', Math.min(ov.total_logged_actions, matches));
    setFunnelValue('cvs', ov.total_pipeline_runs || 0);

    // Model chip — prefer config value (ov.active_model); fall back to last activity log
    var activeModel = ov.active_model || '';
    const lastActivity = await overviewService.getActivity(1);
    var logModel = lastActivity?.entries?.[0]?.model_used || '';
    var displayModel = activeModel || logModel;
    if (displayModel) {
      var shortModel = displayModel.split('/').pop();
      document.getElementById('ov-model').textContent = displayModel;
      var chipModelEl = document.querySelector('#chip-model');
      if (chipModelEl) chipModelEl.innerHTML = `<span class="chip-dot on"></span><span id="chip-model-text">${shortModel}</span>`;
      const heroChip = document.getElementById('chip-model-hero');
      if (heroChip) heroChip.textContent = shortModel;
    }

    // Activity stream
    const act = await overviewService.getActivity(30);
    if (act?.entries?.length) {
      const stream = document.getElementById('activity-stream');
      const agentColors = { forge: '#EAC266', scout: '#6EB8FF', 'job-reader': '#00C89C', 'cv-adapter': '#FF7C68' };
      stream.innerHTML = act.entries.map(e => {
        const color = agentColors[e.agent_name] || 'var(--text-secondary)';
        return `<div class="activity-row">
          <span class="activity-agent" style="background:color-mix(in srgb, ${color} 20%, transparent);color:${color};">${esc(e.agent_name)}</span>
          <span class="activity-task">${esc(e.task_description)}</span>
          <span class="activity-status"><span class="badge ${e.status === 'completed' ? 'badge-ok' : 'badge-fail'}">${e.status}</span></span>
          <span class="activity-model">${esc(e.model_used ? e.model_used.split('/').pop() : '')}</span>
          <span class="activity-time">${timeAgo(e.created_at)}</span>
        </div>`;
      }).join('');
    }

    // Fetch matches for Tailor buttons
    try {
      const rd = await overviewService.getRunDetail();
      const card = document.getElementById('ov-matches-card');
      const tbody = document.getElementById('ov-matches-rows');
      if (card && tbody && rd.matches && rd.matches.length) {
        card.style.display = 'block';
        tbody.innerHTML = rd.matches.map(function(m) {
          var statusClass = '';
          var btnHtml = '';
          // Check if already tailored
          var isTailored = m.cv_path && m.cv_path.length > 0;
          if (isTailored) {
            var encoded = encodeURIComponent(m.cv_path.split('/').pop());
            btnHtml = '<span class="badge badge-ok" style="font-size:10px;">\u2713 Tailored</span>'
              + ' <a href="/api/cv-docx?path=' + encoded + '" class="btn btn-ghost" style="padding:2px 8px;font-size:10px;" target="_blank">DOC</a>'
              + ' <a href="/api/cv-pdf?path=' + encoded + '" class="btn btn-ghost" style="padding:2px 8px;font-size:10px;" target="_blank">PDF</a>';
          } else {
            btnHtml = '<button class="btn btn-primary tailor-btn" style="padding:4px 12px;font-size:11px;" '
              + 'data-url="' + esc(m.url) + '" '
              + 'data-title="' + esc(m.title) + '" '
              + 'data-company="' + esc(m.company) + '" '
              + 'data-run="' + esc(rd.run_id || '') + '" '
              + 'data-description="' + esc(m.description || '').replace(/"/g, '&quot;') + '">Tailor \u25B8</button>';
          }
          return '<tr>'
            + '<td style="font-size:12px;color:var(--text-faint);">' + m.rank + '</td>'
            + '<td style="font-weight:700;">' + m.score.toFixed(1) + '</td>'
            + '<td>' + esc(m.title) + '</td>'
            + '<td style="color:var(--text-secondary);">' + esc(m.company) + '</td>'
            + '<td style="font-size:12px;color:var(--text-faint);">' + esc(m.location) + '</td>'
            + '<td style="text-align:right;">' + btnHtml + '</td>'
            + '</tr>';
        }).join('');
      }
    } catch(e) { /* matches fetch non-critical */ }

  } catch(e) {
    console.warn('Poll failed:', e);
  }
}


function handleTailorClick(e) {
  const btn = e.target.closest('.tailor-btn');
  if (!btn || btn.disabled) return;
  const url = btn.getAttribute('data-url');
  const title = btn.getAttribute('data-title');
  const company = btn.getAttribute('data-company');
  const runId = btn.getAttribute('data-run');
  const description = btn.getAttribute('data-description') || '';
  const key = btn.getAttribute('data-key') || (title + '|' + company);
  if (!url || !title || !company) return;

  overviewTailorState[key] = 'promoting';
  btn.disabled = true;
  btn.style.opacity = '0.7';
  btn.textContent = '\u23F3 Tailoring\u2026';

  overviewService.promoteJob({ run_id: runId, url, title, company, description, key })
    .catch(function(e) {
      if (e.status === 409) {
        overviewTailorState[key] = 'promoting';
        return;
      }
      delete overviewTailorState[key];
      btn.disabled = false;
      btn.style.opacity = '';
      btn.textContent = 'Tailor \u25B8';
      alert('Error: ' + e.message);
    });
}

function wireFindButton(root) {
  const btn = root.querySelector('#btn-find');
  if (!btn) return;
  btn.addEventListener('click', function() {
    btn.disabled = true;
    const icon = document.getElementById('btn-find-icon');
    const txt = document.getElementById('btn-find-text');
    if (icon) icon.innerHTML = '\u23F3';
    if (txt) txt.textContent = 'Starting\u2026';
    overviewService.startFindRun()
      .then(function(r) {
        if (r.status === 409) { alert('A scan is already running.'); return; }
        if (!r.ok) alert('Failed to start scan: ' + r.status);
      })
      .catch(function(e) { alert('Error: ' + e.message); });
  });
}

export function createOverviewPage() {
  let root = null;
  return {
    id: 'overview',
    title: 'Overview',
    navLabel: 'Overview',
    icon: ICONS.overview,
    primary: true,
    render() {
      root = buildOverviewView();
      root.addEventListener('click', handleTailorClick);
      wireFindButton(root);
      return root;
    },
    start() {
      pollData();
      pollInterval = setInterval(pollData, 6000);
    },
    stop() {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = null;
    },
  };
}
