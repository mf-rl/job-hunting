
import { ICONS } from '../shared/icons.js';
import { runService } from '../shared/services/runService.js';

function buildAtmosphere() {
  const div = document.createElement('div');
  div.id = 'fx-atmosphere';
  div.innerHTML = '<div id="fx-glow-gold"></div><div id="fx-glow-blue"></div><div id="fx-grid"></div>';
  document.body.prepend(div);
}

function buildSidebar(router, pages) {
  const sidebar = document.createElement('nav');
  sidebar.id = 'fx-sidebar';
  const brand = document.createElement('div');
  brand.id = 'fx-brand';
  brand.innerHTML = '<span class="diamond">\u25C6</span><span class="brand-text">FORGE</span>';

  const nav = document.createElement('div');
  nav.id = 'fx-nav';
  pages.filter((page) => page.primary).forEach((page) => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.view = page.id;
    btn.innerHTML = `<span class="nav-icon">${page.icon}</span> ${page.navLabel}`;
    btn.addEventListener('click', () => router.switchTo(page.id));
    nav.appendChild(btn);
  });

  const footer = document.createElement('div');
  footer.id = 'fx-nav-footer';
  const design = pages.find((page) => page.id === 'designref');
  if (design) {
    const designBtn = document.createElement('button');
    designBtn.className = 'nav-item';
    designBtn.dataset.view = design.id;
    designBtn.innerHTML = `<span class="nav-icon">${design.icon}</span> ${design.navLabel}`;
    designBtn.addEventListener('click', () => router.switchTo(design.id));
    footer.appendChild(designBtn);
  }

  const miniFleet = document.createElement('div');
  miniFleet.id = 'sidebar-mini-fleet';
  miniFleet.innerHTML = `
    <div class="mini-row">
      <div class="mini-agent" style="--accent:#EAC266">FRG</div>
      <div class="mini-agent" style="--accent:#6EB8FF">SCT</div>
      <div class="mini-agent" style="--accent:#00C89C">RDR</div>
      <div class="mini-agent" style="--accent:#FF7C68">ADP</div>
    </div>
    <div class="mini-readout"><strong id="mini-online">0</strong> / 04 ONLINE</div>
  `;
  sidebar.append(brand, nav, footer, miniFleet);
  document.body.prepend(sidebar);
}

function buildTopbar() {
  const topbar = document.createElement('header');
  topbar.id = 'fx-topbar';
  topbar.innerHTML = `
    <div id="fx-topbar-title"><span class="eyebrow">Mission Control</span><span id="fx-page-title">Overview</span></div>
    <div id="fx-topbar-right">
      <button class="btn btn-ghost" id="btn-theme" style="padding:4px 10px;font-size:13px;cursor:pointer;" title="Toggle theme">&#9790;</button>
      <button class="btn btn-primary" id="btn-scan-top" style="padding:4px 14px;font-size:11px;display:none;"><span id="btn-scan-icon">&#9889;</span> <span id="btn-scan-text">Scan Now</span></button>
      <span class="chip" id="chip-run"><span class="chip-dot off" id="chip-run-dot"></span><span id="chip-run-text">Idle</span></span>
      <span class="chip" id="chip-model"><span class="chip-dot on"></span><span id="chip-model-text">--</span></span>
      <span class="chip" id="chip-gw"><span class="chip-dot on"></span>Gateway</span>
      <span class="chip" id="chip-slack"><span class="chip-dot on"></span>Slack</span>
      <span class="chip" id="chip-clock">${ICONS.clock} <span id="clock-display" data-clock>--:--:--</span></span>
    </div>`;
  document.body.appendChild(topbar);
}

function buildMobileNav(router, pages) {
  const nav = document.createElement('nav');
  nav.id = 'fx-mobile-nav';
  pages.filter((page) => page.primary).forEach((page) => {
    const btn = document.createElement('button');
    btn.className = 'mobile-nav-item';
    btn.dataset.view = page.id;
    btn.innerHTML = `${page.icon}<span>${page.navLabel}</span>`;
    btn.addEventListener('click', () => router.switchTo(page.id));
    nav.appendChild(btn);
  });
  document.body.appendChild(nav);
}

function buildMain() {
  const main = document.createElement('main');
  main.id = 'fx-main';
  document.body.appendChild(main);
  return main;
}

function tickClock() {
  const el = document.getElementById('clock-display');
  if (el) el.textContent = new Date().toLocaleTimeString();
}

function wireThemeToggle() {
  const themeBtn = document.getElementById('btn-theme');
  if (!themeBtn) return;
  const curTheme = localStorage.getItem('forge-theme') || 'dark';
  themeBtn.textContent = curTheme === 'dark' ? '\u2600' : '\uD83C\uDF19';
  themeBtn.addEventListener('click', function() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('forge-theme', next);
    themeBtn.textContent = next === 'dark' ? '\u2600' : '\uD83C\uDF19';
  });
}

function wireTopScanButton() {
  const scanBtn = document.getElementById('btn-scan-top');
  if (!scanBtn) return;
  scanBtn.addEventListener('click', function() {
    scanBtn.disabled = true;
    const icon = document.getElementById('btn-scan-icon');
    const txt = document.getElementById('btn-scan-text');
    if (icon) icon.innerHTML = '\u23F3';
    if (txt) txt.textContent = 'Scanning\u2026';
    runService.startFindRun().then(function(r) {
      if (r.status === 409) {
        if (icon) icon.innerHTML = '\u26A1';
        if (txt) txt.textContent = 'Scan Now';
        scanBtn.disabled = false;
        alert('A scan is already running.');
      } else if (!r.ok) {
        if (icon) icon.innerHTML = '\u26A1';
        if (txt) txt.textContent = 'Scan Now';
        scanBtn.disabled = false;
        alert('Failed: ' + r.status);
      }
    }).catch(function(e) {
      if (icon) icon.innerHTML = '\u26A1';
      if (txt) txt.textContent = 'Scan Now';
      scanBtn.disabled = false;
      alert('Error: ' + e.message);
    });
  });
}

export function buildAppShell({ router, pages }) {
  buildAtmosphere();
  buildSidebar(router, pages);
  buildTopbar();
  buildMobileNav(router, pages);
  const main = buildMain();
  wireThemeToggle();
  wireTopScanButton();
  tickClock();
  setInterval(tickClock, 1000);
  return { main };
}
