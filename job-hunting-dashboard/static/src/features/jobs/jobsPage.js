
import { ICONS } from '../../shared/icons.js';
import { esc, formatSource, htmlToText } from '../../shared/formatters.js';
import { openDrawer } from '../../shared/dialogs/drawer.js';
import { createTemplateView } from '../../shared/templates.js';
import { jobsService } from './jobsService.js';

const srcFilter = new Set();
const tailorState = {};
let jobsPage = 1;
let jobsRefreshTimer = null;

// ── Jobs page ────────────────────────────────────────
function buildJobsView() {
  const div = createTemplateView('jobs');
  renderJobs();
  return div;
}

// ── Pagination helper ──────────────────────────────────────────────────
var _JOBS_PAGE_SIZE = 20;

function _renderPagination(total, page) {
  var bar = document.getElementById('jobs-pagination');
  if (!bar) return;
  var totalPages = Math.max(1, Math.ceil(total / _JOBS_PAGE_SIZE));
  if (totalPages <= 1) { bar.classList.add('is-hidden'); return; }
  bar.classList.remove('is-hidden');

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

  var html = '<span class="pagination-summary">Showing ' + start + '–' + end + ' of <strong>' + total + '</strong> jobs</span>';
  html += '<div class="pagination-buttons">';

  // Prev
  html += '<button class="pg-btn" data-pg="' + (page - 1) + '"' + (page === 1 ? ' disabled' : '') + ' aria-label="Previous page">←</button>';

  pages.forEach(function(p) {
    if (p === '...') {
      html += '<span class="pagination-ellipsis">…</span>';
    } else {
      html += '<button class="pg-btn' + (p === page ? ' active' : '') + '" data-pg="' + p + '">' + p + '</button>';
    }
  });

  // Next
  html += '<button class="pg-btn" data-pg="' + (page + 1) + '"' + (page === totalPages ? ' disabled' : '') + ' aria-label="Next page">→</button>';
  html += '</div>';

  bar.innerHTML = html;

  if (!bar._wired) {
    bar._wired = true;
    bar.addEventListener('click', function(e) {
      var btn = e.target.closest('.pg-btn');
      if (!btn || btn.disabled) return;
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

function _chipBtn(label, count, active, src) {
  var group = src === '__all__' ? 'all' : src;
  return '<button class="source-chip source-chip-' + group + (active ? ' active' : '') + '" data-src="' + src + '">' + label + ' <span class="sc-count">' + count + '</span></button>';
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

  var html = '<span class="filter-label">Source</span>';
  html += _chipBtn('All', total, allActive, '__all__');
  groups.forEach(function(g) {
    html += _chipBtn(_srcGroupLabel(g), counts[g], srcFilter.has(g), g);
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
      tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No matches yet. Run a scan to find jobs.</td></tr>';
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
      if (m.new) flags.push('<span class="flag flag-new">NEW</span>');
      if (m.times_seen > 1) flags.push('<span class="flag">\u00D7' + m.times_seen + '</span>');
      if (m.cv_path) flags.push('<span class="flag flag-cv">CV\u2713</span>');
      if (m.tracking && m.tracking.flags && m.tracking.flags.source) {
        if (m.tracking.flags.source.indexOf('es_') > -1) flags.push('<span class="flag flag-lang">[ES]</span>');
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
        tailorBtnHtml = '<button class="btn btn-primary btn-compact tailor-btn is-loading" disabled data-key="' + esc(m.key) + '">&#9203; Tailoring…</button>';
      } else if (state === 'done') {
        tailorBtnHtml = '<button class="btn btn-primary btn-compact tailor-btn is-success" disabled data-key="' + esc(m.key) + '">&#10003; Tailored</button>';
      } else {
        tailorBtnHtml = '<button class="btn btn-primary btn-compact tailor-btn"'
          + ' data-url="' + esc(m.url) + '" data-title="' + esc(m.title) + '"'
          + ' data-company="' + esc(m.company) + '" data-run="' + esc(rd.run_id || '') + '"'
          + ' data-description="' + esc(m.description || '').replace(/"/g,'&quot;') + '"'
          + ' data-key="' + esc(m.key) + '">Tailor &#9656;</button>';
      }

      var disabledClass = hasCv ? '' : ' is-disabled';

      return '<tr>'
        + '<td class="cell-muted">' + m.rank + '</td>'
        + '<td><span class="' + scoreClass + '">' + score.toFixed(1) + '</span></td>'
        + '<td class="cell-title" title="' + esc(m.title) + '">' + esc(m.title) + '</td>'
        + '<td class="cell-company" title="' + esc(m.company) + '">' + esc(m.company) + '</td>'
        + '<td class="cell-location">' + esc(m.location) + '</td>'
        + '<td>' + formatSource(m.tracking && m.tracking.source || '') + '</td>'
        + '<td><select class="fx-select job-status-select" data-key="' + esc(m.key) + '">'
          + '<option value="">' + (m.user_status || 'new') + '</option>'
          + '<option value="new">new</option><option value="interested">interested</option>'
          + '<option value="applied">applied</option><option value="interview">interview</option>'
          + '<option value="rejected">rejected</option>'
        + '</select></td>'
        + '<td><div class="flag-list">' + flags.join('') + '</div></td>'
        + '<td><div class="row-actions">'
        + tailorBtnHtml
        + '<button class="btn btn-ghost btn-compact jd-btn" data-key="' + esc(m.key) + '">JD</button>'
        + '<button class="btn btn-ghost btn-compact cv-btn' + disabledClass + '"' + ' data-path="' + encodedFile + '" data-key="' + esc(m.key) + '">CV</button>'
        + (hasCv ? '<a href="/api/cv-docx?path=' + encodedFile + '" class="btn btn-ghost btn-compact">DOC</a>' : '<span class="btn btn-ghost btn-compact is-disabled">DOC</span>')
        + (hasCv ? '<a href="/api/cv-pdf?path=' + encodedFile + '" class="btn btn-ghost btn-compact">PDF</a>' : '<span class="btn btn-ghost btn-compact is-disabled">PDF</span>')
        + '<a href="' + esc(m.url) + '" target="_blank" rel="noopener" class="external-link" title="Open original">\u2197</a>'
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
        autoCadence.classList.remove('is-hidden');
        autoCadence.value = s.cadence || 'daily';
        var nextEl = document.getElementById('schedule-next');
        if (nextEl && s.next_run) {
          nextEl.classList.remove('is-hidden');
          nextEl.textContent = 'next: ' + new Date(s.next_run).toLocaleString();
        }
      }
    });
    autoToggle.addEventListener('change', function() {
      var enabled = autoToggle.checked;
      var cadence = autoCadence.value || 'daily';
      autoCadence.classList.toggle('is-hidden', !enabled);
      jobsService.saveSchedule({ enabled, cadence }).then(function(s) {
        var nextEl = document.getElementById('schedule-next');
        if (nextEl && s.next_run) {
          nextEl.classList.remove('is-hidden');
          nextEl.textContent = 'next: ' + new Date(s.next_run).toLocaleString();
        } else if (nextEl) {
          nextEl.classList.add('is-hidden');
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
  btn.classList.add('is-loading');
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
        btn.classList.remove('is-loading');
        btn.textContent = 'Tailor \u25B8';
        alert('Promote failed: ' + result.status);
      }
    })
    .catch(function(e) {
      delete tailorState[key];
      btn.disabled = false;
      btn.classList.remove('is-loading');
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
