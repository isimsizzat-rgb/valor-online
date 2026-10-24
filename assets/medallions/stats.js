/* Resistance is a flat per-hit absorption with a 30% ceiling, never an astrology level. */
function valorMedallionBonuses(now=Date.now()){
 const worn=state.equipped?.Madalyon,it=valorMedallionAlive(worn,now)&&(state.inventory||[]).find(i=>String(i.id)===String(worn.id)&&valorMedallionAlive(i,now));
 const p=it&&valorMedallionProduct(it.medallionId);return {resistance:p?.resistance||0,health:p?.health||0};
}
function valorMedallionAbsorb(damage,resistance){
 const incoming=Math.max(1,Math.round(Number(damage)||1)),value=Math.max(0,Math.floor(Number(resistance)||0));
 const absorbed=Math.min(value,Math.floor(incoming*.30));return {damage:incoming-absorbed,absorbed};
}
function valorMedallionResolve(damage,resistance,resisted=false){
 if(resisted)return {damage:1,absorbed:0};
 return valorMedallionAbsorb(damage,resistance);
}
const valorMedallionStatsPreviousArenaStats=valorArenaStats;
valorArenaStats=function(){const stats=valorMedallionStatsPreviousArenaStats(),bonus=valorMedallionBonuses();return {...stats,Can:(Number(stats.Can)||0)+bonus.health/10,medallionResistance:bonus.resistance,medallionHealth:bonus.health}};
const valorMedallionStatsPreviousHit=valorArenaHit;
valorArenaHit=function(a,b,rng=Math.random){const hit=valorMedallionStatsPreviousHit(a,b,rng);const shield=valorMedallionResolve(hit.damage,b.stats.medallionResistance,hit.resisted);return {...hit,damage:shield.damage,medallionAbsorbed:shield.absorbed}};
const valorMedallionStatsPreviousHitLabel=valorArenaHitLabel;
valorArenaHitLabel=function(hit){return valorMedallionStatsPreviousHitLabel(hit)+(hit?.medallionAbsorbed?' <strong class="vmed-resisted">Direnç −'+money(hit.medallionAbsorbed)+' hasar</strong>':'')};
/* Generated NPCs never inherit equipped medallion passives; training intentionally mirrors both sides. */
const valorMedallionStatsPreviousPlayers=valorArenaPlayers;
valorArenaPlayers=function(){const players=valorMedallionStatsPreviousPlayers();let changed=false;for(const p of players)for(const key of ['medallionResistance','medallionHealth'])if(p.combatStats&&key in p.combatStats){delete p.combatStats[key];changed=true}if(changed)save();return players};
const valorMedallionStatsPreviousProfile=profile;
profile=function(){
 const stats=valorArenaStats(),bonus=valorMedallionBonuses(),hp=valorArenaUnit(stats,state.class).maxHp;
 let html=valorMedallionStatsPreviousProfile().replace(/(<div class="vp-stat"><span>Can<\/span><b>)[^<]*(<\/b><\/div>)/,(_,a,b)=>a+money(hp)+b);
 const detail='<div class="vp-stat"><span>Direnç</span><b>'+money(bonus.resistance)+'</b></div><div class="vp-stat"><span>Madalyon Canı</span><b>+'+money(bonus.health)+'</b></div>';
 html=html.replace('</div><div class="vp-exp">',detail+'</div><div class="vp-exp">');
 return html.replace('<div class="vp-exp">','<p class="vmed-profile-note">Astroloji hasarı azalttıktan sonra direnç, kalan vuruşun en fazla %30’unu ve kendi değeri kadarını karşılar. Can, savaşta kullanılan maksimum canındır.</p><div class="vp-exp">');
};
/* All per-hit battles show and use the same maximum health as the profile. */
stagePlayerMax=function(){return valorArenaUnit(valorArenaStats(),state.class).maxHp};
function valorMedallionSyncStageHealth(){
 const r=stageRun;if(!r||r.failed||r.step===14)return;
 const max=stagePlayerMax();if(r.maxHp!==max){r.maxHp=max;r.hp=Math.min(r.hp,max);stageRunSave()}
}
const valorMedallionStatsPreviousStagePage=stageAdventurePage;
stageAdventurePage=function(){valorMedallionSyncStageHealth();return valorMedallionStatsPreviousStagePage()};
stageAttack=function(){
 const r=stageRun;if(!r||r.step%2!==1||r.step>13||!r.enemy||r.hp<=0)return;
 valorMedallionSyncStageHealth();
 const stats=valorArenaStats(),enemy=r.enemy,critical=Math.random()<valorArenaChance(stats.Kritik),damage=Math.max(10,Math.round((23+state.level*3+combatPower()*.11)*(0.85+Math.random()*.3)*(critical?1.25+valorAstrologyData().fateBreaker*.02:1)));
 enemy.hp=Math.max(0,enemy.hp-damage);
 if(enemy.hp===0){r.message=enemy.name+' yenildi!';if(r.step===13){stageFinish();return}r.step++;r.enemy=null}
 else{
  const resisted=Math.random()<valorAstrologyData().endlessResistance*.01,raw=Math.max(1,Math.round(enemy.attack*(.8+Math.random()*.4)-combatPower()*.018)),base=resisted?1:valorAstrologyTakenDamage(raw);
  const shield=valorMedallionResolve(base,stats.medallionResistance,resisted),taken=shield.damage;r.hp=Math.max(0,r.hp-taken);
  const unit={hp:r.hp,maxHp:r.maxHp},healed=valorAstrologyHeal(unit,valorAstrologyData().lifeLight*.01);r.hp=unit.hp;
  r.message='Sen '+damage+' hasar verdin.'+(critical?' Kritik!':'')+' '+enemy.name+' '+taken+' hasar verdi.'+(shield.absorbed?' Direnç '+shield.absorbed+' hasarı karşıladı.':'')+(resisted?' Sonsuz Direnç!':'')+(healed?' Yaşam Işığı +'+healed+' can.':'');
  if(r.hp===0){r.message+=' Yenildin! Sahne başarısız oldu.';r.failed=true}
 }
 stageRunSave();render();
};
render();
