
import { ICONS } from '../../shared/icons.js';
import { esc } from '../../shared/formatters.js';
import { customService } from './customService.js';

let customTailorState = 'idle';
let customCvPath = '';
// ── Custom CV Tailor page ─────────────────────────────

var _customParsed = null;      // { source_ref, title, company, location, remote_mode, salary, date_posted, jd_json, extracted }
var _customKey = null;         // key of the job currently being tailored or already tailored
var _customPollTimer = null;
var _customCurrentDescription = '';    // preserves pasted description across re-renders
var _customParseLoading = false;

function buildCustomView() {
  const div = document.createElement('div');
  div.className = 'fx-view';
  div.dataset.view = 'custom';
  div.id = 'custom-view-root';
  renderCustomView(div);
  return div;
}

function renderCustomView(container) {
  if (!container) container = document.getElementById('custom-view-root');
  if (!container) return;

  var parsed = _customParsed;
  var tailorState = _customKey ? (customTailorState || 'idle') : 'idle';
  var descriptionValue = _customCurrentDescription || (parsed && parsed.description) || '';

  var heroHtml = '<div class="card card-accent" style="margin-bottom:20px;">'
    + '<div class="eyebrow-line">Custom Tailoring</div>'
    + '<h1 class="hero-title">Tailor CV from pasted job description</h1>'
    + '<p style="color:var(--text-secondary);font-size:13px;margin-top:6px;">'
    + 'Paste the full job description text, parse the details, and tailor your CV specifically for it.'
    + '</p></div>';

  var inputHtml = '<div class="card" style="margin-bottom:20px;">'
    + '<div class="card-label">Job Description</div>'
    + '<textarea id="custom-description-input" class="fx-input" rows="12" placeholder="Paste the full job description here..." '
    + 'style="width:100%;min-height:220px;resize:vertical;line-height:1.5;">' + esc(descriptionValue) + '</textarea>'
    + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;">'
    + '<button id="custom-parse-btn" class="btn btn-primary" style="white-space:nowrap;"'
    + (_customParseLoading ? ' disabled' : '') + '>'
    + '<span id="custom-parse-icon">' + (_customParseLoading ? '&#9203;' : '&#128196;') + '</span>'
    + ' <span id="custom-parse-text">' + (_customParseLoading ? 'Parsing...' : 'Parse Description') + '</span>'
    + '</button>'
    + '<div style="font-size:12px;color:var(--text-faint);">No URL fetch is performed.</div>'
    + '</div>'
    + '<div id="custom-fetch-error" style="margin-top:8px;font-size:12px;color:var(--coral);display:none;"></div>'
    + '</div>';

  // Loading panel — shown while parse is in progress
  var loadingHtml = '';
  if (_customParseLoading) {
    loadingHtml = '<div class="card" style="margin-bottom:20px;text-align:center;padding:40px 24px;">'
      + '<div style="font-size:36px;margin-bottom:14px;">&#9203;</div>'
      + '<div style="font-size:15px;font-weight:700;margin-bottom:6px;">Parsing job description...</div>'
      + '<div style="font-size:13px;color:var(--text-secondary);">Extracting details from the pasted description with Job Reader.</div>'
      + '</div>';
  }

  // Details panel — shown after a successful fetch
  var detailsHtml = '';
  if (!_customParseLoading && parsed) {
    var modeColor = parsed.remote_mode === 'remote' ? 'var(--teal)' : parsed.remote_mode === 'hybrid' ? 'var(--gold)' : 'var(--text-secondary)';
    var modeLabel = parsed.remote_mode || 'not specified';

    detailsHtml = '<div class="card card-accent" style="margin-bottom:20px;">'
      + '<div class="card-label">Parsed Job Details</div>'
      + '<div class="grid grid-2" style="margin-bottom:16px;">'
        + '<div>'
          + '<div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Title</div>'
          + '<div style="font-size:16px;font-weight:700;">' + esc(parsed.title || '—') + '</div>'
        + '</div>'
        + '<div>'
          + '<div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Company</div>'
          + '<div style="font-size:16px;font-weight:700;">' + esc(parsed.company || '—') + '</div>'
        + '</div>'
        + '<div>'
          + '<div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Location</div>'
          + '<div style="font-size:13px;">' + esc(parsed.location || '—') + '</div>'
        + '</div>'
        + '<div>'
          + '<div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Mode</div>'
          + '<div style="font-size:13px;font-weight:600;color:' + modeColor + ';">' + esc(modeLabel) + '</div>'
        + '</div>'
        + '<div>'
          + '<div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Salary</div>'
          + '<div style="font-size:13px;">' + esc(parsed.salary || '—') + '</div>'
        + '</div>'
        + '<div>'
          + '<div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Date Posted</div>'
          + '<div style="font-size:13px;">' + esc(parsed.date_posted || '—') + '</div>'
        + '</div>'
      + '</div>';

    // Skills
    var reqSkills = (parsed.extracted && parsed.extracted.required_skills) || [];
    var prefSkills = (parsed.extracted && parsed.extracted.preferred_skills) || [];
    if (reqSkills.length || prefSkills.length) {
      detailsHtml += '<div style="margin-bottom:14px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid var(--border-light);">';
      if (reqSkills.length) {
        detailsHtml += '<div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Required Skills</div>'
          + '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;">'
          + reqSkills.map(function(s) { return '<span class="badge badge-ok" style="font-size:11px;">' + esc(s) + '</span>'; }).join('')
          + '</div>';
      }
      if (prefSkills.length) {
        detailsHtml += '<div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Preferred Skills</div>'
          + '<div style="display:flex;gap:4px;flex-wrap:wrap;">'
          + prefSkills.map(function(s) { return '<span class="badge badge-mid" style="font-size:11px;">' + esc(s) + '</span>'; }).join('')
          + '</div>';
      }
      detailsHtml += '</div>';
    }

    // Responsibilities — show all
    var resps = (parsed.extracted && parsed.extracted.responsibilities) || [];
    if (resps.length) {
      detailsHtml += '<div style="margin-bottom:14px;">'
        + '<div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Key Responsibilities</div>'
        + '<ul style="margin:0 0 0 16px;padding:0;font-size:12px;color:var(--text-secondary);line-height:1.6;">'
        + resps.map(function(r) { return '<li style="margin-bottom:2px;">' + esc(r) + '</li>'; }).join('')
        + '</ul></div>';
    }

    // Full description text panel (raw scraped text)
    if (parsed.description && parsed.description.length > 50) {
      detailsHtml += '<details style="margin-bottom:14px;">'
        + '<summary style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;cursor:pointer;user-select:none;padding:4px 0;list-style:none;display:flex;align-items:center;gap:6px;">'
        + '<span style="font-size:10px;color:var(--gold);">&#9654;</span> Full Job Description</summary>'
        + '<div style="margin-top:10px;padding:12px;background:rgba(0,0,0,0.25);border-radius:8px;border:1px solid var(--border-light);'
        + 'max-height:360px;overflow-y:auto;font-size:12px;color:var(--text-secondary);line-height:1.7;white-space:pre-wrap;word-break:break-word;">'
        + esc(parsed.description)
        + '</div></details>';
    }

    // Action buttons
    var storedCvPath = customCvPath || '';
    var hasCvNow = storedCvPath.length > 0;
    var encodedCv = hasCvNow ? encodeURIComponent(storedCvPath.split('/').pop()) : '';

    var tailorBtnHtml;
    if (tailorState === 'promoting') {
      tailorBtnHtml = '<button class="btn btn-primary" disabled style="opacity:0.7;">&#9203; Tailoring…</button>';
    } else if (hasCvNow) {
      tailorBtnHtml = '<button class="btn btn-primary" disabled style="background:var(--teal);color:#0B1120;cursor:default;">&#10003; Tailored</button>';
    } else {
      tailorBtnHtml = '<button id="custom-tailor-btn" class="btn btn-primary">&#128196; Tailor CV</button>';
    }

    var docBtnHtml = hasCvNow
      ? '<a href="/api/cv-docx?path=' + encodedCv + '" class="btn btn-ghost" style="text-decoration:none;" target="_blank">DOC</a>'
      : '<span class="btn btn-ghost" style="opacity:0.4;pointer-events:none;">DOC</span>';
    var pdfBtnHtml = hasCvNow
      ? '<a href="/api/cv-pdf?path=' + encodedCv + '" class="btn btn-ghost" style="text-decoration:none;" target="_blank">PDF</a>'
      : '<span class="btn btn-ghost" style="opacity:0.4;pointer-events:none;">PDF</span>';

    var originalLinkHtml = parsed.url && parsed.url.match(/^https?:\/\//i)
      ? '<a href="' + esc(parsed.url) + '" target="_blank" rel="noopener" style="font-size:13px;color:var(--text-faint);text-decoration:none;margin-left:4px;" title="Open original posting">&#8599; View Original</a>'
      : '';

    detailsHtml += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--border-light);">'
      + tailorBtnHtml + ' ' + docBtnHtml + ' ' + pdfBtnHtml + originalLinkHtml
      + '</div>'
      + '</div>';
  }

  // History table
  var historyHtml = '<div class="card" style="margin-bottom:20px;">'
    + '<div class="card-label">Tailored History</div>'
    + '<div id="custom-history-body" style="font-size:13px;color:var(--text-faint);padding:12px 0;text-align:center;">Loading…</div>'
    + '</div>';

  container.innerHTML = heroHtml + inputHtml + loadingHtml + detailsHtml + historyHtml;

  // ── Wire parse button using container.querySelector (works even before DOM attach) ──
  var parseBtn = container.querySelector('#custom-parse-btn');
  var descriptionInput = container.querySelector('#custom-description-input');

  if (descriptionInput) {
    descriptionInput.addEventListener('input', function() {
      _customCurrentDescription = descriptionInput.value.trim();
    });
  }

  if (parseBtn && descriptionInput) {
    parseBtn.addEventListener('click', function() {
      var description = descriptionInput.value.trim();
      _customCurrentDescription = description;

      if (description.length < 80) {
        var errEl = container.querySelector('#custom-fetch-error');
        if (errEl) { errEl.textContent = 'Paste the full job description before parsing.'; errEl.style.display = 'block'; }
        return;
      }

      _customParseLoading = true;
      _customParsed = null;
      _customKey = null;
      customTailorState = 'idle';
      customCvPath = '';
      renderCustomView(container);

      customService.parseDescription(description).then(function(data) {
        _customParseLoading = false;
        _customParsed = data;
        _customCurrentDescription = data.description || description;
        _customKey = null;
        customTailorState = 'idle';
        customCvPath = '';
        renderCustomView(container);
        loadCustomHistory();
      }).catch(function(e) {
        _customParseLoading = false;
        renderCustomView(container);
        var errEl = container.querySelector('#custom-fetch-error');
        if (errEl) { errEl.textContent = 'Error: ' + e.message; errEl.style.display = 'block'; }
      });
    });
  }

  // ── Wire tailor button ──
  var tailorBtn = container.querySelector('#custom-tailor-btn');
  if (tailorBtn && parsed) {
    tailorBtn.addEventListener('click', function() {
      tailorBtn.disabled = true;
      tailorBtn.innerHTML = '&#9203; Tailoring…';

      customService.promote({
        source_ref: parsed.source_ref || '',
        title: parsed.title,
        company: parsed.company,
        description: parsed.description || '',
        jd_json: parsed.jd_json || '',
        location: parsed.location || '',
        remote_mode: parsed.remote_mode || '',
        salary: parsed.salary || '',
        date_posted: parsed.date_posted || '',
      }).then(function(result) {
        if (result.status === 409) {
          var d = result.body || {};
          if (d.detail && d.detail.indexOf('tailored') > -1) {
            customTailorState = 'idle';
            loadCustomHistory();
          } else {
            customTailorState = 'promoting';
            renderCustomView(container);
            loadCustomHistory();
          }
          return null;
        }
        if (!result.ok) throw new Error((result.body && result.body.detail) || 'Promote failed');
        return result.body;
      }).then(function(data) {
        if (!data) return;
        _customKey = data.key;
        customTailorState = 'promoting';
        renderCustomView(container);
        pollCustomStatus(_customKey, container);
      }).catch(function(e) {
        tailorBtn.disabled = false;
        tailorBtn.innerHTML = '&#128196; Tailor CV';
        var errEl = container.querySelector('#custom-fetch-error');
        if (errEl) { errEl.textContent = 'Tailor error: ' + e.message; errEl.style.display = 'block'; }
      });
    });
  }

  // Load history on every render
  loadCustomHistory();
}

