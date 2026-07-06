import { $, $$ } from '../shared/dom.js';

function setSelected(buttons, viewId) {
  buttons.forEach((el) => {
    const active = el.dataset.view === viewId;
    el.classList.toggle('active', active);
    el.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

export function createRouter() {
  const pages = new Map();
  const listeners = new Set();
  let currentView = 'overview';
  return {
    register(page) { pages.set(page.id, page); },
    pages() { return Array.from(pages.values()); },
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    switchTo(viewId) {
      currentView = viewId;
      setSelected($$('.nav-item'), viewId);
      setSelected($$('.mobile-nav-item'), viewId);
      const main = $('#fx-main');
      if (main) {
        $$('.fx-view', main).forEach((el) => {
          const active = el.dataset.view === viewId;
          el.classList.toggle('active', active);
          el.hidden = !active;
        });
      }
      const page = pages.get(viewId);
      const title = $('#fx-page-title');
      if (page && title) title.textContent = page.title;
      if (page?.onShow) page.onShow();
      listeners.forEach((listener) => listener(viewId));
    },
    currentView() { return currentView; },
  };
}
