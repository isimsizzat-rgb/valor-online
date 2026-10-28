/* Turn-based arena duel screen (1v1 and Denk Rakip). The attacker picks one of four skills on their
   turn; the defender is played by the AI. Signed-in players fight on the server (arena-fight
   duel_start / duel_act), so the result cannot be changed on the device; guests and training play the
   same rules locally. 5 seconds without a choice = automatic pick. Team arena is unchanged. */
(function(){
 'use strict';
 const D=window.ValorDuelCore;if(!D)return;
 const duel={st:null,foe:null,rival:null,kind:null,busy:false,skew:0,all:[],shown:0,stable:null,timer:null,floats:[]};
 const now=()=>Date.now()+(duel.kind==='online'?duel.skew:0);
 const secs=ms=>Math.max(0,Math.ceil(ms/1000));
 const esc=s=>escapeAttr(String(s??''));
 const skillIcon=(k,u)=>{
  const folder=({'Büyücü':'buyucu','Okçu':'okcu'})[u.cls];
  const src=k==='passive'?D.passiveOf(u).icon:folder?'assets/arena/skills/'+folder+'/'+k+'.webp':D.SKILLS[k].icon;
  return src+'?v=art2';
 };
 const skillName=(k,u)=>k==='passive'?D.passiveOf(u).name:D.SKILLS[k].name;
 const skillText=(k,u)=>k==='passive'?D.passiveOf(u).text+' · sıranı harcar':k==='normal'?'Normal hasar':k==='strong'?'%130 hasar':'%175 hasar';
 const fallbackIcon="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 10 10%22%3E%3Crect width=%2210%22 height=%2210%22 rx=%222%22 fill=%22%23333%22/%3E%3C/svg%3E'";

 function hpBar(u){return '<div class="vdu-hp"><i style="width:'+Math.max(0,Math.min(100,u.hp/u.maxHp*100))+'%"></i>'+(u.shield>0?'<b style="width:'+Math.min(100,u.shield/u.maxHp*100)+'%"></b>':'')+'</div><small>'+money(Math.max(0,u.hp))+' / '+money(u.maxHp)+(u.shield>0?' · 🛡 '+money(u.shield):'')+(u.focus?' · 🎯 hazır':'')+'</small>'}
 function card(u,side,portrait){return '<div class="vdu-card vdu-'+side+'" data-side="'+side+'"><div class="vdu-portrait"><img src="'+portrait+'" alt=""></div><div class="vdu-info"><b>'+esc(u.name)+'</b><span>'+esc(u.cls)+' · Sv. '+u.level+'</span>'+hpBar(u)+'</div></div>'}
 function chip(e){const who=e.side==='me'?'Sen':esc(duel.st.foe.name);if(e.skill==='burn')return '<span class="burn">🔥 Yanık '+money(e.damage)+'</span>';
  if(e.skill==='passive')return '<span class="pas">'+who+' · '+esc(D.PASSIVES[(e.side==='me'?duel.st.me:duel.st.foe).cls]?.name||'Pasif')+(e.shield?' 🛡'+money(e.shield):e.healed?' +'+money(e.healed):e.focus?' 🎯':'')+'</span>';
  return '<span class="'+(e.side==='me'?'mine':'theirs')+'">'+who+' · '+esc(D.SKILLS[e.skill]?.name||'')+' <b>'+money(e.damage||0)+'</b>'+(e.hit?.critical?' Kritik':'')+(e.hit?.blocked?' Bloke':'')+(e.hit?.absorbed?' 🛡'+money(e.hit.absorbed):'')+(e.auto&&e.side==='me'?' ⏱':'')+'</span>'}
 function skillButton(k,mine,t){const u=duel.st.me,cd=secs((u.cd[k]||0)-t),ok=mine&&!cd&&!duel.busy;return '<button type="button" class="vdu-skill vdu-'+k+'" '+(ok?'':'disabled ')+'onclick="valorDuel.use(\''+k+'\')" title="'+esc(skillText(k,u))+'"><img src="'+skillIcon(k,u)+'" alt="" onerror="'+fallbackIcon+'"><span class="vdu-sname">'+esc(skillName(k,u))+'</span><span class="vdu-cd" data-live="cd-'+k+'">'+(cd?cd+' sn':'')+'</span></button>'}
 function markup(){const st=duel.st,t=now(),mine=st.status==='battle'&&st.turn==='me',left=secs(D.TURN_MS-(t-(st.turnAt||t))),me=st.me,portraitMe=valorBattlePortraitMine(),portraitFoe=duel.rival?.portrait||(duel.kind==='training'?portraitMe:heroImages[Math.max(0,classes.indexOf(st.foe.cls))]);
  const log=duel.all.slice(-10).reverse().map(chip).join('')||'<span>Sıran gelince bir beceri seç · 5 sn içinde seçmezsen otomatik seçilir</span>';
  return '<section class="vdu-dialog" role="dialog" aria-modal="true" aria-labelledby="vdu-title"><small class="vdu-eyebrow">ARENA · TUR '+st.round+'</small><h2 id="vdu-title">'+esc(st.foe.name)+'</h2>'
   +card(st.foe,'foe',portraitFoe)
   +'<div class="vdu-turn '+(mine?'mine':'')+'" role="status"><b>'+(st.status!=='battle'?'Savaş bitti':mine?'Sıra sende!':'Rakip saldırıyor…')+'</b><span data-live="turn">'+(mine?left+' sn':'')+'</span></div>'
   +'<div class="vdu-ticker" aria-live="polite">'+log+'</div>'
   +card(me,'me',portraitMe)
   +'<div class="vdu-skills">'+D.ORDER.map(k=>skillButton(k,mine,t)).join('')+'</div>'
   +'<small class="vdu-hint">'+(mine?'Pasif: '+esc(D.passiveOf(me).text)+' · sıranı harcar':'')+'</small></section>'}
 function paint(){const el=document.getElementById('valor-duel');if(!el||!duel.st)return;const html=markup();
  const stable=html.replace(/(data-live="[^"]+">)[^<]*</g,'$1<');
  if(stable===duel.stable){for(const m of html.matchAll(/data-live="([^"]+)">([^<]*)</g)){const n=el.querySelector('[data-live="'+m[1]+'"]');if(n&&n.textContent!==m[2])n.textContent=m[2]}return}
  duel.stable=stable;el.innerHTML=html;floatNew()}
 /* Floating numbers for events not shown yet (my hit first, then the AI's answer). */
 function floatNew(){const el=document.getElementById('valor-duel');if(!el)return;const list=duel.all.slice(duel.shown);duel.shown=duel.all.length;list.forEach((e,i)=>setTimeout(()=>{
  const target=e.skill==='passive'?e.side:(e.side==='me'?'foe':'me'),host=document.querySelector('#valor-duel .vdu-'+target+' .vdu-portrait');if(!host)return;
  const f=document.createElement('span');f.className='vdu-float '+(e.skill==='passive'?'pas':e.hit?.critical?'crit':'');f.textContent=e.skill==='passive'?(e.shield?'🛡 '+money(e.shield):e.healed?'+'+money(e.healed):'🎯'):'-'+money(e.damage||0);host.appendChild(f);if(e.skill!=='passive'){host.classList.remove('hit');void host.offsetWidth;host.classList.add('hit')}setTimeout(()=>f.remove(),1300)},i*550))}

 function open(){document.getElementById('valor-duel')?.remove();const el=document.createElement('div');el.id='valor-duel';el.className='vdu-overlay';document.body.appendChild(el);document.documentElement.style.overflow='hidden';duel.stable=null;paint();clearInterval(duel.timer);duel.timer=setInterval(tick,250)}
 function close(){clearInterval(duel.timer);duel.timer=null;document.getElementById('valor-duel')?.remove();document.documentElement.style.overflow=''}
 function adopt(view,fresh=true){duel.st=view;if(fresh&&Array.isArray(view.events))duel.all=duel.all.concat(view.events)}
 async function server(body){const r=await valorFightCall(body);if(r&&Number.isFinite(r.now))duel.skew=r.now-Date.now();return r}

 function battleFromDuel(){const r=duel.st.result,rounds=new Map();for(const e of duel.all){if(!rounds.has(e.round))rounds.set(e.round,{round:e.round,mine:0,theirs:0,myHit:null,enemyHit:null,myHp:e.myHp,enemyHp:e.enemyHp});const x=rounds.get(e.round);if(e.side==='me'&&e.skill!=='passive'){x.mine+=e.damage||0;if(e.hit)x.myHit=e.hit}else if(e.side==='foe'&&e.skill!=='passive'){x.theirs+=e.damage||0;if(e.hit)x.enemyHit=e.hit}x.myHp=e.myHp;x.enemyHp=e.enemyHp}
  return {...r,log:[...rounds.values()]}}
 function done(){const battle=battleFromDuel(),kind=duel.kind,rival=duel.rival;setTimeout(()=>{close();duel.st=null;
  if(kind==='online')valorArenaOnlineFinish(rival,battle,true);
  else if(kind==='training'){valorPrecomputedBattle=battle;valorArenaImmediateTraining();valorPrecomputedBattle=null}
  else{valorPrecomputedBattle=battle;valorArenaWithFury(()=>valorArenaImmediateFight(rival.id));valorPrecomputedBattle=null}},1400)}

 async function use(skill){const st=duel.st;if(!st||duel.busy||st.status!=='battle'||st.turn!=='me')return;
  if(duel.kind==='online'){duel.busy=true;paint();let r;try{r=await server({mode:'duel_act',skill})}finally{duel.busy=false}
   if(r?.duel){adopt(r.duel,!r.error)}else if(r?.error&&!r.duel){toast(valorFightError(r.error));close();return}
   paint();if(duel.st.status==='done')done();return}
  if(!D.act(duel.local,skill,Date.now()))return;adopt(D.view(duel.local));paint();if(duel.st.status==='done')done()}
 function tick(){if(document.hidden||!duel.st)return;const st=duel.st;if(st.status==='battle'&&st.turn==='me'&&!duel.busy&&now()-(st.turnAt||0)>=D.TURN_MS){use('auto');return}paint()}

 function localStart(kind,meStats,foe,rival){duel.kind=kind;duel.rival=rival;duel.all=[];duel.shown=0;
  duel.local=D.create({name:state.name||'Sen',cls:state.class,level:state.level,stats:meStats},foe,Date.now());adopt(D.view(duel.local));open();if(duel.st.status==='done')done()}

 const prevFight=valorArenaFight,prevTraining=valorArenaTraining;
 valorArenaFight=async function(id){
  if(page!=='Savaş'||!state.class||duel.st||duel.busy||document.getElementById('valor-arena-result'))return;
  if(valorArenaData().used>=10)return toast('Bugünkü 10 savaş hakkını kullandın');
  if(valorArenaIsOnline()){const rival=(valorArenaOnline.rivals||[]).find(p=>p.id===id);if(!rival)return;
   duel.busy=true;let r;try{if(typeof valorCloudFlush==='function')await valorCloudFlush().catch(()=>{});r=await server({mode:'duel_start',target:rival.uid})}finally{duel.busy=false}
   if(r?.missing||(!r?.duel&&/Sunucu hatası|Sunucuya bağlanılamadı/.test(String(r?.error||''))))return prevFight.apply(this,arguments);   // server missing or failing: classic fight
   if(!r?.duel){valorArenaOnline.at=0;return toast(valorFightError(r?.error))}
   if(r.resumed){const again=(valorArenaOnline.rivals||[]).find(p=>p.name===r.foe?.name);duel.rival=again||{name:r.foe?.name,cls:r.foe?.class,level:r.foe?.level,portrait:valorArenaPortrait(r.foe?.class,r.foe?.gender)};toast('Yarım kalan savaşın açıldı')}else duel.rival=rival;
   duel.kind='online';duel.all=[];duel.shown=0;adopt(r.duel);open();if(duel.st.status==='done')done();return}
  const rival=valorArenaCandidates().find(p=>p.id===id);if(!rival)return;
  localStart('local',valorArenaStats(),{name:rival.name,cls:rival.cls,level:rival.level,stats:{...rival.combatStats}},rival)};
 valorArenaTraining=function(){if(page!=='Savaş'||!state.class||duel.st||document.getElementById('valor-arena-result'))return;const s=valorArenaStats();
  localStart('training',s,{name:'Denk Rakip',cls:state.class,level:state.level,stats:{...s}},null)};
 /* A refresh in the middle of an online duel: offer to continue it on the arena page. */
 let checked=false;const prevPage=valorArenaPage;valorArenaPage=function(){const html=prevPage.apply(this,arguments);
  if(!checked&&valorArenaIsOnline()){checked=true;server({mode:'duel_state'}).then(r=>{if(r?.duel&&r.duel.status==='battle'&&!duel.st){duel.kind='online';duel.all=[];duel.shown=0;duel.rival={name:r.foe?.name,cls:r.foe?.class,level:r.foe?.level,portrait:valorArenaPortrait(r.foe?.class,r.foe?.gender)};adopt(r.duel);open()}}).catch(()=>{})}
  return html};
 window.valorDuel={use,state:()=>duel,close};
})();
