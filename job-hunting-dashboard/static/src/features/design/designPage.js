
import { ICONS } from '../../shared/icons.js';

function buildDesignRefView() {
  const div = document.createElement('div');
  div.className = 'fx-view';
  div.dataset.view = 'designref';
  div.innerHTML = '<iframe id="fx-design-ref"></iframe>';
  return div;
}

export function createDesignPage() {
  return {
    id: 'designref',
    title: 'Design Reference',
    navLabel: 'Design Reference',
    icon: ICONS.design,
    primary: false,
    render: buildDesignRefView,
    onShow() {
      const ref = document.getElementById('fx-design-ref');
      if (ref && !ref.src) ref.src = '/template';
    },
  };
}
