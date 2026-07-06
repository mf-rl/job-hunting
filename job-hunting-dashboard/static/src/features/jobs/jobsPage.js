
import { ICONS } from '../../shared/icons.js';
import { esc, formatSource, htmlToText } from '../../shared/formatters.js';
import { openDrawer } from '../../shared/dialogs/drawer.js';
import { jobsService } from './jobsService.js';

const srcFilter = new Set();
const tailorState = {};
let jobsPage = 1;
let jobsRefreshTimer = null;

// ── Jobs page ────────────────────────────────────────
function buildJobsView() {
  const div = document.createElement('div');
  div.className = 'fx-view';
  div.dataset.view = 'jobs';
  div.innerHTML = `
    <div class="card card-accent" style="margin-bottom:20px;">
      <div class="card-label">Top Matches</div>
      <div id="jobs-stats" style="display:flex;gap:24px;margin-bottom:12px;font-size:13px;flex-wrap:wrap;">
        <span>Found: <strong id="jobs-found">--</strong></span>
        <span>Matched: <strong id="jobs-matched">--</strong></span>
        <span>Tailored: <strong id="jobs-tailored">--</strong></span>
        <span style="margin-left:auto;display:flex;align-items:center;gap:8px;">
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;">
            <input type="checkbox" id="auto-scan-toggle"> <span style="color:var(--text-secondary);">Auto-Scan</span>
          </label>
          <select id="auto-scan-cadence" style="display:none;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:11px;color:var(--text);">
            <option value="2h">Every 2h</option><option value="4h">Every 4h</option>
            <option value="6h">Every 6h</option><option value="8h">Every 8h</option>
            <option value="12h">Every 12h</option><option value="daily" selected>Daily · 9 AM</option>
          </select>
          <span id="schedule-next" style="font-size:11px;color:var(--text-faint);display:none;"></span>
        </span>
      </div>
      <!-- Source filter -->
      <div id="source-filter-row" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:14px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border-light);border-radius:10px;">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--text-faint);margin-right:4px;">Source</span>
        <span style="font-size:11px;color:var(--text-faint);font-style:italic;">Loading…</span>
      </div>
      <div style="overflow-x:auto;">
        <table class="fx-table" id="jobs-table" style="width:100%;font-size:13px;">
          <thead>
            <tr>
              <th style="width:32px;">#</th>
              <th style="width:60px;">Score</th>
              <th>Role</th>
              <th>Company</th>
              <th>Location</th>
              <th style="width:80px;">Source</th>
              <th style="width:110px;">Status</th>
              <th style="width:120px;">Flags</th>
              <th style="width:240px;">Actions</th>
            </tr>
          </thead>
          <tbody id="jobs-rows">
            <tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-faint);">No matches yet. Run a scan to find jobs.</td></tr>
          </tbody>
        </table>
      </div>
      <!-- Pagination -->
      <div id="jobs-pagination" style="display:none;margin-top:14px;padding-top:12px;border-top:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;"></div>
    </div>

    <!-- KEY Legend -->
    <div class="card" id="jobs-legend" style="margin-bottom:20px;">
      <div class="card-label">KEY</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--text-secondary);">
        <div><span style="font-weight:700;color:var(--teal);">●≥65</span> Strong match</div>
        <div><span style="font-weight:700;color:var(--gold);">●50–64</span> Moderate match</div>
        <div><span style="color:var(--teal);font-weight:700;">NEW</span> First time seen</div>
        <div><span style="color:var(--text);font-weight:700;">×N</span> Seen N times</div>
        <div><span style="color:var(--gold);">CV✓</span> Tailored CV exists</div>
        <div><span style="color:var(--sky);">[EN]</span> English required</div>
        <div><span class="btn btn-primary" style="padding:2px 8px;font-size:10px;">Tailor ▸</span> Promote this job</div>
        <div><span class="btn btn-ghost" style="padding:2px 8px;font-size:10px;">JD</span> Open job description</div>
        <div><span class="btn btn-ghost" style="padding:2px 8px;font-size:10px;">CV</span> View tailored CV</div>
        <div><span class="btn btn-ghost" style="padding:2px 8px;font-size:10px;">DOC</span> Download .docx</div>
        <div><span class="btn btn-ghost" style="padding:2px 8px;font-size:10px;">PDF</span> Download PDF</div>
        <div><span style="font-size:14px;">↗</span> Original posting</div>
      </div>
    </div>
  `;

  // Fetch + render immediately, then every 6s
  renderJobs();
  return div;
}

