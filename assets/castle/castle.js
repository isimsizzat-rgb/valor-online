/* Local castle-war rules. A shared authoritative service is required for online guilds. */
const VALOR_CASTLE_DAYS=[1,3,5],VALOR_CASTLE_DURATION=15*60000;
let valorCastleAuto=null;
function valorCastleCalendar(now=Date.now()){
 const local=new Date(now+3*3600000),midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()),sessions=[];
 for(let n=-8;n<=9;n++){const day=new Date(midnight+n*86400000);if(!VALOR_CASTLE_DAYS.includes(day.getUTCDay()))continue;const id=day.toISOString().slice(0,10),start=Date.parse(id+'T21:00:00+03:00');sessions.push({id,start,end:start+VALOR_CASTLE_DURATION})}
 return {active:sessions.find(s=>now>=s.start&&now<s.end)||null,next:sessions.find(s=>s.start>now),sessions};
}
function valorCastleNextEnd(start){return valorCastleCalendar(start+1).next.end}
function valorCastleData(now=Date.now()){
 if(!state.castleV1)state.castleV1={playerId:'castle-player-'+valorUniqueItemId(),medallions:0,sessions:{},memberships:[],lastAttack:0};
 const d=state.castleV1;
 if(state.guild&&!state.guild.id)state.guild.id='guild-'+valorUniqueItemId();
 const id=state.guild?.id||null,last=d.memberships[d.memberships.length-1];
 if(!last||last.guildId!==id){if(last)last.until=now;d.memberships.push({guildId:id,since:now,until:null})}
 return d;
}
function valorCastleRank(rows){return rows.filter(r=>r.score>0&&r.hits>0).slice().sort((a,b)=>b.score-a.score||a.updatedAt-b.updatedAt||a.id.localeCompare(b.id))}
function valorCastleFame(rank){return Number.isInteger(rank)&&rank>0?([125,100,75][rank-1]||50):0}
function valorCastlePayouts(rows){
 const payouts={},rankings=valorCastleRank(rows);
 rankings.forEach((row,index)=>{for(const id of new Set(row.members||[]))if(!payouts[id])payouts[id]={guildId:row.id,rank:index+1,amount:[500,400,300][index]||200,fame:valorCastleFame(index+1),claimed:false,fameClaimed:false}});
 return {rankings,payouts};
}
function valorCastleSettle(now=Date.now()){
 if(!state.class)return false;const d=valorCastleData(now);let changed=false;
 for(const war of Object.values(d.sessions).sort((a,b)=>a.start-b.start)){
  if(now<war.end)continue;
  if(!war.settled){const result=valorCastlePayouts(Object.values(war.guilds));war.rankings=result.rankings;war.payouts=result.payouts;war.settled=true;war.bonusUntil=valorCastleNextEnd(war.start);changed=true}
  const reward=war.payouts[d.playerId];
  if(reward&&!reward.claimed){reward.claimed=true;d.medallions=(Number(d.medallions)||0)+reward.amount;changed=true}
  if(reward&&!reward.fameClaimed){reward.fame=valorCastleFame(reward.rank);reward.fameClaimed=true;state.fame=(Number(state.fame)||0)+reward.fame;changed=true}
 }
 return changed;
}
function valorCastleOverlap(start,end,now=Date.now()){
 const d=valorCastleData(now);let overlap=0;
 for(const war of Object.values(d.sessions)){
  if(!war.settled||!war.rankings?.length)continue;const winner=war.rankings[0];
  for(const membership of d.memberships){if(membership.guildId!==winner.id)continue;const a=Math.max(start,war.end,membership.since),b=Math.min(end,war.bonusUntil,membership.until??end);overlap+=Math.max(0,b-a)}
 }
 return Math.min(Math.max(0,end-start),overlap);
}
function valorCastleOwner(now=Date.now()){
 const d=valorCastleData(now),wars=Object.values(d.sessions).filter(w=>w.settled&&w.rankings?.length&&now>=w.end&&now<w.bonusUntil).sort((a,b)=>b.start-a.start);
 return wars.length?{...wars[0].rankings[0],until:wars[0].bonusUntil}:null;
}
vaGoldCollect=function(){
 if(!state.class)return 0;const now=Date.now(),changed=valorCastleSettle(now),g=vaGoldData(),last=Number(g.lastTick)||now,start=Math.max(last,now-365*86400000),elapsed=Math.max(0,now-start);
 g.lastTick=now;if(g.level<=0){if(changed)save();return 0}
 const bonusMs=valorCastleOverlap(start,now,now),produced=(elapsed+bonusMs*.25)*g.level*100/60000+(Number(g.fraction)||0),amount=Math.floor(produced);
 g.fraction=produced-amount;if(amount){state.gold+=amount;g.total=(Number(g.total)||0)+amount}if(changed)save();return amount;
};
function valorCastleTime(ms){const s=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(s/3600);return (h?h+':':'')+String(Math.floor(s%3600/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function valorCastleDate(time){return new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(time))}
function valorCastleStop(){valorCastleAuto=null}
function valorCastleStrike(stats,cls){
 const key=cls==='Büyücü'?'Sihir':'Saldırı',power=Number(stats[key]);
 return {damage:Number.isFinite(power)?Math.round(Math.max(0,power)*.5):0,critical:false};
}
function valorCastleAttack(now=Date.now()){
 if(!state.class||!state.guild||page!=='Birlik'||document.hidden)return false;
 const schedule=valorCastleCalendar(now),active=schedule.active;if(!active){valorCastleStop();return false}
 const d=valorCastleData(now);if(now-d.lastAttack<1000)return false;
 const war=d.sessions[active.id]||(d.sessions[active.id]={...active,guilds:{},settled:false});
 if(war.settled)return false;
 const guild=state.guild,row=war.guilds[guild.id]||(war.guilds[guild.id]={id:guild.id,name:guild.name,score:0,hits:0,updatedAt:now,members:[d.playerId]});
 if(!row.members.includes(d.playerId))row.members.push(d.playerId);
 const hit=valorCastleStrike(valorArenaStats(),state.class);
 d.lastAttack=now;row.score+=hit.damage;row.hits++;row.updatedAt=now;war.lastHit={damage:hit.damage,critical:hit.critical};
 save();valorCastleRefresh();return true;
}
function valorCastleToggle(){
 if(valorCastleAuto){valorCastleStop();valorCastleRefresh();return}
 const active=valorCastleCalendar().active;if(!state.guild||!active)return;
 valorCastleData();
 valorCastleAuto={owner:state,guildId:state.guild.id,session:active.id};valorCastleAttack();valorCastleRefresh();
}
function valorCastleRows(rows){return rows.length?rows.map((row,index)=>'<div class="vc-rank"><b>'+(index+1)+'.</b><span>'+escapeAttr(row.name)+'</span><strong>'+money(row.score)+'<small>puan</small></strong></div>').join(''):'<p class="vc-empty">Henüz saldırı yapan birlik yok.</p>'}
function valorCastlePanel(now=Date.now()){
 const d=valorCastleData(now),schedule=valorCastleCalendar(now),active=schedule.active,war=active?d.sessions[active.id]:null,owner=valorCastleOwner(now),mine=owner&&owner.id===state.guild?.id;
 const ended=Object.values(d.sessions).filter(w=>w.settled).sort((a,b)=>b.start-a.start),last=ended[0],rows=active?valorCastleRank(Object.values(war?.guilds||{})):last?.rankings||[];
 return '<div class="vc-hero"><span>PAZARTESİ · ÇARŞAMBA · CUMA</span><h2>Kale Savaşı</h2><p>21.00 – 21.15 · Türkiye saati</p><b class="vc-phase '+(active?'vc-live':'')+'">'+(active?'SAVAŞ BAŞLADI · '+valorCastleTime(active.end-now):'Sonraki savaş: '+valorCastleDate(schedule.next.start))+'</b></div><p class="vc-local">YEREL DENEME · Puanlar ve ödüller yalnızca bu karakterin kaydında tutulur. Farklı cihazlardan ortak birlik savaşı için sunucu bağlantısı gerekir.</p><div class="vc-summary"><div><span>Kalenin Hakimi</span><b>'+(owner?escapeAttr(owner.name):'Henüz belirlenmedi')+'</b><small>'+(owner?'Hakimiyet sonu: '+valorCastleDate(owner.until):'Savaş sonunda belirlenir')+'</small></div><div><span>Altın Üretimi Bonusu</span><b>'+(mine?'+%25':'%0')+'</b><small>'+(mine?'Teknoloji → AFK Altın Üretimi':'Kazanan birliğe +%25')+'</small></div><div><span>Kale Madalyonu</span><b>'+valorCastleCurrency(d.medallions)+'</b><small>Kale Savaşı ödül bakiyen</small></div></div><div class="vc-battle"><h3>'+(active?'Kale kapılarına saldır':'Savaş hazırlığı')+'</h3><p>Her vuruşta toplam saldırının %50’si kadar hasar verirsin. Büyücüde sihirli saldırı esas alınır. 1 hasar = 1 birlik puanı; saniyede 1 saldırı yapılır.</p>'+(war?.lastHit?'<p class="vc-hit">Son vuruş: <b>'+money(war.lastHit.damage)+'</b>'+(war.lastHit.critical?' · Kritik!':'')+'</p>':'')+'<div class="vc-actions"><button type="button" '+(!active||!state.guild?'disabled':'')+' onclick="valorCastleAttack()">Saldır</button><button type="button" '+(!active||!state.guild?'disabled':'')+' onclick="valorCastleToggle()">'+(valorCastleAuto?'Saldırıyı Durdur':'Otomatik Saldırı')+'</button></div><small>'+(!state.guild?'Katılmak için önce birlik kurmalısın.':active?'Otomatik saldırı bu sayfa açık ve görünürken sürer.':'Saldırı butonları savaş saatinde açılır.')+'</small></div><div class="vc-board"><h3>'+(active?'Birlik Puanları':last?'Son Savaş Sıralaması':'Birlik Sıralaması')+'</h3>'+valorCastleRows(rows)+(last&&!active?'<p class="vc-date">'+valorCastleDate(last.start)+'</p>':'')+'</div><div class="vc-reward-table"><h3>Üye Başına Savaş Ödülleri</h3>'+[['1. birlik',500,125],['2. birlik',400,100],['3. birlik',300,75],['Diğer katılan birlikler',200,50]].map(([name,amount,fame])=>'<div><span>'+name+'</span><b>'+amount+' Madalyon<small>+'+fame+' Şöhret</small></b></div>').join('')+'<p>En az bir saldırıyla puan kazanan birlikler sıralanır. Eşit puanda son toplamına önce ulaşan birlik öne geçer. Ödüller savaş bitince bir kez eklenir; çevrimdışıysan girişinde işlenir.</p><p>Kale hakimiyeti bir sonraki savaşın 21.15’te bitişine kadar sürer. +%25 bonus yalnızca AFK altın üretimine uygulanır.</p></div>'+(last?.payouts?.[d.playerId]?'<div class="vc-receipt"><b>Son ödülün: '+last.payouts[d.playerId].amount+' Kale Madalyonu</b><span>'+last.payouts[d.playerId].rank+'. birlik · +'+valorCastleFame(last.payouts[d.playerId].rank)+' Şöhret · Ödüller eklendi</span></div>':'');
}
function valorCastleRefresh(){
 const panel=document.getElementById('valor-castle-panel');if(!panel||page!=='Birlik')return;
 const next=document.createElement('div');next.innerHTML=valorCastlePanel();
 // Preserve the attack buttons while refreshing the clock and scores.
 for(const selector of ['.vc-hero','.vc-summary','.vc-board','.vc-reward-table','.vc-receipt']){
  const old=panel.querySelector(selector),updated=next.querySelector(selector);
  if(old&&updated){if(old.outerHTML!==updated.outerHTML)old.replaceWith(updated)}else if(old)old.remove();else if(updated)panel.appendChild(updated);
 }
 const battle=panel.querySelector('.vc-battle'),updated=next.querySelector('.vc-battle');
 if(!battle||!updated)return;
 battle.querySelector('h3').textContent=updated.querySelector('h3').textContent;
 battle.querySelector(':scope > small').textContent=updated.querySelector(':scope > small').textContent;
 const buttons=battle.querySelectorAll('button'),nextButtons=updated.querySelectorAll('button');
 buttons.forEach((button,i)=>{button.disabled=nextButtons[i].disabled;button.textContent=nextButtons[i].textContent});
 const oldHit=battle.querySelector('.vc-hit'),newHit=updated.querySelector('.vc-hit');
 if(oldHit&&newHit)oldHit.replaceWith(newHit);else if(oldHit)oldHit.remove();else if(newHit)battle.querySelector('.vc-actions').before(newHit);
}
const valorCastlePreviousGuild=guild;
guild=function(){if(valorCastleSettle())save();return '<section class="valor-castle"><div id="valor-castle-panel">'+valorCastlePanel()+'</div><div class="vc-management">'+valorCastlePreviousGuild()+'</div></section>'};
const valorCastlePreviousTechnology=vsTechnology;
vsTechnology=function(){let html=valorCastlePreviousTechnology();const g=vaGoldData(),owner=valorCastleOwner(),bonus=owner?.id===state.guild?.id;if(bonus)html=html.replace('<b>'+money(g.level*100)+'</b> altın/dk','<b>'+money(g.level*125)+'</b> altın/dk').replace('<b>'+money(g.level*6000)+'</b> altın','<b>'+money(g.level*7500)+'</b> altın');return html.replace('<div class="vsys-gold-stats">','<p class="vc-production-note">Kale hakimiyeti: '+(bonus?'+%25 üretim bonusu aktif.':'Aktif kale bonusun yok.')+'</p><div class="vsys-gold-stats">')};
const valorCastlePreviousGo=go;
go=function(destination){valorCastleStop();return valorCastlePreviousGo(destination)};
setInterval(()=>{
 if(!state.class)return;
 if(valorCastleSettle())save();
 if(!valorCastleAuto||valorCastleAuto.owner!==state||page!=='Birlik'||document.hidden||valorCastleAuto.guildId!==state.guild?.id||valorCastleAuto.session!==valorCastleCalendar().active?.id)valorCastleStop();
 else valorCastleAttack();
 if(page==='Birlik'&&!document.hidden)valorCastleRefresh();
},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)valorCastleStop()});

