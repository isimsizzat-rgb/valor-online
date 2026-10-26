/* Arena battle playback: during the wait the already-resolved fight is replayed with both portraits,
   names, health bars and floating damage numbers. Rewards and ranking still run through the original
   arena code, which receives the same precomputed battle. */
let valorPrecomputedBattle=null;
const valorBattleAnimPrevSimulate=valorArenaSimulate;
valorArenaSimulate=function(){if(valorPrecomputedBattle){const b=valorPrecomputedBattle;valorPrecomputedBattle=null;return b}return valorBattleAnimPrevSimulate.apply(this,arguments)};

function valorBattlePortraitMine(){return document.getElementById('valor-hud-portrait')?.src||heroImages[Math.max(0,classes.indexOf(state.class))]}
function valorBattleFloat(side,text,kind){
 const host=document.querySelector('#valor-arena-wait .vba-fighter[data-side="'+side+'"] .vba-portrait');if(!host)return;
 const el=document.createElement('span');el.className='vba-float vba-'+kind;el.textContent=text;el.style.left=(30+Math.random()*40)+'%';
 host.appendChild(el);host.classList.remove('vba-hit');void host.offsetWidth;if(kind!=='heal')host.classList.add('vba-hit');
 setTimeout(()=>el.remove(),1300);
}
function valorBattleHitTexts(hit,dmg){
 const out=[];if(!hit)return out;const strike=Math.max(0,dmg-(hit.burnTick||0)-(hit.shadow||0));
 if(strike>0||!hit.burnTick)out.push([(hit.critical?'KRİTİK ':'')+'-'+money(strike),hit.critical?'crit':hit.blocked?'block':'dmg']);
 if(hit.blocked)out.push(['BLOKE','tag']);
 if(hit.resisted)out.push(['SONSUZ DİRENÇ','tag']);
 if(hit.shadow)out.push(['GÖLGE -'+money(hit.shadow),'crit']);
 if(hit.ignite)out.push(['TUTUŞTU!','burn']);
 if(hit.burnTick)out.push(['🔥 -'+money(hit.burnTick),'burn']);
 return out;
}
function valorBattlePlay({left,right,battle,meFirst,onDone}){
 if(valorArenaPendingBattle||document.getElementById('valor-arena-result'))return false;
 const overlay=document.createElement('div');overlay.id='valor-arena-wait';overlay.className='valor-item-overlay vba-overlay';
 const fighter=(f,side)=>'<div class="vba-fighter" data-side="'+side+'"><div class="vba-portrait"><img src="'+escapeAttr(f.portrait)+'" alt=""></div><b>'+escapeAttr(f.name)+'</b><small>'+escapeAttr(f.sub||'')+'</small></div>';
 const bar=(f,side)=>'<div class="vba-bar" data-side="'+side+'"><div class="vba-bar-top"><b>'+escapeAttr(f.name)+'</b><span data-hp>'+money(f.maxHp)+' / '+money(f.maxHp)+'</span></div><div class="vba-track"><i style="width:100%"></i></div></div>';
 overlay.innerHTML='<section class="valor-item-dialog vba-dialog" role="dialog" aria-modal="true" aria-label="Savaş" aria-busy="true"><div class="vba-bars">'+bar(left,'L')+'<span class="vba-vs">VS</span>'+bar(right,'R')+'</div><div class="vba-round" data-round>1. tur</div><div class="vba-stage">'+fighter(left,'L')+'<span class="vba-swords" aria-hidden="true">⚔</span>'+fighter(right,'R')+'</div><div class="vba-actions"><button type="button" data-skip>Sonucu Göster</button><button type="button" onclick="valorArenaCancelPending()">Vazgeç</button></div></section>';
 document.body.appendChild(overlay);
 const pending={timer:null};valorArenaPendingBattle=pending;
 /* About 1 second per round (both hits shown half a second apart); very long fights speed up to fit 35 seconds. */
 /* Rounds 1-15 take 1 second each; from round 16 every round is 7% quicker, down to 0.35 seconds. */
 const log=battle.log||[],rounds=Math.max(1,log.length),stepOf=i=>i<15?1000:Math.max(350,1000*Math.pow(.93,i-14)),starts=[];let total=0;
 for(let i=0;i<rounds;i++){starts.push(total);total+=stepOf(i)}
 const setHp=(side,hp,max)=>{const b=overlay.querySelector('.vba-bar[data-side="'+side+'"]');if(!b)return;b.querySelector('i').style.width=Math.max(0,hp/max*100)+'%';b.querySelector('[data-hp]').textContent=money(Math.max(0,hp))+' / '+money(max)};
 let finished=false;
 const finish=()=>{if(finished||valorArenaPendingBattle!==pending)return;finished=true;clearTimeout(pending.timer);valorArenaPendingBattle=null;overlay.remove();if(page==='Savaş'&&state.class)onDone()};
 overlay.querySelector('[data-skip]').addEventListener('click',finish);
 log.forEach((r,i)=>setTimeout(()=>{
  if(valorArenaPendingBattle!==pending)return;
  overlay.querySelector('[data-round]').textContent=r.round+'. tur'+(r.myHit?.fury?' · Öfke +%'+Math.round(r.myHit.fury*100):'');
  const mine=()=>{for(const [t,k] of valorBattleHitTexts(r.myHit,r.mine))valorBattleFloat('R',t,k);if(r.myHit?.healed)valorBattleFloat('R','+'+money(r.myHit.healed),'heal');setHp('R',r.enemyHp,right.maxHp)};
  const theirs=()=>{for(const [t,k] of valorBattleHitTexts(r.enemyHit,r.theirs))valorBattleFloat('L',t,k);if(r.enemyHit?.healed)valorBattleFloat('L','+'+money(r.enemyHit.healed),'heal');setHp('L',r.myHp,left.maxHp)};
  const [a,b]=meFirst?[mine,theirs]:[theirs,mine];a();if(r.mine||r.theirs)setTimeout(()=>{if(valorArenaPendingBattle===pending)b()},stepOf(i)/2);else b();
 },starts[i]));
 pending.timer=setTimeout(finish,total+900);
 overlay.querySelector('[data-skip]')?.focus();
 return true;
}

