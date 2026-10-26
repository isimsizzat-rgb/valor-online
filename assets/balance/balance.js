/* Balance v1 (2026-10-26): Dungeon and Stage difficulty calibrated against reference characters
   (see VALOR_REFS in tools). A "typical active player" reaches about Sv.25 on day 10, Sv.50 on day 30,
   Sv.75 on day 60 and Sv.100 on day 90. Enemy power is close to the player's combat power at a
   ~50% win chance; 20% weaker always loses, 20% stronger always wins. */

/* Shared enemy stat generator (same proportions the Dungeon already used). */
function valorBalanceEnemyStats(power,magic){
 const P=Math.max(1,Number(power)||1),stats={};
 stats[magic?'Sihir':'Saldırı']=Math.max(1,Math.round(P*.28/10));
 stats[magic?'Saldırı':'Sihir']=Math.max(1,Math.round(P*.06/3));
 stats.Savunma=stats['Sihir Savunma']=Math.max(0,Math.round(P*.12/10));
 stats.Can=Math.max(1,Math.round(P*.34/3));
 stats.Kritik=stats.Bloke=Math.min(2000,Math.max(0,Math.round(P*.04/4)));
 return stats;
}
function valorBalanceInterp(anchors,x){
 if(x<=anchors[0][0])return anchors[0][1];
 for(let i=1;i<anchors.length;i++){const [x0,y0]=anchors[i-1],[x1,y1]=anchors[i];if(x<=x1)return Math.exp(Math.log(y0)+(Math.log(y1)-Math.log(y0))*(x-x0)/(x1-x0))}
 return anchors[anchors.length-1][1];
}

/* ---------- Dungeon ---------- */
/* Target: R0 (new) floor 3, R1 (day 10) floor 15, R2 (day 30) 33, R3 (day 60) 52, R4 (day 90) 70, peak build 100. */
const VALOR_DUNGEON_ANCHORS=[[1,6700],[3,9600],[15,86000],[33,201000],[52,361000],[70,1210000],[100,8200000]];
/* Every 5th floor is a boss (+12%), every 10th a great boss (+25%): gates the player must grow into. */
function valorDungeonFloorMult(floor){return floor%10===0?1.25:floor%5===0?1.12:1}
function valorDungeonBasePower(floor){
 // Anchors are the final targets, so remove the boss multiplier at anchor floors before interpolating.
 const base=VALOR_DUNGEON_ANCHORS.map(([f,p])=>[f,p/valorDungeonFloorMult(f)]);
 return valorBalanceInterp(base,floor);
}
/* Late content (Sv.50+): floors past the Sv.50 player's reach are 25% stronger, ramping in over floors 34-40. */
function valorDungeonLateMult(floor){return floor<=33?1:floor>=40?1.25:1+.25*(floor-33)/7}
vsEnemy=function(floor){const f=Math.max(1,Math.min(100,Math.floor(Number(floor)||1)));return Math.round(valorDungeonBasePower(f)*valorDungeonFloorMult(f)*valorDungeonLateMult(f))};

/* ---------- Stages ---------- */
/* Per area [Kolay, Zor, Kabus] base power of the first foe. Foes ramp +5% each, the boss is +25%.
   Kolay: the area's entry character clears it reliably. Kabus: the character at the end of the area
   clears it about half the time. Zor sits between them. */
const VALOR_STAGE_POWER=[[3000,11600,35800],[35000,54600,85000],[83000,112000,152000],[146000,278000,530000]];
const VALOR_STAGE_DIFFS=['Kolay','Zor','Kabus'];
/* Late areas (Buzul Dağları 51-75, Cehennem Ovaları 76-100) are 25% stronger. */
const VALOR_STAGE_LATE_MULT=[1,1,1.25,1.25];
function valorStageFoePower(area,diff,idx,boss){
 const row=VALOR_STAGE_POWER[Math.max(0,Math.min(3,area))],base=row[Math.max(0,VALOR_STAGE_DIFFS.indexOf(diff))];
 return Math.round(base*VALOR_STAGE_LATE_MULT[Math.max(0,Math.min(3,area))]*(1+.05*idx)*(boss?1.25:1));
}
function valorStageMagic(area,idx){return (area+idx)%3===1}
stageNewEnemy=function(run){
 const idx=Math.floor(run.step/2),boss=run.step===13,magic=valorStageMagic(run.area,idx),power=valorStageFoePower(run.area,run.diff,idx,boss);
 const stats=valorBalanceEnemyStats(power,magic),cls=magic?'Büyücü':'Savaşçı',unit=valorArenaUnit({...stats},cls);
 run.enemy={name:boss?stageFoes[6]:stageFoes[Math.min(idx,5)],hp:unit.maxHp,max:unit.maxHp,attack:Math.round(unit.attack),stats,cls,power,burn:null};
};

