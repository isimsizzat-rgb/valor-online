// @ts-nocheck
// Valor Online · arena-fight (Supabase Edge Function)
// Solo and team arena fights are computed here, on the server, with the same rules as the game,
// so a player cannot change the result on their own device.
//   POST { mode: "solo", target: "<user id>" }  → { battle }
//   POST { mode: "team" }                        → { prep }   (caller must lead a team room)
//   POST { mode: "duel_start", target }           → { duel, foe }   turn-based duel (resumes a live one)
//   POST { mode: "duel_act", skill }              → { duel, foe }   skill = normal|strong|max|passive|auto
//   POST { mode: "duel_state" }                   → { duel, foe } or { duel: null }
//   POST { mode: "tduel_start" }                  → { tduel }   leader starts a turn-based team fight
//   POST { mode: "tduel_state" }                  → { tduel }   any member; also plays idle turns after 5 s
//   POST { mode: "tduel_act", skill }             → { tduel }   the member whose turn it is
import { createClient } from "jsr:@supabase/supabase-js@2";
import "./duel-core.js";   // same file as assets/arena/duel-core.js
const D = globalThis.ValorDuelCore;
const DUEL_STALE_MS = 10 * 60 * 1000;

// ENGINE START — mirrors the game's arena engine (index.html + astrology.js + medallions/stats.js + pets/pets.js + team.js)
const DAMAGE_MULTIPLIER = 1.5, FURY_START = 5, FURY_STEP = 0.10;
function arenaUnit(stats, cls) {
  const magic = cls === "Büyücü", attack = 10 + Math.max(0, Number(stats[magic ? "Sihir" : "Saldırı"]) || 0), hp = Math.max(1, Math.round(100 + (Number(stats.Can) || 0) * 10));
  return { stats, magic, attack, maxHp: hp, hp };
}
function baseDamage(a, b) { const defense = Math.max(0, Number(b.stats[a.magic ? "Sihir Savunma" : "Savunma"]) || 0); return Math.max(1, Math.round(a.attack * a.attack / (a.attack + defense))); }
function arenaDamage(a, b) {   // medallion armor pierce
  const pierce = Math.max(0, Math.min(100, Number(a?.stats?.medallionArmorPierce) || 0)) / 100;
  if (!pierce) return baseDamage(a, b);
  const key = a.magic ? "Sihir Savunma" : "Savunma";
  return baseDamage(a, { ...b, stats: { ...b.stats, [key]: (Number(b.stats[key]) || 0) * (1 - pierce) } });
}
function arenaChance(value) { const p = Math.max(0, Number(value) || 0); return Math.min(1, p <= 1000 ? p / 4000 : .25 + (p - 1000) * .75 / 4000); }
function baseHit(a, b, rng) {
  const critStat = Math.max(0, Number(a.stats.Kritik) || 0), blockStat = Math.max(0, Number(b.stats.Bloke) || 0);
  const critical = rng() < arenaChance(critStat), blocked = rng() < arenaChance(blockStat), base = arenaDamage(a, b);
  return { damage: Math.max(1, Math.round(base * (1 + (critical ? .25 : 0) - (blocked ? .25 : 0)))), critical, blocked };
}
function takenDamage(damage, reduction) { return Math.max(1, Math.round(Math.max(1, Number(damage) || 1) * (1 - Math.max(0, Math.min(.20, Number(reduction) || 0))))); }
function astrologyHit(a, b, rng) {
  const hit = baseHit(a, b, rng);
  if (hit.critical) hit.damage += Math.round(arenaDamage(a, b) * Math.max(0, Number(a.stats.astrologyCriticalDamage) || 0));
  hit.damageBeforeAstrology = hit.damage * DAMAGE_MULTIPLIER;
  hit.damage = takenDamage(hit.damage * DAMAGE_MULTIPLIER, b.stats.astrologyDamageReduction || 0);
  hit.resisted = !!b.stats.astrologyResistance && rng() < b.stats.astrologyResistance;
  if (hit.resisted) hit.damage = 1;
  return hit;
}
function arenaHit(a, b, rng) {   // guardian "Don Nefesi" shifts the crit / block rolls
  const critCut = b?.stats?.petBuff?.id === "ayazdis" ? b.stats.petBuff.reduce : 0, blockCut = a?.stats?.petBuff?.id === "ayazdis" ? a.stats.petBuff.reduce : 0;
  if (!critCut && !blockCut) return astrologyHit(a, b, rng);
  let n = 0; const roll = () => { const v = rng(); n++; return n === 1 ? v + critCut : n === 2 ? v + blockCut : v; };
  const hit = astrologyHit(a, b, roll); hit.frost = true; return hit;
}
function fury(round) { return Math.max(0, round - FURY_START) * FURY_STEP; }
function heal(unit, chance, rng) { if (unit.hp <= 0 || !chance || rng() >= chance) return 0; const healed = Math.min(unit.maxHp - unit.hp, Math.max(1, Math.round(unit.maxHp * .05))); unit.hp += healed; return healed; }

