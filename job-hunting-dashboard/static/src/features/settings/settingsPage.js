
import { ICONS } from '../../shared/icons.js';
import { esc } from '../../shared/formatters.js';
import { settingsService } from './settingsService.js';

// ── Settings page ────────────────────────────────────
var _settingsData = null;
var _settingsDirty = false;

function buildSettingsView() {
  const div = document.createElement('div');
  div.className = 'fx-view';
  div.dataset.view = 'settings';

  div.innerHTML = '<div class="card card-accent" style="margin-bottom:20px;"><div class="card-label">Settings</div><div style="text-align:center;padding:24px;"><div style="font-size:48px;margin-bottom:12px;color:var(--gold);">\u2699\uFE0F</div><div style="font-size:16px;font-weight:700;">Loading settings...</div></div></div>';

  settingsService.getSettings().then(function(data) {
    _settingsData = data;
    _settingsDirty = false;
    renderSettings(div, data);
  }).catch(function(e) { div.innerHTML = '<div class="card" style="padding:24px;color:var(--coral);">Failed to load settings: ' + esc(e.message) + '</div>'; });

  return div;
}

function renderSettings(div, data) {
  var p = data.profile || {};
  var sys = data.system || {};
  var countries = data.country_display || ['United States', 'Spain'];
  var seniority = p.seniority || 'senior';
  var fc = p.first_cut_threshold || 50;
  var fn = p.final_threshold || 65;

  function chipHtml(items, name, placeholder) {
    var chips = (items || []).map(function(it) {
      return '<span class="settings-chip" data-name="' + name + '" data-value="' + esc(it) + '">' + esc(it) + ' <span class="chip-remove" data-name="' + name + '" data-value="' + esc(it) + '" style="cursor:pointer;opacity:0.6;">\u00D7</span></span>';
    }).join('');
    return chips + '<input class="chip-input" data-name="' + name + '" placeholder="' + placeholder + '" style="background:transparent;border:none;outline:none;color:var(--text);font-size:12px;padding:4px;min-width:80px;">';
  }

  div.innerHTML = '\
    <div class="card card-accent" style="margin-bottom:20px;">\
      <div class="card-label">Profile &amp; Targeting</div>\
      <div style="margin-bottom:16px;">\
        <div style="font-size:12px;color:var(--text-faint);margin-bottom:6px;">Seniority</div>\
        <div class="segmented-control" id="ctrl-seniority">\
          ' + ['junior','mid','senior','lead','principal','manager','any'].map(function(s) {
            return '<button class="seg-btn' + (s === seniority ? ' active' : '') + '" data-value="' + s + '">' + s + '</button>';
          }).join('') + '\
        </div>\
      </div>\
      <div style="margin-bottom:16px;">\
        <div style="font-size:12px;color:var(--text-faint);margin-bottom:6px;">Target Titles <span style="font-size:10px;color:var(--text-faint);">(type + Enter to add, \u00D7 to remove)</span></div>\
        <div class="chip-container" id="chips-titles">' + chipHtml(p.target_titles, 'target_titles', 'e.g. Senior Backend Engineer') + '</div>\
      </div>\
      <div style="margin-bottom:4px;">\
        <div style="font-size:12px;color:var(--text-faint);margin-bottom:6px;">Scoring Skills</div>\
        <div class="chip-container" id="chips-skills">' + chipHtml(p.scoring_skills, 'scoring_skills', 'e.g. .NET Core') + '</div>\
      </div>\
    </div>\
    <div class="card" style="margin-bottom:20px;">\
      <div class="card-label">Search</div>\
      <div style="margin-bottom:16px;">\
        <div style="font-size:12px;color:var(--text-faint);margin-bottom:6px;">Search Keywords</div>\
        <div class="chip-container" id="chips-queries">' + chipHtml(p.search_queries, 'search_queries', 'e.g. .NET') + '</div>\
      </div>\
      <div style="margin-bottom:16px;">\
        <div style="font-size:12px;color:var(--text-faint);margin-bottom:6px;">Country</div>\
        <select id="ctrl-country" multiple size="4" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);font-size:13px;">\
          ' + [
            'United States','Spain','United Kingdom','Germany','France','Canada','Australia','Brazil',
            'India','Netherlands','Italy','Switzerland','Austria','Belgium','Poland','South Africa',
            'Singapore','Hong Kong','Ireland','New Zealand','Sweden','United Arab Emirates',
            'Saudi Arabia','Mexico','Argentina','Chile','Colombia'
          ].map(function(c) {
            return '<option value="' + c + '"' + (countries.indexOf(c) > -1 ? ' selected' : '') + '>' + c + '</option>';
          }).join('') + '\
        </select>\
      </div>\
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">\
        <div><div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">Pages</div><input type="number" id="ctrl-pages" value="' + (p.pages || 2) + '" min="1" max="5" class="num-input"></div>\
        <div><div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">Max Posting Age (days)</div><input type="number" id="ctrl-days" value="' + (p.max_days_old || 120) + '" min="1" max="365" class="num-input"></div>\
        <div><div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">Results per Scan</div><input type="number" id="ctrl-results" value="' + (p.results_per_run || 60) + '" min="10" max="300" class="num-input"></div>\
      </div>\
    </div>\
    <div class="card" style="margin-bottom:20px;">\
      <div class="card-label">Scoring</div>\
      <div style="margin-bottom:16px;">\
        <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:var(--text-faint);">First-cut Threshold</span><span id="val-fc" style="font-weight:700;color:var(--gold);">' + fc + '</span></div>\
        <input type="range" id="slider-fc" min="0" max="100" value="' + fc + '" style="width:100%;">\
      </div>\
      <div>\
        <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:var(--text-faint);">Final Threshold</span><span id="val-fn" style="font-weight:700;color:var(--teal);">' + fn + '</span></div>\
        <input type="range" id="slider-fn" min="0" max="100" value="' + fn + '" style="width:100%;">\
      </div>\
    </div>\
    <div class="card" style="margin-bottom:20px;">\
      <div class="card-label">Job Sources</div>\
      <div style="display:flex;gap:24px;flex-wrap:wrap;">\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-adzuna"' + ((p.sources && p.sources.adzuna !== false) ? ' checked' : '') + '> Adzuna\
          <span style="font-size:10px;color:' + (sys.adzuna_has_key ? 'var(--teal)' : 'var(--coral)') + ';">(' + (sys.adzuna_has_key ? 'key set' : 'no key') + ')</span>\
        </label>\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-remotive"' + ((p.sources && p.sources.remotive !== false) ? ' checked' : '') + '> Remotive\
          <span style="font-size:10px;color:var(--teal);">(free)</span>\
        </label>\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-remoteok"' + ((p.sources && p.sources.remoteok) ? ' checked' : '') + '> Remote OK\
          <span style="font-size:10px;color:var(--teal);">(free)</span>\
        </label>\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-weworkremotely"' + ((p.sources && p.sources.weworkremotely) ? ' checked' : '') + '> We Work Remotely\
          <span style="font-size:10px;color:var(--teal);">(free)</span>\
        </label>\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-jobicy"' + ((p.sources && p.sources.jobicy) ? ' checked' : '') + '> Jobicy\
          <span style="font-size:10px;color:var(--teal);">(free)</span>\
        </label>\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-arbeitnow"' + ((p.sources && p.sources.arbeitnow) ? ' checked' : '') + '> Arbeitnow\
          <span style="font-size:10px;color:var(--teal);">(free · EU + remote · freelance/contract)</span>\
        </label>\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-getonboard"' + ((p.sources && p.sources.getonboard) ? ' checked' : '') + '> GetOnBoard\
          <span style="font-size:10px;color:var(--teal);">(free · LATAM tech · apply free)</span>\
        </label>\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-himalayas"' + ((p.sources && p.sources.himalayas) ? ' checked' : '') + '> Himalayas\
          <span style="font-size:10px;color:var(--teal);">(free · global contractor · apply free)</span>\
        </label>\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-graphqljobs"' + ((p.sources && p.sources.graphqljobs) ? ' checked' : '') + '> GraphQL Jobs\
          <span style="font-size:10px;color:var(--teal);">(free · global tech)</span>\
        </label>\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-reed"' + ((p.sources && p.sources.reed) ? ' checked' : '') + '> Reed.co.uk\
          <span style="font-size:10px;color:var(--teal);">(✅ key set · UK contract/temp)</span>\
        </label>\
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">\
          <input type="checkbox" id="src-jsearch"' + ((p.sources && p.sources.jsearch) ? ' checked' : '') + '> JSearch (LinkedIn/Indeed/Glassdoor)\
          <span style="font-size:10px;color:var(--teal);">(✅ key set · 200 req/mo free)</span>\
        </label>\
      </div>\
    </div>\
    <div class="card" style="margin-bottom:20px;">\
      <div class="card-label">System</div>\
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;">\
        <div>Model: <strong>' + esc(sys.model || '--') + '</strong></div>\
        <div>Gateway: <span style="color:var(--teal);">\u25CF ' + esc(sys.gateway || 'connected') + '</span></div>\
        <div>Slack: <span style="color:var(--teal);">\u25CF ' + esc(sys.slack || 'connected') + '</span></div>\
      </div>\
    </div>\
    <div style="display:flex;justify-content:flex-end;gap:12px;margin-bottom:40px;">\
      <button class="btn btn-primary" id="btn-save-settings" disabled style="opacity:0.5;"><span id="save-icon">\u2714</span> <span id="save-text">Save Changes</span></button>\
    </div>\
  ';

  // ── Wire interactivity ──
  markDirty();

  // Seniority segmented buttons
  div.querySelectorAll('.seg-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      div.querySelectorAll('.seg-btn').forEach(function(x) { x.classList.remove('active'); });
      b.classList.add('active');
      markDirty();
    });
  });

  // Sliders
  ['fc','fn'].forEach(function(id) {
    var slider = document.getElementById('slider-' + id);
    if (!slider) return;
    slider.addEventListener('input', function() {
      document.getElementById('val-' + id).textContent = slider.value;
      markDirty();
    });
  });

  // Chip inputs (type + Enter to add)
  div.querySelectorAll('.chip-input').forEach(function(inp) {
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var val = inp.value.trim();
        if (!val) return;
        var name = inp.getAttribute('data-name');
        var chip = document.createElement('span');
        chip.className = 'settings-chip';
        chip.setAttribute('data-name', name);
        chip.setAttribute('data-value', val);
        chip.innerHTML = esc(val) + ' <span class="chip-remove" data-name="' + name + '" data-value="' + esc(val) + '" style="cursor:pointer;opacity:0.6;">\u00D7</span>';
        inp.parentNode.insertBefore(chip, inp);
        inp.value = '';
        markDirty();
        // Wire the new remove button
        chip.querySelector('.chip-remove').addEventListener('click', function() {
          chip.remove();
          markDirty();
        });
      }
    });
  });

  // Chip × remove (existing)
  div.querySelectorAll('.chip-remove').forEach(function(x) {
    x.addEventListener('click', function() {
      var chip = x.parentNode;
      if (chip) chip.remove();
      markDirty();
    });
  });

  // All inputs
  div.querySelectorAll('input, select').forEach(function(el) {
    el.addEventListener('change', markDirty);
    if (el.tagName === 'INPUT' && el.type !== 'checkbox') {
      el.addEventListener('input', markDirty);
    }
  });
}