// ── Pagination helper ──────────────────────────────────────────────────
var _JOBS_PAGE_SIZE = 20;

function _renderPagination(total, page) {
  var bar = document.getElementById('jobs-pagination');
  if (!bar) return;
  var totalPages = Math.max(1, Math.ceil(total / _JOBS_PAGE_SIZE));
  if (totalPages <= 1) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';

  var start = (page - 1) * _JOBS_PAGE_SIZE + 1;
  var end   = Math.min(page * _JOBS_PAGE_SIZE, total);

  // Build page buttons (show at most 7: first, ..., p-1, p, p+1, ..., last)
  var pages = [];
  if (totalPages <= 7) {
    for (var i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (var i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  var btnBase = 'padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-secondary);transition:all 0.15s;';
  var btnActive = 'background:rgba(234,194,102,0.15);border-color:var(--gold);color:var(--gold);';
  var btnDisabled = 'opacity:0.35;pointer-events:none;';

  var html = '<span style="font-size:12px;color:var(--text-faint);">' +
    'Showing ' + start + '–' + end + ' of <strong style="color:var(--text);">' + total + '</strong> jobs</span>';

  html += '<div style="display:flex;gap:4px;align-items:center;">';

  // Prev
  html += '<button class="pg-btn" data-pg="' + (page - 1) + '" style="' + btnBase + (page === 1 ? btnDisabled : '') + '">←</button>';

  pages.forEach(function(p) {
    if (p === '...') {
      html += '<span style="color:var(--text-faint);padding:0 4px;">…</span>';
    } else {
      html += '<button class="pg-btn" data-pg="' + p + '" style="' + btnBase + (p === page ? btnActive : '') + '">' + p + '</button>';
    }
  });

  // Next
  html += '<button class="pg-btn" data-pg="' + (page + 1) + '" style="' + btnBase + (page === totalPages ? btnDisabled : '') + '">→</button>';
  html += '</div>';

  bar.innerHTML = html;

  if (!bar._wired) {
    bar._wired = true;
    bar.addEventListener('click', function(e) {
      var btn = e.target.closest('.pg-btn');
      if (!btn || btn.style.pointerEvents === 'none') return;
      var pg = parseInt(btn.getAttribute('data-pg'), 10);
      if (!pg || pg < 1) return;
      jobsPage = pg;
      renderJobs();
      // Scroll table into view
      var table = document.getElementById('jobs-table');
      if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

// ── Source filter helper ────────────────────────────────────────────────────
var _SOURCE_COLORS = {
  adzuna: '#6EB8FF', remotive: '#00C89C',
  remoteok: '#AD8CFF', weworkremotely: '#EAC266', jobicy: '#FF7C68',
  arbeitnow: '#5DD3B3', getonboard: '#22C55E', himalayas: '#8B5CF6',
  graphqljobs: '#E535AB', reed: '#E31B23', jsearch: '#0A66C2',
};

function _srcGroupKey(src) {
  return (src && src.startsWith('adzuna_')) ? 'adzuna' : (src || 'unknown');
}

function _srcGroupLabel(key) {
  var labels = {
    adzuna: 'Adzuna', remotive: 'Remotive',
    remoteok: 'Remote OK', weworkremotely: 'We Work Remotely', jobicy: 'Jobicy',
    arbeitnow: 'Arbeitnow', getonboard: 'GetOnBoard', himalayas: 'Himalayas',
    graphqljobs: 'GraphQL Jobs', reed: 'Reed.co.uk', jsearch: 'JSearch',
  };
  return labels[key] || key;
}

function _h2r(hex, a) {
  var n = parseInt(hex.replace('#',''), 16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
}

function _chipBtn(label, count, color, active, src) {
  var base = 'display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:999px;'
    + 'font-size:11px;cursor:pointer;user-select:none;outline:none;white-space:nowrap;transition:all 0.15s;';
  var style = active
    ? base + 'font-weight:700;border:1.5px solid '+color+';background:'+_h2r(color,0.18)+';color:'+color+';box-shadow:0 0 0 1px '+_h2r(color,0.3)+',0 0 10px '+_h2r(color,0.18)+';'
    : base + 'font-weight:600;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:rgba(180,183,193,0.7);';
  return '<button data-src="'+src+'" style="'+style+'">'+label+' <span style="opacity:0.6;">'+count+'</span></button>';
}

function _renderSourceFilter(matches) {
  var row = document.getElementById('source-filter-row');
  if (!row) return;
  var counts = {};
  (matches || []).forEach(function(m) {
    var g = _srcGroupKey((m.tracking && m.tracking.source) || 'unknown');
    counts[g] = (counts[g] || 0) + 1;
  });

  var groups = Object.keys(counts).sort();
  var total  = matches ? matches.length : 0;
  var allActive = srcFilter.size === 0;

  var html = '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:rgba(112,116,127,0.8);margin-right:4px;">Source</span>';
  html += _chipBtn('All', total, '#EAC266', allActive, '__all__');
  groups.forEach(function(g) {
    html += _chipBtn(_srcGroupLabel(g), counts[g], _SOURCE_COLORS[g]||'#B4B7C1', srcFilter.has(g), g);
  });

  row.innerHTML = html;

  if (!row._wired) {
    row._wired = true;
    row.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-src]');
      if (!btn) return;
      var src = btn.getAttribute('data-src');
      if (src === '__all__') {
        srcFilter.clear();
      } else {
        srcFilter.has(src) ? srcFilter.delete(src) : srcFilter.add(src);
        var n = row.querySelectorAll('button[data-src]:not([data-src="__all__"])').length;
        if (srcFilter.size >= n) srcFilter.clear();
      }
      renderJobs();
    });
  }
}

async function renderJobs() {
  try {
    const rd = await jobsService.getRunDetail();
    const tbody = document.getElementById('jobs-rows');
    if (!tbody) return;

    document.getElementById('jobs-found').textContent = rd.found || '--';
    document.getElementById('jobs-matched').textContent = rd.matched || '--';
    document.getElementById('jobs-tailored').textContent = (rd.memory && rd.memory.tailored) || '--';

    if (!rd.matches || !rd.matches.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-faint);">No matches yet. Run a scan to find jobs.</td></tr>';
      _renderSourceFilter([]);
      return;
    }

    // ── Build / refresh source filter chips ─────────────────────────────────
    _renderSourceFilter(rd.matches);

    // ── Apply source filter ───────────────────────────────────────────────
    var displayMatches = rd.matches;
    if (srcFilter.size > 0) {
      displayMatches = rd.matches.filter(function(m) {
        var src = (m.tracking && m.tracking.source) || 'unknown';
        if (srcFilter.has('adzuna') && src.startsWith('adzuna_')) return true;
        return srcFilter.has(src);
      });
    }

    // ── Paginate ─────────────────────────────────────────────────────────
    if (!jobsPage) jobsPage = 1;
    var _totalFiltered = displayMatches.length;
    var _pageStart = (jobsPage - 1) * _JOBS_PAGE_SIZE;
    if (_pageStart >= _totalFiltered && _totalFiltered > 0) { jobsPage = 1; _pageStart = 0; }
    var _pageEnd = Math.min(_pageStart + _JOBS_PAGE_SIZE, _totalFiltered);
    var pageMatches = displayMatches.slice(_pageStart, _pageEnd);

    tbody.innerHTML = pageMatches.map(function(m) {
      var score = m.score || 0;
      var scoreClass = score >= 65 ? 'score-high' : 'score-mid';
      var flags = [];
      if (m.new) flags.push('<span style="color:var(--teal);font-weight:700;">NEW</span>');
      if (m.times_seen > 1) flags.push('<span style="font-weight:700;">\u00D7' + m.times_seen + '</span>');
      if (m.cv_path) flags.push('<span style="color:var(--gold);">CV\u2713</span>');
      if (m.tracking && m.tracking.flags && m.tracking.flags.source) {
        if (m.tracking.flags.source.indexOf('es_') > -1) flags.push('<span style="color:var(--sky);font-size:10px;">[ES]</span>');
      }

      var cvPath = m.cv_path || '';
      var cvFilename = cvPath ? cvPath.split('/').pop() : '';
      var encodedFile = cvFilename ? encodeURIComponent(cvFilename) : '';
      var hasCv = cvFilename.length > 0;
      // m.cv_path is the source of truth: if DB says tailored, it is tailored
      if (hasCv) {
        delete tailorState[m.key];  // clear transient state — DB is authoritative
      } else if (tailorState[m.key] === 'done') {
        // API accepted but cv_path not in DB yet — still in flight
        tailorState[m.key] = 'promoting';
      }
      // Sync from server flag file — survives page refresh
      if (m.promoting && !hasCv) {
        tailorState[m.key] = 'promoting';
      }
      // Stale-promoting guard: server says NOT promoting AND no cv_path — process ended
      // without saving (failed or completed before fix). Reset so user can retry.
      if (!m.promoting && !hasCv && tailorState[m.key] === 'promoting') {
        delete tailorState[m.key];
      }
      var state = tailorState[m.key] || (hasCv ? 'done' : 'idle');
      var tailorBtnHtml = '';
      if (state === 'promoting') {
        tailorBtnHtml = '<button class="btn btn-primary tailor-btn" disabled style="padding:2px 10px;font-size:10px;opacity:0.7;" data-key="' + esc(m.key) + '">&#9203; Tailoring…</button>';
      } else if (state === 'done') {
        tailorBtnHtml = '<button class="btn btn-primary tailor-btn" disabled style="padding:2px 10px;font-size:10px;background:var(--teal);color:#0B1120;cursor:default;" data-key="' + esc(m.key) + '">&#10003; Tailored</button>';
      } else {
        tailorBtnHtml = '<button class="btn btn-primary tailor-btn" style="padding:2px 10px;font-size:10px;"'
          + ' data-url="' + esc(m.url) + '" data-title="' + esc(m.title) + '"'
          + ' data-company="' + esc(m.company) + '" data-run="' + esc(rd.run_id || '') + '"'
          + ' data-description="' + esc(m.description || '').replace(/"/g,'&quot;') + '"'
          + ' data-key="' + esc(m.key) + '">Tailor &#9656;</button>';
      }

      var cvDisabled = !hasCv ? ' style="padding:2px 8px;font-size:10px;opacity:0.4;pointer-events:none;"' : ' style="padding:2px 8px;font-size:10px;"';
      var docDisabled = !hasCv ? ' style="padding:2px 8px;font-size:10px;opacity:0.4;pointer-events:none;"' : ' style="padding:2px 8px;font-size:10px;text-decoration:none;"';
      var pdfDisabled = !hasCv ? ' style="padding:2px 8px;font-size:10px;opacity:0.4;pointer-events:none;"' : ' style="padding:2px 8px;font-size:10px;text-decoration:none;"';

      return '<tr>'
        + '<td style="color:var(--text-faint);">' + m.rank + '</td>'
        + '<td><span class="' + scoreClass + '">' + score.toFixed(1) + '</span></td>'
        + '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(m.title) + '">' + esc(m.title) + '</td>'
        + '<td style="color:var(--text-secondary);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(m.company) + '">' + esc(m.company) + '</td>'
        + '<td style="font-size:12px;color:var(--text-faint);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(m.location) + '</td>'
        + '<td>' + formatSource(m.tracking && m.tracking.source || '') + '</td>'
        + '<td><select class="job-status-select" data-key="' + esc(m.key) + '" style="background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:11px;color:var(--text);">'
          + '<option value="">' + (m.user_status || 'new') + '</option>'
          + '<option value="new">new</option><option value="interested">interested</option>'
          + '<option value="applied">applied</option><option value="interview">interview</option>'
          + '<option value="rejected">rejected</option>'
        + '</select></td>'
        + '<td><div style="display:flex;gap:4px;flex-wrap:wrap;">' + flags.join('') + '</div></td>'
        + '<td><div style="display:flex;gap:4px;flex-wrap:wrap;">'
        + tailorBtnHtml
        + '<button class="btn btn-ghost jd-btn" style="padding:2px 8px;font-size:10px;" data-key="' + esc(m.key) + '">JD</button>'
        + '<button class="btn btn-ghost cv-btn"' + cvDisabled + ' data-path="' + encodedFile + '" data-key="' + esc(m.key) + '">CV</button>'
        + (hasCv ? '<a href="/api/cv-docx?path=' + encodedFile + '" class="btn btn-ghost"' + docDisabled + '>DOC</a>' : '<span class="btn btn-ghost"' + docDisabled + '>DOC</span>')
        + (hasCv ? '<a href="/api/cv-pdf?path=' + encodedFile + '" class="btn btn-ghost"' + pdfDisabled + '>PDF</a>' : '<span class="btn btn-ghost"' + pdfDisabled + '>PDF</span>')
        + '<a href="' + esc(m.url) + '" target="_blank" rel="noopener" style="padding:2px 6px;font-size:14px;color:var(--text-faint);text-decoration:none;" title="Open original">\u2197</a>'
        + '</div></td>'
        + '</tr>';
    }).join('');

    // ── Render pagination bar ──────────────────────────────────────────
    _renderPagination(_totalFiltered, jobsPage);

    // Wire status dropdowns
    tbody.querySelectorAll('.job-status-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var key = sel.getAttribute('data-key');
        var status = sel.value || 'new';
        jobsService.updateStatus({ key, status }).catch(function(e) { console.warn('Status update failed:', e); });
      });
    });

    // Wire JD buttons (show JD in drawer, no alert on 404)
    tbody.querySelectorAll('.jd-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-key');
        btn.textContent = '...';
        jobsService.getJobDescription(key).then(function(data) {
          if (data && data.notFound) {
            btn.textContent = 'JD';
            openDrawer('Job Description', esc('No job description has been fetched for this match yet. Run Tailor to fetch and extract it.'));
            return null;
          }
          if (data && data.errorStatus) { btn.textContent = 'JD'; openDrawer('Job Description', esc('Error loading JD: ' + data.errorStatus)); return null; }
          return data;
        }).then(function(data) {
          if (!data) return;
          btn.textContent = 'JD';
          var jd = data.jd || {};
          var extracted = jd.extracted || jd;
          var title = extracted.full_job_title || 'Job Description';
          var parts = [];
          if (extracted.company_name) parts.push('Company: ' + extracted.company_name);
          if (extracted.location) parts.push('Location: ' + extracted.location);
          parts.push('Remote: ' + (extracted.remote_mentioned ? 'Yes' : 'Not specified'));
          parts.push('Language: ' + (extracted.language || 'Not specified'));
          var detail = parts.join('\n') + '\n\n';
          if (extracted.responsibilities && extracted.responsibilities.length) {
            detail += '-- RESPONSIBILITIES --\n' + extracted.responsibilities.join('\n') + '\n\n';
          }
          if (extracted.required_skills && extracted.required_skills.length) {
            detail += '-- REQUIRED SKILLS --\n' + extracted.required_skills.join('\n') + '\n\n';
          }
          if (extracted.preferred_skills && extracted.preferred_skills.length) {
            detail += '-- PREFERRED SKILLS --\n' + extracted.preferred_skills.join('\n');
          }
          // Fallback: show raw description if no structured fields were extracted
          if (!extracted.responsibilities && !extracted.required_skills && !extracted.preferred_skills && extracted.description) {
            detail += htmlToText(extracted.description);
          }
          if (data.jd_raw) detail = htmlToText(data.jd_raw);
          openDrawer(title, esc(detail));
        }).catch(function(e) {
          btn.textContent = 'JD';
          openDrawer('Job Description', esc('Error: ' + e.message));
        });
      });
    });

    tbody.removeEventListener('click', handleTailorClick);
    tbody.addEventListener('click', handleTailorClick);

    // Wire CV buttons
    tbody.querySelectorAll('.cv-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var path = btn.getAttribute('data-path');
        if (!path) { openDrawer('Tailored CV', esc('No tailored CV available yet. Run Tailor first.')); return; }
        var key = btn.getAttribute('data-key');
        // Fetch the CV content from the JSON file
        var cvFilename = decodeURIComponent(path);
        var fullPath = '/api/cv-docx?path=' + encodeURIComponent(cvFilename);
        openDrawer('Tailored CV', esc('The tailored CV is available for download. Use the DOC or PDF buttons to download it.'));
      });
    });

  } catch(e) { console.warn('Render jobs failed:', e); }

  // Wire auto-scan toggle (runs once)
  var autoToggle = document.getElementById('auto-scan-toggle');
  var autoCadence = document.getElementById('auto-scan-cadence');
  if (autoToggle && !autoToggle._wired) {
    autoToggle._wired = true;
    // Load current schedule state
    jobsService.getSchedule().then(function(s) {
      autoToggle.checked = s.enabled;
      if (s.enabled) {
        autoCadence.style.display = 'inline-block';
        autoCadence.value = s.cadence || 'daily';
        var nextEl = document.getElementById('schedule-next');
        if (nextEl && s.next_run) {
          nextEl.style.display = 'inline';
          nextEl.textContent = 'next: ' + new Date(s.next_run).toLocaleString();
        }
      }
    });
    autoToggle.addEventListener('change', function() {
      var enabled = autoToggle.checked;
      var cadence = autoCadence.value || 'daily';
      autoCadence.style.display = enabled ? 'inline-block' : 'none';
      jobsService.saveSchedule({ enabled, cadence }).then(function(s) {
        var nextEl = document.getElementById('schedule-next');
        if (nextEl && s.next_run) {
          nextEl.style.display = 'inline';
          nextEl.textContent = 'next: ' + new Date(s.next_run).toLocaleString();
        } else if (nextEl) {
          nextEl.style.display = 'none';
        }
      });
    });
    autoCadence.addEventListener('change', function() {
      if (autoToggle.checked) {
        jobsService.saveSchedule({ enabled: true, cadence: autoCadence.value }).then(function(s) {
          var nextEl = document.getElementById('schedule-next');
          if (nextEl && s.next_run) {
            nextEl.textContent = 'next: ' + new Date(s.next_run).toLocaleString();
          }
        });
      }
    });
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

  tailorState[key] = 'promoting';
  btn.disabled = true;
  btn.style.opacity = '0.7';
  btn.textContent = '\u23F3 Tailoring\u2026';

  jobsService.promote({ run_id: runId, url, title, company, description, key })
    .then(function(result) {
      if (result.status === 409) {
        tailorState[key] = 'promoting';
        return;
      }
      if (!result.ok) {
        delete tailorState[key];
        btn.disabled = false;
        btn.style.opacity = '';
        btn.textContent = 'Tailor \u25B8';
        alert('Promote failed: ' + result.status);
      }
    })
    .catch(function(e) {
      delete tailorState[key];
      btn.disabled = false;
      btn.style.opacity = '';
      btn.textContent = 'Tailor \u25B8';
      alert('Error: ' + e.message);
    });
}

export function createJobsPage() {
  let root = null;
  return {
    id: 'jobs',
    title: 'Jobs',
    navLabel: 'Jobs',
    icon: ICONS.jobs,
    primary: true,
    render() {
      root = buildJobsView();
      return root;
    },
    start() {
      jobsRefreshTimer = setInterval(function() {
        if (root && root.classList.contains('active')) renderJobs();
      }, 6000);
    },
    onShow() {
      renderJobs();
    },
    stop() {
      if (jobsRefreshTimer) clearInterval(jobsRefreshTimer);
      jobsRefreshTimer = null;
    },
  };
}