function simulateSolo(myStats, myClass, rivalStats, rivalClass, rng) {
  const me = arenaUnit({ ...myStats }, myClass), enemy = arenaUnit({ ...rivalStats }, rivalClass), log = [];
  const buff = (u) => u.stats.petBuff || null;
  for (let round = 1; me.hp > 0 && enemy.hp > 0 && round <= 10000; round++) {
    let mine = 0, theirs = 0, myHit = null, enemyHit = null;
    const f = fury(round);
    const strike = (a, b) => {
      const hit = arenaHit(a, b, rng), pb = buff(a);
      if (f > 0 && !hit.resisted) { hit.fury = f; hit.damage = Math.max(1, Math.round(hit.damage * (1 + f))); }
      if (pb?.id === "safakkanat" && !hit.resisted && b.hp < b.maxHp * .25) { hit.dawn = pb.bonus; hit.damage = Math.max(1, Math.round(hit.damage * (1 + pb.bonus))); }
      const damage = Math.min(b.hp, hit.damage); b.hp -= damage;
      if (pb?.id === "kozpence" && b.hp > 0 && rng() < pb.chance) { b.burn = { rounds: 3, damage: Math.max(1, Math.round(b.maxHp * pb.burn)) }; hit.ignite = true; }
      hit.healed = heal(b, b.stats.astrologyHealing, rng); return { hit, damage };
    };
    const attack = (a, b) => {
      const s = strike(a, b); let total = s.damage; const pb = buff(a);
      if (pb?.id === "gecegaga" && b.hp > 0 && rng() < pb.chance) { const extra = strike(a, b); total += extra.damage; s.hit.shadow = extra.damage; }
      return { hit: s.hit, damage: total };
    };
    const events = [];
    const strikeMine = () => { const s = attack(me, enemy); myHit = s.hit; mine = s.damage; events.push({ side: "me", damage: s.damage, hit: { ...s.hit }, myHp: me.hp, enemyHp: enemy.hp }); };
    const strikeEnemy = () => { const s = attack(enemy, me); enemyHit = s.hit; theirs = s.damage; events.push({ side: "enemy", damage: s.damage, hit: { ...s.hit }, myHp: me.hp, enemyHp: enemy.hp }); };
    const meFirst = me.attack === enemy.attack ? rng() < .5 : me.attack > enemy.attack;
    if (meFirst) { strikeMine(); if (enemy.hp > 0) strikeEnemy(); } else { strikeEnemy(); if (me.hp > 0) strikeMine(); }
    const tick = (u, hit) => { if (!u.burn || u.hp <= 0) return 0; const d = Math.min(u.hp, u.burn.damage); u.hp -= d; if (--u.burn.rounds <= 0) u.burn = null; if (hit) hit.burnTick = (hit.burnTick || 0) + d; return d; };
    if (me.hp > 0 && enemy.hp > 0) { mine += tick(enemy, myHit || (myHit = { damage: 0 })); theirs += tick(me, enemyHit || (enemyHit = { damage: 0 })); }
    log.push({ round, mine, theirs, myHit, enemyHit, myHp: me.hp, enemyHp: enemy.hp, events });
    if (me.hp === 0 || enemy.hp === 0) break;
  }
  const knockout = me.hp === 0 || enemy.hp === 0, draw = !knockout, win = enemy.hp === 0 && me.hp > 0;
  return { win, draw, rounds: log.length, myHp: me.hp, enemyHp: enemy.hp, myMaxHp: me.maxHp, enemyMaxHp: enemy.maxHp, reason: knockout ? "knockout" : "stalemate", log };
}

