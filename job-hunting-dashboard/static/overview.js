/*──────────────────────────────────────────────────────────
  FORGE · Mission Control Dashboard
  Pure DOM — no framework, no build step
  Visual language matches forge-template.html exactly
──────────────────────────────────────────────────────────*/
const V = 1;

// ── CSS injection ─────────────────────────────────────────
(function injectCSS(){
  const s = document.createElement('style');
  s.id = 'fx-fix';
  s.textContent = `
/* ── design tokens ──────────────────────────────── */
:root {
  --bg: #080C17;
  --bg-panel: #121724;
  --surface: #0B1120;
  --border: #272C3C;
  --border-light: rgba(255,255,255,0.07);
  --text: #F3F5FB;
  --text-secondary: #B4B7C1;
  --text-faint: #70747F;
  --gold: #EAC266;
  --gold-dim: rgba(234,194,102,0.3);
  --gold-glow: rgba(234,194,102,0.25);
  --teal: #00C89C;
  --coral: #FF7C68;
  --iris: #AD8CFF;
  --sky: #6EB8FF;
  --card-radius: 16px;
  --card-padding: 24px;
  --blur: blur(20px);
  --sidebar-w: 240px;
  --topbar-h: 64px;
}

/* ── Light theme ──────────────────────────────────── */
html[data-theme="light"] {
  --bg: #F0F2F5;
  --bg-panel: #FFFFFF;
  --surface: #FFFFFF;
  --border: #D0D5DD;
  --border-light: rgba(0,0,0,0.08);
  --text: #1A1D23;
  --text-secondary: #5A5E6B;
  --text-faint: #8B8F9C;
  --gold: #B8860B;
  --gold-dim: rgba(184,134,11,0.15);
  --gold-glow: rgba(184,134,11,0.15);
  --teal: #008F6B;
  --coral: #CC4533;
  --iris: #7B5DBF;
  --sky: #3A7BD5;
}

* { margin:0; padding:0; box-sizing:border-box; }

html, body {
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
}

/* ── background atmosphere ─────────────────────────── */
#fx-atmosphere {
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
#fx-glow-gold {
  position: absolute;
  top: -300px; left: -200px;
  width: 800px; height: 800px;
  background: radial-gradient(circle, rgba(234,194,102,0.08) 0%, transparent 70%);
}
#fx-glow-blue {
  position: absolute;
  bottom: -200px; right: -200px;
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(110,184,255,0.06) 0%, transparent 70%);
}
#fx-grid {
  position: absolute; inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}

/* ── sidebar ──────────────────────────────────────── */
#fx-sidebar {
  position: fixed;
  top: 0; left: 0;
  width: var(--sidebar-w);
  height: 100vh;
  background: var(--surface);
  border-right: 1px solid var(--border-light);
  z-index: 100;
  display: flex;
  flex-direction: column;
  padding: 20px 0 0;
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
}
#fx-brand {
  padding: 0 20px 24px;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 12px;
}
#fx-brand .diamond { color: var(--gold); font-size: 14px; }
#fx-brand .brand-text { background: linear-gradient(135deg,#fff 40%,var(--gold)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
#fx-nav { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 0 10px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  border: none;
  background: none;
  text-align: left;
  width: 100%;
}
.nav-item:hover { color: var(--text); background: rgba(255,255,255,0.04); }
.nav-item.active {
  color: var(--text);
  background: rgba(234,194,102,0.08);
}
.nav-item.active::before {
  content: '';
  position: absolute;
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 3px;
  background: var(--gold);
  box-shadow: 0 0 8px var(--gold-glow);
}
.nav-icon { width: 18px; height: 18px; flex-shrink: 0; }
#fx-nav-footer {
  border-top: 1px solid var(--border-light);
  padding: 12px 20px 0;
  margin-top: auto;
}

/* ── topbar ────────────────────────────────────────── */
#fx-topbar {
  position: sticky;
  top: 0;
  left: var(--sidebar-w);
  right: 0;
  height: var(--topbar-h);
  background: rgba(8,12,23,0.85);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border-bottom: 1px solid var(--border-light);
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  margin-left: var(--sidebar-w);
}
#fx-topbar-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
#fx-topbar-title .eyebrow {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--gold);
  margin-bottom: 2px;
}
#fx-topbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
}
.chip-dot {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
}
.chip-dot.on { background: var(--teal); box-shadow: 0 0 6px rgba(0,200,156,0.4); }
.chip-dot.off { background: var(--text-faint); }

/* ── main content ──────────────────────────────────── */
#fx-main {
  margin-left: var(--sidebar-w);
  padding: 32px;
  position: relative;
  z-index: 1;
  min-height: calc(100vh - var(--topbar-h));
}

/* ── cards ─────────────────────────────────────────── */
.card {
  background: rgba(18,23,36,0.75);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--card-radius);
  padding: var(--card-padding);
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s;
}
.card:hover { border-color: rgba(255,255,255,0.14); }
.card-accent::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--gold), transparent 80%);
}
.card-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-faint);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-label::before { content: '\u25C6'; color: var(--gold); font-size: 8px; }
.stat-number {
  font-size: 42px;
  font-weight: 900;
  letter-spacing: -2px;
  background: linear-gradient(135deg,#fff 30%,var(--gold));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
  margin-bottom: 4px;
}
.stat-sub { font-size: 13px; color: var(--text-secondary); }

/* ── grid ──────────────────────────────────────────── */
.grid { display: grid; gap: 20px; margin-bottom: 24px; }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-2 { grid-template-columns: repeat(2, 1fr); }

/* ── buttons ───────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-primary {
  background: linear-gradient(135deg, var(--gold), #D4A84A);
  color: #0B1120;
  box-shadow: 0 4px 20px var(--gold-glow);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 28px var(--gold-glow); }
.btn-ghost {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text);
}
.btn-ghost:hover { background: rgba(255,255,255,0.1); }

/* ── badges ────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}
.badge-ok { background: rgba(0,200,156,0.12); color: var(--teal); }
.badge-fail { background: rgba(255,124,104,0.12); color: var(--coral); }
.badge-mid { background: rgba(234,194,102,0.12); color: var(--gold); }

/* ── table ─────────────────────────────────────────── */
.fx-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fx-table th {
  text-align: left;
  padding: 10px 10px 10px 0;
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid var(--border);
}
.fx-table td { padding: 10px 10px 10px 0; border-bottom: 1px solid var(--border); }

/* ── inputs ────────────────────────────────────────── */
.fx-input {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text);
  font-size: 14px;
  width: 100%;
  outline: none;
  transition: border-color 0.2s;
}
.fx-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px var(--gold-glow); }
.fx-select {
  composes: fx-input;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath fill='%23B4B7C1' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

/* ── funnel bars ───────────────────────────────────── */
.funnel-bar {
  border-radius: 6px 6px 0 0;
  transition: height 0.5s ease;
}

/* ── views ─────────────────────────────────────────── */
.fx-view { display: none; }
.fx-view.active { display: block; }

/* ── design ref iframe ─────────────────────────────── */
#fx-design-ref { width:100%; height:calc(100vh - var(--topbar-h) - 64px); border:none; border-radius:var(--card-radius); background:var(--surface); }

/* ── mobile bottom nav ─────────────────────────────── */
#fx-mobile-nav {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 64px;
  background: rgba(11,17,32,0.95);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border-top: 1px solid var(--border-light);
  z-index: 200;
  justify-content: space-around;
  align-items: center;
  padding: 0 8px;
}
.mobile-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  border: none;
  background: none;
  transition: color 0.15s;
}
.mobile-nav-item.active { color: var(--gold); }
.mobile-nav-item svg { width: 20px; height: 20px; }

/* ── scrollbar ─────────────────────────────────────── */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* ── responsive ────────────────────────────────────── */
@media (max-width: 1023px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(2, 1fr); }
  #fx-sidebar { display: none; }
  #fx-topbar { margin-left: 0; }
  #fx-main { margin-left: 0; padding: 20px; }
  #fx-mobile-nav { display: flex; }
  #fx-main { padding-bottom: 84px; }
  #fx-topbar-right .chip { display: none; }
}

@media (max-width: 767px) {
  .grid-4, .grid-3, .grid-2 { grid-template-columns: 1fr; }
  #fx-main { padding: 16px; }
  .card { padding: 16px; }
  .stat-number { font-size: 32px; }
  .fx-table th:nth-child(3), .fx-table td:nth-child(3),
  .fx-table th:nth-child(5), .fx-table td:nth-child(5) { display: none; }
}

/* ── gauge rings ───────────────────────────────────── */
.gauge-ring { width: 140px; height: 140px; margin: 0 auto 8px; position: relative; }
.gauge-ring svg { transform: rotate(-90deg); display:block; }
.gauge-value { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800; letter-spacing: -1.5px; background: linear-gradient(135deg,#fff 30%,var(--gold)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.gauge-sub-text { text-align:center; font-size:12px; color:var(--text-faint); }
.gauge-card { text-align:center; }
.gauge-wrap { padding:8px 0; }

/* ── hero panel ─────────────────────────────────────── */
.eyebrow-line { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: var(--gold); margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
.eyebrow-line::before { content: ''; display: inline-block; width: 24px; height: 2px; background: var(--gold); border-radius: 2px; box-shadow: 0 0 6px var(--gold-glow); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -1px; background: linear-gradient(135deg,#fff 40%,var(--gold)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; line-height:1.2; }

/* ── fleet cards ───────────────────────────────────── */
:root {
  --color-forge: #EAC266;
  --color-scout: #6EB8FF;
  --color-reader: #00C89C;
  --color-adapter: #FF7C68;
}
.fleet-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
.fleet-card { text-align:center; padding:20px; }
.fleet-card.working { border-color: var(--agent-color); box-shadow: 0 0 24px color-mix(in srgb, var(--agent-color) 25%, transparent); }
.fleet-avatar {
  width: 52px; height: 52px; border-radius: 12px; margin: 0 auto 10px;
  border: 2px solid var(--agent-color);
  box-shadow: 0 0 12px color-mix(in srgb, var(--agent-color) 30%, transparent);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 800; letter-spacing: 0.5px;
  color: var(--agent-color); background: rgba(0,0,0,0.3);
}
.fleet-name { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
.fleet-role { font-size: 11px; color: var(--text-faint); margin-bottom: 8px; }
.fleet-status { font-size: 11px; font-weight: 600; display:flex; align-items:center; justify-content:center; gap:5px; margin-bottom:8px; }
.fleet-status-dot { width: 7px; height: 7px; border-radius:50%; display:inline-block; }
.fleet-status.live .fleet-status-dot { background:var(--teal); box-shadow:0 0 6px rgba(0,200,156,0.4); }
.fleet-status.working .fleet-status-dot { background:var(--gold); box-shadow:0 0 8px var(--gold-glow); }
.fleet-status.idle .fleet-status-dot { background:var(--text-faint); }
.fleet-count { font-size: 28px; font-weight: 900; letter-spacing:-1.5px; line-height:1; }
.fleet-rate { font-size: 11px; color:var(--text-secondary); margin-bottom:6px; }
.fleet-last { font-size: 10px; color:var(--text-faint); }
.fleet-model { font-size: 9px; color:var(--text-faint); font-family:monospace; margin-top:2px; }

/* ── sidebar mini-fleet ────────────────────────────── */
#sidebar-mini-fleet {
  padding: 12px 16px;
  border-top: 1px solid var(--border-light);
  margin-top: auto;
}
#sidebar-mini-fleet .mini-row { display:flex; gap:6px; align-items:center; justify-content:center; }
.mini-agent {
  width: 28px; height: 28px; border-radius: 6px;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: var(--accent);
}
.mini-readout { text-align:center; font-size: 10px; color:var(--text-faint); margin-top:6px; letter-spacing:0.5px; }
.mini-readout strong { color:var(--teal); }

/* ── activity stream ───────────────────────────────── */
#activity-stream { height: 320px; overflow-y:auto; }
/* ── settings components ──────────────────────────── */
.segmented-control { display:flex; gap:0; flex-wrap:wrap; }
.seg-btn { padding:6px 14px; font-size:12px; font-weight:600; background:rgba(255,255,255,0.04); border:1px solid var(--border); color:var(--text-secondary); cursor:pointer; transition:all 0.15s; }
.seg-btn:first-child { border-radius:8px 0 0 8px; }
.seg-btn:last-child { border-radius:0 8px 8px 0; }
.seg-btn:not(:last-child) { border-right:none; }
.seg-btn.active { background:rgba(234,194,102,0.15); border-color:var(--gold); color:var(--gold); z-index:1; }
.seg-btn:hover:not(.active) { background:rgba(255,255,255,0.08); }
.settings-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; background:rgba(234,194,102,0.12); border:1px solid rgba(234,194,102,0.25); border-radius:999px; font-size:11px; color:var(--gold); margin:2px; }
.chip-container { display:flex; flex-wrap:wrap; gap:4px; align-items:center; padding:6px 8px; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:8px; min-height:36px; }
.chip-input { background:transparent; border:none; outline:none; color:var(--text); font-size:12px; padding:4px; min-width:80px; flex:1; }
.num-input { width:100%; padding:8px 10px; background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:8px; color:var(--text); font-size:13px; outline:none; }
.num-input:focus { border-color:var(--gold); box-shadow:0 0 0 2px var(--gold-glow); }
input[type=range] { -webkit-appearance:none; appearance:none; height:6px; background:var(--border); border-radius:3px; outline:none; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%; background:var(--gold); cursor:pointer; box-shadow:0 0 8px var(--gold-glow); }
.activity-row { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px; }
.activity-row:last-child { border-bottom:none; }
.activity-agent { font-size:11px; font-weight:600; padding:2px 10px; border-radius:999px; white-space:nowrap; flex-shrink:0; }
.activity-task { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-secondary); }
.activity-model { font-size:10px; color:var(--text-faint); font-family:monospace; white-space:nowrap; flex-shrink:0; }
.activity-time { font-size:11px; color:var(--text-faint); white-space:nowrap; flex-shrink:0; }

@media (max-width:1023px) {
  .fleet-grid { grid-template-columns:repeat(2,1fr); }
}
@media (max-width:767px) {
  .fleet-grid { grid-template-columns:repeat(2,1fr); gap:12px; }
  #activity-stream { height: 240px; }
}

.source-chip {
  display:inline-flex; align-items:center; gap:5px;
  padding:4px 12px; border-radius:999px;
  font-size:11px; font-weight:600;
  cursor:pointer; user-select:none; outline:none;
  border:1px solid rgba(255,255,255,0.1);
  background:rgba(255,255,255,0.03);
  color:rgba(180,183,193,0.7);
  transition:all 0.15s; white-space:nowrap;
}
.source-chip:hover { background:rgba(255,255,255,0.09); color:var(--text-secondary); }
.source-chip .sc-count { opacity:0.6; }

/* ── source filter chips ───────────────────────────────────────── */
.source-chip {
  display:inline-flex; align-items:center; gap:5px;
  padding:4px 12px; border-radius:999px;
  font-size:11px; font-weight:600;
  cursor:pointer; user-select:none;
  border:1px solid var(--border);
  background:rgba(255,255,255,0.03);
  color:var(--text-faint);
  transition:border-color 0.15s,background 0.15s,color 0.15s,box-shadow 0.15s;
  white-space:nowrap;
  outline:none;
}
.source-chip:hover { background:rgba(255,255,255,0.09); color:var(--text-secondary); }
.source-chip .sc-count { opacity:0.65; font-weight:500; }
`;
  document.head.appendChild(s);
})();

