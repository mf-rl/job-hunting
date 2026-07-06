
import { ICONS } from '../../shared/icons.js';
import { esc } from '../../shared/formatters.js';
import { cvService } from './cvService.js';

// ── CV page ────────────────────────────────────────────
let _cvDiv = null;
let _cvRender = null;

function buildCvView() {
  function renderBuilding() {
    return '<div class="card" style="text-align:center;padding:40px;">' +
      '<div style="font-size:48px;margin-bottom:12px;color:var(--gold);">' + ICONS.zap + '</div>' +
      '<div style="font-size:16px;font-weight:700;margin-bottom:4px;">Building Profile from CV…</div>' +
      '<div style="font-size:13px;color:var(--text-secondary);">Extracting text, structuring experience, and deriving your search profile.</div>' +
    '</div>';
  }

  function renderUpload(status) {
    const baseCv = status?.base_cv;
    const profile = status?.profile;
    const rawFn = status?.raw_filename;

    let html = '<div class="cv-dropzone card" id="cv-dropzone" style="text-align:center;padding:48px;border:2px dashed var(--border);cursor:pointer;margin-bottom:20px;">' +
      '<div style="font-size:36px;margin-bottom:12px;color:var(--gold);">' + ICONS.cv + '</div>' +
      '<div style="font-size:16px;font-weight:600;margin-bottom:4px;">Drop your CV here</div>' +
      '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">or click to browse — PDF, DOCX, MD, TXT</div>' +
      '<input type="file" id="cv-file-input" accept=".pdf,.docx,.md,.txt" style="display:none;">' +
      '<button class="btn btn-primary" id="cv-upload-btn">Upload CV</button></div>';

    if (baseCv) {
      const skillCount = (baseCv.skills || []).reduce((s,g) => s + (g.items||[]).length, 0);
      let titlesHtml = '', queriesHtml = '';
      if (profile) {
        titlesHtml = (profile.target_titles || []).map(t => '<span class="badge badge-ok" style="margin:1px;">' + esc(t) + '</span>').join(' ');
        queriesHtml = (profile.search_queries || []).map(q => '<span class="badge badge-mid" style="margin:1px;">' + esc(q) + '</span>').join(' ');
      }

      html +=
        '<div class="grid grid-2" style="margin-bottom:20px;">' +
          '<div class="card card-accent">' +
            '<div class="card-label">Profile</div>' +
            '<div style="font-size:18px;font-weight:700;">' + esc(baseCv.name || '—') + '</div>' +
            '<div style="font-size:13px;color:var(--text-secondary);">' + esc(baseCv.headline || '') + '</div>' +
            (baseCv.contact?.email ? '<div style="font-size:12px;color:var(--text-faint);margin-top:4px;">' + esc(baseCv.contact.email) + '</div>' : '') +
            '<div style="margin-top:8px;font-size:12px;color:var(--text-secondary);">' +
              '<strong>' + (baseCv.experience || []).length + '</strong> positions · ' +
              '<strong>' + skillCount + '</strong> skills · ' +
              '<strong>' + (baseCv.languages || []).length + '</strong> languages' +
            '</div></div>' +
          '<div class="card card-accent">' +
            '<div class="card-label">Search Profile</div>' +
            (profile ?
              '<div style="font-size:13px;margin-bottom:6px;"><span style="color:var(--text-faint);">Titles:</span> ' + titlesHtml + '</div>' +
              '<div style="font-size:13px;margin-bottom:6px;"><span style="color:var(--text-faint);">Queries:</span> ' + queriesHtml + '</div>' +
              '<div style="font-size:13px;"><span style="color:var(--text-faint);">Seniority:</span> <strong>' + esc(profile.seniority || '—') + '</strong></div>'
            : '<div style="color:var(--text-faint);font-size:13px;">No profile derived yet — upload your CV.</div>') +
          '</div></div>';

      // Experience
      html += '<div class="card" style="margin-bottom:20px;"><div class="card-label">Experience</div>';
      if ((baseCv.experience || []).length) {
        baseCv.experience.forEach(function(exp) {
          html += '<div style="padding:8px 0;border-bottom:1px solid var(--border);">' +
            '<div style="display:flex;justify-content:space-between;">' +
              '<div style="font-weight:600;font-size:14px;">' + esc(exp.role || '') + '</div>' +
              '<div style="font-size:12px;color:var(--text-faint);">' + esc(exp.start || '') + ' — ' + esc(exp.end || '') + '</div>' +
            '</div>' +
            '<div style="font-size:13px;color:var(--text-secondary);">' + esc(exp.company || '') + (exp.location ? ' · ' + esc(exp.location) : '') + '</div>' +
            '<ul style="margin:4px 0 0 16px;font-size:12px;color:var(--text-secondary);">';
          (exp.bullets || []).forEach(function(b) { html += '<li>' + esc(b) + '</li>'; });
          html += '</ul></div>';
        });
      } else {
        html += '<div style="font-size:13px;color:var(--text-faint);">No experience extracted.</div>';
      }
      html += '</div>';

      // Skills
      html += '<div class="card" style="margin-bottom:20px;"><div class="card-label">Skills</div>';
      if ((baseCv.skills || []).length) {
        baseCv.skills.forEach(function(sg) {
          html += '<div style="margin-bottom:8px;"><div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">' + esc(sg.category || '') + '</div>' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap;">';
          (sg.items || []).forEach(function(s) { html += '<span class="badge badge-ok" style="font-size:11px;">' + esc(s) + '</span>'; });
          html += '</div></div>';
        });
      } else {
        html += '<div style="font-size:13px;color:var(--text-faint);">No skills extracted.</div>';
      }
      html += '</div>';

      html += '<div style="display:flex;gap:12px;margin-bottom:20px;">' +
        '<button class="btn btn-ghost" id="cv-reupload-btn">Replace CV</button>' +
        (rawFn ? '<span style="font-size:11px;color:var(--text-faint);align-self:center;">Current: ' + esc(rawFn) + '</span>' : '') +
      '</div>';
    } else {
      html += '<div class="card" style="text-align:center;padding:32px;">' +
        '<div style="font-size:13px;color:var(--text-faint);">No CV uploaded yet. Drop your file above to get started.</div></div>';
    }
    return html;
  }

  function render(status) {
    const building = status?.building;
    return '<div class="card card-accent" style="margin-bottom:20px;">' +
      '<div class="eyebrow-line">Curriculum Vitae</div>' +
      '<h1 class="hero-title">Your CV</h1>' +
      '<p style="color:var(--text-secondary);font-size:13px;margin-top:6px;">Upload your CV (PDF, DOCX, MD, or TXT). We extract the text, structure it, and derive a search profile — never hand-write anything.</p>' +
    '</div>' +
    (building ? renderBuilding() : renderUpload(status));
  }

  const div = document.createElement('div');
  div.className = 'fx-view';
  div.dataset.view = 'cv';
  div.innerHTML = render(null);

  // Store references so uploadFile can trigger re-renders
  _cvDiv = div;
  _cvRender = render;

  // Wire drop zone after DOM mount
  setTimeout(() => {
    const dropzone = document.getElementById('cv-dropzone');
    const fileInput = document.getElementById('cv-file-input');
    const uploadBtn = document.getElementById('cv-upload-btn');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--gold)'; });
      dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--border)');
      dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border)';
        if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) uploadFile(fileInput.files[0]);
      });
      // uploadBtn will bubble click to dropzone which opens file picker
    }

    // Re-upload button
    const reup = document.getElementById('cv-reupload-btn');
    if (reup) reup.addEventListener('click', () => {
      const inp = document.getElementById('cv-file-input');
      if (inp) inp.click();
    });

    // Poll /api/cv for building state
    pollCvStatus(div, render);
  }, 50);

  return div;
}

