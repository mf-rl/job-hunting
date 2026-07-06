
export function setGaugeValue(key, val) {
  const el = document.querySelector(`[data-gauge-value="${key}"]`);
  if (el) el.textContent = val;
}

export function setGaugeArc(key, fraction) {
  const el = document.querySelector(`[data-gauge-arc="${key}"]`);
  if (!el) return;
  const circ = 364.42;
  const offset = circ * (1 - Math.max(0, Math.min(1, fraction)));
  el.style.strokeDashoffset = offset;
}

export function setFunnelValue(key, val) {
  const bar = document.querySelector(`[data-funnel="${key}"]`);
  const valEl = document.querySelector(`[data-funnel="${key}-value"]`);
  if (bar) bar.style.height = Math.min(val * 4, 120) + 'px';
  if (valEl) valEl.textContent = val;
}