/* One full duel with the real Arena hit rules (crits, blocks, Astrology, medallion, guardian buffs; no Arena fury). */
function valorStageDuel(me,foe,rng=Math.random){
 const tags={crit:0,block:0,ignite:0,shadow:0,dawn:0,heal:0,resist:0};let dealt=0,taken=0,rounds=0;
 const strike=(a,b)=>{
  const hit=valorArenaHit(a,b,rng),pb=a.stats.petBuff;
  if(pb?.id==='safakkanat'&&!hit.resisted&&b.hp<b.maxHp*.25){hit.damage=Math.max(1,Math.round(hit.damage*(1+pb.bonus)));if(a===me)tags.dawn++}
  const dmg=Math.min(b.hp,hit.damage);b.hp-=dmg;
  if(pb?.id==='kozpence'&&b.hp>0&&rng()<pb.chance){b.burn={rounds:3,damage:Math.max(1,Math.round(b.maxHp*pb.burn))};if(a===me)tags.ignite++}
  const healed=valorAstrologyHeal(b,b.stats.astrologyHealing,rng);
  if(a===me){if(hit.critical)tags.crit++}else{if(hit.blocked)tags.block++;if(hit.resisted)tags.resist++;if(healed)tags.heal++}
  return dmg;
 };
 const attack=(a,b)=>{let d=strike(a,b);const pb=a.stats.petBuff;if(pb?.id==='gecegaga'&&b.hp>0&&rng()<pb.chance){d+=strike(a,b);if(a===me)tags.shadow++}return d};
 const tick=u=>{if(!u.burn||u.hp<=0)return 0;const d=Math.min(u.hp,u.burn.damage);u.hp-=d;if(--u.burn.rounds<=0)u.burn=null;return d};
 while(me.hp>0&&foe.hp>0&&rounds<1000){
  rounds++;const meFirst=me.attack===foe.attack?rng()<.5:me.attack>foe.attack;
  if(meFirst){dealt+=attack(me,foe);if(foe.hp>0)taken+=attack(foe,me)}else{taken+=attack(foe,me);if(me.hp>0)dealt+=attack(me,foe)}
  if(me.hp>0&&foe.hp>0)dealt+=tick(foe);
 }
 return {win:foe.hp<=0&&me.hp>0,rounds,dealt,taken,tags};
}
function valorStageUnits(run,stats){
 const me=valorArenaUnit({...stats},state.class);me.hp=Math.min(run.hp,me.maxHp);me.maxHp=run.maxHp;
 const e=run.enemy,foe=valorArenaUnit({...e.stats},e.cls);foe.hp=e.hp;foe.maxHp=e.max;foe.burn=e.burn||null;
 return {me,foe};
}
stagePlayerMax=function(){return valorArenaUnit(valorArenaStats(),state.class).maxHp};
stageAttack=function(){
 const r=stageRun;if(!r||r.step%2!==1||r.step>13||!r.enemy||r.hp<=0||r.failed)return;
 if(!r.enemy.stats){const ratio=r.enemy.max?r.enemy.hp/r.enemy.max:1;stageNewEnemy(r);r.enemy.hp=Math.max(1,Math.round(r.enemy.max*ratio))}
 const {me,foe}=valorStageUnits(r,valorArenaStats()),res=valorStageDuel(me,foe);
 r.hp=Math.max(0,me.hp);r.enemy.hp=Math.max(0,foe.hp);r.enemy.burn=foe.burn;
 const t=res.tags,extras=[t.crit&&'Kritik ×'+t.crit,t.ignite&&'Tutuşturdu ×'+t.ignite,t.shadow&&'Gölge Darbesi ×'+t.shadow,t.dawn&&'Şafak İnfazı ×'+t.dawn,t.block&&'Bloke ×'+t.block,t.resist&&'Sonsuz Direnç ×'+t.resist,t.heal&&'Yaşam Işığı ×'+t.heal].filter(Boolean).join(' · ');
 const summary=res.rounds+' tur · Verdiğin hasar '+money(res.dealt)+' · Aldığın hasar '+money(res.taken)+(extras?' · '+extras:'');
 if(res.win){
  const name=r.enemy.name;r.message=name+' yenildi! '+summary;
  if(r.step===13){stageFinish();if(stageRun)stageRun.message=r.message;stageRunSave();render();return}
  r.step++;r.enemy=null;
 }else{r.message='Yenildin! '+r.enemy.name+' karşısında düştün. '+summary;r.failed=true}
 stageRunSave();render();
};
/* Simulate a full stage run (7 foes, health carries over) for balance checks. */
function valorStageSimulateRun(area,diff,stats,cls=state.class,rng=Math.random){
 const run={area,diff,step:1,hp:0,maxHp:0,enemy:null};const u=valorArenaUnit({...stats},cls);run.hp=run.maxHp=u.maxHp;
 for(let step=1;step<=13;step+=2){run.step=step;stageNewEnemy(run);const {me,foe}=valorStageUnits(run,stats),res=valorStageDuel(me,foe,rng);run.hp=me.hp;if(!res.win)return false}
 return true;
}
/* Saved runs created with the old foe formula get real stats once. */
if(stageRun?.enemy&&!stageRun.enemy.stats&&stageRun.step%2===1){const ratio=stageRun.enemy.max?stageRun.enemy.hp/stageRun.enemy.max:1;stageNewEnemy(stageRun);stageRun.enemy.hp=Math.max(1,Math.round(stageRun.enemy.max*ratio));stageRunSave()}
if(state.class&&['Zindan','Sahne Macerası','Sahneler'].includes(page))render();