let _cvPollTimer = null;

function pollCvStatus(div, render) {
  async function check() {
    try {
      const r = await cvService.getStatus();
      div.innerHTML = render(r);
      // Re-wire events
      setTimeout(() => {
        const dropzone = document.getElementById('cv-dropzone');
        const fileInput = document.getElementById('cv-file-input');
        if (dropzone && fileInput) {
          dropzone.addEventListener('click', () => fileInput.click());
          dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--gold)'; });
          dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--border)');
          dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border)';
            if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
          });
          fileInput.addEventListener('change', () => {
            if (fileInput.files.length) uploadFile(fileInput.files[0]);
          });
          const uploadBtn = document.getElementById('cv-upload-btn');
          // uploadBtn will bubble click to dropzone which opens file picker
        }
        const reup = document.getElementById('cv-reupload-btn');
        if (reup) reup.addEventListener('click', () => {
          const inp = document.getElementById('cv-file-input');
          if (inp) inp.click();
        });
      }, 50);

      if (r.building) {
        _cvPollTimer = setTimeout(check, 2000);
      } else {
        _cvPollTimer = null;
      }
    } catch(e) {
      console.warn('CV poll failed:', e);
      _cvPollTimer = setTimeout(check, 5000);
    }
  }
  check();
}

function uploadFile(file) {
  cvService.upload(file)
    .then(d => {
      // Immediately re-poll so the "building" state shows
      if (_cvDiv && _cvRender) {
        cvService.getStatus().then(function(data) {
          _cvDiv.innerHTML = _cvRender(data);
          // Re-wire events after render
          setTimeout(function() {
            var dz = document.getElementById('cv-dropzone');
            var fi = document.getElementById('cv-file-input');
            if (dz && fi) {
              dz.addEventListener('click', function() { fi.click(); });
              dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.style.borderColor = 'var(--gold)'; });
              dz.addEventListener('dragleave', function() { dz.style.borderColor = 'var(--border)'; });
              dz.addEventListener('drop', function(e) {
                e.preventDefault();
                dz.style.borderColor = 'var(--border)';
                if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
              });
              fi.addEventListener('change', function() {
                if (fi.files.length) uploadFile(fi.files[0]);
              });
              var ub = document.getElementById('cv-upload-btn');
              // ub will bubble click to dropzone which opens file picker
            }
            var reup = document.getElementById('cv-reupload-btn');
            if (reup) reup.addEventListener('click', function() {
              var inp = document.getElementById('cv-file-input');
              if (inp) inp.click();
            });
          }, 50);
          // If still building, start polling
          if (data.building) {
            if (_cvPollTimer) clearTimeout(_cvPollTimer);
            _cvPollTimer = setTimeout(function() { pollCvStatus(_cvDiv, _cvRender); }, 2000);
          }
        });
      }
    })
    .catch(function(e) { alert('Upload failed: ' + e.message); });
}

export function createCvPage() {
  return {
    id: 'cv',
    title: 'CV',
    navLabel: 'CV',
    icon: ICONS.cv,
    primary: true,
    render: buildCvView,
    onShow() {
      if (_cvDiv && _cvRender) {
        if (_cvPollTimer) { clearTimeout(_cvPollTimer); _cvPollTimer = null; }
        pollCvStatus(_cvDiv, _cvRender);
      }
    },
  };
}