function teamUnit(name, cls, stats, side, me, level, uid, gender) { const u = arenaUnit({ ...stats }, cls); return { ...u, name, cls, side, me, dealt: 0, level, uid, gender }; }
function simulateTeam(teamA, teamB, rng) {
  const all = [...teamA, ...teamB], log = []; all.forEach((u, i) => u.idx = i);
  const alive = (side) => all.filter((u) => u.side === side && u.hp > 0);
  for (let round = 1; alive("A").length && alive("B").length && round <= 300; round++) {
    const f = fury(round), order = all.filter((u) => u.hp > 0).sort((a, b) => b.attack - a.attack || rng() - .5), acts = [];
    const strike = (a, b) => {
      const hit = arenaHit(a, b, rng), pb = a.stats.petBuff;
      if (f > 0 && !hit.resisted) hit.damage = Math.max(1, Math.round(hit.damage * (1 + f)));
      if (pb?.id === "safakkanat" && !hit.resisted && b.hp < b.maxHp * .25) hit.damage = Math.max(1, Math.round(hit.damage * (1 + pb.bonus)));
      const dmg = Math.min(b.hp, hit.damage); b.hp -= dmg; a.dealt += dmg;
      if (pb?.id === "kozpence" && b.hp > 0 && rng() < pb.chance) { b.burn = { rounds: 3, damage: Math.max(1, Math.round(b.maxHp * pb.burn)), from: a }; hit.ignite = true; }
      hit.healed = heal(b, b.stats.astrologyHealing, rng); return { hit, dmg };
    };
    for (const a of order) {
      if (a.hp <= 0) continue; const foes = alive(a.side === "A" ? "B" : "A"); if (!foes.length) break;
      const b = foes[Math.floor(rng() * foes.length)], s = strike(a, b); let dmg = s.dmg;
      if (a.stats.petBuff?.id === "gecegaga" && b.hp > 0 && rng() < a.stats.petBuff.chance) { const x = strike(a, b); dmg += x.dmg; s.hit.shadow = x.dmg; }
      acts.push({ a: a.name, b: b.name, ai: a.idx, bi: b.idx, dmg, hit: s.hit, ko: b.hp <= 0 });
    }
    for (const u of all) { if (!u.burn || u.hp <= 0) continue; const d = Math.min(u.hp, u.burn.damage); u.hp -= d; if (u.burn.from) u.burn.from.dealt += d; acts.push({ a: "Yanık", b: u.name, ai: -1, bi: u.idx, dmg: d, hit: null, ko: u.hp <= 0, burn: true }); if (--u.burn.rounds <= 0) u.burn = null; }
    log.push({ round, acts });
  }
  const aLeft = alive("A").length, bLeft = alive("B").length, win = aLeft > 0 && bLeft === 0, draw = aLeft > 0 && bLeft > 0;
  return { win, draw, rounds: log.length, log, units: all.map((u) => ({ name: u.name, cls: u.cls, side: u.side, me: u.me, hp: u.hp, maxHp: u.maxHp, dealt: u.dealt, level: u.level, uid: u.uid, gender: u.gender })) };
}
// ENGINE END

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const CLASSES = ["Savaşçı", "Büyücü", "Okçu"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth?.user) return json({ error: "auth" }, 401);
  const me = auth.user.id;
  let body = {}; try { body = await req.json(); } catch { /* empty */ }


  // ---- Turn-based duel: the attacker plays, the defender is the AI. State lives in arena_duels. ----
  const loadDuel = async () => { const { data } = await db.from("arena_duels").select("*").eq("attacker", me).maybeSingle(); return data; };
  const finishDuel = async (row) => {
    const r = row.state.result;
    const { data: stored, error: e } = await db.rpc("srv_arena_store", { attacker: me, target: row.target, won: !!r.win, was_draw: !!r.draw, fight_rounds: r.rounds | 0 });
    await db.from("arena_duels").delete().eq("attacker", me);
    return e ? e.message : stored;
  };
  const reply = (row, extra = {}) => json({ duel: D.view(row.state), foe: row.foe, now: Date.now(), ...extra });

  if (body.mode === "duel_state") {
    const row = await loadDuel();
    return row ? reply(row) : json({ duel: null, now: Date.now() });
  }

  if (body.mode === "duel_start") {
    let row = await loadDuel();
    if (row && Date.now() - Date.parse(row.updated_at) < DUEL_STALE_MS) return reply(row, { resumed: true });
    if (row) { D.autoplay(row.state, Date.now()); await finishDuel(row); }   // abandoned: play it out and record it
    const { data: ctx, error } = await db.rpc("srv_arena_context", { attacker: me, target: body.target });
    if (error) return json({ error: error.message }, 500);
    if (ctx?.status !== "ok") return json({ error: ctx?.status || "invalid" });
    const foe = { name: ctx.foe.name, class: ctx.foe.class, level: ctx.foe.level, gender: ctx.foe.gender };
    const state = D.create({ name: ctx.me.name, cls: ctx.me.class, level: ctx.me.level, stats: ctx.me.combat },
      { name: ctx.foe.name, cls: ctx.foe.class, level: ctx.foe.level, gender: ctx.foe.gender, stats: ctx.foe.combat }, Date.now(), Math.random);
    row = { attacker: me, target: body.target, foe, state, updated_at: new Date().toISOString() };
    const { error: e2 } = await db.from("arena_duels").insert(row);
    if (e2) return json({ error: e2.message }, 500);
    if (state.status === "done") { const s = await finishDuel(row); if (s !== "ok") return json({ error: s }); }
    return reply(row);
  }

  if (body.mode === "duel_act") {
    const row = await loadDuel();
    if (!row) return json({ error: "no_duel", duel: null });
    const before = row.updated_at;
    if (!D.act(row.state, String(body.skill || ""), Date.now(), Math.random)) return reply(row, { error: "not_ready" });
    if (row.state.status === "done") { const s = await finishDuel(row); return reply(row, s === "ok" ? {} : { error: s }); }
    const updated_at = new Date().toISOString();
    const { data: saved, error } = await db.from("arena_duels").update({ state: row.state, updated_at }).eq("attacker", me).eq("updated_at", before).select("attacker");
    if (error) return json({ error: error.message }, 500);
    if (!saved?.length) { const fresh = await loadDuel(); return fresh ? reply(fresh, { error: "stale" }) : json({ duel: null }); }
    return reply({ ...row, updated_at });
  }


  // ---- Turn-based team fight: room members play, rivals are the AI. State lives in team_duels. ----
  const myRoom = async () => { const { data } = await db.from("team_room_members").select("room_id").eq("user_id", me).maybeSingle(); return data?.room_id || null; };
  const loadTeam = async (room) => { const { data } = await db.from("team_duels").select("*").eq("room_id", room).maybeSingle(); return data; };
  const treply = (row, extra = {}) => json({ tduel: { ...D.teamView(row.state), meta: row.meta }, now: Date.now(), ...extra });
  const saveTeam = async (row, before) => {
    if (row.state.status === "done") {
      const r = row.state.result, size = row.meta.size, rivalSize = row.meta.rivalSize;
      const prep = { reporter: null, server: true, duel: true, duelId: row.meta.id, size, rivalSize, label: size + "v" + rivalSize, start: row.meta.start, battle: r };
      // Claim the finish first so two members ending the same turn cannot store it twice.
      const { data: claimed } = await db.from("team_duels").delete().eq("room_id", row.room_id).eq("updated_at", before).select("room_id");
      if (!claimed?.length) return "stale";
      const { data: stored, error } = await db.rpc("srv_team_store", { room: row.room_id, fight: prep, won: !!r.win, was_draw: !!r.draw });
      return error ? error.message : stored;
    }
    const updated_at = new Date().toISOString();
    const { data } = await db.from("team_duels").update({ state: row.state, updated_at }).eq("room_id", row.room_id).eq("updated_at", before).select("room_id");
    if (!data?.length) return "stale";
    row.updated_at = updated_at; return "ok";
  };

  if (body.mode === "tduel_start") {
    const { data: ctx, error } = await db.rpc("srv_team_context", { leader: me });
    if (error) return json({ error: error.message }, 500);
    if (ctx?.status !== "ok") return json({ error: ctx?.status || "invalid" });
    const live = await loadTeam(ctx.room);
    if (live) return treply(live, { resumed: true });
    const members = (ctx.members || []).filter((m) => m.combat && CLASSES.includes(m.class));
    const rivalSize = Math.random() < 0.7 ? 3 : 2;
    const { data: rivals, error: e2 } = await db.rpc("srv_team_rivals", { room: ctx.room, n: rivalSize });
    if (e2) return json({ error: e2.message }, 500);
    const foes = (rivals || []).filter((r) => r.combat && CLASSES.includes(r.class));
    if (!foes.length) return json({ error: "no_rivals" });
    const A = members.map((m) => ({ uid: m.user_id, name: m.name, cls: m.class, level: m.level, gender: m.gender, stats: m.combat, human: true }));
    const B = foes.map((r) => ({ uid: r.user_id, name: r.name, cls: r.class, level: r.level, gender: r.gender, stats: r.combat }));
    const state = D.teamCreate(A, B, Date.now(), Math.random);
    const start = state.units.map((u) => ({ uid: u.uid, name: u.name, cls: u.cls, side: u.side, me: false, maxHp: u.maxHp, level: u.level, gender: u.gender }));
    const row = { room_id: ctx.room, state, meta: { id: crypto.randomUUID(), size: A.length, rivalSize: B.length, start }, updated_at: new Date().toISOString() };
    const { error: e3 } = await db.from("team_duels").insert(row);
    if (e3) { const again = await loadTeam(ctx.room); return again ? treply(again, { resumed: true }) : json({ error: e3.message }, 500); }
    if (state.status === "done") { const s2 = await saveTeam(row, (await loadTeam(ctx.room))?.updated_at); if (s2 !== "ok") return json({ error: s2 }); }
    return treply(row);
  }

  if (body.mode === "tduel_state" || body.mode === "tduel_act") {
    const room = await myRoom();
    if (!room) return json({ tduel: null, error: body.mode === "tduel_act" ? "gone" : undefined, now: Date.now() });
    const row = await loadTeam(room);
    if (!row) return json({ tduel: null, now: Date.now() });
    const before = row.updated_at;
    const changed = body.mode === "tduel_act" ? D.teamAct(row.state, me, String(body.skill || ""), Date.now(), Math.random) : D.teamTick(row.state, Date.now(), Math.random);
    if (!changed) return treply(row, body.mode === "tduel_act" ? { error: "not_ready" } : {});
    const s3 = await saveTeam(row, before);
    if (s3 === "stale") { const fresh = await loadTeam(room); return fresh ? treply(fresh, { error: "stale" }) : json({ tduel: null, now: Date.now() }); }
    return treply(row, s3 === "ok" ? {} : { error: s3 });
  }

  if (body.mode === "solo") {
    const { data: ctx, error } = await db.rpc("srv_arena_context", { attacker: me, target: body.target });
    if (error) return json({ error: error.message }, 500);
    if (ctx?.status !== "ok") return json({ error: ctx?.status || "invalid" });
    const battle = simulateSolo(ctx.me.combat, ctx.me.class, ctx.foe.combat, ctx.foe.class, Math.random);
    const { data: stored, error: e2 } = await db.rpc("srv_arena_store", { attacker: me, target: body.target, won: battle.win, was_draw: battle.draw, fight_rounds: battle.rounds });
    if (e2) return json({ error: e2.message }, 500);
    if (stored !== "ok") return json({ error: stored });
    return json({ battle, foe: { name: ctx.foe.name, class: ctx.foe.class, level: ctx.foe.level, gender: ctx.foe.gender } });
  }

  if (body.mode === "team") {
    const { data: ctx, error } = await db.rpc("srv_team_context", { leader: me });
    if (error) return json({ error: error.message }, 500);
    if (ctx?.status !== "ok") return json({ error: ctx?.status || "invalid" });
    const members = (ctx.members || []).filter((m) => m.combat && CLASSES.includes(m.class));
    const rivalSize = Math.random() < 0.7 ? 3 : 2;
    const { data: rivals, error: e2 } = await db.rpc("srv_team_rivals", { room: ctx.room, n: rivalSize });
    if (e2) return json({ error: e2.message }, 500);
    const foes = (rivals || []).filter((r) => r.combat && CLASSES.includes(r.class));
    if (!foes.length) return json({ error: "no_rivals" });
    const teamA = members.map((m) => teamUnit(m.name, m.class, m.combat, "A", false, m.level, m.user_id, m.gender));
    const teamB = foes.map((r) => teamUnit(r.name, r.class, r.combat, "B", false, r.level, r.user_id, r.gender));
    const start = [...teamA, ...teamB].map((u) => ({ uid: u.uid, name: u.name, cls: u.cls, side: u.side, me: false, maxHp: u.maxHp, level: u.level, gender: u.gender }));
    const battle = simulateTeam(teamA, teamB, Math.random);
    if (battle.log.length > 150) battle.log = battle.log.slice(0, 150);
    const prep = { reporter: me, server: true, size: teamA.length, rivalSize: teamB.length, label: teamA.length + "v" + teamB.length, start, battle };
    const { data: stored, error: e3 } = await db.rpc("srv_team_store", { room: ctx.room, fight: prep, won: battle.win, was_draw: battle.draw });
    if (e3) return json({ error: e3.message }, 500);
    if (stored !== "ok") return json({ error: stored });
    return json({ prep });
  }
  return json({ error: "mode" }, 400);
});
