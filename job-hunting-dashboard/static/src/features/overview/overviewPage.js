
import { ICONS } from '../../shared/icons.js';
import { esc, timeAgo } from '../../shared/formatters.js';
import { setGaugeArc, setGaugeValue, setFunnelValue } from '../../shared/widgets.js';
import { createTemplateView } from '../../shared/templates.js';
import { overviewService } from './overviewService.js';

let pollInterval = null;
const overviewTailorState = {};
// ── Overview page ──────────────────────────────────────
function buildOverviewView() {
  const div = createTemplateView('overview');
  const today = new Date();
  const dateEl = div.querySelector('#overview-date');
  if (dateEl) {
    dateEl.textContent = today.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  }
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
      if (runDot) runDot.className = 'chip-dot on is-running';
      if (runText) runText.textContent = 'RUNNING\u2026';
      if (runChip) runChip.classList.add('is-running');
      if (findBtn) findBtn.disabled = true;
      if (findIcon) findIcon.innerHTML = '\u23F3';
      if (findText) findText.textContent = 'Scanning\u2026';
      if (scanTopBtn) scanTopBtn.disabled = true;
      if (scanTopIcon) scanTopIcon.innerHTML = '\u23F3';
      if (scanTopText) scanTopText.textContent = 'Scanning\u2026';
      // Glow the scout fleet card
      var scoutCard = document.querySelector('.fleet-card[data-agent="scout"]');
      if (scoutCard) {
        scoutCard.classList.add('is-highlighted');
      }
    } else {
      if (runDot) runDot.className = 'chip-dot on is-idle';
      if (findBtn) findBtn.disabled = false;
      if (findIcon) findIcon.innerHTML = '\u26A1';
      if (findText) findText.textContent = 'Find Jobs';
      if (scanTopBtn) scanTopBtn.disabled = false;
      if (scanTopIcon) scanTopIcon.innerHTML = '\u26A1';
      if (scanTopText) scanTopText.textContent = 'Scan Now';
      var scoutCard = document.querySelector('.fleet-card[data-agent="scout"]');
      if (scoutCard) {
        scoutCard.classList.remove('is-highlighted');
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
      stream.innerHTML = act.entries.map(e => {
        const agentClass = 'activity-agent-' + String(e.agent_name || '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        return `<div class="activity-row">
          <span class="activity-agent ${agentClass}">${esc(e.agent_name)}</span>
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
        card.hidden = false;
        tbody.innerHTML = rd.matches.map(function(m) {
          var statusClass = '';
          var btnHtml = '';
          // Check if already tailored
          var isTailored = m.cv_path && m.cv_path.length > 0;
          if (isTailored) {
            var encoded = encodeURIComponent(m.cv_path.split('/').pop());
            btnHtml = '<span class="badge badge-ok badge-compact">\u2713 Tailored</span>'
              + ' <a href="/api/cv-docx?path=' + encoded + '" class="btn btn-ghost btn-compact" target="_blank">DOC</a>'
              + ' <a href="/api/cv-pdf?path=' + encoded + '" class="btn btn-ghost btn-compact" target="_blank">PDF</a>';
          } else {
            btnHtml = '<button class="btn btn-primary btn-compact tailor-btn" '
              + 'data-url="' + esc(m.url) + '" '
              + 'data-title="' + esc(m.title) + '" '
              + 'data-company="' + esc(m.company) + '" '
              + 'data-run="' + esc(rd.run_id || '') + '" '
              + 'data-description="' + esc(m.description || '').replace(/"/g, '&quot;') + '">Tailor \u25B8</button>';
          }
          return '<tr>'
            + '<td class="cell-muted">' + m.rank + '</td>'
            + '<td class="score-cell">' + m.score.toFixed(1) + '</td>'
            + '<td>' + esc(m.title) + '</td>'
            + '<td class="cell-company">' + esc(m.company) + '</td>'
            + '<td class="cell-muted">' + esc(m.location) + '</td>'
            + '<td class="align-right">' + btnHtml + '</td>'
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
  btn.classList.add('is-loading');
  btn.textContent = '\u23F3 Tailoring\u2026';

  overviewService.promoteJob({ run_id: runId, url, title, company, description, key })
    .catch(function(e) {
      if (e.status === 409) {
        overviewTailorState[key] = 'promoting';
        return;
      }
      delete overviewTailorState[key];
      btn.disabled = false;
      btn.classList.remove('is-loading');
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
