/* Permanent, independently upgraded astrology talents. */
const VALOR_ASTROLOGY_MAX = 20;
const VALOR_ASTROLOGY_TALENTS = [
  {id:'crimsonFury',name:'Kızıl Hiddet',stat:'Saldırı',step:1,label:'Saldırı',icon:'✶',color:'#d17676'},
  {id:'ironWill',name:'Demir İrade',stat:'Savunma',step:1,label:'Defans',icon:'⬡',color:'#aebcd1'},
  {id:'astralFlame',name:'Astral Alev',stat:'Sihir',step:1,label:'Sihirli saldırı',icon:'✧',color:'#b291eb'},
  {id:'starVeil',name:'Yıldız Örtüsü',stat:'Sihir Savunma',step:1,label:'Sihirli defans',icon:'✦',color:'#8caee9'},
  {id:'fateBreaker',name:'Kader Kıran',step:2,label:'Kritik hasar',icon:'ϟ',color:'#e3bc76'},
  {id:'nightVeil',name:'Gece Perdesi',step:2,label:'Hasar azaltma',icon:'☾',color:'#9c91dd'},
  {id:'endlessResistance',name:'Sonsuz Direnç',step:1,label:'Etkinleşme ihtimali',icon:'◇',color:'#88c9d0',description:'Rakibin vuruşundan yalnızca 1 hasar alırsın.'},
  {id:'lifeLight',name:'Yaşam Işığı',step:1,label:'Etkinleşme ihtimali',icon:'❋',color:'#90c99c',description:'Gelen vuruştan sağ çıkarsan maksimum canının %5’i yenilenir.'}
];
function valorAstrologyData() {
  let d=state.astrologyV1,changed=false;
  if(!d||typeof d!=='object'||Array.isArray(d)){d={};state.astrologyV1=d;changed=true;}
  // Keep the old talent's purchased levels when renaming it.
  if(d.nightVeil===undefined&&d.dragonBreath!==undefined){d.nightVeil=d.dragonBreath;changed=true;}
  for(const t of VALOR_ASTROLOGY_TALENTS){const n=Math.max(0,Math.min(VALOR_ASTROLOGY_MAX,Math.floor(Number(d[t.id])||0)));if(d[t.id]!==n){d[t.id]=n;changed=true;}}
  if(changed)save();return d;
}
function valorAstrologyReduction(){return valorAstrologyData().nightVeil*.02;}
function valorAstrologyTakenDamage(damage,reduction=valorAstrologyReduction()){
  return Math.max(1,Math.round(Math.max(1,Number(damage)||1)*(1-Math.max(0,Math.min(.40,Number(reduction)||0)))));
}
function valorAstrologyEnemyThreat(power){return Math.max(1,Number(power)*(1-valorAstrologyReduction()));}
function valorAstrologyCost(level){return 5000*(level+1)*(level+1);}
function valorAstrologyUpgrade(id){
  if(page!=='Astroloji'||!state.class)return;
  const t=VALOR_ASTROLOGY_TALENTS.find(t=>t.id===id);if(!t)return;
  const d=valorAstrologyData(),level=d[id];
  if(level>=VALOR_ASTROLOGY_MAX)return toast(t.name+' en yüksek seviyede.');
  const cost=valorAstrologyCost(level);if(state.gold<cost)return toast('Geliştirmek için yeterli altının yok.');
  state.gold-=cost;d[id]++;save();render();toast(t.name+' Sv. '+d[id]+' · %'+d[id]*t.step+' '+t.label.toLocaleLowerCase('tr-TR'));
}
function valorAstrologyPage(){
  const d=valorAstrologyData();
  return '<section class="astrology-page"><header class="astrology-header"><div><small>YILDIZLARIN KUDRETİ</small><h1>Astroloji</h1><p>Göksel güçlerini altınla geliştir. Her özellik kalıcıdır.</p></div><button type="button" class="astrology-back" onclick="go(\'Anasayfa\')">‹ Anasayfa</button></header><div class="astrology-gold">Altının <b>'+money(state.gold)+'</b></div><div class="astrology-grid">'+VALOR_ASTROLOGY_TALENTS.map(t=>{
    const level=d[t.id],maxed=level>=VALOR_ASTROLOGY_MAX,cost=valorAstrologyCost(level);
    return '<article class="astrology-talent" style="--talent-color:'+t.color+'"><figure class="astrology-visual"><img src="'+VALOR_ASTROLOGY_ART[t.id]+'" alt="'+t.name+' kozmik enerji görseli" width="480" height="480" loading="lazy" decoding="async"></figure><div class="astrology-card-heading"><div><span class="astrology-passive">PASİF ÖZELLİK · KALICI</span><h2>'+t.name+'</h2></div></div><div class="astrology-talent-copy"><p>Her seviye '+(t.id==='nightVeil'?'alınan hasarı %2 azaltır.':t.description?'%'+t.step+' etkinleşme ihtimali kazandırır. '+t.description:t.label.toLocaleLowerCase('tr-TR')+' değerini %'+t.step+' artırır.')+'</p><div class="astrology-level"><b>Sv. '+level+'<small> / '+VALOR_ASTROLOGY_MAX+'</small></b><span>%'+level*t.step+' '+t.label+'</span></div><div class="astrology-progress"><i style="width:'+level/VALOR_ASTROLOGY_MAX*100+'%"></i></div><div class="astrology-stats"><div><small>ŞU ANDA</small><strong>%'+level*t.step+'</strong><span>'+t.label+'</span></div><div><small>'+(maxed?'MAKSİMUM':'SONRAKİ')+'</small><strong>%'+Math.min(VALOR_ASTROLOGY_MAX,level+1)*t.step+'</strong><span>'+t.label+'</span></div></div><button type="button" class="astrology-upgrade" '+(maxed||state.gold<cost?'disabled':'')+' onclick="valorAstrologyUpgrade(\''+t.id+'\')">'+(maxed?'En Yüksek Seviye':'Geliştir <span>'+money(cost)+' Altın</span>')+'</button></div></article>';
  }).join('')+'</div><p class="astrology-note">Arena, Sahne ve Zindan savaşlarında tüm etkiler aktiftir. Macera’da temel özellikler ve hasar azaltma savaş gücüne yansır. Şifa ve Sonsuz Direnç her gelen vuruşta ayrı değerlendirilir.</p></section>';
}
function valorAstrologyBoostStats(stats){const out={...stats},d=valorAstrologyData();for(const t of VALOR_ASTROLOGY_TALENTS)if(t.stat)out[t.stat]=(Number(out[t.stat])||0)*(1+d[t.id]/100);return out;}
const valorAstrologyPreviousArenaStats=valorArenaStats;
valorArenaStats=function(){const d=valorAstrologyData();return {...valorAstrologyBoostStats(valorAstrologyPreviousArenaStats()),astrologyDamageReduction:valorAstrologyReduction(),astrologyCriticalDamage:d.fateBreaker*.02,astrologyResistance:d.endlessResistance*.01,astrologyHealing:d.lifeLight*.01};};
/* Profile, Arena and power use the same complete stat totals. */
combatPower=function(){
  const stats=valorArenaStats(),mage=state.class==='Büyücü',weights={'Saldırı':mage?3:10,'Sihir':mage?10:3,'Savunma':10,'Sihir Savunma':10,'Can':3,'Kritik':4,'Bloke':4};
  return Math.round(Object.keys(weights).reduce((sum,k)=>sum+(Number(stats[k])||0)*weights[k],0));
};
const valorAstrologyPreviousProfile=profile;
profile=function(){
  const stats=valorArenaStats(),data=valorAstrologyData();
  let html=valorAstrologyPreviousProfile().replace(/(<div class="vp-stat"><span>)(Saldırı|Sihir|Savunma|Sihir Savunma|Kritik|Bloke|Can)(<\/span><b>)([0-9]+(?:\.[0-9]+)?)(<\/b><\/div>)/g,(all,a,k,b,n,c)=>a+k+b+(Math.round(stats[k]*100)/100)+c);
  const passives=[['Kritik Hasar Artışı',stats.astrologyCriticalDamage],['Hasar Azaltma',stats.astrologyDamageReduction],['Sonsuz Direnç İhtimali',stats.astrologyResistance],['Yaşam Işığı İhtimali',stats.astrologyHealing]].map(([label,value])=>'<div class="vp-stat"><span>'+label+'</span><b>%'+Math.round(value*100)+'</b></div>').join('');
  html=html.replace('</div><div class="vp-exp">',passives+'</div><div class="vp-exp">');
  return html.replace(/<p class="vp-hint">[^<]*<\/p>/,'<p class="vp-hint">Ekipman, binek, teknoloji ve Astroloji bonusları toplam değerlere dahildir. Savaş gücü temel istatistiklerden hesaplanır. Pasif savaş etkileri ayrıca gösterilir. Yaşam Işığı etkinleştiğinde maksimum canının %5’ini yeniler.</p>');
};
const VALOR_ARENA_DAMAGE_MULTIPLIER=1.5;
const valorAstrologyPreviousArenaHit=valorArenaHit;
valorArenaHit=function(a,b,rng=Math.random){const hit=valorAstrologyPreviousArenaHit(a,b,rng);if(hit.critical)hit.damage+=Math.round(valorArenaDamage(a,b)*Math.max(0,Number(a.stats.astrologyCriticalDamage)||0));hit.damageBeforeAstrology=hit.damage*VALOR_ARENA_DAMAGE_MULTIPLIER;hit.damage=valorAstrologyTakenDamage(hit.damage*VALOR_ARENA_DAMAGE_MULTIPLIER,b.stats.astrologyDamageReduction||0);hit.resisted=!!b.stats.astrologyResistance&&rng()<b.stats.astrologyResistance;if(hit.resisted)hit.damage=1;return hit;};
function valorAstrologyHeal(unit,chance,rng=Math.random){if(unit.hp<=0||!chance||rng()>=chance)return 0;const healed=Math.min(unit.maxHp-unit.hp,Math.max(1,Math.round(unit.maxHp*.05)));unit.hp+=healed;return healed;}
valorArenaSimulate=function(myStats,myClass,rivalStats,rivalClass,rng=Math.random){
  const me=valorArenaUnit({...myStats},myClass),enemy=valorArenaUnit({...rivalStats},rivalClass),log=[];
  for(let round=1;me.hp>0&&enemy.hp>0&&round<=10000;round++){
    let mine=0,theirs=0,myHit=null,enemyHit=null;
    const strike=(a,b)=>{const hit=valorArenaHit(a,b,rng),damage=Math.min(b.hp,hit.damage);b.hp-=damage;hit.healed=valorAstrologyHeal(b,b.stats.astrologyHealing,rng);return {hit,damage};};
    const strikeMine=()=>{const s=strike(me,enemy);myHit=s.hit;mine=s.damage;},strikeEnemy=()=>{const s=strike(enemy,me);enemyHit=s.hit;theirs=s.damage;};
    const meFirst=me.attack===enemy.attack?rng()<.5:me.attack>enemy.attack;
    if(meFirst){strikeMine();if(enemy.hp>0)strikeEnemy();}else{strikeEnemy();if(me.hp>0)strikeMine();}
    log.push({round,mine,theirs,myHit,enemyHit,myHp:me.hp,enemyHp:enemy.hp});if(me.hp===0||enemy.hp===0)break;
  }
  const knockout=me.hp===0||enemy.hp===0,draw=!knockout,win=enemy.hp===0&&me.hp>0;return {win,draw,rounds:log.length,myHp:me.hp,enemyHp:enemy.hp,myMaxHp:me.maxHp,enemyMaxHp:enemy.maxHp,reason:knockout?'knockout':'stalemate',log};
};
const valorAstrologyPreviousHitLabel=valorArenaHitLabel;
valorArenaHitLabel=function(hit){return valorAstrologyPreviousHitLabel(hit)+(hit?.resisted?' <strong class="arena-blocked">Sonsuz Direnç!</strong>':'')+(hit?.healed?' <strong class="arena-healed">Yaşam Işığı +'+money(hit.healed)+' can</strong>':'');};
const valorAstrologyPreviousDungeonEnemy=vsEnemy;
vsEnemy=function(floor){return Math.max(1,Math.round(valorAstrologyEnemyThreat(valorAstrologyPreviousDungeonEnemy(floor))));};
/* NPCs copy base stat strengths, never the player's passive chances. */
const valorAstrologyPreviousArenaPlayers=valorArenaPlayers;
valorArenaPlayers=function(){const players=valorAstrologyPreviousArenaPlayers();let changed=false;for(const p of players)for(const k of Object.keys(p.combatStats||{}))if(k.startsWith('astrology')){delete p.combatStats[k];changed=true;}if(changed)save();return players;};