/* 1v1 Arena */
valorArenaFight=function(id){
 if(page!=='Savaş'||!state.class||valorArenaPendingBattle||document.getElementById('valor-arena-result'))return;
 if(valorArenaData().used>=10)return toast('Bugünkü 10 savaş hakkını kullandın');
 const rival=valorArenaCandidates().find(p=>p.id===id);if(!rival)return;
 const mine=valorArenaStats(),battle=valorArenaWithFury(()=>valorBattleAnimPrevSimulate(mine,state.class,rival.combatStats,rival.cls));
 const me=valorArenaUnit({...mine},state.class),foe=valorArenaUnit({...rival.combatStats},rival.cls);
 valorBattlePlay({left:{name:state.name||'Sen',portrait:valorBattlePortraitMine(),sub:state.class+' · Sv. '+state.level,maxHp:battle.myMaxHp},right:{name:rival.name,portrait:rival.portrait||heroImages[Math.max(0,classes.indexOf(rival.cls))],sub:rival.cls+' · Sv. '+rival.level,maxHp:battle.enemyMaxHp},battle,meFirst:me.attack>=foe.attack,
  onDone:()=>{valorPrecomputedBattle=battle;valorArenaWithFury(()=>valorArenaImmediateFight(id));valorPrecomputedBattle=null}});
};
/* Equal-rival training */
valorArenaTraining=function(){
 if(page!=='Savaş'||!state.class||valorArenaPendingBattle||document.getElementById('valor-arena-result'))return;
 const mine=valorArenaStats(),battle=valorArenaWithFury(()=>valorBattleAnimPrevSimulate({...mine},state.class,{...mine},state.class)),portrait=valorBattlePortraitMine();
 valorBattlePlay({left:{name:state.name||'Sen',portrait,sub:state.class+' · Sv. '+state.level,maxHp:battle.myMaxHp},right:{name:'Denk Rakip',portrait,sub:state.class+' · Sv. '+state.level,maxHp:battle.enemyMaxHp},battle,meFirst:Math.random()<.5,
  onDone:()=>{valorPrecomputedBattle=battle;valorArenaImmediateTraining();valorPrecomputedBattle=null}});
};