// ── Icon SVGs ──────────────────────────────────────────
const ICONS = {
  overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  jobs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>',
  custom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  cv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  design: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>',
};

// ── DOM refs ─────────────────────────────────────────
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));

// ── global state ─────────────────────────────────────
let navViews = {};          // { viewName: { title, tab, render? } }
let currentView = 'overview';

// ── Build atmosphere ─────────────────────────────────
function buildAtmosphere() {
  const div = document.createElement('div');
  div.id = 'fx-atmosphere';
  div.innerHTML = '<div id="fx-glow-gold"></div><div id="fx-glow-blue"></div><div id="fx-grid"></div>';
  document.body.prepend(div);
}

// ── Build sidebar ────────────────────────────────────
function buildSidebar() {
  const sidebar = document.createElement('nav');
  sidebar.id = 'fx-sidebar';

  // Brand
  const brand = document.createElement('div');
  brand.id = 'fx-brand';
  brand.innerHTML = '<span class="diamond">\u25C6</span><span class="brand-text">FORGE</span>';

  // Nav
  const nav = document.createElement('div');
  nav.id = 'fx-nav';

  const items = [
    { id: 'overview', label: 'Overview', icon: ICONS.overview },
    { id: 'jobs', label: 'Jobs', icon: ICONS.jobs },
    { id: 'custom', label: 'Custom', icon: ICONS.custom },
    { id: 'cv', label: 'CV', icon: ICONS.cv },
    { id: 'settings', label: 'Settings', icon: ICONS.settings },
  ];
  items.forEach(it => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.view = it.id;
    btn.innerHTML = `<span class="nav-icon">${it.icon}</span> ${it.label}`;
    btn.addEventListener('click', () => switchView(it.id));
    nav.appendChild(btn);
  });

  // Footer: Design Reference link + mini-fleet
  const footer = document.createElement('div');
  footer.id = 'fx-nav-footer';

  const designBtn = document.createElement('button');
  designBtn.className = 'nav-item';
  designBtn.dataset.view = 'designref';
  designBtn.innerHTML = `<span class="nav-icon">${ICONS.design}</span> Design Reference`;
  designBtn.addEventListener('click', () => switchView('designref'));
  footer.appendChild(designBtn);

  // Mini fleet
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
  navViews = items.reduce((acc, it) => { acc[it.id] = { title: it.label }; return acc; }, {});
  navViews.designref = { title: 'Design Reference' };
}