function pollCustomStatus(key, container) {
  if (_customPollTimer) clearTimeout(_customPollTimer);
  _customPollTimer = setTimeout(function doCheck() {
    customService.getStatus(key)
      .then(function(data) {
        if (data.cv_path) {
          // Done
          customTailorState = 'done';
          customCvPath = data.cv_path.split('/').pop();
          renderCustomView(container);
          loadCustomHistory();
        } else if (data.promoting || data.status === 'seen') {
          // Still in progress
          _customPollTimer = setTimeout(doCheck, 3000);
        } else {
          // Failed or unexpected state
          customTailorState = 'idle';
          renderCustomView(container);
          loadCustomHistory();
        }
      })
      .catch(function() {
        _customPollTimer = setTimeout(doCheck, 5000);
      });
  }, 3000);
}

function loadCustomHistory() {
  var bodyEl = document.getElementById('custom-history-body');
  if (!bodyEl) return;
  customService.listJobs()
    .then(function(data) {
      var jobs = data.jobs || [];
      if (!jobs.length) {
        bodyEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-faint);">No custom-tailored jobs yet.</div>';
        return;
      }
      var html = '<div style="overflow-x:auto;"><table class="fx-table" style="width:100%;">'
        + '<thead><tr><th>Title</th><th>Company</th><th>Location</th><th>Mode</th><th>Status</th><th>Created</th><th style="width:180px;">Actions</th></tr></thead>'
        + '<tbody>';
      jobs.forEach(function(j) {
        var cvFile = j.cv_path ? j.cv_path.split('/').pop() : '';
        var encodedCv = cvFile ? encodeURIComponent(cvFile) : '';
        var hasCv = cvFile.length > 0;
        var statusBadge = j.status === 'tailored'
          ? '<span class="badge badge-ok">tailored</span>'
          : j.status === 'failed'
            ? '<span class="badge badge-fail">failed</span>'
            : '<span class="badge badge-mid">' + esc(j.status) + '</span>';
        var docBtn = hasCv
          ? '<a href="/api/cv-docx?path=' + encodedCv + '" class="btn btn-ghost" style="padding:2px 8px;font-size:10px;text-decoration:none;" target="_blank">DOC</a>'
          : '<span class="btn btn-ghost" style="padding:2px 8px;font-size:10px;opacity:0.4;pointer-events:none;">DOC</span>';
        var pdfBtn = hasCv
          ? '<a href="/api/cv-pdf?path=' + encodedCv + '" class="btn btn-ghost" style="padding:2px 8px;font-size:10px;text-decoration:none;" target="_blank">PDF</a>'
          : '<span class="btn btn-ghost" style="padding:2px 8px;font-size:10px;opacity:0.4;pointer-events:none;">PDF</span>';
        var modeColor = j.remote_mode === 'remote' ? 'var(--teal)' : j.remote_mode === 'hybrid' ? 'var(--gold)' : 'var(--text-faint)';
        var sourceLink = j.url && j.url.match(/^https?:\/\//i)
          ? '<a href="' + esc(j.url) + '" target="_blank" rel="noopener" style="padding:2px 6px;font-size:14px;color:var(--text-faint);text-decoration:none;" title="Open original">&#8599;</a>'
          : '';
        html += '<tr>'
          + '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(j.title) + '">' + esc(j.title) + '</td>'
          + '<td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);">' + esc(j.company) + '</td>'
          + '<td style="font-size:12px;color:var(--text-faint);">' + esc(j.location || '—') + '</td>'
          + '<td style="font-size:11px;font-weight:600;color:' + modeColor + ';">' + esc(j.remote_mode || '—') + '</td>'
          + '<td>' + statusBadge + '</td>'
          + '<td style="font-size:11px;color:var(--text-faint);">' + esc((j.created_at || '').slice(0, 10)) + '</td>'
          + '<td><div style="display:flex;gap:4px;">' + docBtn + pdfBtn + sourceLink + '</div></td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
      bodyEl.innerHTML = html;
    })
    .catch(function(e) {
      bodyEl.innerHTML = '<div style="color:var(--coral);padding:12px;">Failed to load history: ' + esc(e.message) + '</div>';
    });
}

export function createCustomPage() {
  return {
    id: 'custom',
    title: 'Custom',
    navLabel: 'Custom',
    icon: ICONS.custom,
    primary: true,
    render: buildCustomView,
    onShow: loadCustomHistory,
  };
}
