/* Macera seferi: 10 steps per entry (10 energy, as before). Each step starts with a short story; then a
   foe to fight with the four arena skills (5 s, then automatic), or a mysterious chest. Step 10 is the
   zone's boss. Rewards are given the moment they are won, so a loss keeps what was earned so far.
   The journey is saved in state.adventureRun, so it continues after a refresh. Rules and numbers live in
   assets/adventure/expedition-core.js. */
(function(){
 'use strict';
 const D=window.ValorDuelCore,X=window.ValorExpedition;if(!D||!X)return;
 const ui={timer:null,stable:null,shown:0,all:[],chestTimer:null};
 const esc=s=>escapeAttr(String(s??''));
 const secs=ms=>Math.max(0,Math.ceil(ms/1000));
 const run=()=>state.adventureRun||null;
 const zoneOf=r=>valorAdventureZones[r.zone];
 const dv=()=>window.valorDuel||{};
 const icon=(k,u)=>dv().skillIcon?dv().skillIcon(k,u):(k==='passive'?D.passiveOf(u).icon:D.SKILLS[k].icon);
 const sname=(k,u)=>dv().skillName?dv().skillName(k,u):(k==='passive'?D.passiveOf(u).name:D.SKILLS[k].name);
 const stext=(k,u)=>dv().skillText?dv().skillText(k,u):'';
 const fallback=()=>dv().fallbackIcon||'';

 /* ---------- rewards ---------- */
 function giveStone(){const stack=(state.inventory||[]).find(it=>it.marketItemId==='mountStone');if(stack)stack.count=(Number(stack.count)||1)+1;else state.inventory.push({id:valorUniqueItemId(),slot:'Eşya',marketItemId:'mountStone',name:'Binek Taşı',count:1})}
 function give(r,prize){const got={};
  if(prize.gold){state.gold+=prize.gold;got.gold=prize.gold}
  if(prize.xp){earnXP(prize.xp);got.xp=window.valorLastXpGain||prize.xp}
  if(prize.stone){giveStone();got.stone=prize.stone}
  if(prize.luck){state.stones=state.stones||{};state.stones[1]=(Number(state.stones[1])||0)+prize.luck;if(typeof syncDirectStones==='function')syncDirectStones();got.luck=prize.luck}
  for(const k in got)r.earned[k]=(r.earned[k]||0)+got[k];
  return got}
 function prizeText(p,sep=' · '){return [p.gold&&'🪙 +'+money(p.gold)+' Altın',p.xp&&'✦ +'+p.xp+' EXP',p.stone&&'💎 +'+p.stone+' Binek Taşı',p.luck&&'🔷 +'+p.luck+' Şans Taşı',p.hearts&&'❤ +'+p.hearts+' Kalp'].filter(Boolean).join(sep)||'Ödül yok'}
 function logEnd(r,won){const z=zoneOf(r);state.logs=state.logs||[];state.logs.unshift((won?'🏆 Zafer':'💀 Yenilgi')+' — Macera · '+z.name+' ('+(won?10:r.i+1)+'/10): '+prizeText(r.earned,', ')+' · −10 Enerji');state.logs=state.logs.slice(0,30)}

 /* ---------- flow ---------- */
 function start(i){
  const zone=valorAdventureZones[i];
  state.adventureEnergy-=10;
  if(typeof valorQuestRecord==='function')valorQuestRecord('energy',10);
  const plan=X.plan(i);
  state.adventureRun={zone:i,steps:plan.steps,i:0,phase:'story',duel:null,earned:{},last:null,startedAt:Date.now()};
  save();render();open();
 }
 function next(){const r=run();if(!r)return;
  if(r.phase==='story'){const s=r.steps[r.i];
   if(s.kind==='chest'){r.last=give(r,X.chest(r.zone));if(heartsOnline()){r.last.heartReq=crypto.randomUUID();r.last.heartsPending=true;claimHearts(r)}r.phase='chest';ui.chestAt=Date.now();save();paint(true);clearTimeout(ui.chestTimer);ui.chestTimer=setTimeout(()=>paint(true),1700);return}
   const foe=X.enemy(r.zone,s);r.duel=D.create({name:state.name||'Sen',cls:state.class,level:state.level,stats:valorArenaStats()},foe,Date.now());r.phase='fight';ui.all=[];ui.shown=0;collect(r);save();paint(true);if(r.duel.status==='done')fightOver(r);return}
  if(r.phase==='chest'||r.phase==='won'){r.i++;r.phase='story';r.duel=null;r.last=null;save();paint(true);return}
  if(r.phase==='lost'||r.phase==='done'){finish();}
 }
 /* 1-3 Kalp per chest, rolled and stored by the server (signed-in players only; 30 chests a day). */
 function heartsOnline(){return typeof valorHeartsOnline==='function'&&valorHeartsOnline()}
 async function claimHearts(r){const last=r.last;if(!last?.heartsPending||!last.heartReq)return;
  let res=null;try{res=await valorCloudFetch('/rest/v1/rpc/heart_adventure_chest',{method:'POST',body:JSON.stringify({request_id:last.heartReq})})}catch(e){res=null}
  if(run()!==r||r.last!==last)return;
  last.heartsPending=false;
  if(res&&Number(res.hearts)>0){last.hearts=Number(res.hearts);r.earned.hearts=(r.earned.hearts||0)+last.hearts}
  if(res&&res.limit)last.heartLimit=true;
  if(res&&Number.isFinite(Number(res.balance))&&typeof valorHearts!=='undefined'){valorHearts.balance=Number(res.balance);valorHearts.at=Date.now();if(typeof valorHeartMirror==='function')valorHeartMirror(valorHearts.balance)}
  save();paint(true)}
 function collect(r){const v=D.view(r.duel);if(Array.isArray(v.events))ui.all=ui.all.concat(v.events)}
 function use(skill){const r=run();if(!r||r.phase!=='fight'||!r.duel||r.duel.status!=='battle')return;
  if(!D.act(r.duel,skill,Date.now()))return;collect(r);
  if(r.duel.status==='done')return fightOver(r);
  save();paint()}
 function fightOver(r){const s=r.steps[r.i],won=!!r.duel.result?.win;
  setTimeout(()=>{if(run()!==r||r.phase!=='fight')return;
   if(won){r.last=give(r,X.fightReward(r.zone,s.boss));
    if(s.boss){r.phase='done';state.adventureZoneWins=state.adventureZoneWins||{};state.adventureZoneWins[r.zone]=(Number(state.adventureZoneWins[r.zone])||0)+1;logEnd(r,true)}
    else r.phase='won'}
   else{r.phase='lost';r.last=null;logEnd(r,false)}
   r.duel=null;save();paint(true)},1300)}
 function finish(){state.adventureRun=null;save();close();render()}

 /* ---------- screen ---------- */
 function trail(r){return '<div class="vex-trail" aria-label="Adım '+(r.i+1)+' / 10">'+r.steps.map((s,k)=>{const known=k<r.i||(k===r.i&&r.phase!=='story')||k===9;const mark=!known?'•':s.kind==='chest'?'🎁':s.boss?'👑':'⚔';return '<span class="'+(k<r.i?'done':k===r.i?'now':'')+'">'+mark+'</span>'}).join('')+'</div>'}
 function head(r){const z=zoneOf(r);return '<small class="vdu-eyebrow">MACERA · ADIM '+(r.i+1)+' / 10</small><h2 id="vex-title">'+z.icon+' '+esc(z.name)+'</h2>'+trail(r)}
 function hpBar(u){return '<div class="vdu-hp"><i style="width:'+Math.max(0,Math.min(100,u.hp/u.maxHp*100))+'%"></i>'+(u.shield>0?'<b style="width:'+Math.min(100,u.shield/u.maxHp*100)+'%"></b>':'')+'</div><small>'+money(Math.max(0,u.hp))+' / '+money(u.maxHp)+(u.shield>0?' · 🛡 '+money(u.shield)+(u.shieldTurns?' ('+u.shieldTurns+' tur)':''):'')+(u.focusTurns>0?' · 🎯 +%'+Math.round(u.focus*100)+' ('+u.focusTurns+' tur)':'')+'</small>'}
 function card(u,side,portrait,sub){return '<div class="vdu-card vdu-'+side+'"><div class="vdu-portrait"><img src="'+portrait+'" alt=""></div><div class="vdu-info"><b>'+esc(u.name)+'</b><span>'+sub+'</span>'+hpBar(u)+'</div></div>'}
 function chip(e,st){const who=e.side==='me'?'Sen':esc(st.foe.name);if(e.skill==='burn')return '<span class="burn">🔥 Yanık '+money(e.damage)+'</span>';
  if(e.skill==='passive')return '<span class="pas">'+who+' · '+esc(D.passiveOf(e.side==='me'?st.me:st.foe).name)+(e.shield?' 🛡'+money(e.shield):e.healed?' +'+money(e.healed):e.focus?' 🎯':'')+'</span>';
  return '<span class="'+(e.side==='me'?'mine':'theirs')+'">'+who+' · '+esc(sname(e.skill,e.side==='me'?st.me:st.foe))+' <b>'+money(e.damage||0)+'</b>'+(e.hit?.critical?' Kritik':'')+(e.hit?.blocked?' Bloke':'')+(e.hit?.absorbed?' 🛡'+money(e.hit.absorbed):'')+(e.auto&&e.side==='me'?' ⏱':'')+'</span>'}
 function skillBtn(k,u,mine,t){const cd=secs((u.cd[k]||0)-t),ok=mine&&!cd;return '<button type="button" class="vdu-skill vdu-'+k+'" '+(ok?'':'disabled ')+'onclick="valorExpedition.use(\''+k+'\')" title="'+esc(stext(k,u))+'"><img src="'+icon(k,u)+'" alt="" onerror="'+fallback()+'"><span class="vdu-sname">'+esc(sname(k,u))+'</span><span class="vdu-cd" data-live="cd-'+k+'">'+(cd?cd+' sn':'')+'</span></button>'}
 function fightView(r){const st=D.view(r.duel),t=Date.now(),s=r.steps[r.i],z=zoneOf(r),mine=st.status==='battle'&&st.turn==='me',left=secs(D.TURN_MS-(t-(st.turnAt||t)));
  const log=ui.all.slice(-10).reverse().map(e=>chip(e,st)).join('')||'<span>Sıran gelince bir beceri seç · 5 sn içinde seçmezsen otomatik seçilir</span>';
  return card(st.foe,'foe',z.image,(s.boss?'👑 Bölge Bossu':'Düşman')+' · Sv. '+st.foe.level)
   +'<div class="vdu-turn '+(mine?'mine':'')+'" role="status"><b>'+(st.status!=='battle'?(st.result?.win?'Kazandın!':'Yenildin…'):mine?'Sıra sende!':'Düşman saldırıyor…')+'</b><span data-live="turn">'+(mine?left+' sn':'Tur '+st.round)+'</span></div>'
   +'<div class="vdu-ticker" aria-live="polite">'+log+'</div>'
   +card(st.me,'me',valorBattlePortraitMine(),esc(st.me.cls)+' · Sv. '+st.me.level)
   +'<div class="vdu-skills">'+D.ORDER.map(k=>skillBtn(k,st.me,mine,t)).join('')+'</div>'
   +'<small class="vdu-hint">'+(mine?'Pasif: '+esc(D.passiveOf(st.me).text)+' · sıranı harcar':'')+'</small>'}
 function storyView(r){const s=r.steps[r.i],z=zoneOf(r);
  return '<div class="vex-scene"><img src="'+z.image+'" alt="" onerror="this.hidden=true"><span class="vex-scene-tag">'+(s.boss?'👑 Bölge Bossu':s.kind==='chest'?'❔ Gizem':'⚔ Karşılaşma')+'</span></div>'
   +'<p class="vex-story">'+esc(s.story)+'</p>'
   +'<button type="button" class="vex-go" onclick="valorExpedition.next()">'+(s.kind==='chest'?'🎁 Sandığı aç':s.boss?'👑 Bossa saldır':'⚔ Savaş')+'</button>'}
 function chestView(r){const opening=Date.now()-(ui.chestAt||0)<1600;
  return '<div class="vex-chest '+(opening?'opening':'open')+'"><span class="vex-chest-icon">'+(opening?'🎁':'✨')+'</span><b>'+(opening?'Gizemli sandık açılıyor…':'Sandıktan çıkan ödül')+'</b>'+(opening?'':'<strong>'+prizeText(r.last||{})+'</strong>'+(r.last?.heartsPending?'<small>❤ Kalpler geliyor…</small>':r.last?.heartLimit?'<small>Bugünkü sandık kalbi sınırına ulaştın (30 sandık)</small>':''))+'</div>'
   +(opening?'':'<button type="button" class="vex-go" onclick="valorExpedition.next()">Yola devam et ❯</button>')}
 function resultView(r){const s=r.steps[r.i];
  if(r.phase==='won')return '<div class="vex-result win"><span>🏆</span><b>'+esc(s.foe)+' yenildi!</b><strong>'+prizeText(r.last||{})+'</strong></div><button type="button" class="vex-go" onclick="valorExpedition.next()">Yola devam et ❯</button>';
  const won=r.phase==='done';
  return '<div class="vex-result '+(won?'win':'loss')+'"><span>'+(won?'👑':'💀')+'</span><b>'+(won?'Macera tamamlandı! '+esc(s.foe)+' yenildi.':'Yenildin… Macera '+(r.i+1)+'. adımda bitti.')+'</b>'+(won&&r.last?'<small>Boss ödülü: '+prizeText(r.last)+'</small>':'')+'<em>Toplam kazanç</em><strong>'+prizeText(r.earned)+'</strong></div><button type="button" class="vex-go" onclick="valorExpedition.next()">Tamam</button>'}
 function markup(){const r=run();if(!r)return '';
  const body=r.phase==='fight'&&r.duel?fightView(r):r.phase==='story'?storyView(r):r.phase==='chest'?chestView(r):resultView(r);
  const canLeave=r.phase!=='done'&&r.phase!=='lost';
  return '<section class="vdu-dialog vex-dialog" role="dialog" aria-modal="true" aria-labelledby="vex-title">'+(canLeave?'<button type="button" class="vex-close" onclick="valorExpedition.close()" aria-label="Kapat (macera kaldığı yerden devam eder)">✕</button>':'')+head(r)+body+'</section>'}
 function paint(force){const el=document.getElementById('valor-adv');if(!el)return;if(!run())return close();const html=markup();
  const stable=html.replace(/(data-live="[^"]+">)[^<]*</g,'$1<');
  if(!force&&stable===ui.stable){for(const m of html.matchAll(/data-live="([^"]+)">([^<]*)</g)){const n=el.querySelector('[data-live="'+m[1]+'"]');if(n&&n.textContent!==m[2])n.textContent=m[2]}return}
  ui.stable=stable;el.innerHTML=html;floatNew()}
 function floatNew(){const list=ui.all.slice(ui.shown);ui.shown=ui.all.length;list.forEach((e,i)=>setTimeout(()=>{
  const target=e.skill==='passive'?e.side:(e.side==='me'?'foe':'me'),host=document.querySelector('#valor-adv .vdu-'+target+' .vdu-portrait');if(!host)return;
  const f=document.createElement('span');f.className='vdu-float '+(e.skill==='passive'?'pas':e.hit?.critical?'crit':'');f.textContent=e.skill==='passive'?(e.shield?'🛡 '+money(e.shield):e.healed?'+'+money(e.healed):'🎯'):'-'+money(e.damage||0);host.appendChild(f);if(e.skill!=='passive'){host.classList.remove('hit');void host.offsetWidth;host.classList.add('hit')}setTimeout(()=>f.remove(),1300)},i*550))}
 function tick(){if(document.hidden)return;const r=run();if(!r)return close();
  if(r.phase==='fight'&&r.duel&&r.duel.status==='battle'){const v=D.view(r.duel);if(v.turn==='me'&&Date.now()-(v.turnAt||0)>=D.TURN_MS){use('auto');return}}
  paint()}
 function open(){const r=run();if(!r)return;
  if(r.phase==='chest'&&r.last?.heartsPending)claimHearts(r);
  if(r.phase==='fight'&&r.duel){if(r.duel.status==='battle')r.duel.turnAt=Date.now();else{r.phase='fight';fightOver(r)}ui.all=(r.duel.log||[]).slice();ui.shown=ui.all.length}
  document.getElementById('valor-adv')?.remove();const el=document.createElement('div');el.id='valor-adv';el.className='vdu-overlay vex-overlay';document.body.appendChild(el);document.documentElement.style.overflow='hidden';ui.stable=null;paint(true);clearInterval(ui.timer);ui.timer=setInterval(tick,250)}
 function close(){clearInterval(ui.timer);ui.timer=null;document.getElementById('valor-adv')?.remove();document.documentElement.style.overflow='';if(page==='Macera')render()}

 /* ---------- hooks into the Macera page ---------- */
 valorAdventureFight=function(i){
  if(page!=='Macera'||!state.class||!Number.isInteger(i))return;
  if(run())return open();
  const zone=valorAdventureZones[i];if(!zone)return;
  stageDailyReset();
  if(state.level<zone.min)return toast('Bu alan için en az '+zone.min+'. seviye gerekli.');
  if((Number(state.adventureEnergy)||0)<10)return toast('Macera için en az 10 enerji gerekli.');
  start(i)};
 const prevConfirm=valorAdventureConfirm;
 valorAdventureConfirm=function(i){if(run()){open();return}return prevConfirm.apply(this,arguments)};
 const prevPage=valorAdventurePage;
 valorAdventurePage=function(){let html=prevPage.apply(this,arguments);const r=run();
  if(r){const z=zoneOf(r);html=html.replace('<div class="adventure-zone-grid">','<button type="button" class="vex-resume" onclick="valorExpedition.open()"><span>🧭 Yarım kalan macera</span><b>'+z.icon+' '+esc(z.name)+' · Adım '+(r.i+1)+' / 10</b><em>Devam et ❯</em></button><div class="adventure-zone-grid">')}
  return html};
 battle=valorAdventurePage;
 window.valorExpedition={use,next,open,close,state:run};
 if(page==='Macera')render();
})();