// ── Build topbar ─────────────────────────────────────
function buildTopbar() {
  const topbar = document.createElement('header');
  topbar.id = 'fx-topbar';
  topbar.innerHTML = `
    <div id="fx-topbar-title">
      <span class="eyebrow">Mission Control</span>
      <span id="fx-page-title">Overview</span>
    </div>
    <div id="fx-topbar-right">
      <button class="btn btn-ghost" id="btn-theme" style="padding:4px 10px;font-size:13px;cursor:pointer;" title="Toggle theme">&#9790;</button>
      <button class="btn btn-primary" id="btn-scan-top" style="padding:4px 14px;font-size:11px;display:none;"><span id="btn-scan-icon">&#9889;</span> <span id="btn-scan-text">Scan Now</span></button>
      <span class="chip" id="chip-run"><span class="chip-dot off" id="chip-run-dot"></span><span id="chip-run-text">Idle</span></span>
      <span class="chip" id="chip-model"><span class="chip-dot on"></span><span id="chip-model-text">--</span></span>
      <span class="chip" id="chip-gw"><span class="chip-dot on"></span>Gateway</span>
      <span class="chip" id="chip-slack"><span class="chip-dot on"></span>Slack</span>
      <span class="chip" id="chip-clock">${ICONS.clock} <span id="clock-display" data-clock>--:--:--</span></span>
    </div>
  `;
  document.body.appendChild(topbar);
}

