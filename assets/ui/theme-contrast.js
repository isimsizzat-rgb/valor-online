/* Light theme readability guard.
   Many pages were designed for the dark theme. In light mode some of their panels turn pale while
   the text stays pale, and some panels stay dark while headings turn dark. After every render this
   finds text whose colour is too close to the surface behind it and shifts that same hue lighter or
   darker until it reads at 4.5:1. Text over artwork (image backgrounds) is left untouched. */
(function () {
  'use strict';
  const root = document.documentElement;
  const TARGET = 4.5, TRIGGER = 3.2;
  const original = new WeakMap();
  let fixed = new Set(), queued = false;

  function parse(c) {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    return {r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1};
  }
  function lum(c) {
    const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); };
    return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b);
  }
  function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  function mix(top, under) {
    const a = top.a;
    return {r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1};
  }
  function toHsl(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6;
    }
    return {h, s, l};
  }
  function fromHsl(h, s, l) {
    const k = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    if (!s) return {r: l * 255, g: l * 255, b: l * 255, a: 1};
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return {r: k(p, q, h + 1 / 3) * 255, g: k(p, q, h) * 255, b: k(p, q, h - 1 / 3) * 255, a: 1};
  }

  /* The colour behind an element: its own and its ancestors' fills, flattened. null = artwork. */
  const PAGE = {r: 245, g: 239, b: 228, a: 1};
  function surface(el, cache) {
    const layers = [];
    for (let e = el; e && e !== document.body && e !== root; e = e.parentElement) {
      if (cache.has(e)) { const under = cache.get(e); if (under === null) return null; return flatten(layers, under); }
      const cs = getComputedStyle(e), img = cs.backgroundImage, op = +cs.opacity || 1;
      if (img && img !== 'none') {
        if (/url\(/.test(img) && !/gradient/.test(img)) { cache.set(e, null); return null; }
        const stops = (img.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
        if (stops.length) {
          const avg = stops.reduce((s, c) => ({r: s.r + c.r, g: s.g + c.g, b: s.b + c.b, a: s.a + c.a}), {r: 0, g: 0, b: 0, a: 0});
          const n = stops.length; const g = {r: avg.r / n, g: avg.g / n, b: avg.b / n, a: avg.a / n};
          const bg = parse(cs.backgroundColor);
          if (bg && bg.a > .05) layers.push({...bg, a: bg.a * op});
          g.a *= op; layers.push(g);
          if (g.a > .85 || (bg && bg.a > .85)) return flatten(layers, null);
          continue;
        }
      }
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > .05) { bg.a *= op; layers.push(bg); if (bg.a > .85) return flatten(layers, null); }
      if (e.querySelector(':scope > img[class*=cover],:scope > img[class*=art]')) { cache.set(e, null); return null; }
    }
    return flatten(layers, PAGE);
  }
  function flatten(layers, under) {
    let c = under;
    for (let i = layers.length - 1; i >= 0; i--) c = c ? mix(layers[i], c) : {...layers[i], a: 1};
    return c;
  }

  /* Keep the designer's polarity (light text on its surface stays lighter than it) when that can
     reach the target; otherwise go the other way. */
  function shift(color, bg, darker) {
    const {h, s} = toHsl(color);
    let l = toHsl(color).l, c = color;
    for (let i = 0; i < 40 && ratio(c, bg) < TARGET; i++) {
      l = darker ? Math.max(0, l - .025) : Math.min(1, l + .025);
      c = fromHsl(h, Math.min(s, darker ? .75 : .6), l);
    }
    return c;
  }
  function adjust(color, bg) {
    const prefer = lum(color) < lum(bg);
    let c = shift(color, bg, prefer);
    if (ratio(c, bg) >= TARGET - .3) return {c, darker: prefer};
    const alt = shift(color, bg, !prefer);
    return ratio(alt, bg) > ratio(c, bg) ? {c: alt, darker: !prefer} : {c, darker: prefer};
  }

  function clear() {
    fixed.forEach(el => { el.style.removeProperty('color'); el.style.removeProperty('text-shadow'); delete el.dataset.vtContrast; });
    fixed = new Set();
  }

  function pass() {
    queued = false;
    if (root.dataset.valorTheme !== 'light') { if (fixed.size) clear(); return; }
    const scope = document.body; if (!scope) return;
    const cache = new Map(), seen = new Set();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode, el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent.trim()) continue;
      seen.add(el);
      if (el.closest('script,style,svg,.bottom-nav,.vp-scene,[disabled]')) continue;
      if (!el.isConnected || !el.getClientRects().length) continue;
      if (!original.has(el) || !el.dataset.vtContrast) original.set(el, getComputedStyle(el).color);
      const col = parse(original.get(el)); if (!col || col.a < .3) continue;
      const bg = surface(el, cache); if (!bg) continue;
      const solid = col.a < 1 ? mix(col, bg) : col;
      if (ratio(solid, bg) >= TRIGGER) {
        if (el.dataset.vtContrast) { el.style.removeProperty('color'); el.style.removeProperty('text-shadow'); delete el.dataset.vtContrast; fixed.delete(el); }
        continue;
      }
      const {c, darker} = adjust(solid, bg);
      el.style.setProperty('color', `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`, 'important');
      el.style.setProperty('text-shadow', darker ? 'none' : '0 1px 2px rgba(0,0,0,.55)', 'important');
      el.dataset.vtContrast = darker ? 'dark' : 'light';
      fixed.add(el);
    }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(pass); } }

  function start() {
    new MutationObserver(queue).observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class']});
    new MutationObserver(queue).observe(root, {attributes: true, attributeFilter: ['data-valor-theme']});
    queue();
  }
  window.valorThemeContrastPass = pass;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
