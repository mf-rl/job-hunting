const templates = new Map();

export async function loadTemplates(templateMap) {
  await Promise.all(Object.entries(templateMap).map(async ([name, url]) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load template ${name}: ${response.status}`);
    templates.set(name, await response.text());
  }));
}

export function createTemplateView(name) {
  const html = templates.get(name);
  if (!html) throw new Error(`Template not loaded: ${name}`);
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild.cloneNode(true);
}