// ── Build mobile bottom nav ──────────────────────────
function buildMobileNav() {
  const nav = document.createElement('nav');
  nav.id = 'fx-mobile-nav';
  const items = [
    { id: 'overview', label: 'Overview', icon: ICONS.overview },
    { id: 'jobs', label: 'Jobs', icon: ICONS.jobs },
    { id: 'custom', label: 'Custom', icon: ICONS.custom },
    { id: 'cv', label: 'CV', icon: ICONS.cv },
    { id: 'settings', label: 'Settings', icon: ICONS.settings },
  ];
  items.forEach(it => {
    const btn = document.createElement('button');
    btn.className = 'mobile-nav-item';
    btn.dataset.view = it.id;
    btn.innerHTML = `${it.icon}<span>${it.label}</span>`;
    btn.addEventListener('click', () => switchView(it.id));
    nav.appendChild(btn);
  });
  document.body.appendChild(nav);
}

// ── Build main content area ──────────────────────────
function buildMain() {
  const main = document.createElement('main');
  main.id = 'fx-main';
  document.body.appendChild(main);
}

// ── View switching ────────────────────────────────────
function switchView(viewId) {
  currentView = viewId;
  // Update sidebar
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === viewId));
  // Update mobile nav
  $$('.mobile-nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === viewId));
  // Update views
  const allViews = document.getElementById('fx-main');
  $$('.fx-view', allViews).forEach(el => el.classList.toggle('active', el.dataset.view === viewId));
  // Update topbar title
  const v = navViews[viewId];
  if (v) $('#fx-page-title').textContent = v.title;
  // Load design ref iframe lazily
  if (viewId === 'designref') {
    const ref = $('#fx-design-ref');
    if (ref && !ref.src) ref.src = '/template';
  }
  // Refresh custom history when switching to custom tab
  if (viewId === 'custom') {
    loadCustomHistory();
  }
}

// ── View builders ─────────────────────────────────────

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

// ── Placeholder views ─────────────────────────────────
function buildPlaceholderView(viewId, label, desc) {
  const div = document.createElement('div');
  div.className = 'fx-view';
  div.dataset.view = viewId;
  div.innerHTML = `
    <div class="card card-accent" style="text-align:center;padding:64px;">
      <div style="font-size:48px;margin-bottom:16px;color:var(--gold);">${ICONS.zap}</div>
      <h2 style="font-size:24px;font-weight:700;margin-bottom:8px;">${label}</h2>
      <p style="color:var(--text-secondary);font-size:14px;">${desc}</p>
    </div>
  `;
  return div;
}

