import { esc } from '../formatters.js';

// ── Drawer overlay ────────────────────────────────────
let drawerEl = null;
export function openDrawer(title, content) {
  var existing = document.getElementById('fx-drawer');
  if (existing) existing.remove();
  var d = document.createElement('div');
  d.id = 'fx-drawer';
  d.innerHTML = '<div id="fx-drawer-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999;"></div>'
    + '<div id="fx-drawer-panel" style="position:fixed;top:0;right:0;bottom:0;width:520px;max-width:90vw;background:var(--surface);border-left:1px solid var(--border);z-index:1000;overflow-y:auto;padding:24px;transform:translateX(100%);transition:transform 0.25s ease;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    + '<div style="font-size:16px;font-weight:700;">' + esc(title) + '</div>'
    + '<button id="fx-drawer-close" class="btn btn-ghost" style="padding:4px 12px;font-size:13px;">\u2715</button></div>'
    + '<div id="fx-drawer-body" style="font-size:13px;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap;">' + content + '</div></div>';
  document.body.appendChild(d);
  drawerEl = d;
  setTimeout(function() {
    var panel = document.getElementById('fx-drawer-panel');
    if (panel) panel.style.transform = 'translateX(0)';
  }, 10);
  document.getElementById('fx-drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('fx-drawer-backdrop').addEventListener('click', closeDrawer);
}
export function closeDrawer() {
  var panel = document.getElementById('fx-drawer-panel');
  if (panel) panel.style.transform = 'translateX(100%)';
  setTimeout(function() {
    var d = document.getElementById('fx-drawer');
    if (d) d.remove();
  }, 300);
}
