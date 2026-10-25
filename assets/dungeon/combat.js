/* Dungeon fights use the same complete stats and per-hit effects as Arena. */
const VALOR_DUNGEON_WAIT_MS=7000;
let valorDungeonPendingFight=null,valorDungeonBattleResult=null,valorDungeonVisibleRounds=50;
// Damage reduction is now applied per hit, so do not also discount enemy power.
vsEnemy=function(floor){return valorAstrologyPreviousDungeonEnemy(floor)};
function valorDungeonEnemyStats(floor){
 const power=vsEnemy(floor),magic=[1,2,6,7].includes(Math.floor((floor-1)/10)),stats={};
 stats[magic?'Sihir':'Saldırı']=Math.max(1,Math.round(power*.28/10));
 stats[magic?'Saldırı':'Sihir']=Math.max(1,Math.round(power*.06/3));
 stats.Savunma=stats['Sihir Savunma']=Math.max(0,Math.round(power*.12/10));
 stats.Can=Math.max(1,Math.round(power*.34/3));
 stats.Kritik=stats.Bloke=Math.min(2000,Math.max(0,Math.round(power*.04/4)));
 return {stats,cls:magic?'Büyücü':'Savaşçı',power};
}
function valorDungeonCancelFight(){
 if(valorDungeonPendingFight)clearTimeout(valorDungeonPendingFight.timer);
 valorDungeonPendingFight=null;document.getElementById('valor-dungeon-wait')?.remove();
}
function valorDungeonCloseBattle(){document.getElementById('valor-dungeon-result')?.remove();valorDungeonBattleResult=null}
function valorDungeonFinishFight(pending){
 if(valorDungeonPendingFight!==pending)return;
 valorDungeonPendingFight=null;document.getElementById('valor-dungeon-wait')?.remove();
 if(state!==pending.owner||!state.class||page!=='Zindan'||valorDungeonShopView)return;
 const d=vsData().dungeon;
 if(d.day!==pending.day||vsToday()!==pending.day||d.cleared+1!==pending.floor)return toast('Zindan ilerlemesi değişti. Savaşı yeniden başlat.');
 const battle=valorArenaSimulate(pending.stats,pending.cls,pending.enemy.stats,pending.enemy.cls),rewards={xp:0,coins:0,gem:null};
 if(battle.win){
  const gems=new Map((state.gemInventory||[]).map(g=>[g.type+':'+g.level,Number(g.count)||0])),coins=d.coins;
  d.cleared=pending.floor;d.best=Math.max(d.best,pending.floor);
  vsReward(pending.floor);rewards.xp=valorDungeonFloorXp(pending.floor);rewards.coins=d.coins-coins;
  for(const g of state.gemInventory||[]){const count=(Number(g.count)||0)-(gems.get(g.type+':'+g.level)||0);if(count>0){rewards.gem={type:g.type,level:g.level,count};break}}
 }
 const result={...battle,floor:pending.floor,opponent:vsBoss(pending.floor),rewards,owner:state};
 d.lastBattle={floor:pending.floor,win:battle.win,draw:battle.draw,rounds:battle.rounds,myHp:battle.myHp,enemyHp:battle.enemyHp,at:Date.now()};
 save();render();valorDungeonShowBattle(result);
}
vsFight=function(){
 if(!state.class||page!=='Zindan'||valorDungeonShopView||valorDungeonPendingFight||document.getElementById('valor-dungeon-result'))return;
 const d=vsData().dungeon,floor=d.cleared+1;if(floor>100)return;
 const pending={owner:state,day:d.day,floor,cls:state.class,stats:{...valorArenaStats()},enemy:valorDungeonEnemyStats(floor),timer:null};
 valorDungeonPendingFight=pending;
 const overlay=document.createElement('div');overlay.id='valor-dungeon-wait';overlay.className='valor-item-overlay';
 overlay.innerHTML='<section class="valor-item-dialog vdc-wait" role="dialog" aria-modal="true" aria-labelledby="vdc-wait-title" aria-busy="true"><span class="vdg-eyebrow">'+floor+'. KAT · '+vsBoss(floor)+'</span><div class="vdc-orbit" aria-hidden="true"><span>⚔</span></div><h2 id="vdc-wait-title">Savaş sürüyor…</h2><p role="status">Son darbeye kadar mücadele ediyorsun.<br>Sonuç birazdan açıklanacak.</p><div class="vdc-wait-progress" aria-hidden="true"><i></i></div><button type="button" onclick="valorDungeonCancelFight()">Vazgeç</button></section>';
 document.body.appendChild(overlay);overlay.querySelector('button')?.focus();
 pending.timer=setTimeout(()=>valorDungeonFinishFight(pending),VALOR_DUNGEON_WAIT_MS);
};
function valorDungeonRoundMarkup(r){
 return '<article class="vdc-round"><b>'+r.round+'. Tur</b><p>'+(r.myHit?'Verdiğin hasar: <strong>'+money(r.mine)+'</strong>'+valorArenaHitLabel(r.myHit):'Saldırı yapamadın.')+'</p><p>'+(r.enemyHit?'Aldığın hasar: <strong>'+money(r.theirs)+'</strong>'+valorArenaHitLabel(r.enemyHit):'Rakip saldırı yapamadı.')+'</p><small>Senin canın: '+money(r.myHp)+' · Rakibin canı: '+money(r.enemyHp)+'</small></article>';
}
function valorDungeonMoreRounds(){
 const result=valorDungeonBattleResult,box=document.getElementById('vdc-rounds');if(!result||result.owner!==state||!box)return;
 const end=Math.min(result.log.length,valorDungeonVisibleRounds+50);
 box.insertAdjacentHTML('beforeend',result.log.slice(valorDungeonVisibleRounds,end).map(valorDungeonRoundMarkup).join(''));valorDungeonVisibleRounds=end;
 const button=document.getElementById('vdc-more');if(button){button.hidden=end>=result.log.length;button.textContent='Sonraki turlar ('+end+' / '+result.log.length+')'}
}
function valorDungeonShowBattle(result){
 valorDungeonCloseBattle();valorDungeonBattleResult=result;valorDungeonVisibleRounds=Math.min(50,result.log.length);
 const rewards=result.rewards,overlay=document.createElement('div');overlay.id='valor-dungeon-result';overlay.className='valor-item-overlay';
 const hp=(name,value,max)=>'<div class="vdc-hp"><span>'+name+' <b>'+money(value)+' / '+money(max)+'</b></span><div><i style="width:'+Math.min(100,Math.max(0,value/max*100))+'%"></i></div></div>';
 overlay.innerHTML='<section class="valor-item-dialog vdc-result" role="dialog" aria-modal="true" aria-labelledby="vdc-result-title"><button type="button" class="valor-item-close" onclick="valorDungeonCloseBattle()" aria-label="Kapat">×</button><span class="vdg-eyebrow">'+result.floor+'. KAT · '+result.opponent+'</span><h2 id="vdc-result-title" class="'+(result.win?'vdc-win':'vdc-loss')+'">'+(result.win?'Zafer!':result.draw?'Savaş Sonuçsuz':'Yenilgi')+'</h2><p>'+result.rounds+' tur · '+(result.draw?'Taraflar birbirini yenemedi.':result.win?'Rakibin canı tükendi.':'Canın tükendi.')+'</p>'+hp('Sen',result.myHp,result.myMaxHp)+hp(result.opponent,result.enemyHp,result.enemyMaxHp)+'<div class="vdc-rewards">'+(result.win?'<b>Kat '+result.floor+' geçildi</b><span>+'+money(rewards.xp)+' EXP</span>'+(rewards.coins?'<span>+'+money(rewards.coins)+' Zindan Parası</span>':'')+(rewards.gem?'<span>+'+rewards.gem.count+' '+rewards.gem.type+' · Sv. '+rewards.gem.level+' Mozaik Taşı</span>':''):'<span>Ödül kazanmadın. Aynı katta tekrar deneyebilirsin.</span>')+'</div><details class="vdc-log"><summary>Tur Detayları · '+result.rounds+' tur</summary><p class="vdc-log-note">Şifa yazısı, o vuruşu alan tarafın yenilenen canını gösterir. Canlar turun sonundaki değerlerdir.</p><div id="vdc-rounds">'+result.log.slice(0,valorDungeonVisibleRounds).map(valorDungeonRoundMarkup).join('')+'</div><button type="button" id="vdc-more" '+(valorDungeonVisibleRounds>=result.log.length?'hidden':'')+' onclick="valorDungeonMoreRounds()">Sonraki turlar ('+valorDungeonVisibleRounds+' / '+result.log.length+')</button></details><button type="button" class="vdc-continue" onclick="valorDungeonCloseBattle()">'+(result.win?'Devam Et':'Kapat')+'</button></section>';
 overlay.addEventListener('click',e=>{if(e.target===overlay)valorDungeonCloseBattle()});document.body.appendChild(overlay);overlay.querySelector('.vdc-continue')?.focus();
}
const valorDungeonCombatPreviousRaid=vsRaid;
vsRaid=function(){if(valorDungeonPendingFight)return;return valorDungeonCombatPreviousRaid()};
const valorDungeonCombatPreviousGo=go;
go=function(destination){valorDungeonCancelFight();valorDungeonCloseBattle();return valorDungeonCombatPreviousGo(destination)};
const valorDungeonCombatPreviousShop=valorDungeonOpenShop;
valorDungeonOpenShop=function(){valorDungeonCancelFight();valorDungeonCloseBattle();return valorDungeonCombatPreviousShop()};
const valorDungeonCombatPreviousPage=vsDungeon;
vsDungeon=function(){return valorDungeonCombatPreviousPage().replace('<p class="vdg-reset-note">','<p class="vdg-reset-note">Savaşlar can bitene kadar sürer. Her karşılaşmaya tam canla başlarsın; sonuç ekranından tur detaylarını inceleyebilirsin.</p><p class="vdg-reset-note">')};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){valorDungeonCancelFight();valorDungeonCloseBattle()}});