// ── Build design reference view ───────────────────────
function buildDesignRefView() {
  const div = document.createElement('div');
  div.className = 'fx-view';
  div.dataset.view = 'designref';
  div.innerHTML = `<iframe id="fx-design-ref"></iframe>`;
  return div;
}

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
      const r = await fetch('/api/cv').then(r => r.json());
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
  const form = new FormData();
  form.append('file', file);
  fetch('/api/cv', { method: 'POST', body: form })
    .then(r => r.json())
    .then(d => {
      // Immediately re-poll so the "building" state shows
      if (_cvDiv && _cvRender) {
        fetch('/api/cv').then(function(r) { return r.json(); }).then(function(data) {
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

// ── Data polling ──────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return new Date(iso).toLocaleDateString();
}

let pollInterval = null;

async function pollData() {
  try {
    // Update greeting based on time of day
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Good Morning' : hr < 18 ? 'Good Afternoon' : 'Good Evening';
    const el = document.querySelector('.eyebrow-line');
    if (el) el.textContent = greet;

    // Get overview
    const ov = await fetch('/api/overview').then(r => r.json());
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
    const ag = await fetch('/api/agents').then(r => r.json());
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
    const tl = await fetch('/api/telemetry').then(r => r.json());
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
    const lastActivity = await fetch('/api/activity?limit=1').then(r => r.json());
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
    const act = await fetch('/api/activity?limit=30').then(r => r.json());
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
      const rd = await fetch('/api/run-detail').then(r => r.json());
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

// Wire Tailor buttons (delegated click on #fx-main)
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.tailor-btn');
  if (!btn) return;
  // Ignore disabled buttons (already tailored or tailoring)
  if (btn.disabled) return;
  var url = btn.getAttribute('data-url');
  var title = btn.getAttribute('data-title');
  var company = btn.getAttribute('data-company');
  var runId = btn.getAttribute('data-run');
  var description = btn.getAttribute('data-description') || '';
  var key = btn.getAttribute('data-key') || (title + '|' + company);
  if (!url || !title || !company) return;

  // Immediately show 'Tailoring' in the DOM and set transient state
  if (!window._tailorState) window._tailorState = {};
  window._tailorState[key] = 'promoting';
  btn.disabled = true;
  btn.style.opacity = '0.7';
  btn.textContent = '\u23F3 Tailoring\u2026';

  fetch('/api/promote', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({run_id: runId, url: url, title: title, company: company, description: description, key: key})
  }).then(function(r) {
    if (r.status === 409) {
      // Already being promoted server-side — stay in 'promoting'; renderJobs will resolve
      window._tailorState[key] = 'promoting';
      return;
    }
    if (!r.ok) {
      // Genuine failure — reset to idle
      delete window._tailorState[key];
      btn.disabled = false;
      btn.style.opacity = '';
      btn.textContent = 'Tailor \u25B8';
      alert('Promote failed: ' + r.status);
      return;
    }
    // 200 = accepted, NOT completed. Keep 'promoting'; renderJobs detects completion via m.cv_path
  }).catch(function(e) {
    delete window._tailorState[key];
    btn.disabled = false;
    btn.style.opacity = '';
    btn.textContent = 'Tailor \u25B8';
    alert('Error: ' + e.message);
  });
});

// ── Drawer overlay ────────────────────────────────────
var drawerEl = null;
function openDrawer(title, content) {
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
function closeDrawer() {
  var panel = document.getElementById('fx-drawer-panel');
  if (panel) panel.style.transform = 'translateX(100%)';
  setTimeout(function() {
    var d = document.getElementById('fx-drawer');
    if (d) d.remove();
  }, 300);
}

// ── Jobs page ────────────────────────────────────────
function buildJobsView() {
  const div = document.createElement('div');
  div.className = 'fx-view active';
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
      window._jobsPage = pg;
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
  if (!window._srcFilter) window._srcFilter = new Set();

  var counts = {};
  (matches || []).forEach(function(m) {
    var g = _srcGroupKey((m.tracking && m.tracking.source) || 'unknown');
    counts[g] = (counts[g] || 0) + 1;
  });

  var groups = Object.keys(counts).sort();
  var total  = matches ? matches.length : 0;
  var allActive = window._srcFilter.size === 0;

  var html = '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:rgba(112,116,127,0.8);margin-right:4px;">Source</span>';
  html += _chipBtn('All', total, '#EAC266', allActive, '__all__');
  groups.forEach(function(g) {
    html += _chipBtn(_srcGroupLabel(g), counts[g], _SOURCE_COLORS[g]||'#B4B7C1', window._srcFilter.has(g), g);
  });

  row.innerHTML = html;

  if (!row._wired) {
    row._wired = true;
    row.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-src]');
      if (!btn) return;
      var src = btn.getAttribute('data-src');
      if (!window._srcFilter) window._srcFilter = new Set();
      if (src === '__all__') {
        window._srcFilter.clear();
      } else {
        window._srcFilter.has(src) ? window._srcFilter.delete(src) : window._srcFilter.add(src);
        var n = row.querySelectorAll('button[data-src]:not([data-src="__all__"])').length;
        if (window._srcFilter.size >= n) window._srcFilter.clear();
      }
      renderJobs();
    });
  }
}

async function renderJobs() {
  try {
    const rd = await fetch('/api/run-detail').then(r => r.json());
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
    if (!window._srcFilter) window._srcFilter = new Set();
    var displayMatches = rd.matches;
    if (window._srcFilter.size > 0) {
      displayMatches = rd.matches.filter(function(m) {
        var src = (m.tracking && m.tracking.source) || 'unknown';
        if (window._srcFilter.has('adzuna') && src.startsWith('adzuna_')) return true;
        return window._srcFilter.has(src);
      });
    }

    // ── Paginate ─────────────────────────────────────────────────────────
    if (!window._jobsPage) window._jobsPage = 1;
    var _totalFiltered = displayMatches.length;
    var _pageStart = (window._jobsPage - 1) * _JOBS_PAGE_SIZE;
    if (_pageStart >= _totalFiltered && _totalFiltered > 0) { window._jobsPage = 1; _pageStart = 0; }
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
      if (!window._tailorState) window._tailorState = {};
      var tailorState = window._tailorState;
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
    _renderPagination(_totalFiltered, window._jobsPage);

    // Wire status dropdowns
    tbody.querySelectorAll('.job-status-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var key = sel.getAttribute('data-key');
        var status = sel.value || 'new';
        fetch('/api/job-status', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({key: key, status: status})
        }).catch(function(e) { console.warn('Status update failed:', e); });
      });
    });

    // Wire JD buttons (show JD in drawer, no alert on 404)
    tbody.querySelectorAll('.jd-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-key');
        btn.textContent = '...';
        fetch('/api/jd?key=' + encodeURIComponent(key)).then(function(r) {
          if (r.status === 404) {
            btn.textContent = 'JD';
            openDrawer('Job Description', esc('No job description has been fetched for this match yet. Run Tailor to fetch and extract it.'));
            return null;
          }
          if (!r.ok) { btn.textContent = 'JD'; openDrawer('Job Description', esc('Error loading JD: ' + r.status)); return null; }
          return r.json();
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
    fetch('/api/schedule').then(function(r) { return r.json(); }).then(function(s) {
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
      fetch('/api/schedule', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({enabled: enabled, cadence: cadence})
      }).then(function(r) { return r.json(); }).then(function(s) {
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
        fetch('/api/schedule', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({enabled: true, cadence: autoCadence.value})
        }).then(function(r) { return r.json(); }).then(function(s) {
          var nextEl = document.getElementById('schedule-next');
          if (nextEl && s.next_run) {
            nextEl.textContent = 'next: ' + new Date(s.next_run).toLocaleString();
          }
        });
      }
    });
  }
}

