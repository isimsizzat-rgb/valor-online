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
 const log=battle.log||[],rounds=Math.max(1,log.length),step=Math.max(600,Math.min(1000,35000/rounds)),total=rounds*step;
 const setHp=(side,hp,max)=>{const b=overlay.querySelector('.vba-bar[data-side="'+side+'"]');if(!b)return;b.querySelector('i').style.width=Math.max(0,hp/max*100)+'%';b.querySelector('[data-hp]').textContent=money(Math.max(0,hp))+' / '+money(max)};
 let finished=false;
 const finish=()=>{if(finished||valorArenaPendingBattle!==pending)return;finished=true;clearTimeout(pending.timer);valorArenaPendingBattle=null;overlay.remove();if(page==='Savaş'&&state.class)onDone()};
 overlay.querySelector('[data-skip]').addEventListener('click',finish);
 log.forEach((r,i)=>setTimeout(()=>{
  if(valorArenaPendingBattle!==pending)return;
  overlay.querySelector('[data-round]').textContent=r.round+'. tur'+(r.myHit?.fury?' · Öfke +%'+Math.round(r.myHit.fury*100):'');
  const mine=()=>{for(const [t,k] of valorBattleHitTexts(r.myHit,r.mine))valorBattleFloat('R',t,k);if(r.myHit?.healed)valorBattleFloat('R','+'+money(r.myHit.healed),'heal');setHp('R',r.enemyHp,right.maxHp)};
  const theirs=()=>{for(const [t,k] of valorBattleHitTexts(r.enemyHit,r.theirs))valorBattleFloat('L',t,k);if(r.enemyHit?.healed)valorBattleFloat('L','+'+money(r.enemyHit.healed),'heal');setHp('L',r.myHp,left.maxHp)};
  const [a,b]=meFirst?[mine,theirs]:[theirs,mine];a();if(r.mine||r.theirs)setTimeout(()=>{if(valorArenaPendingBattle===pending)b()},step/2);else b();
 },i*step));
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