/* Protected inventory mirror of the medallion wallet. */
function valorCastleMedalSync(){
 if(!state.class||!Array.isArray(state.inventory))return false;
 const amount=Math.max(0,Math.floor(Number(state.castleV1?.medallions)||0)),items=state.inventory.filter(it=>it.marketItemId==='castleMedallion');
 if(!amount){if(!items.length)return false;state.inventory=state.inventory.filter(it=>it.marketItemId!=='castleMedallion');return true}
 if(items.length===1&&items[0].count===amount)return false;
 const entry={...(items[0]||{id:valorUniqueItemId()}),slot:'Eşya',marketItemId:'castleMedallion',name:'Kale Madalyonu',count:amount};
 let inserted=false;state.inventory=state.inventory.flatMap(it=>{if(it.marketItemId!=='castleMedallion')return [it];if(inserted)return [];inserted=true;return [entry]});if(!inserted)state.inventory.push(entry);return true;
}
function valorCastleMedalIcon(){return '<img class="vc-currency-icon" src="'+VALOR_CASTLE_MEDAL_ART+'" alt="" aria-hidden="true" width="24" height="24">'}
function valorCastleCurrency(amount){return '<span class="vc-currency-value">'+valorCastleMedalIcon()+'<span>'+money(amount)+'</span></span>'}
function valorCastleMedalArt(){return '<img src="'+VALOR_CASTLE_MEDAL_ART+'" alt="Kale Madalyonu" style="width:100%;height:100%;object-fit:contain;display:block">'}
const valorCastlePreviousSave=save;
save=function(){valorCastleMedalSync();return valorCastlePreviousSave.apply(this,arguments)};
const valorCastlePreviousBag=bag;
bag=function(){if(valorCastleMedalSync())save();return valorCastlePreviousBag()};
const valorCastlePreviousEmoji=marketItemEmoji;
marketItemEmoji=function(id,it){return id==='castleMedallion'?valorCastleMedalArt():valorCastlePreviousEmoji(id,it)};
const valorCastlePreviousDescription=marketItemDescription;
marketItemDescription=function(id){return id==='castleMedallion'?'Kale Savaşı sonunda birlik sıralamana göre verilen ödül para birimi.':valorCastlePreviousDescription(id)};
const valorCastlePreviousMaterial=isDirectStoneMaterial;
isDirectStoneMaterial=function(id){return id==='castleMedallion'||valorCastlePreviousMaterial(id)};
const valorCastlePreviousDelete=deleteInventoryItem;
deleteInventoryItem=function(n){if(state.inventory[n]?.marketItemId==='castleMedallion')return toast('Kale Madalyonu silinemez');return valorCastlePreviousDelete(n)};
const valorCastlePreviousConsume=consumeMarketStack;
consumeMarketStack=function(n){if(state.inventory[n]?.marketItemId==='castleMedallion')return null;return valorCastlePreviousConsume(n)};
if(state.class){valorCastleSettle();valorCastleMedalSync();save()}