// ── Custom CV Tailor page ─────────────────────────────

var _customParsed = null;      // { url, title, company, location, remote_mode, salary, date_posted, jd_json, extracted }
var _customKey = null;         // key of the job currently being tailored or already tailored
var _customPollTimer = null;
var _customCurrentUrl = '';    // preserves input value across re-renders
var _customFetchLoading = false;

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
  var tailorState = _customKey ? (window._customTailorState || 'idle') : 'idle';
  var urlValue = _customCurrentUrl || (parsed && parsed.url) || '';

  var heroHtml = '<div class="card card-accent" style="margin-bottom:20px;">'
    + '<div class="eyebrow-line">Custom Tailoring</div>'
    + '<h1 class="hero-title">Tailor CV from URL</h1>'
    + '<p style="color:var(--text-secondary);font-size:13px;margin-top:6px;">'
    + 'Enter a job posting URL (LinkedIn, Indeed, etc.) to fetch the job details and tailor your CV specifically for it.'
    + '</p></div>';

  var inputHtml = '<div class="card" style="margin-bottom:20px;">'
    + '<div class="card-label">Job Post URL</div>'
    + '<div style="display:flex;gap:10px;align-items:stretch;flex-wrap:wrap;">'
    + '<input id="custom-url-input" class="fx-input" type="url" placeholder="https://www.linkedin.com/jobs/view/..." '
    + 'style="flex:1;min-width:200px;" value="' + esc(urlValue) + '">'
    + '<button id="custom-fetch-btn" class="btn btn-primary" style="white-space:nowrap;"'
    + (_customFetchLoading ? ' disabled' : '') + '>'
    + '<span id="custom-fetch-icon">' + (_customFetchLoading ? '&#9203;' : '&#128279;') + '</span>'
    + ' <span id="custom-fetch-text">' + (_customFetchLoading ? 'Fetching…' : 'Fetch Job') + '</span>'
    + '</button>'
    + '</div>'
    + '<div id="custom-fetch-error" style="margin-top:8px;font-size:12px;color:var(--coral);display:none;"></div>'
    + '</div>';

  // Loading panel — shown while parse is in progress
  var loadingHtml = '';
  if (_customFetchLoading) {
    loadingHtml = '<div class="card" style="margin-bottom:20px;text-align:center;padding:40px 24px;">'
      + '<div style="font-size:36px;margin-bottom:14px;">&#9203;</div>'
      + '<div style="font-size:15px;font-weight:700;margin-bottom:6px;">Reading job posting…</div>'
      + '<div style="font-size:13px;color:var(--text-secondary);">Fetching the page and extracting details with AI. This can take up to 60 seconds.</div>'
      + '</div>';
  }

  // Details panel — shown after a successful fetch
  var detailsHtml = '';
  if (!_customFetchLoading && parsed) {
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
    var storedCvPath = window._customCvPath || '';
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

    detailsHtml += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--border-light);">'
      + tailorBtnHtml + ' ' + docBtnHtml + ' ' + pdfBtnHtml
      + '<a href="' + esc(parsed.url) + '" target="_blank" rel="noopener" style="font-size:13px;color:var(--text-faint);text-decoration:none;margin-left:4px;" title="Open original posting">&#8599; View Original</a>'
      + '</div>'
      + '</div>';
  }

  // History table
  var historyHtml = '<div class="card" style="margin-bottom:20px;">'
    + '<div class="card-label">Tailored History</div>'
    + '<div id="custom-history-body" style="font-size:13px;color:var(--text-faint);padding:12px 0;text-align:center;">Loading…</div>'
    + '</div>';

  container.innerHTML = heroHtml + inputHtml + loadingHtml + detailsHtml + historyHtml;

  // ── Wire fetch button using container.querySelector (works even before DOM attach) ──
  var fetchBtn = container.querySelector('#custom-fetch-btn');
  var urlInput = container.querySelector('#custom-url-input');

  if (urlInput) {
    urlInput.addEventListener('input', function() {
      _customCurrentUrl = urlInput.value.trim();
    });
  }

  if (fetchBtn && urlInput) {
    fetchBtn.addEventListener('click', function() {
      var url = urlInput.value.trim();
      _customCurrentUrl = url;

      if (!url || !url.match(/^https?:\/\//i)) {
        var errEl = container.querySelector('#custom-fetch-error');
        if (errEl) { errEl.textContent = 'Please enter a valid http(s) URL.'; errEl.style.display = 'block'; }
        return;
      }

      // Show loading state immediately
      _customFetchLoading = true;
      _customParsed = null;
      _customKey = null;
      window._customTailorState = 'idle';
      window._customCvPath = '';
      renderCustomView(container);

      fetch('/api/custom/parse-url', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url: url}),
      }).then(function(r) {
        if (!r.ok) {
          return r.json().then(function(e) { throw new Error(e.detail || 'Fetch failed: ' + r.status); });
        }
        return r.json();
      }).then(function(data) {
        _customFetchLoading = false;
        _customParsed = data;
        _customCurrentUrl = data.url || url;
        _customKey = null;
        window._customTailorState = 'idle';
        window._customCvPath = '';
        renderCustomView(container);
        loadCustomHistory();
      }).catch(function(e) {
        _customFetchLoading = false;
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

      fetch('/api/custom/promote', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          url: parsed.url,
          title: parsed.title,
          company: parsed.company,
          jd_json: parsed.jd_json || '',
          location: parsed.location || '',
          remote_mode: parsed.remote_mode || '',
          salary: parsed.salary || '',
          date_posted: parsed.date_posted || '',
        }),
      }).then(function(r) {
        if (r.status === 409) {
          return r.json().then(function(d) {
            if (d.detail && d.detail.indexOf('tailored') > -1) {
              window._customTailorState = 'idle';
              loadCustomHistory();
            } else {
              window._customTailorState = 'promoting';
              renderCustomView(container);
              pollCustomStatus(_customKey || ('custom:' + parsed.url.slice(-16)), container);
            }
            return null;
          });
        }
        if (!r.ok) {
          return r.json().then(function(e) { throw new Error(e.detail || 'Promote failed'); });
        }
        return r.json();
      }).then(function(data) {
        if (!data) return;
        _customKey = data.key;
        window._customTailorState = 'promoting';
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
    fetch('/api/custom/status?key=' + encodeURIComponent(key))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.cv_path) {
          // Done
          window._customTailorState = 'done';
          window._customCvPath = data.cv_path.split('/').pop();
          renderCustomView(container);
          loadCustomHistory();
        } else if (data.promoting || data.status === 'seen') {
          // Still in progress
          _customPollTimer = setTimeout(doCheck, 3000);
        } else {
          // Failed or unexpected state
          window._customTailorState = 'idle';
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
  fetch('/api/custom/jobs')
    .then(function(r) { return r.json(); })
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
        html += '<tr>'
          + '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(j.title) + '">' + esc(j.title) + '</td>'
          + '<td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);">' + esc(j.company) + '</td>'
          + '<td style="font-size:12px;color:var(--text-faint);">' + esc(j.location || '—') + '</td>'
          + '<td style="font-size:11px;font-weight:600;color:' + modeColor + ';">' + esc(j.remote_mode || '—') + '</td>'
          + '<td>' + statusBadge + '</td>'
          + '<td style="font-size:11px;color:var(--text-faint);">' + esc((j.created_at || '').slice(0, 10)) + '</td>'
          + '<td><div style="display:flex;gap:4px;">' + docBtn + pdfBtn
            + '<a href="' + esc(j.url) + '" target="_blank" rel="noopener" style="padding:2px 6px;font-size:14px;color:var(--text-faint);text-decoration:none;" title="Open original">&#8599;</a>'
          + '</div></td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
      bodyEl.innerHTML = html;
    })
    .catch(function(e) {
      bodyEl.innerHTML = '<div style="color:var(--coral);padding:12px;">Failed to load history: ' + esc(e.message) + '</div>';
    });
}

