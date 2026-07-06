// ── CSS injection ─────────────────────────────────────────
export function injectStyles() {
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
}
