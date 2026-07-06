import { ICONS } from '../shared/icons.js';
import { runService } from '../shared/services/runService.js';

function applyIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const icon = ICONS[el.dataset.icon];
    if (icon) el.innerHTML = icon;
  });
}

function wireNavigation(router) {
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => router.switchTo(btn.dataset.view));
  });
}

function tickClock() {
  const el = document.getElementById('clock-display');
  if (el) el.textContent = new Date().toLocaleTimeString();
}

function wireThemeToggle() {
  const themeBtn = document.getElementById('btn-theme');
  if (!themeBtn) return;
  const setLabel = (theme) => {
    themeBtn.textContent = theme === 'dark' ? '☀' : '☾';
    themeBtn.setAttribute('aria-pressed', String(theme !== 'dark'));
  };
  setLabel(localStorage.getItem('forge-theme') || 'dark');
  themeBtn.addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('forge-theme', next);
    setLabel(next);
  });
}

function resetScanButton(scanBtn, icon, text) {
  if (icon) icon.textContent = '⚡';
  if (text) text.textContent = 'Scan Now';
  scanBtn.disabled = false;
}

function wireTopScanButton() {
  const scanBtn = document.getElementById('btn-scan-top');
  if (!scanBtn) return;
  scanBtn.addEventListener('click', () => {
    scanBtn.disabled = true;
    const icon = document.getElementById('btn-scan-icon');
    const text = document.getElementById('btn-scan-text');
    if (icon) icon.textContent = '⏳';
    if (text) text.textContent = 'Scanning…';
    runService.startFindRun().then((response) => {
      if (response.status === 409) {
        resetScanButton(scanBtn, icon, text);
        alert('A scan is already running.');
      } else if (!response.ok) {
        resetScanButton(scanBtn, icon, text);
        alert('Failed: ' + response.status);
      }
    }).catch((error) => {
      resetScanButton(scanBtn, icon, text);
      alert('Error: ' + error.message);
    });
  });
}

export function buildAppShell({ router }) {
  applyIcons();
  wireNavigation(router);
  wireThemeToggle();
  wireTopScanButton();
  tickClock();
  setInterval(tickClock, 1000);
  const main = document.getElementById('fx-main');
  if (!main) throw new Error('Missing #fx-main shell element');
  return { main };
}