/* Arena battles finish on knockout. The ten-round scoring rule is retired. */
const VALOR_ARENA_WAIT_MS=7000;
let valorArenaPendingBattle=null;
function valorArenaCancelPending(){
  if(valorArenaPendingBattle)clearTimeout(valorArenaPendingBattle.timer);
  valorArenaPendingBattle=null;
  document.getElementById('valor-arena-wait')?.remove();
}
function valorArenaBeginWait(finish){
  if(valorArenaPendingBattle||document.getElementById('valor-arena-result'))return;
  const overlay=document.createElement('div');overlay.id='valor-arena-wait';overlay.className='valor-item-overlay';
  overlay.innerHTML='<style>@keyframes valorBattleSpin{to{transform:rotate(360deg)}}@keyframes valorBattlePulse{50%{transform:scale(1.14);filter:drop-shadow(0 0 20px #e3b669)}}@keyframes valorBattleProgress{from{transform:scaleX(0)}to{transform:scaleX(1)}}.arena-wait-orbit{position:relative;display:grid;place-items:center;width:112px;height:112px;margin:24px auto}.arena-wait-orbit:before{content:"";position:absolute;inset:0;border:2px solid #c4a06333;border-top-color:#f5d598;border-bottom-color:#a787c9;border-radius:50%;animation:valorBattleSpin 1.5s linear infinite}.arena-wait-swords{font-size:48px;animation:valorBattlePulse 1.1s ease-in-out infinite}.arena-wait-progress{height:7px;background:#090a13;border-radius:8px;overflow:hidden;margin:20px 0}.arena-wait-progress i{display:block;width:100%;height:100%;background:linear-gradient(90deg,#9364bd,#e4bc79);transform-origin:left;animation:valorBattleProgress 7s linear forwards}.arena-wait-dialog h2{color:#efcf94}.arena-wait-dialog p{color:#c5b7ce;font-size:13px;line-height:1.7}@media(prefers-reduced-motion:reduce){.arena-wait-orbit:before,.arena-wait-swords{animation:none}}</style><section class="valor-item-dialog arena-wait-dialog" role="dialog" aria-modal="true" aria-labelledby="arena-wait-title" aria-busy="true"><div class="arena-wait-orbit" aria-hidden="true"><span class="arena-wait-swords">⚔</span></div><h2 id="arena-wait-title">Savaş sürüyor…</h2><p role="status">Savaşçılar son darbeye kadar mücadele ediyor.<br>Sonuç birazdan açıklanacak.</p><div class="arena-wait-progress" aria-hidden="true"><i></i></div><button type="button" onclick="valorArenaCancelPending()">Vazgeç</button></section>';
  document.body.appendChild(overlay);
  const pending={timer:null};valorArenaPendingBattle=pending;
  pending.timer=setTimeout(()=>{if(valorArenaPendingBattle!==pending)return;valorArenaPendingBattle=null;overlay.remove();if(page==='Savaş'&&state.class)finish();},VALOR_ARENA_WAIT_MS);
  overlay.querySelector('button')?.focus();
}
const valorArenaImmediateFight=valorArenaFight;
valorArenaFight=function(id){
  if(page!=='Savaş'||!state.class||valorArenaPendingBattle||document.getElementById('valor-arena-result'))return;
  if(valorArenaData().used>=10)return toast('Bugünkü 10 savaş hakkını kullandın');
  if(!valorArenaCandidates().some(p=>p.id===id))return;
  valorArenaBeginWait(()=>valorArenaImmediateFight(id));
};
const valorArenaImmediateTraining=valorArenaTraining;
valorArenaTraining=function(){
  if(page!=='Savaş'||!state.class)return;
  valorArenaBeginWait(()=>valorArenaImmediateTraining());
};
const valorArenaBeforeBattleNavigation=go;
go=function(destination){valorArenaCancelPending();return valorArenaBeforeBattleNavigation(destination);};
const valorArenaBeforeKnockoutResult=valorArenaResult;
valorArenaResult=function(result){
  valorArenaBeforeKnockoutResult(result);
  const overlay=document.getElementById('valor-arena-result');
  if(overlay)overlay.innerHTML=overlay.innerHTML.replace('Kalan canlar karşılaştırıldı',result.reason==='stalemate'?'Savaş sonuçsuz kaldı':'Can tükendi');
};
