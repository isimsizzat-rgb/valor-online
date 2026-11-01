/* Turn-based Team Arena (1v1 up to 3v3). Everyone in the room plays their own fighter: on your turn pick one
   of the four skills (5 s, then automatic); rivals are played by the AI and every attack goes to the enemy
   with the lowest health. Passives affect only the one who uses them. Signed-in rooms fight on the server
   (arena-fight tduel_*): the leader starts, every member's screen opens and follows the same fight; the result
   is stored once for the whole room. Guests play the same rules locally (teammates are AI). */
(function(){
 'use strict';
 const D=window.ValorDuelCore,H=window.valorDuel;if(!D||!D.teamCreate||!H)return;
 const td={st:null,meta:null,kind:null,local:null,busy:false,skew:0,all:[],shown:0,stable:null,timer:null,lastPoll:0,applied:new Set(),closedAt:0,animating:false,animToken:0,view:null,revealed:0,chain:Promise.resolve(),lastBatch:''};
 /* Skills stay locked while skill animations play (at most until 2 s of the turn are left), so taps cannot pile up. */
 /* HP bars, shields and the log follow the animations move by move (view = what the screen shows so far). */
 const snap=u=>({hp:u.hp,shield:u.shield||0,shieldTurns:u.shieldTurns||0,focus:u.focus||0,focusTurns:u.focusTurns||0});
 const fresh=u=>({hp:u.maxHp,shield:0,shieldTurns:0,focus:0,focusTurns:0});
 const shownUnit=u=>td.view&&td.view.units[u.idx]?{...u,...td.view.units[u.idx]}:u;
 const animated=(el,e,u)=>!!(window.ValorCombatMotion&&el?.querySelector('.valor-combat-motion')&&['normal','strong','max','passive'].includes(e.skill)&&['Savaşçı','Büyücü'].includes(u?.cls));
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 function reveal(e){const v=td.view;if(v){if(Array.isArray(e.hp))e.hp.forEach(([hp,sh],i)=>{const x=v.units[i];if(!x)return;x.hp=hp;x.shield=sh||0;if(!x.shield)x.shieldTurns=0});
   const a=v.units[e.ai],u=td.st.units[e.ai];if(a&&u){if(e.passive==='shield')a.shieldTurns=D.passiveOf(u).turns||3;if(e.passive==='focus'){a.focus=e.focus;a.focusTurns=D.passiveOf(u).turns||3}if(e.focused&&a.focusTurns>0&&--a.focusTurns<=0)a.focus=0}v.round=e.round}
  td.revealed++;if(td.revealed>=td.all.length)td.view=null;paint();floatOne(e)}
 const locked=t=>td.animating&&D.TURN_MS-(t-(td.st?.turnAt||t))>2000;
 const now=()=>Date.now()+(td.kind==='online'?td.skew:0);
 const secs=ms=>Math.max(0,Math.ceil(ms/1000));
 const esc=s=>escapeAttr(String(s??''));
 const myUid=()=>td.kind==='online'?valorAccountActive?.id:'me';
 const mine=()=>td.st&&td.st.units.find(u=>u.uid===myUid()&&u.side==='A');
 function portrait(u){if(u.portrait)return u.portrait;if(u.uid===myUid())return valorBattlePortraitMine();return typeof valorArenaPortrait==='function'?valorArenaPortrait(u.cls,u.gender):heroImages[Math.max(0,classes.indexOf(u.cls))]}

 function mini(u,actor){const hp=Math.max(0,Math.min(100,u.hp/u.maxHp*100));return '<div class="vtd-unit '+(u.hp<=0?'down ':'')+(u.idx===actor?'active ':'')+(u.uid===myUid()&&u.side==='A'?'me':'')+'" data-idx="'+u.idx+'"><b>'+esc(u.name)+'</b><div class="vdu-hp"><i style="width:'+hp+'%"></i>'+(u.shield>0?'<b style="width:'+Math.min(100,u.shield/u.maxHp*100)+'%"></b>':'')+'</div><small>'+(u.hp<=0?'Düştü':money(Math.max(0,u.hp)))+(u.shield>0?' 🛡'+(u.shieldTurns||''):'')+(u.focusTurns>0?' 🎯'+u.focusTurns:'')+'</small></div>'}
 function chip(e){const U=td.st.units,a=U[e.ai],b=U[e.bi];if(e.skill==='burn')return '<span class="burn">🔥 '+esc(b?.name)+' '+money(e.damage)+'</span>';
  const cls=a?.side==='A'?'mine':'theirs';if(e.skill==='passive')return '<span class="pas">'+esc(a?.name)+' · '+esc(D.passiveOf(a).name)+'</span>';
  return '<span class="'+cls+'">'+esc(a?.name)+' → '+esc(b?.name)+' · '+esc(H.skillName(e.skill,a))+' <b>'+money(e.damage||0)+'</b>'+(e.hit?.critical?' Kritik':'')+(e.ko?' ☠':'')+(e.auto&&a?.side==='A'?' ⏱':'')+'</span>'}
 function skillButton(k,u,myTurn,t){const cd=secs((u.cd[k]||0)-t),ok=myTurn&&!cd&&!td.busy;return '<button type="button" class="vdu-skill vdu-'+k+'" '+(ok?'':'disabled ')+'onclick="valorTeamDuel.use(\''+k+'\')" title="'+esc(H.skillText(k,u))+'"><img src="'+H.skillIcon(k,u)+'" alt="" onerror="'+H.fallbackIcon+'"><span class="vdu-sname">'+esc(H.skillName(k,u))+'</span><span class="vdu-cd" data-live="cd-'+k+'">'+(cd?cd+' sn':'')+'</span></button>'}
 function markup(){const st=td.st,t=now(),me=mine(),actor=st.units[st.actor],myTurn=st.status==='battle'&&actor&&me&&actor.idx===me.idx&&!locked(t),left=secs(D.TURN_MS-(t-(st.turnAt||t)));
  const side=s=>st.units.filter(u=>u.side===s).map(u=>mini(shownUnit(u),st.actor)).join('');
  const log=td.all.slice(0,td.revealed).slice(-12).reverse().map(chip).join('')||'<span>Sıran gelince bir beceri seç · 5 sn içinde seçmezsen otomatik seçilir</span>';
  const who=st.status!=='battle'?'Savaş bitti':myTurn?'Sıra sende!':me&&actor?.idx===me.idx?'':actor?.side==='A'?'Sıra: '+esc(actor.name):'Rakip saldırıyor…';
  return '<section class="vdu-dialog vtd-dialog" role="dialog" aria-modal="true" aria-labelledby="vtd-title"><small class="vdu-eyebrow">TAKIM ARENASI · TUR '+(td.view?.round||st.round)+'</small><h2 id="vtd-title">Rakip Takım</h2>'
   +'<div class="vtd-side foes">'+side('B')+'</div>'
   +'<div class="vdu-turn '+(myTurn?'mine':'')+'" role="status"><b>'+who+'</b><span data-live="turn">'+(st.status==='battle'&&actor?.side==='A'?left+' sn':'')+'</span></div>'
   +'<div class="vdu-ticker" aria-live="polite">'+log+'</div>'
   +'<h3 class="vtd-label">Takımın</h3><div class="vtd-side allies">'+side('A')+'</div>'
   +(me&&me.hp>0?'<div class="vdu-skills">'+D.ORDER.map(k=>skillButton(k,me,myTurn,t)).join('')+'</div><small class="vdu-hint">'+(myTurn?'Pasif: '+esc(D.passiveOf(me).text)+' · sadece sana':'Sıran gelince becerilerin açılır')+'</small>':'<small class="vdu-hint">'+(me?'Düştün · takımın savaşmaya devam ediyor':'')+'</small>')+'</section>'}
 function paint(){const el=document.getElementById('valor-tduel');if(!el||!td.st)return;floatNew();const html=markup(),stable=html.replace(/(data-live="[^"]+">)[^<]*</g,'$1<');
  if(stable===td.stable){for(const m of html.matchAll(/data-live="([^"]+)">([^<]*)</g)){const n=el.querySelector('[data-live="'+m[1]+'"]');if(n&&n.textContent!==m[2])n.textContent=m[2]}return}
  td.stable=stable;el.innerHTML=html;if(window.ValorCombatMotion&&td.st.units.some(u=>u.cls==='Savaşçı'||u.cls==='Büyücü')){const a=td.st.units.find(u=>u.side==='A'&&u.hp>0)||td.st.units.find(u=>u.side==='A'),b=td.st.units.find(u=>u.side==='B'&&u.hp>0)||td.st.units.find(u=>u.side==='B');ValorCombatMotion.mount(el,[motionUnit(a),motionUnit(b)]);}}
 function motionUnit(u){const gender=u.uid===myUid()&&u.side==='A'?state.gender:u.gender;return {...u,gender,art:typeof valorCreationCutout==='function'?valorCreationCutout(u.cls,gender):null}}
 function floatNew(){const list=td.all.slice(td.shown);td.shown=td.all.length;if(!list.length)return;const token=td.animToken;td.animating=true;
  for(const e of list)td.chain=td.chain.catch(()=>{}).then(async()=>{if(token!==td.animToken)return;const root=document.getElementById('valor-tduel'),a=td.st.units[e.ai],b=e.skill==='passive'?(td.st.units.find(u=>u.side!==a?.side&&u.hp>0)||td.st.units.find(u=>u.side!==a?.side)):td.st.units[e.bi];
   if(a&&b&&animated(root,e,a))await ValorCombatMotion.play(root,{...e,side:a.side==='A'?'me':'foe'},motionUnit(a),motionUnit(b)).catch(()=>{});else await wait(e.skill==='burn'?300:500);
   if(token===td.animToken&&document.getElementById('valor-tduel'))reveal(e)});
  const end=td.chain=td.chain.catch(()=>{}).then(()=>{if(token!==td.animToken||end!==td.chain)return;td.animating=false;td.view=null;td.revealed=td.all.length;paint()})}
 function floatOne(e){{
  const idx=e.skill==='passive'?e.ai:e.bi,host=document.querySelector('#valor-tduel .vtd-unit[data-idx="'+idx+'"]');if(!host)return;
  const f=document.createElement('span');f.className='vdu-float '+(e.skill==='passive'?'pas':e.hit?.critical?'crit':'');f.textContent=e.skill==='passive'?(e.shield?'🛡':e.healed?'+'+money(e.healed):'🎯'):'-'+money(e.damage||0);host.appendChild(f);
  if(e.skill!=='passive'){host.classList.remove('hit');void host.offsetWidth;host.classList.add('hit')}setTimeout(()=>f.remove(),1300)}}

 function open(){td.finishing=false;if(document.getElementById('valor-tduel'))return;const el=document.createElement('div');el.id='valor-tduel';el.className='vdu-overlay';document.body.appendChild(el);document.documentElement.style.overflow='hidden';td.stable=null;paint();clearInterval(td.timer);td.timer=setInterval(tick,250)}
 function close(){td.animToken++;td.animating=false;td.view=null;td.revealed=0;window.ValorCombatMotion?.close(document.getElementById('valor-tduel'));clearInterval(td.timer);td.timer=null;document.getElementById('valor-tduel')?.remove();document.documentElement.style.overflow='';td.closedAt=Date.now()}
 function adopt(view,isNew=true){const prev=td.st;if(view.meta)td.meta=view.meta;
  // The state poll repeats the last move's events until something changes; add each batch only once.
  const batch=Array.isArray(view.events)&&view.events.length?JSON.stringify(view.events):'';
  if(isNew&&batch&&(batch!==td.lastBatch||!td.all.length)){td.lastBatch=batch;
   if(!td.all.length){td.revealed=0;td.view={units:view.units.map(fresh),round:1}}else if(!td.view&&prev)td.view={units:prev.units.map(snap),round:prev.round};td.all=td.all.concat(view.events)}
  td.st=view}
 async function server(body){const r=await valorFightCall(body);if(r&&Number.isFinite(r.now))td.skew=r.now-Date.now();return r}

 /* The same result object the classic team arena used, so rewards, rating and the result dialog are unchanged. */
 function prepFrom(st){const meta=td.meta||{},r=st.result,uid=myUid();const units=r.units.map(u=>({...u,me:u.uid===uid&&u.side==='A',portrait:portrait(u)}));
  const size=units.filter(u=>u.side==='A').length,rivalSize=units.length-size;
  return {duel:true,duelId:meta.id||'local-'+st.round+'-'+Date.now(),size,rivalSize,label:size+'v'+rivalSize,start:units.map(u=>({uid:u.uid,name:u.name,cls:u.cls,side:u.side,me:u.me,maxHp:u.maxHp,portrait:u.portrait,level:u.level})),battle:{...r,units}}}
 function finish(){if(td.finishing)return;td.finishing=true;const st=td.st,kind=td.kind,prep=prepFrom(st);const root=document.getElementById('valor-tduel');td.chain.catch(()=>{}).then(()=>setTimeout(()=>{if(!root?.isConnected)return;close();td.st=null;
  if(kind==='local'){valorTeamResolve(prep);return}
  if(td.applied.has(prep.duelId))return;td.applied.add(prep.duelId);valorTeamData().duelApplied=prep.duelId;valorTeamApplyResult(prep)},500))}

 async function use(skill){const st=td.st,me=mine();if(!st||!me||td.busy||st.status!=='battle'||st.actor!==me.idx||locked(now()))return;
  if(td.kind==='online'){td.busy=true;paint();let r;try{r=await server({mode:'tduel_act',skill})}finally{td.busy=false}
   if(r?.tduel){adopt(r.tduel,!r.error);paint();if(td.st.status==='done')finish()}else if(r&&r.tduel===null){close();td.st=null}return}
  if(!D.teamAct(td.local,'me',skill,Date.now()))return;adopt(D.teamView(td.local));paint();if(td.st.status==='done')finish()}
 async function poll(){if(td.busy)return;td.busy=true;let r;try{r=await server({mode:'tduel_state'})}catch{r=null}finally{td.busy=false}
  if(!document.getElementById('valor-tduel'))return;
  if(r?.tduel){adopt(r.tduel,!r.error);paint();if(td.st.status==='done')finish()}else if(r&&r.tduel===null){close();td.st=null;if(typeof valorTeamPoll==='function')valorTeamPoll(true)}}
 function tick(){if(document.hidden||!td.st)return;const st=td.st;
  if(td.kind==='local'){if(st.status==='battle'&&st.actorUid==='me'&&Date.now()-(st.turnAt||0)>=D.TURN_MS){if(D.teamTick(td.local,Date.now())){adopt(D.teamView(td.local));if(td.st.status==='done')finish()}}paint();return}
  if(Date.now()-td.lastPoll>=1000){td.lastPoll=Date.now();poll()}paint()}

 /* Members: when the room's fight starts, open the screen (also after a refresh). */
 setInterval(()=>{if(document.hidden||!state.class||document.getElementById('valor-tduel')||typeof valorTeamIsOnline!=='function'||!valorTeamIsOnline())return;
  const room=valorTeamNet?.room;if(!room?.duel||Date.now()-td.closedAt<4000)return;
  if(ts.on)return;td.kind='online';td.all=[];td.shown=0;td.lastBatch='';td.meta=null;
  server({mode:'tduel_state'}).then(r=>{if(r?.tduel&&r.tduel.status==='battle'&&!document.getElementById('valor-tduel')){adopt(r.tduel);open()}}).catch(()=>{})},1500);

 /* Results of a turn-based fight are not replayed: everyone already watched it live. */
 const prevCheck=valorTeamCheckResult;valorTeamCheckResult=function(room,prevId){
  if(room?.result?.duel){const d=valorTeamData(),key=room.id+':'+room.result_id,id=room.result.duelId;
   if(d.seenResult===key)return;const first=!d.seenResult||d.seenResult.split(':')[0]!==room.id;d.seenResult=key;
   if(first||td.applied.has(id)||d.duelApplied===id)return;
   const prep=valorTeamFillPrep(JSON.parse(JSON.stringify(room.result)));if(!prep.start.some(u=>u.me))return;
   td.applied.add(id);d.duelApplied=id;if(document.getElementById('valor-tduel')){close();td.st=null}valorTeamApplyResult(prep);return}
  return prevCheck.apply(this,arguments)};

 /* Matchmaking (online): the leader waits up to 60 s for another real team that is searching at the same time.
    Matched teams fight each other live; nobody else searching = "Takım bulunamadı". */
 const SEARCH_MS=60000,ts={on:false,timer:null,started:0,token:0};
 function searchBox(title,sub,done){let el=document.getElementById('valor-tsearch');
  if(!el){el=document.createElement('div');el.id='valor-tsearch';el.className='vdu-overlay';document.body.appendChild(el);document.documentElement.style.overflow='hidden'}
  el.innerHTML='<section class="vdu-dialog vts-dialog'+(done?' vts-done':'')+'" role="dialog" aria-modal="true" aria-labelledby="vts-title"><small class="vdu-eyebrow">TAKIM ARENASI</small><h2 id="vts-title">'+title+'</h2>'
   +(done?'':'<div class="vts-ring" role="timer"><i></i><b data-live="vts">'+Math.ceil(SEARCH_MS/1000)+'</b><small>saniye</small></div>')
   +'<p class="vts-sub">'+sub+'</p>'
   +(done?'<button type="button" class="vt-primary" onclick="valorTeamSearchClose()">Tamam</button>':'<button type="button" class="vt-mini" onclick="valorTeamSearchCancel()">Aramayı İptal Et</button>')+'</section>'}
 function searchClose(){document.getElementById('valor-tsearch')?.remove();if(!document.getElementById('valor-tduel'))document.documentElement.style.overflow=''}
 function searchStop(notFound){clearInterval(ts.timer);ts.timer=null;ts.on=false;ts.token++;
  if(notFound){searchBox('Takım bulunamadı','Şu an savaş arayan başka bir takım yok. Biraz sonra tekrar dene.',true);valorTeamNotice='Takım bulunamadı.';render()}else searchClose()}
 async function search(){ts.on=true;ts.started=Date.now();const token=++ts.token;
  searchBox('Rakip takım aranıyor…','Aynı anda savaş arayan gerçek bir takım bulununca eşleşip savaşacaksınız.');
  ts.timer=setInterval(()=>{const n=document.querySelector('#valor-tsearch [data-live="vts"]');if(n)n.textContent=Math.max(0,Math.ceil((SEARCH_MS-(Date.now()-ts.started))/1000))},250);
  let pending=false;
  while(ts.on&&token===ts.token){let r;try{r=await server({mode:'tduel_search'})}catch{r=null}
   if(!ts.on||token!==ts.token)return;
   if(r?.tduel){searchStop(false);if(document.getElementById('valor-tduel'))return;td.kind='online';td.all=[];td.shown=0;td.lastBatch='';td.meta=null;adopt(r.tduel);open();if(td.st.status==='done')finish();return}
   if(r?.error&&!r.search){searchStop(false);valorTeamNotice=valorFightError(r.error);render();return}
   pending=r?.search==='pending';
   if(r?.search==='timeout'||(!pending&&Date.now()-ts.started>=SEARCH_MS)){if(r?.search!=='timeout')server({mode:'tduel_cancel'}).catch(()=>{});searchStop(true);return}
   await new Promise(res=>setTimeout(res,pending?800:2000))}}
 window.valorTeamSearchCancel=function(){if(!ts.on)return searchClose();searchStop(false);server({mode:'tduel_cancel'}).catch(()=>{});valorTeamNotice='Arama iptal edildi.';render()};
 window.valorTeamSearchClose=searchClose;

 /* Leader starts (online); guests fight locally with AI teammates. */
 const prevFight=valorTeamFight;
 valorTeamFight=async function(){
  if(page!=='Savaş'||!state.class||valorArenaPendingBattle||document.getElementById('valor-arena-result')||document.getElementById('valor-tduel'))return;
  if(!valorTeamOpen())return valorTeamClosedNotice();
  const d=valorTeamData(),room=d.room;if(!room)return;
  if(valorTeamIsOnline()){
   if(!room.own){valorTeamNotice='Savaşı oda lideri başlatır. Lider başlatınca savaş senin ekranında da açılır.';render();return}
   if(valorTeamRemaining()<1){valorTeamNotice='Bugünkü '+VALOR_TEAM_DAILY+' takım savaşı hakkını kullandın.';render();return}
   if(td.busy||ts.on)return;td.busy=true;
   try{if(typeof valorCloudFlush==='function')await valorCloudFlush().catch(()=>{})}finally{td.busy=false}
   search();return}
  if(valorTeamRemaining()<1){valorTeamNotice='Bugünkü '+VALOR_TEAM_DAILY+' takım savaşı hakkını kullandın.';render();return}
  const mineStats=valorArenaStats(),hud=document.getElementById('valor-hud-portrait')?.src;
  const A=[{uid:'me',name:state.name||'Sen',cls:state.class,level:state.level,gender:state.gender,stats:mineStats,human:true,portrait:hud},...room.members.map((m,i)=>({uid:'m'+i,name:m.name,cls:m.cls,level:m.level,gender:m.gender,stats:valorTeamBotStats(m.ratio,m.cls),portrait:valorTeamPortrait(m)}))];
  const rivalSize=Math.random()<VALOR_TEAM_RIVAL3_CHANCE?3:2,rivals=valorTeamPick(rivalSize,room.members.map(m=>m.id));
  const B=rivals.map((p,i)=>({uid:'r'+i,name:p.name,cls:p.cls,level:p.level,gender:p.gender,stats:p.combatStats?{...p.combatStats}:valorTeamBotStats(.3+Math.random()*2.7,p.cls),portrait:valorTeamPortrait(p)}));
  td.kind='local';td.all=[];td.shown=0;td.lastBatch='';td.meta=null;td.local=D.teamCreate(A,B,Date.now());adopt(D.teamView(td.local));open();if(td.st.status==='done')finish()};
 window.valorTeamDuel={use,state:()=>td,close};
})();



