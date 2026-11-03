/* Standalone light/dark preference; no framework, analytics or remote assets. */
(() => {
  'use strict';
  const key = 'map-challenge-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => value === 'light' || value === 'dark';
  let preference;
  try { const stored = localStorage.getItem(key); if (valid(stored)) preference = stored; } catch { /* Storage can be disabled. */ }
  function apply() {
    const theme = preference || (media.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme';
    }
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.hidden = false;
      button.addEventListener('click', () => {
        preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(key, preference); } catch { /* Keep working without persistence. */ }
        apply();
      });
    }
    apply();
  });
  media.addEventListener('change', () => { if (!preference) apply(); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : undefined;
    apply();
  });
})();