/* ---------- Refah (catch-up EXP) ----------
   Players behind the ranking's top level earn +5% EXP per level of gap (max +100%).
   The bonus switches off within 2 levels of the top, so it helps close the gap but never catches up.
   Reference level comes from the ranking; with a server, valorRankRows() will hold real players. */
const VALOR_WELFARE_STEP=.05,VALOR_WELFARE_MAX=1,VALOR_WELFARE_FREE_GAP=2;
function valorWelfareReferenceLevel(){try{return Math.max(...valorRankRows().map(r=>Number(r.level)||1))}catch(e){return Number(state.level)||1}}
function valorWelfareBonus(){if(!state?.class)return 0;const gap=valorWelfareReferenceLevel()-(Number(state.level)||1);return gap>VALOR_WELFARE_FREE_GAP?Math.min(VALOR_WELFARE_MAX,gap*VALOR_WELFARE_STEP):0}
function valorWelfareXp(base){return Math.round((Number(base)||0)*(1+valorWelfareBonus()))}
const valorWelfarePreviousEarnXP=earnXP;
earnXP=function(amount){const gained=valorWelfareXp(amount);window.valorLastXpGain=gained;return valorWelfarePreviousEarnXP(gained)};
function valorWelfareBadge(){
 const anchor=document.getElementById('valor-xp-current');if(!anchor)return;
 let badge=document.getElementById('valor-welfare-badge');const bonus=valorWelfareBonus();
 if(!bonus){badge?.remove();return}
 if(!badge){badge=document.createElement('span');badge.id='valor-welfare-badge';badge.style.cssText='margin-left:8px;padding:1px 7px;border:1px solid #7fc99a;border-radius:999px;color:#bff0cf;background:#173326cc;font-size:10px;white-space:nowrap';anchor.parentElement.appendChild(badge)}
 badge.textContent='Refah +%'+Math.round(bonus*100)+' EXP';badge.title='Sıralamanın 1.si Sv.'+valorWelfareReferenceLevel()+'. Aradaki her seviye için +%5 EXP (en fazla +%100). 2 seviye yakına gelince bonus kapanır.';
}
const valorWelfarePreviousRender=render;
render=function(){const result=valorWelfarePreviousRender.apply(this,arguments);try{valorWelfareBadge()}catch(e){}return result};
render();
