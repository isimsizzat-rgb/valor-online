(function () {
  'use strict';
  const KEY = 'valor-color-theme-v1';
  const root = document.documentElement;
  function apply(theme) {
    root.dataset.valorTheme = theme === 'light' ? 'light' : 'dark';
    root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#e9e1d1' : '#1a1310';
    document.querySelectorAll('[data-valor-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.valorThemeChoice === root.dataset.valorTheme));
    });
  }
  let initial = 'dark';
  try { if (localStorage.getItem(KEY) === 'light') initial = 'light'; } catch (_) {}
  apply(initial);
  window.valorSetColorTheme = function (theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch (_) {}
  };
  window.addEventListener('storage', event => {
    if (event.key === KEY) apply(event.newValue === 'light' ? 'light' : 'dark');
  });
  function install() {
    if (typeof window.valorSettingsPage !== 'function') return;
    const previous = window.valorSettingsPage;
    window.valorSettingsPage = function () {
      const template = document.createElement('template');
      template.innerHTML = previous.apply(this, arguments);
      const appearance = template.content.querySelector('.vhub-card');
      if (appearance) {
        const block = document.createElement('div');
        block.className = 'valor-theme-picker';
        block.innerHTML = '<p id="valor-theme-label">Tema</p><div role="group" aria-labelledby="valor-theme-label">' +
          [['light','☀ Aydınlık'],['dark','☾ Karanlık']].map(([value,label]) =>
            '<button type="button" data-valor-theme-choice="'+value+'" aria-pressed="'+(root.dataset.valorTheme === value)+'" onclick="valorSetColorTheme(\''+value+'\')">'+label+'</button>'
          ).join('')+'</div><p class="vhub-note">Tema seçimin bu cihazda hatırlanır.</p>';
        appearance.querySelector('h2').insertAdjacentElement('afterend', block);
      }
      return template.innerHTML;
    };
    if (typeof page !== 'undefined' && page === 'Ayarlar' && typeof render === 'function') render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