function markDirty() {
  _settingsDirty = true;
  var btn = document.getElementById('btn-save-settings');
  var icon = document.getElementById('save-icon');
  var txt = document.getElementById('save-text');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  if (txt) txt.textContent = 'Save Changes';
  if (icon) icon.innerHTML = '\u2714';

  // Wire save (once)
  var saveBtn = document.getElementById('btn-save-settings');
  if (saveBtn && !saveBtn._wired) {
    saveBtn._wired = true;
    saveBtn.addEventListener('click', saveSettings);
  }
}

function saveSettings() {
  var btn = document.getElementById('btn-save-settings');
  var icon = document.getElementById('save-icon');
  var txt = document.getElementById('save-text');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  if (txt) txt.textContent = 'Saving\u2026';
  if (icon) icon.innerHTML = '\u23F3';

  // Gather all values
  // Seniority
  var activeSeniority = document.querySelector('.seg-btn.active');
  var seniority = activeSeniority ? activeSeniority.getAttribute('data-value') : 'senior';

  // Chips
  function gatherChips(name) {
    var chips = document.querySelectorAll('.settings-chip[data-name="' + name + '"]');
    return Array.from(chips).map(function(c) { return c.getAttribute('data-value'); }).filter(Boolean);
  }

  // Country
  var countrySelect = document.getElementById('ctrl-country');
  var countryNames = countrySelect ? Array.from(countrySelect.selectedOptions).map(function(o) { return o.value; }) : ['United States','Spain'];

  var body = {
    seniority: seniority,
    target_titles: gatherChips('target_titles'),
    scoring_skills: gatherChips('scoring_skills'),
    search_queries: gatherChips('search_queries'),
    country: countryNames,
    pages: parseInt(document.getElementById('ctrl-pages')?.value || '2'),
    max_days_old: parseInt(document.getElementById('ctrl-days')?.value || '120'),
    results_per_run: parseInt(document.getElementById('ctrl-results')?.value || '60'),
    first_cut_threshold: parseInt(document.getElementById('slider-fc')?.value || '50'),
    final_threshold: parseInt(document.getElementById('slider-fn')?.value || '65'),
    sources: {
      adzuna: document.getElementById('src-adzuna')?.checked || false,
      remotive: document.getElementById('src-remotive')?.checked || false,
      remoteok: document.getElementById('src-remoteok')?.checked || false,
      weworkremotely: document.getElementById('src-weworkremotely')?.checked || false,
      jobicy: document.getElementById('src-jobicy')?.checked || false,
      arbeitnow: document.getElementById('src-arbeitnow')?.checked || false,
      getonboard: document.getElementById('src-getonboard')?.checked || false,
      himalayas: document.getElementById('src-himalayas')?.checked || false,
      graphqljobs: document.getElementById('src-graphqljobs')?.checked || false,
      reed: document.getElementById('src-reed')?.checked || false,
      jsearch: document.getElementById('src-jsearch')?.checked || false,
    },
  };

  settingsService.saveSettings(body).then(function(result) {
    _settingsDirty = false;
    if (txt) txt.textContent = 'Saved!';
    if (icon) icon.innerHTML = '\u2713';
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
    if (result.errors && result.errors.length) {
      console.warn('Settings saved with warnings:', result.errors);
    }
    // Refresh profile in background
    _settingsData = result;
  }).catch(function(e) {
    if (txt) txt.textContent = 'Save Failed';
    if (icon) icon.innerHTML = '\u2717';
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    alert('Error: ' + e.message);
  });
}

export function createSettingsPage() {
  return {
    id: 'settings',
    title: 'Settings',
    navLabel: 'Settings',
    icon: ICONS.settings,
    primary: true,
    render: buildSettingsView,
  };
}
