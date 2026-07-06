
export function timeAgo(iso) {
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

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

export function htmlToText(html) {
  if (!html) return '';
  const s = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\u2022 ')
    .replace(/<[^>]+>/g, '');
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value.replace(/\n{3,}/g, '\n\n').trim();
}

export function formatSource(src) {
  const map = {
    adzuna_us: ['AZ·US', '#6EB8FF'], adzuna_gb: ['AZ·UK', '#6EB8FF'],
    adzuna_es: ['AZ·ES', '#6EB8FF'], adzuna_de: ['AZ·DE', '#6EB8FF'],
    adzuna_fr: ['AZ·FR', '#6EB8FF'], adzuna_ca: ['AZ·CA', '#6EB8FF'],
    adzuna_au: ['AZ·AU', '#6EB8FF'], adzuna_br: ['AZ·BR', '#6EB8FF'],
    adzuna_in: ['AZ·IN', '#6EB8FF'], remotive: ['Rem', '#00C89C'],
    remoteok: ['ROK', '#AD8CFF'], weworkremotely: ['WWR', '#EAC266'], jobicy: ['Jcy', '#FF7C68'],
  };
  if (!src) return '<span style="font-size:10px;color:var(--text-faint);">—</span>';
  if (src.startsWith('adzuna_')) {
    const cc = src.slice(7).toUpperCase();
    const entry = map[src] || ['AZ·' + cc, '#6EB8FF'];
    return '<span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:4px;background:rgba(110,184,255,0.12);color:' + entry[1] + ';">' + entry[0] + '</span>';
  }
  const entry = map[src];
  if (!entry) return '<span style="font-size:10px;color:var(--text-faint);">' + esc(src) + '</span>';
  return '<span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:4px;background:rgba(0,0,0,0.2);color:' + entry[1] + ';">' + entry[0] + '</span>';
}
