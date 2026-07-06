
import { $, $$ } from '../shared/dom.js';

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
      $$('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === viewId));
      $$('.mobile-nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === viewId));
      const main = $('#fx-main');
      if (main) $$('.fx-view', main).forEach((el) => el.classList.toggle('active', el.dataset.view === viewId));
      const page = pages.get(viewId);
      const title = $('#fx-page-title');
      if (page && title) title.textContent = page.title;
      if (page?.onShow) page.onShow();
      listeners.forEach((listener) => listener(viewId));
    },
    currentView() { return currentView; },
  };
}