/* ---------- Team Arena playback (1v1 / 2v2 / 3v3) ---------- */
function valorTeamFloat(overlay,idx,text,kind){
 const host=overlay.querySelector('.vtp-f[data-i="'+idx+'"] .vba-portrait');if(!host)return;
 const el=document.createElement('span');el.className='vba-float vtp-float vba-'+kind;el.textContent=text;el.style.left=(35+Math.random()*30)+'%';
 host.appendChild(el);if(kind!=='heal'){host.classList.remove('vba-hit');void host.offsetWidth;host.classList.add('vba-hit')}
 setTimeout(()=>el.remove(),1300);
}
function valorTeamPlay(prep,onDone){
 if(valorArenaPendingBattle||document.getElementById('valor-arena-result'))return false;
 const {start,battle,size}=prep,hp=start.map(u=>u.maxHp);
 const row=(u,i)=>'<div class="vtp-f'+(u.me?' vtp-me':'')+'" data-i="'+i+'"><div class="vba-portrait"><img src="'+escapeAttr(u.portrait)+'" alt=""></div><div class="vtp-info"><b>'+escapeAttr(u.name)+(u.me?' (Sen)':'')+'</b><small>'+escapeAttr(u.cls)+' · Sv. '+(u.level||1)+'</small><div class="vba-track"><i style="width:100%"></i></div><span data-hp>'+money(u.maxHp)+'</span></div></div>';
 const col=(side,title)=>'<div class="vtp-col" data-side="'+side+'"><h3>'+title+'</h3>'+start.map((u,i)=>u.side===side?row(u,i):'').join('')+'</div>';
 const overlay=document.createElement('div');overlay.id='valor-arena-wait';overlay.className='valor-item-overlay vba-overlay';
 overlay.innerHTML='<section class="valor-item-dialog vba-dialog vtp-dialog" role="dialog" aria-modal="true" aria-label="Takım savaşı" aria-busy="true"><div class="vba-round" data-round>'+size+'v'+size+' · 1. tur</div><div class="vtp-sides">'+col('A','Takımın')+'<span class="vba-vs">VS</span>'+col('B','Rakip')+'</div><div class="vba-actions"><button type="button" data-skip>Sonucu Göster</button><button type="button" onclick="valorArenaCancelPending()">Vazgeç</button></div></section>';
 document.body.appendChild(overlay);
 const pending={timer:null};valorArenaPendingBattle=pending;
 const setHp=i=>{const f=overlay.querySelector('.vtp-f[data-i="'+i+'"]');if(!f)return;const max=start[i].maxHp,v=Math.max(0,Math.min(max,hp[i]));f.querySelector('i').style.width=(v/max*100)+'%';f.querySelector('[data-hp]').textContent=money(v);f.classList.toggle('vtp-down',v<=0)};
 const log=battle.log||[],rounds=Math.max(1,log.length),stepOf=i=>1.3*(i<15?1000:Math.max(350,1000*Math.pow(.93,i-14))),starts=[];let total=0;
 for(let i=0;i<rounds;i++){starts.push(total);total+=stepOf(i)}
 let finished=false;
 const finish=()=>{if(finished||valorArenaPendingBattle!==pending)return;finished=true;clearTimeout(pending.timer);valorArenaPendingBattle=null;overlay.remove();if(page==='Savaş'&&state.class)onDone()};
 overlay.querySelector('[data-skip]').addEventListener('click',finish);
 log.forEach((r,i)=>{const gap=stepOf(i)/Math.max(1,r.acts.length);
  setTimeout(()=>{if(valorArenaPendingBattle===pending)overlay.querySelector('[data-round]').textContent=size+'v'+size+' · '+r.round+'. tur'+(valorArenaFury(r.round)>0?' · Öfke +%'+Math.round(valorArenaFury(r.round)*100):'')},starts[i]);
  r.acts.forEach((x,j)=>setTimeout(()=>{
   if(valorArenaPendingBattle!==pending)return;
   if(x.ai>=0){const a=overlay.querySelector('.vtp-f[data-i="'+x.ai+'"]');if(a){a.classList.remove('vtp-act');void a.offsetWidth;a.classList.add('vtp-act')}}
   const texts=x.burn?[['🔥 -'+money(x.dmg),'burn']]:valorBattleHitTexts(x.hit,x.dmg);
   for(const [t,k] of texts)valorTeamFloat(overlay,x.bi,t,k);
   hp[x.bi]-=x.dmg;if(x.hit?.healed){hp[x.bi]+=x.hit.healed;valorTeamFloat(overlay,x.bi,'+'+money(x.hit.healed),'heal')}
   if(x.ko)hp[x.bi]=0;setHp(x.bi);
  },starts[i]+j*gap));
 });
 pending.timer=setTimeout(()=>{(battle.units||[]).forEach((u,i)=>{hp[i]=u.hp;setHp(i)});setTimeout(finish,900)},total);
 overlay.querySelector('[data-skip]')?.focus();
 return true;
}
