(function () {
  'use strict';
  const KEY = 'valor-color-theme-v1';
  const root = document.documentElement;
  const choices = ['light', 'dark', 'auto'];
  let selected = 'light';
  function apply() {
    const hour = new Date().getHours();
    const theme = selected === 'auto' ? (hour >= 7 && hour < 19 ? 'light' : 'dark') : selected;
    root.dataset.valorThemeMode = selected;
    root.dataset.valorTheme = theme === 'light' ? 'light' : 'dark';
    root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#e9e1d1' : '#1a1310';
    document.querySelectorAll('[data-valor-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.valorThemeChoice === selected));
    });
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (choices.includes(saved)) selected = saved;
  } catch (_) {}
  apply();
  window.valorSetColorTheme = function (theme) {
    if (!choices.includes(theme)) return;
    selected = theme;
    apply();
    try { localStorage.setItem(KEY, theme); } catch (_) {}
  };
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) {
      selected = choices.includes(event.newValue) ? event.newValue : 'auto';
      apply();
    }
  });
  // Recheck the local clock while open and immediately after returning to the game.
  window.setInterval(apply, 1000);
  window.addEventListener('focus', apply);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) apply();
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
          [['auto','◷ Oto seçim'],['light','☀ Aydınlık'],['dark','☾ Karanlık']].map(([value,label]) =>
            '<button type="button" data-valor-theme-choice="'+value+'" aria-pressed="'+(selected === value)+'" onclick="valorSetColorTheme(\''+value+'\')">'+label+'</button>'
          ).join('')+'</div><p class="vhub-note">Oto seçim: cihaz saatine göre 07.00–19.00 aydınlık, diğer saatlerde karanlık. Tema seçimin bu cihazda hatırlanır.</p>';
        appearance.querySelector('h2').insertAdjacentElement('afterend', block);
      }
      return template.innerHTML;
    };
    if (typeof page !== 'undefined' && page === 'Ayarlar' && typeof render === 'function') render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
