/* Valor Online · turn-based arena duel (shared by the game and the arena-fight Edge Function).
   The attacker picks one of four skills on their turn; the defender is played by the AI.
   Hits use the same engine as the classic arena (fury, guardians, astrology, medallions).
     1 Saldırı      normal hit           1 s cooldown
     2 Güçlü Vuruş  130% hit             5 s cooldown
     3 Son Darbe    175% hit (max)      15 s cooldown
     4 Pasif        class effect, uses the turn, 10 s cooldown
                    (Savaşçı shield and Okçu damage boost last 3 turns; Büyücü heals at once)
   A player who does not act within 5 seconds gets an automatic choice. */
(function (root) {
  'use strict';
  // ---- classic arena engine (keep in sync with supabase/functions/arena-fight) ----
  const DAMAGE_MULTIPLIER = 1.5, FURY_START = 5, FURY_STEP = 0.05;   // classic arena uses 0.10; duels are longer
  function arenaUnit(stats, cls) { const magic = cls === 'Büyücü', attack = 10 + Math.max(0, Number(stats[magic ? 'Sihir' : 'Saldırı']) || 0), hp = Math.max(1, Math.round(100 + (Number(stats.Can) || 0) * 10)); return { stats, magic, attack, maxHp: hp, hp }; }
  function baseDamage(a, b) { const defense = Math.max(0, Number(b.stats[a.magic ? 'Sihir Savunma' : 'Savunma']) || 0); return Math.max(1, Math.round(a.attack * a.attack / (a.attack + defense))); }
  function arenaDamage(a, b) { const pierce = Math.max(0, Math.min(100, Number(a?.stats?.medallionArmorPierce) || 0)) / 100; if (!pierce) return baseDamage(a, b); const key = a.magic ? 'Sihir Savunma' : 'Savunma'; return baseDamage(a, { ...b, stats: { ...b.stats, [key]: (Number(b.stats[key]) || 0) * (1 - pierce) } }); }
  function arenaChance(value) { const p = Math.max(0, Number(value) || 0); return Math.min(1, p <= 1000 ? p / 4000 : .25 + (p - 1000) * .75 / 4000); }
  function baseHit(a, b, rng) { const critical = rng() < arenaChance(a.stats.Kritik), blocked = rng() < arenaChance(b.stats.Bloke), base = arenaDamage(a, b); return { damage: Math.max(1, Math.round(base * (1 + (critical ? .25 : 0) - (blocked ? .25 : 0)))), critical, blocked }; }
  function takenDamage(damage, reduction) { return Math.max(1, Math.round(Math.max(1, Number(damage) || 1) * (1 - Math.max(0, Math.min(.20, Number(reduction) || 0))))); }
  function astrologyHit(a, b, rng) { const hit = baseHit(a, b, rng); if (hit.critical) hit.damage += Math.round(arenaDamage(a, b) * Math.max(0, Number(a.stats.astrologyCriticalDamage) || 0)); hit.damage = takenDamage(hit.damage * DAMAGE_MULTIPLIER, b.stats.astrologyDamageReduction || 0); hit.resisted = !!b.stats.astrologyResistance && rng() < b.stats.astrologyResistance; if (hit.resisted) hit.damage = 1; return hit; }
  function arenaHit(a, b, rng) { const critCut = b?.stats?.petBuff?.id === 'ayazdis' ? b.stats.petBuff.reduce : 0, blockCut = a?.stats?.petBuff?.id === 'ayazdis' ? a.stats.petBuff.reduce : 0; if (!critCut && !blockCut) return astrologyHit(a, b, rng); let n = 0; const roll = () => { const v = rng(); n++; return n === 1 ? v + critCut : n === 2 ? v + blockCut : v; }; const hit = astrologyHit(a, b, roll); hit.frost = true; return hit; }
  const TEAM_FURY_STEP = 0.10;   // 3v3 keeps the classic team arena's fury
  function fury(round, step = FURY_STEP) { return Math.max(0, round - FURY_START) * step; }
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
    'Savaşçı': { id: 'shield', name: 'Demir Duruş', value: .25, turns: 3, text: '3 tur, canının %25\'i kadar kalkan', icon: 'assets/arena/skills/passive-savasci.webp' },
    'Büyücü': { id: 'heal', name: 'Yenilenme', value: .25, text: 'Canının %25\'i kadar iyileşir', icon: 'assets/arena/skills/passive-buyucu.webp' },
    'Okçu': { id: 'focus', name: 'Odaklan', value: .25, turns: 3, text: '3 tur boyunca %25 fazla hasar', icon: 'assets/arena/skills/passive-okcu.webp' }
  };
  const TURN_MS = 5000, GRACE_MS = 1200, MAX_ROUNDS = 200, ORDER = ['normal', 'strong', 'max', 'passive'];
  const passiveOf = (u) => PASSIVES[u.cls] || PASSIVES['Savaşçı'];
  const ready = (u, k, t) => t >= (u.cd[k] || 0);

  function fighter(p) { const u = arenaUnit({ ...p.stats }, p.cls); return { ...u, name: p.name, cls: p.cls, level: p.level || 1, gender: p.gender || 'male', cd: { normal: 0, strong: 0, max: 0, passive: 0 }, shield: 0, shieldTurns: 0, focus: 0, focusTurns: 0, burn: null }; }

  /* AI: defensive passive when it pays, otherwise the strongest ready hit. */
  function choose(u, t) {
    const pas = passiveOf(u);
    if (ready(u, 'passive', t)) {
      if (pas.id === 'shield' && !u.shield && u.hp < u.maxHp * .8) return 'passive';
      if (pas.id === 'heal' && u.hp < u.maxHp * .65) return 'passive';
      if (pas.id === 'focus' && !u.focusTurns && ready(u, 'max', t)) return 'passive';
    }
    if (ready(u, 'max', t)) return 'max';
    if (ready(u, 'strong', t)) return 'strong';
    return 'normal';
  }

  function strike(st, a, b, mult, rng) {
    const hit = arenaHit(a, b, rng), pb = a.stats.petBuff, f = fury(st.round, st.team ? TEAM_FURY_STEP : FURY_STEP);
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
      if (p.id === 'shield') { a.shield = Math.max(a.shield, Math.round(a.maxHp * p.value)); a.shieldTurns = p.turns; ev.shield = a.shield; }
      else if (p.id === 'heal') { const h = Math.min(a.maxHp - a.hp, Math.round(a.maxHp * p.value)); a.hp += h; ev.healed = h; }
      else { a.focus = p.value; a.focusTurns = p.turns; ev.focus = p.value; }
    } else {
      let mult = SKILLS[skill].mult; if (a.focusTurns > 0) { mult *= 1 + a.focus; ev.focused = true; if (--a.focusTurns <= 0) a.focus = 0; }
      const s = strike(st, a, b, mult, rng); let total = s.damage;
      if (a.stats.petBuff?.id === 'gecegaga' && b.hp > 0 && rng() < a.stats.petBuff.chance) { const x = strike(st, a, b, 1, rng); total += x.damage; s.hit.shadow = x.damage; }
      ev.damage = total; ev.hit = s.hit;
    }
    if (b.shieldTurns > 0 && --b.shieldTurns <= 0) b.shield = 0;
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


  // ---------------- Team duels (1v1 up to 3v3) ----------------
  /* Every round all living fighters act once, fastest (highest attack) first. Team A's real players
     pick their skill (5 s, then automatic); everyone else is the AI. Attacks go to the enemy with the
     lowest health. Passives affect only the one who uses them; shields last 3 rounds. */
  function tUnit(p, side, idx, human) { const u = fighter(p); return { ...u, uid: p.uid || null, side, idx, human: !!human, dealt: 0, portrait: p.portrait || null }; }
  const tAlive = (st, side) => st.units.filter((u) => u.side === side && u.hp > 0);
  const tActor = (st) => st.units[st.queue[st.qi]];
  function tQueue(st, rng) { st.queue = st.units.filter((u) => u.hp > 0).sort((a, b) => b.attack - a.attack || (rng() - .5)).map((u) => u.idx); st.qi = 0; }
  function tTarget(st, u) { const foes = tAlive(st, u.side === 'A' ? 'B' : 'A'); return foes.sort((a, b) => a.hp - b.hp || a.idx - b.idx)[0] || null; }
  function tLog(st, act) { let r = st.tlog[st.tlog.length - 1]; if (!r || r.round !== st.round) { if (st.tlog.length >= 150) return; r = { round: st.round, acts: [] }; st.tlog.push(r); } r.acts.push(act); }
  function tPerform(st, u, skill, t, rng, auto) {
    const ev = { ai: u.idx, side: u.side, skill, auto: !!auto, round: st.round };
    u.cd[skill] = t + SKILLS[skill].cd; if (skill !== 'normal') u.cd.normal = Math.max(u.cd.normal, t + SKILLS.normal.cd);
    if (skill === 'passive') {
      const p = passiveOf(u); ev.passive = p.id;
      if (p.id === 'shield') { u.shield = Math.max(u.shield, Math.round(u.maxHp * p.value)); u.shieldTurns = p.turns; ev.shield = u.shield; }
      else if (p.id === 'heal') { const h = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * p.value)); u.hp += h; ev.healed = h; }
      else { u.focus = p.value; u.focusTurns = p.turns; ev.focus = p.value; }
      tLog(st, { a: u.name, b: u.name, ai: u.idx, bi: u.idx, dmg: 0, hit: null, ko: false, passive: p.id });
    } else {
      const b = tTarget(st, u); if (!b) return;
      let mult = SKILLS[skill].mult; if (u.focusTurns > 0) { mult *= 1 + u.focus; ev.focused = true; if (--u.focusTurns <= 0) u.focus = 0; }
      const s = strike(st, u, b, mult, rng); let total = s.damage;
      if (u.stats.petBuff?.id === 'gecegaga' && b.hp > 0 && rng() < u.stats.petBuff.chance) { const x = strike(st, u, b, 1, rng); total += x.damage; s.hit.shadow = x.damage; }
      u.dealt += total; ev.bi = b.idx; ev.damage = total; ev.hit = s.hit; ev.ko = b.hp <= 0;
      if (b.burn && !b.burn.from) b.burn.from = u.idx;
      tLog(st, { a: u.name, b: b.name, ai: u.idx, bi: b.idx, dmg: total, hit: s.hit, ko: b.hp <= 0 });
    }
    ev.hp = st.units.map((x) => [x.hp, x.shield]); st.events.push(ev);
    if (!tAlive(st, 'A').length || !tAlive(st, 'B').length) return tFinish(st);
    tNext(st, rng);
  }
  function tNext(st, rng) {
    do st.qi++; while (st.qi < st.queue.length && st.units[st.queue[st.qi]].hp <= 0);
    if (st.qi < st.queue.length) return;
    for (const u of st.units) {   // end of round: burns, shields run down
      if (u.burn && u.hp > 0) { const d = Math.min(u.hp, u.burn.damage); u.hp -= d; const from = st.units[u.burn.from]; if (from) from.dealt += d; st.events.push({ ai: -1, bi: u.idx, skill: 'burn', damage: d, round: st.round, hp: st.units.map((x) => [x.hp, x.shield]) }); tLog(st, { a: 'Yanık', b: u.name, ai: -1, bi: u.idx, dmg: d, hit: null, ko: u.hp <= 0, burn: true }); if (--u.burn.rounds <= 0) u.burn = null; }
      if (u.shieldTurns > 0 && --u.shieldTurns <= 0) u.shield = 0;
    }
    if (!tAlive(st, 'A').length || !tAlive(st, 'B').length) return tFinish(st);
    st.round++; if (st.round > MAX_ROUNDS) return tFinish(st);
    tQueue(st, rng);
  }
  function tFinish(st) {
    st.status = 'done'; const a = tAlive(st, 'A').length, b = tAlive(st, 'B').length;
    st.result = { win: a > 0 && b === 0, draw: a > 0 && b > 0, rounds: st.round, log: st.tlog,
      units: st.units.map((u) => ({ uid: u.uid, name: u.name, cls: u.cls, side: u.side, hp: Math.max(0, u.hp), maxHp: u.maxHp, dealt: u.dealt, level: u.level, gender: u.gender })) };
  }
  function tRunAi(st, now, rng) {
    let t = now;
    while (st.status === 'battle' && !tActor(st).human) { const u = tActor(st); t = Math.max(t, u.cd.normal); tPerform(st, u, choose(u, t), t, rng, true); }
    st.turnAt = now + (st.events.length ? GRACE_MS : 0);
  }
  /* A and B: [{uid, name, cls, level, gender, stats, human}] */
  function teamCreate(A, B, now, rng = Math.random) {
    const units = [...A.map((p, i) => tUnit(p, 'A', i, p.human)), ...B.map((p, i) => tUnit(p, 'B', A.length + i, false))];
    const st = { v: 1, team: true, units, round: 1, status: 'battle', events: [], tlog: [], startedAt: now };
    tQueue(st, rng); tRunAi(st, now, rng); return st;
  }
  /* A real player's turn (uid must be the fighter whose turn it is). skill 'auto' only after 5 s. */
  function teamAct(st, uid, skill, now, rng = Math.random) {
    if (st.status !== 'battle') return false; const u = tActor(st); if (!u || !u.human || u.uid !== uid) return false;
    let auto = false;
    if (skill === 'auto') { if (now - st.turnAt < TURN_MS) return false; now = Math.max(now, u.cd.normal); skill = choose(u, now); auto = true; }
    if (!SKILLS[skill] || !ready(u, skill, now)) return false;
    st.events = []; tPerform(st, u, skill, now, rng, auto); tRunAi(st, now, rng); return true;
  }
  /* Anyone in the room may call this: an idle player attacks automatically after 5 s. */
  function teamTick(st, now, rng = Math.random) { const u = st.status === 'battle' && tActor(st); return !!(u && u.human) && teamAct(st, u.uid, 'auto', now, rng); }
  function teamAutoplay(st, now, rng = Math.random) { let t = Math.max(now, st.turnAt + TURN_MS), g = 0; while (st.status === 'battle' && g++ < 5000) { teamTick(st, t, rng); t += TURN_MS; } return st; }
  function teamView(st) { const u = st.status === 'battle' ? tActor(st) : null; return { v: st.v, team: true, units: st.units.map(({ stats, ...x }) => x), round: st.round, status: st.status, actor: u ? u.idx : null, actorUid: u && u.human ? u.uid : null, turnAt: st.turnAt, events: st.events, result: st.result || null }; }

  const api = { SKILLS, PASSIVES, ORDER, TURN_MS, passiveOf, ready, choose, create, act, autoplay, view, arenaUnit, teamCreate, teamAct, teamTick, teamAutoplay, teamView };
  root.ValorDuelCore = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
