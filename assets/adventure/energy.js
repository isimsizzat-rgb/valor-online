/* Adventure-only energy: +10 every 30 minutes, including offline time. */
const VALOR_ENERGY_INTERVAL = 30 * 60 * 1000;
const VALOR_ENERGY_GAIN = 10;

function valorEnergyRegenerate(now = Date.now()) {
  if (!state.class) return 0;
  let changed = false;
  const before = Math.max(0, Math.min(MAX_ADVENTURE_ENERGY, Number(state.adventureEnergy) || 0));
  if (state.adventureEnergy !== before) { state.adventureEnergy = before; changed = true; }
  if (before === MAX_ADVENTURE_ENERGY) {
    if (state.adventureEnergyRegenAt !== null) { state.adventureEnergyRegenAt = null; changed = true; }
  } else {
    const anchor = state.adventureEnergyRegenAt;
    if (typeof anchor !== 'number' || !Number.isFinite(anchor) || anchor > now) {
      state.adventureEnergyRegenAt = now;
      changed = true;
    } else {
      const ticks = Math.floor((now - anchor) / VALOR_ENERGY_INTERVAL);
      if (ticks > 0) {
        state.adventureEnergy = Math.min(MAX_ADVENTURE_ENERGY, before + ticks * VALOR_ENERGY_GAIN);
        state.adventureEnergyRegenAt = state.adventureEnergy === MAX_ADVENTURE_ENERGY ? null : anchor + ticks * VALOR_ENERGY_INTERVAL;
        changed = true;
      }
    }
  }
  if (changed) save();
  return state.adventureEnergy - before;
}

function valorEnergyCountdown(now = Date.now()) {
  if (state.adventureEnergy >= MAX_ADVENTURE_ENERGY) return 'Enerji dolu · 30 dakikada +10';
  const anchor = typeof state.adventureEnergyRegenAt === 'number' ? state.adventureEnergyRegenAt : now;
  const remaining = Math.max(0, Math.ceil((VALOR_ENERGY_INTERVAL - (now - anchor)) / 1000));
  return '+10 enerji: ' + String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
}

function valorEnergyUpdateCountdown() {
  const text = valorEnergyCountdown();
  for (const panel of document.querySelectorAll('.adventure-energy')) {
    let timer = panel.querySelector('[data-energy-countdown]');
    if (!timer) {
      timer = document.createElement('small');
      timer.dataset.energyCountdown = '';
      timer.style.cssText = 'display:block;margin-top:7px;font-size:11px;color:#ddc99f;white-space:nowrap';
      panel.appendChild(timer);
    }
    timer.textContent = text;
  }
  const hud = document.getElementById('valor-hud-energy-current');
  if (hud) { hud.textContent = String(state.adventureEnergy); hud.parentElement.title = text; }
}

const valorEnergyPreviousDailyReset = stageDailyReset;
stageDailyReset = function () {
  valorEnergyPreviousDailyReset();
  valorEnergyRegenerate();
};
const valorEnergyPreviousRender = render;
render = function () {
  if (state.class) stageDailyReset();
  valorEnergyPreviousRender();
  if (state.class) valorEnergyUpdateCountdown();
};
function valorEnergyTick() {
  if (!state.class) return;
  const before = state.adventureEnergy;
  stageDailyReset();
  if (state.adventureEnergy !== before) render();
  else valorEnergyUpdateCountdown();
}
setInterval(valorEnergyTick, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) valorEnergyTick(); });
window.addEventListener('pageshow', valorEnergyTick);
render();