// ── Settings page ────────────────────────────────────
var _settingsData = null;
var _settingsDirty = false;

function buildSettingsView() {
  const div = document.createElement('div');
  div.className = 'fx-view active';
  div.dataset.view = 'settings';

  div.innerHTML = '<div class="card card-accent" style="margin-bottom:20px;"><div class="card-label">Settings</div><div style="text-align:center;padding:24px;"><div style="font-size:48px;margin-bottom:12px;color:var(--gold);">\u2699\uFE0F</div><div style="font-size:16px;font-weight:700;">Loading settings...</div></div></div>';

  fetch('/api/settings').then(function(r) { return r.json(); }).then(function(data) {
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

  fetch('/api/settings', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  }).then(function(r) {
    if (!r.ok) { return r.json().then(function(e) { throw new Error(e.detail || 'Save failed'); }); }
    return r.json();
  }).then(function(result) {
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

function formatSource(src) {
  var map = {
    'adzuna_us': ['AZ·US', '#6EB8FF'],
    'adzuna_gb': ['AZ·UK', '#6EB8FF'],
    'adzuna_es': ['AZ·ES', '#6EB8FF'],
    'adzuna_de': ['AZ·DE', '#6EB8FF'],
    'adzuna_fr': ['AZ·FR', '#6EB8FF'],
    'adzuna_ca': ['AZ·CA', '#6EB8FF'],
    'adzuna_au': ['AZ·AU', '#6EB8FF'],
    'adzuna_br': ['AZ·BR', '#6EB8FF'],
    'adzuna_in': ['AZ·IN', '#6EB8FF'],
    'remotive':  ['Rem', '#00C89C'],
    'remoteok':  ['ROK', '#AD8CFF'],
    'weworkremotely': ['WWR', '#EAC266'],
    'jobicy':    ['Jcy', '#FF7C68'],
  };
  if (!src) return '<span style="font-size:10px;color:var(--text-faint);">—</span>';
  // Handle any adzuna_xx not explicitly listed
  if (src.startsWith('adzuna_')) {
    var cc = src.slice(7).toUpperCase();
    var entry = map[src] || ['AZ·' + cc, '#6EB8FF'];
    return '<span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:4px;background:rgba(110,184,255,0.12);color:' + entry[1] + ';">' + entry[0] + '</span>';
  }
  var e = map[src];
  if (!e) return '<span style="font-size:10px;color:var(--text-faint);">' + esc(src) + '</span>';
  return '<span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:4px;background:rgba(0,0,0,0.2);color:' + e[1] + ';">' + e[0] + '</span>';
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Strip HTML tags and convert block elements to readable plain text
function htmlToText(html) {
  if (!html) return '';
  var s = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\u2022 ')
    .replace(/<[^>]+>/g, '');
  // Decode HTML entities
  var t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value.replace(/\n{3,}/g, '\n\n').trim();
}

function setGaugeValue(key, val) {
  const el = document.querySelector(`[data-gauge-value="${key}"]`);
  if (el) el.textContent = val;
}

function setGaugeArc(key, fraction) {
  const el = document.querySelector(`[data-gauge-arc="${key}"]`);
  if (!el) return;
  const circ = 364.42; // 2 * π * 58
  const offset = circ * (1 - Math.max(0, Math.min(1, fraction)));
  el.style.strokeDashoffset = offset;
}

function setFunnelValue(key, val) {
  const bar = document.querySelector(`[data-funnel="${key}"]`);
  const valEl = document.querySelector(`[data-funnel="${key}-value"]`);
  if (bar) bar.style.height = Math.min(val * 4, 120) + 'px';
  if (valEl) valEl.textContent = val;
}

// ── Clock ──────────────────────────────────────────────
function tickClock() {
  const el = document.getElementById('clock-display');
  if (el) el.textContent = new Date().toLocaleTimeString();
}

// ── Init ──────────────────────────────────────────────
function init() {
  buildAtmosphere();
  buildSidebar();
  buildTopbar();
  buildMobileNav();
  buildMain();

  const main = document.getElementById('fx-main');

  // Build views
  main.appendChild(buildOverviewView());
  main.appendChild(buildJobsView());
  main.appendChild(buildCustomView());
  main.appendChild(buildCvView());
  main.appendChild(buildSettingsView());
  main.appendChild(buildDesignRefView());

  // Start poll + clock
  pollData();
  pollInterval = setInterval(pollData, 6000);
  tickClock();
  setInterval(tickClock, 1000);

  // Wire Scan Now button + theme toggle
  setTimeout(function() {
    // Theme toggle
    var themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      var curTheme = localStorage.getItem('forge-theme') || 'dark';
      themeBtn.textContent = curTheme === 'dark' ? '\u2600' : '\uD83C\uDF19';
      themeBtn.addEventListener('click', function() {
        var html = document.documentElement;
        var current = html.getAttribute('data-theme') || 'dark';
        var next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('forge-theme', next);
        themeBtn.textContent = next === 'dark' ? '\u2600' : '\uD83C\uDF19';
      });
    }
    
    // Scan button — stays in "Scanning" state until pollData detects live_run is gone
    var scanBtn = document.getElementById('btn-scan-top');
    if (scanBtn) {
      scanBtn.addEventListener('click', function() {
        scanBtn.disabled = true;
        var icon = document.getElementById('btn-scan-icon');
        var txt = document.getElementById('btn-scan-text');
        if (icon) icon.innerHTML = '\u23F3';
        if (txt) txt.textContent = 'Scanning\u2026';
        fetch('/api/run?trigger=find', { method: 'POST' })
          .then(function(r) {
            if (r.status === 409) {
              if (icon) icon.innerHTML = '\u26A1';
              if (txt) txt.textContent = 'Scan Now';
              scanBtn.disabled = false;
              alert('A scan is already running.');
              return;
            }
            if (!r.ok) {
              if (icon) icon.innerHTML = '\u26A1';
              if (txt) txt.textContent = 'Scan Now';
              scanBtn.disabled = false;
              alert('Failed: ' + r.status);
            }
            // On success: remain disabled/scanning; pollData will re-enable when run finishes
          })
          .catch(function(e) {
            if (icon) icon.innerHTML = '\u26A1';
            if (txt) txt.textContent = 'Scan Now';
            scanBtn.disabled = false;
            alert('Error: ' + e.message);
          });
      });
    }

    // Show/hide Scan Now based on view
    var originalSwitch = switchView;
    window.switchView = function(view) {
      originalSwitch(view);
      var sb = document.getElementById('btn-scan-top');
      if (sb) sb.style.display = view === 'jobs' ? 'inline-flex' : 'none';
      // Refresh CV data when switching to the CV tab so Settings changes
      // (Target Titles, Scoring Skills, etc.) are immediately reflected.
      if (view === 'cv' && _cvDiv && _cvRender) {
        if (_cvPollTimer) { clearTimeout(_cvPollTimer); _cvPollTimer = null; }
        pollCvStatus(_cvDiv, _cvRender);
      }
    };
    // Set initial state
    var sb = document.getElementById('btn-scan-top');
    if (sb) sb.style.display = 'none';
  }, 100);

  // Also poll renderJobs on the jobs view
  setInterval(function() {
    var jobsView = document.querySelector('.fx-view.active[data-view="jobs"]');
    if (jobsView) renderJobs();
  }, 6000);

  // Wire Find Jobs button
  setTimeout(function() {
    var btn = document.getElementById('btn-find');
    if (btn) {
      btn.addEventListener('click', function() {
        btn.disabled = true;
        var icon = document.getElementById('btn-find-icon');
        var txt = document.getElementById('btn-find-text');
        if (icon) icon.innerHTML = '\u23F3';
        if (txt) txt.textContent = 'Starting\u2026';
        fetch('/api/run?trigger=find', { method: 'POST' })
          .then(function(r) {
            if (r.status === 409) { alert('A scan is already running.'); return; }
            if (!r.ok) { alert('Failed to start scan: ' + r.status); return; }
            // pollData will pick up live_run on next tick
          })
          .catch(function(e) { alert('Error: ' + e.message); });
      });
    }
  }, 100);

  // Cache-bust on next load
  console.log('FORGE Dashboard v' + V);
}

// ── Live data trap: grep for 775.5K and 227 ────────────
// After init, check no demo values leaked
document.addEventListener('DOMContentLoaded', () => {
  init();
  // Deferred check
  setTimeout(() => {
    const text = document.body.innerText;
    const found = [];
    if (text.includes('775.5K')) found.push('775.5K');
    if (text.includes('227') || text.includes(' 227')) found.push('227');
    if (found.length) console.warn('DEMO DATA LEAK detected:', found.join(', '));
  }, 2000);
});