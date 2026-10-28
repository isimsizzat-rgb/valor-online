/* Valor Online · turn-based arena duel (shared by the game and the arena-fight Edge Function).
   The attacker picks one of four skills on their turn; the defender is played by the AI.
   Hits use the same engine as the classic arena (fury, guardians, astrology, medallions).
     1 Saldırı      normal hit           1 s cooldown
     2 Güçlü Vuruş  130% hit             5 s cooldown
     3 Son Darbe    175% hit (max)      15 s cooldown
     4 Pasif        class effect, uses the turn, 10 s cooldown
   A player who does not act within 5 seconds gets an automatic choice. */
(function (root) {
  'use strict';
  // ---- classic arena engine (keep in sync with supabase/functions/arena-fight) ----
  const DAMAGE_MULTIPLIER = 1.5, FURY_START = 5, FURY_STEP = 0.10;
  function arenaUnit(stats, cls) { const magic = cls === 'Büyücü', attack = 10 + Math.max(0, Number(stats[magic ? 'Sihir' : 'Saldırı']) || 0), hp = Math.max(1, Math.round(100 + (Number(stats.Can) || 0) * 10)); return { stats, magic, attack, maxHp: hp, hp }; }
  function baseDamage(a, b) { const defense = Math.max(0, Number(b.stats[a.magic ? 'Sihir Savunma' : 'Savunma']) || 0); return Math.max(1, Math.round(a.attack * a.attack / (a.attack + defense))); }
  function arenaDamage(a, b) { const pierce = Math.max(0, Math.min(100, Number(a?.stats?.medallionArmorPierce) || 0)) / 100; if (!pierce) return baseDamage(a, b); const key = a.magic ? 'Sihir Savunma' : 'Savunma'; return baseDamage(a, { ...b, stats: { ...b.stats, [key]: (Number(b.stats[key]) || 0) * (1 - pierce) } }); }
  function arenaChance(value) { const p = Math.max(0, Number(value) || 0); return Math.min(1, p <= 1000 ? p / 4000 : .25 + (p - 1000) * .75 / 4000); }
  function baseHit(a, b, rng) { const critical = rng() < arenaChance(a.stats.Kritik), blocked = rng() < arenaChance(b.stats.Bloke), base = arenaDamage(a, b); return { damage: Math.max(1, Math.round(base * (1 + (critical ? .25 : 0) - (blocked ? .25 : 0)))), critical, blocked }; }
  function takenDamage(damage, reduction) { return Math.max(1, Math.round(Math.max(1, Number(damage) || 1) * (1 - Math.max(0, Math.min(.20, Number(reduction) || 0))))); }
  function astrologyHit(a, b, rng) { const hit = baseHit(a, b, rng); if (hit.critical) hit.damage += Math.round(arenaDamage(a, b) * Math.max(0, Number(a.stats.astrologyCriticalDamage) || 0)); hit.damage = takenDamage(hit.damage * DAMAGE_MULTIPLIER, b.stats.astrologyDamageReduction || 0); hit.resisted = !!b.stats.astrologyResistance && rng() < b.stats.astrologyResistance; if (hit.resisted) hit.damage = 1; return hit; }
  function arenaHit(a, b, rng) { const critCut = b?.stats?.petBuff?.id === 'ayazdis' ? b.stats.petBuff.reduce : 0, blockCut = a?.stats?.petBuff?.id === 'ayazdis' ? a.stats.petBuff.reduce : 0; if (!critCut && !blockCut) return astrologyHit(a, b, rng); let n = 0; const roll = () => { const v = rng(); n++; return n === 1 ? v + critCut : n === 2 ? v + blockCut : v; }; const hit = astrologyHit(a, b, roll); hit.frost = true; return hit; }
  function fury(round) { return Math.max(0, round - FURY_START) * FURY_STEP; }
  function astroHeal(unit, chance, rng) { if (unit.hp <= 0 || !chance || rng() >= chance) return 0; const healed = Math.min(unit.maxHp - unit.hp, Math.max(1, Math.round(unit.maxHp * .05))); unit.hp += healed; return healed; }

  // ---- skills ----
  const SKILLS = {
    normal: { name: 'Saldırı', mult: 1, cd: 1000, icon: 'assets/arena/skills/normal.webp' },
    strong: { name: 'Güçlü Vuruş', mult: 1.3, cd: 5000, icon: 'assets/arena/skills/strong.webp' },
    max: { name: 'Son Darbe', mult: 1.75, cd: 15000, icon: 'assets/arena/skills/max.webp' },
    passive: { name: 'Pasif', mult: 0, cd: 10000 }
  };
  /* Class passives (calibrated with tools/arena/duel-balance.cjs). They use the turn. */
  const PASSIVES = {
    'Savaşçı': { id: 'shield', name: 'Demir Duruş', value: .09, text: 'Canının %9\'u kadar kalkan', icon: 'assets/arena/skills/passive-savasci.webp' },
    'Büyücü': { id: 'heal', name: 'Yenilenme', value: .12, text: 'Canının %12\'si kadar iyileşir', icon: 'assets/arena/skills/passive-buyucu.webp' },
    'Okçu': { id: 'focus', name: 'Odaklan', value: 1.35, text: 'Sonraki vuruş %135 fazla hasar', icon: 'assets/arena/skills/passive-okcu.webp' }
  };
  const TURN_MS = 5000, GRACE_MS = 1200, MAX_ROUNDS = 200, ORDER = ['normal', 'strong', 'max', 'passive'];
  const passiveOf = (u) => PASSIVES[u.cls] || PASSIVES['Savaşçı'];
  const ready = (u, k, t) => t >= (u.cd[k] || 0);

  function fighter(p) { const u = arenaUnit({ ...p.stats }, p.cls); return { ...u, name: p.name, cls: p.cls, level: p.level || 1, gender: p.gender || 'male', cd: { normal: 0, strong: 0, max: 0, passive: 0 }, shield: 0, focus: 0, burn: null }; }

  /* AI: defensive passive when it pays, otherwise the strongest ready hit. */
  function choose(u, t) {
    const pas = passiveOf(u);
    if (ready(u, 'passive', t)) {
      if (pas.id === 'shield' && !u.shield && u.hp < u.maxHp * .8) return 'passive';
      if (pas.id === 'heal' && u.hp < u.maxHp * .65) return 'passive';
      if (pas.id === 'focus' && !u.focus && ready(u, 'max', t)) return 'passive';
    }
    if (ready(u, 'max', t)) return 'max';
    if (ready(u, 'strong', t)) return 'strong';
    return 'normal';
  }

  function strike(st, a, b, mult, rng) {
    const hit = arenaHit(a, b, rng), pb = a.stats.petBuff, f = fury(st.round);
    if (f > 0 && !hit.resisted) { hit.fury = f; hit.damage = Math.max(1, Math.round(hit.damage * (1 + f))); }
    if (pb?.id === 'safakkanat' && !hit.resisted && b.hp < b.maxHp * .25) { hit.dawn = pb.bonus; hit.damage = Math.max(1, Math.round(hit.damage * (1 + pb.bonus))); }
    if (!hit.resisted) hit.damage = Math.max(1, Math.round(hit.damage * mult));
    const absorbed = Math.min(b.shield || 0, hit.damage); b.shield -= absorbed; hit.absorbed = absorbed || undefined;
    const damage = Math.min(b.hp, hit.damage - absorbed); b.hp -= damage;
    if (pb?.id === 'kozpence' && b.hp > 0 && rng() < pb.chance) { b.burn = { rounds: 3, damage: Math.max(1, Math.round(b.maxHp * pb.burn)) }; hit.ignite = true; }
    hit.healed = astroHeal(b, b.stats.astrologyHealing, rng) || undefined;
    return { hit, damage };
  }

  function perform(st, side, skill, t, rng, auto) {
    const a = st[side], b = st[side === 'me' ? 'foe' : 'me'], ev = { side, skill, auto: !!auto, round: st.round };
    a.cd[skill] = t + SKILLS[skill].cd; if (skill !== 'normal') a.cd.normal = Math.max(a.cd.normal, t + SKILLS.normal.cd);
    if (skill === 'passive') {
      const p = passiveOf(a); ev.passive = p.id;
      if (p.id === 'shield') { a.shield = Math.max(a.shield, Math.round(a.maxHp * p.value)); ev.shield = a.shield; }
      else if (p.id === 'heal') { const h = Math.min(a.maxHp - a.hp, Math.round(a.maxHp * p.value)); a.hp += h; ev.healed = h; }
      else { a.focus = p.value; ev.focus = p.value; }
    } else {
      let mult = SKILLS[skill].mult; if (a.focus) { mult *= 1 + a.focus; ev.focused = true; a.focus = 0; }
      const s = strike(st, a, b, mult, rng); let total = s.damage;
      if (a.stats.petBuff?.id === 'gecegaga' && b.hp > 0 && rng() < a.stats.petBuff.chance) { const x = strike(st, a, b, 1, rng); total += x.damage; s.hit.shadow = x.damage; }
      ev.damage = total; ev.hit = s.hit;
    }
    ev.myHp = st.me.hp; ev.enemyHp = st.foe.hp; ev.myShield = st.me.shield; ev.enemyShield = st.foe.shield;
    st.events.push(ev); st.log = st.log.concat(ev).slice(-8);
    if (st.me.hp <= 0 || st.foe.hp <= 0) return finish(st);
    st.step++;
    if (st.step >= 2) endRound(st, rng);
  }
  function endRound(st, rng) {
    for (const [u, side] of [[st.foe, 'me'], [st.me, 'foe']]) {
      if (!u.burn || u.hp <= 0) continue; const d = Math.min(u.hp, u.burn.damage); u.hp -= d; if (--u.burn.rounds <= 0) u.burn = null;
      const ev = { side, skill: 'burn', damage: d, round: st.round, myHp: st.me.hp, enemyHp: st.foe.hp }; st.events.push(ev); st.log = st.log.concat(ev).slice(-8);
    }
    if (st.me.hp <= 0 || st.foe.hp <= 0) return finish(st);
    st.round++; st.step = 0; if (st.round > MAX_ROUNDS) finish(st);
  }
  function finish(st) { st.status = 'done'; const ko = st.me.hp <= 0 || st.foe.hp <= 0; st.result = { win: st.foe.hp <= 0 && st.me.hp > 0, draw: !ko, rounds: st.round, myHp: st.me.hp, enemyHp: st.foe.hp, myMaxHp: st.me.maxHp, enemyMaxHp: st.foe.maxHp, reason: ko ? 'knockout' : 'stalemate' }; }
  const actor = (st) => st.order[st.step];

  /* Let the AI (defender) play every turn that is not the player's. */
  function runAi(st, now, rng) {
    let t = now;
    while (st.status === 'battle' && actor(st) === 'foe') { const u = st.foe; t = Math.max(t, u.cd.normal); perform(st, 'foe', choose(u, t), t, rng, true); }
    st.turnAt = now + (st.events.length ? GRACE_MS : 0);
  }
  function create(me, foe, now, rng = Math.random) {
    const st = { v: 1, me: fighter(me), foe: fighter(foe), round: 1, step: 0, status: 'battle', events: [], log: [], startedAt: now };
    const meFirst = st.me.attack === st.foe.attack ? rng() < .5 : st.me.attack > st.foe.attack;
    st.order = meFirst ? ['me', 'foe'] : ['foe', 'me'];
    runAi(st, now, rng); return st;
  }
  /* The player's turn: a skill name, or 'auto' once 5 seconds have passed. Returns false if not allowed. */
  function act(st, skill, now, rng = Math.random) {
    if (st.status !== 'battle' || actor(st) !== 'me') return false;
    let auto = false;
    if (skill === 'auto') { if (now - st.turnAt < TURN_MS) return false; skill = choose(st.me, Math.max(now, st.me.cd.normal)); auto = true; now = Math.max(now, st.me.cd.normal); }
    if (!SKILLS[skill] || !ready(st.me, skill, now)) return false;
    st.events = []; perform(st, 'me', skill, now, rng, auto); runAi(st, now, rng); return true;
  }
  /* Play the rest automatically (abandoned fights). */
  function autoplay(st, now, rng = Math.random) { let t = Math.max(now, st.turnAt + TURN_MS), guard = 0; while (st.status === 'battle' && guard++ < 2000) { if (!act(st, 'auto', t, rng)) t += TURN_MS; else t += TURN_MS; } return st; }
  /* What the client needs (no hidden RNG state). */
  function view(st) { return { v: st.v, me: st.me, foe: st.foe, round: st.round, status: st.status, turn: st.status === 'battle' ? actor(st) : null, turnAt: st.turnAt, events: st.events, log: st.log, result: st.result || null }; }

  const api = { SKILLS, PASSIVES, ORDER, TURN_MS, passiveOf, ready, choose, create, act, autoplay, view, arenaUnit };
  root.ValorDuelCore = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
