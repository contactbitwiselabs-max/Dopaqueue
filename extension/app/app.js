import { supabaseClient } from '../shared/supabase.js';
import { initStorage } from '../shared/storage.js';

const routes = {
  dashboard: () => import('./pages/dashboard.js'),
  journal: () => import('./pages/journal.js'),
  channels: () => import('./pages/channels.js'),
  settings: () => import('./pages/settings.js'),
  login: () => import('./pages/login.js'),
};

const appEl = document.getElementById('app');
const navLinks = document.querySelectorAll('.nav__links a[data-route]');

let currentPage = null;

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  return routes[hash] ? hash : 'dashboard';
}

function setActiveNav(route) {
  navLinks.forEach((link) => {
    link.classList.toggle('active', link.dataset.route === route);
  });
}

async function render() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  let route = currentRoute();
  
  if (session && route === 'login') {
    location.hash = '#/dashboard';
    return;
  }

  setActiveNav(route);

  if (currentPage && typeof currentPage.destroy === 'function') {
    currentPage.destroy();
  }

  appEl.innerHTML = '';
  const module = await routes[route]();
  currentPage = module;
  module.render(appEl);
}

window.addEventListener('hashchange', render);

async function boot() {
  await initStorage();
  render();
}

boot();
