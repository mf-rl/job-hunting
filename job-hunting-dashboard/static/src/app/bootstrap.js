
import { injectStyles } from '../styles/styles.js';
import { buildAppShell } from './appShell.js';
import { createRouter } from './router.js';
import { createOverviewPage } from '../features/overview/overviewPage.js';
import { createJobsPage } from '../features/jobs/jobsPage.js';
import { createCustomPage } from '../features/custom/customPage.js';
import { createCvPage } from '../features/cv/cvPage.js';
import { createSettingsPage } from '../features/settings/settingsPage.js';
import { createDesignPage } from '../features/design/designPage.js';

const VERSION = 3;

function checkForDemoData() {
  setTimeout(() => {
    const text = document.body.innerText;
    const found = [];
    if (text.includes('775.5K')) found.push('775.5K');
    if (text.includes('227') || text.includes(' 227')) found.push('227');
    if (found.length) console.warn('DEMO DATA LEAK detected:', found.join(', '));
  }, 2000);
}

export function bootstrap() {
  injectStyles();
  const router = createRouter();
  const pages = [
    createOverviewPage(),
    createJobsPage(),
    createCustomPage(),
    createCvPage(),
    createSettingsPage(),
    createDesignPage(),
  ];
  pages.forEach((page) => router.register(page));
  const { main } = buildAppShell({ router, pages });
  pages.forEach((page) => main.appendChild(page.render()));
  router.onChange((viewId) => {
    const scanButton = document.getElementById('btn-scan-top');
    if (scanButton) scanButton.style.display = viewId === 'jobs' ? 'inline-flex' : 'none';
  });
  router.switchTo('overview');
  pages.forEach((page) => page.start?.());
  checkForDemoData();
  console.log('FORGE Dashboard v' + VERSION);
}

document.addEventListener('DOMContentLoaded', bootstrap);
