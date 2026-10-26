/* A separate local Castle War simulation: five guilds with two fighters each, including the real character. */
const VALOR_CASTLE_TEST_DURATION=15*60000;
const VALOR_CASTLE_TEST_BOTS=[
 {id:'ashen',guild:'Kül Muhafızları',name:'Karaçelik',cls:'Savaşçı',power:185000,color:'#df9275'},
 {id:'violet',guild:'Mor Sancak',name:'Veylora',cls:'Büyücü',power:195000,color:'#c5a0f0'},
 {id:'emerald',guild:'Zümrüt Yemin',name:'Selvar',cls:'Okçu',power:205000,color:'#99cba2'},
 {id:'frost',guild:'Ayaz Birliği',name:'Buzpençe',cls:'Savaşçı',power:215000,color:'#9bcbe7'}
];
const VALOR_CASTLE_TEST_COMPANIONS={
 'my-guild':{id:'bot-ally',name:'Demiriz',cls:'Savaşçı',power:200000},
 ashen:{id:'bot-ashen-2',name:'Korhan',cls:'Okçu',power:215000},
 violet:{id:'bot-violet-2',name:'Saryel',cls:'Büyücü',power:205000},
 emerald:{id:'bot-emerald-2',name:'Yelora',cls:'Okçu',power:195000},
 frost:{id:'bot-frost-2',name:'Ayazhan',cls:'Savaşçı',power:185000}
};
function valorCastleTestAddFighters(run){
 for(const row of run.rows){
  if(!Array.isArray(row.fighters)){
   const first={...row.fighter,score:row.score,hits:row.hits,updatedAt:row.updatedAt};
   const bot=VALOR_CASTLE_TEST_COMPANIONS[row.id],stats=valorCastleTestStats(bot.power,bot.cls);
   row.fighters=[first,{...bot,stats,power:valorCastleTestPower(stats,bot.cls),score:0,hits:0,updatedAt:run.start}];
   row.members=row.fighters.map(f=>f.id);
  }
  row.fighter=row.fighters[0];
 }
 delete run.events;run.version=2;return run;
}
function valorCastleTestPlayers(run){
 return run.rows.flatMap(row=>row.fighters.map(f=>({...f,guildId:row.id,guildName:row.name,bot:f.id!=='test-player'})));
}
let valorCastleTestOwner=null,valorCastleTestLastReal=0;
let valorCastleTestRequested=new URLSearchParams(location.search).get('castleTest')==='1'&&valorTestMode();
function valorCastleTestStats(power,cls){
 const stats={Saldırı:0,Sihir:0,Savunma:Math.round(power*.15/10),'Sihir Savunma':Math.round(power*.15/10),Can:Math.round(power*.18/3),Kritik:Math.round(power*.02/4),Bloke:Math.round(power*.02/4)};
 stats[cls==='Büyücü'?'Sihir':'Saldırı']=Math.round(power*.45/10);
 stats[cls==='Büyücü'?'Saldırı':'Sihir']=Math.round(power*.03/3);return stats;
}
function valorCastleTestPower(stats,cls){const weights={Saldırı:cls==='Büyücü'?3:10,Sihir:cls==='Büyücü'?10:3,Savunma:10,'Sihir Savunma':10,Can:3,Kritik:4,Bloke:4};return Math.round(Object.keys(weights).reduce((sum,key)=>sum+(Number(stats[key])||0)*weights[key],0))}
function valorCastleTestCreate(stats,cls,name,guildName,now=Date.now()){
 const user={id:'test-player',name,cls,stats:{...stats},power:valorCastleTestPower(stats,cls)};
 const rows=[{id:'my-guild',name:guildName||'Deneme Birliğin',fighter:user,members:[user.id],score:0,hits:0,updatedAt:now},...VALOR_CASTLE_TEST_BOTS.map(bot=>{const stats=valorCastleTestStats(bot.power,bot.cls);return{id:bot.id,name:bot.guild,fighter:{id:'bot-'+bot.id,name:bot.name,cls:bot.cls,stats,power:valorCastleTestPower(stats,bot.cls)},members:['bot-'+bot.id],score:0,hits:0,updatedAt:now}})];
 return valorCastleTestAddFighters({version:2,start:now,elapsed:0,processedSecond:-1,phase:'running',speed:1,auto:false,lastPlayerAt:-1000,lastHit:0,rows,result:null});
}
function valorCastleTestRecord(run,row,stats,cls,at,fighter=row.fighters[0]){
 const hit=valorCastleStrike(stats,cls);row.score+=hit.damage;row.hits++;row.updatedAt=run.start+at;
 fighter.score+=hit.damage;fighter.hits++;fighter.updatedAt=run.start+at;
 if(fighter.id==='test-player'){run.lastPlayerAt=at;run.lastHit=hit.damage;fighter.stats={...stats};fighter.cls=cls;fighter.power=valorCastleTestPower(stats,cls)}
 return hit.damage;
}
function valorCastleTestFinish(run){
 if(run.result)return run.result;
 const result=valorCastlePayouts(run.rows),mine=result.payouts['test-player']||null;
 run.phase='finished';run.auto=false;run.result={rankings:result.rankings,payouts:result.payouts,mine,winner:result.rankings[0]?.name||null,goldBonus:result.rankings[0]?.id==='my-guild'?25:0};return run.result;
}
function valorCastleTestAdvance(run,elapsed,stats,cls){
 if(run.phase!=='running')return false;
 const next=Math.max(run.elapsed,Math.min(VALOR_CASTLE_TEST_DURATION,Number(elapsed)||0)),second=Math.min(899,Math.floor(next/1000));
 for(let tick=run.processedSecond+1;tick<=second;tick++){
  const at=tick*1000;
  for(const row of run.rows)for(const fighter of row.fighters){if(fighter.id==='test-player'){if(run.auto&&at-run.lastPlayerAt>=1000)valorCastleTestRecord(run,row,stats,cls,at,fighter)}else valorCastleTestRecord(run,row,fighter.stats,fighter.cls,at,fighter)}
 }
 run.processedSecond=second;run.elapsed=next;if(next>=VALOR_CASTLE_TEST_DURATION)valorCastleTestFinish(run);return true;
}
function valorCastleTestCanUse(){return !!state.class&&valorAccountCanPlay()&&page==='Kale Testi'}
function valorCastleTestRun(){const run=state.castleTestV1;return [1,2].includes(run?.version)?valorCastleTestAddFighters(run):null}
function valorCastleTestOpen(){valorCastleStop();go('Kale Testi')}
function valorCastleTestStart(){
 if(!valorCastleTestCanUse())return;
 const run=valorCastleTestCreate(valorArenaStats(),state.class,state.name||'Sen',state.guild?.name);
 state.castleTestV1=run;valorCastleTestOwner=state;valorCastleTestLastReal=Date.now();
 valorCastleTestAdvance(run,0,valorArenaStats(),state.class);save();render();
}
function valorCastleTestUpdate(now=Date.now()){
 const run=valorCastleTestRun();if(!valorCastleTestCanUse()||!run||run.phase!=='running'||document.hidden||valorCastleTestOwner!==state)return false;
 const delta=Math.max(0,now-valorCastleTestLastReal);valorCastleTestLastReal=now;
 if(!delta)return false;valorCastleTestAdvance(run,run.elapsed+delta*run.speed,valorArenaStats(),state.class);save();return true;
}
function valorCastleTestPause(){
 const run=valorCastleTestRun();if(!run||run.phase!=='running')return;
 valorCastleTestUpdate();if(run.phase==='running')run.phase='paused';run.auto=false;valorCastleTestOwner=null;save();
}
function valorCastleTestTogglePause(){
 if(!valorCastleTestCanUse())return;const run=valorCastleTestRun();if(!run||run.phase==='finished')return;
 if(run.phase==='running')valorCastleTestPause();else{run.phase='running';valorCastleTestOwner=state;valorCastleTestLastReal=Date.now();save()}
 valorCastleTestRefresh();
}
function valorCastleTestAttack(){
 if(!valorCastleTestCanUse()||document.hidden)return false;const run=valorCastleTestRun();if(!run||run.phase!=='running'||valorCastleTestOwner!==state)return false;
 valorCastleTestUpdate();if(run.phase!=='running'||run.elapsed-run.lastPlayerAt<1000)return false;
 valorCastleTestRecord(run,run.rows[0],valorArenaStats(),state.class,run.elapsed);save();valorCastleTestRefresh();return true;
}
function valorCastleTestToggleAuto(){
 if(!valorCastleTestCanUse()||document.hidden)return;const run=valorCastleTestRun();if(!run||run.phase!=='running')return;
 valorCastleTestUpdate();if(run.phase!=='running')return;run.auto=!run.auto;if(run.auto)valorCastleTestAttack();save();valorCastleTestRefresh();
}
function valorCastleTestSetSpeed(value){
 if(!valorCastleTestCanUse())return;const speed=Number(value);if(![1,10,30].includes(speed))return;
 valorCastleTestUpdate();const run=valorCastleTestRun();if(!run||run.phase==='finished')return;run.speed=speed;valorCastleTestLastReal=Date.now();save();valorCastleTestRefresh();
}
function valorCastleTestFastForward(){
 if(!valorCastleTestCanUse()||document.hidden)return;const run=valorCastleTestRun();if(!run||run.phase!=='running')return;
 valorCastleTestAdvance(run,VALOR_CASTLE_TEST_DURATION,valorArenaStats(),state.class);save();valorCastleTestRefresh();
}
function valorCastleTestBoard(run){
 const rows=run?run.rows:[...valorCastleTestCreate(valorArenaStats(),state.class,state.name||'Sen',state.guild?.name).rows];
 const sorted=rows.slice().sort((a,b)=>b.score-a.score||a.updatedAt-b.updatedAt||a.id.localeCompare(b.id));
 return sorted.map((row,index)=>'<article class="vct-row '+(row.id==='my-guild'?'vct-mine':'')+'"><span class="vct-rank">'+(index+1)+'</span><div><h3>'+escapeAttr(row.name)+(row.id==='my-guild'?' <small>SENİN BİRLİĞİN</small>':' <small>TEST BOTU</small>')+'</h3><p>'+row.fighters.map(f=>escapeAttr(f.name)).join(' · ')+'</p><span>'+row.fighters.length+' savaşçı · '+money(row.fighters.reduce((sum,f)=>sum+f.power,0))+' toplam SG'+'</span></div><strong>'+money(row.score)+'<small>'+money(row.hits)+' saldırı</small></strong></article>').join('');
}
function valorCastleTestResult(run){
 if(!run?.result)return '';
 const result=run.result,mine=result.mine;
 return '<section class="vct-result"><span>DENEME TAMAMLANDI</span><h2>'+escapeAttr(result.winner||'Katılan birlik yok')+'</h2><p>'+(result.winner?'Test kalesinin hakimi':'Sonuç oluşmadı')+'</p><div class="vct-result-grid"><div><small>Senin sıran</small><b>'+(mine?mine.rank+'.':'Katılmadın')+'</b></div><div><small>Dukat önizlemesi</small><b>'+valorCastleCurrency(mine?.amount||0)+'</b></div><div><small>Şöhret önizlemesi</small><b>+'+money(mine?.fame||0)+'</b></div></div><p>'+(result.goldBonus?'Senin birliğin kazandı: +%25 altın üretimi bonusu önizlemesi.':'Kazanan birlik: +%25 altın üretimi bonusu önizlemesi.')+'</p><small>Deneme ödülleri ve kale hakimiyeti gerçek bakiyene uygulanmaz.</small></section>';
}
function valorCastleTestLive(run){
 const running=run?.phase==='running',finished=run?.phase==='finished',left=VALOR_CASTLE_TEST_DURATION-(run?.elapsed||0),my=run?.rows[0];
 return '<div class="vct-status"><span>'+(!run?'HAZIR':finished?'TAMAMLANDI':running?'SAVAŞ SÜRÜYOR':'DURAKLATILDI')+'</span><strong>'+valorCastleTime(left)+'</strong><p>Birliğinin puanı: <b>'+money(my?.score||0)+'</b><br>Senin toplam hasarın: <b>'+money(my?.fighters?.find(f=>f.id==='test-player')?.score||0)+'</b> · Son vuruş: <b>'+money(run?.lastHit||0)+'</b></p></div><div class="vct-controls">'+(!run||finished?'<button type="button" onclick="valorCastleTestStart()">'+(finished?'Yeni Deneme Başlat':'Denemeyi Başlat')+'</button>':'<div class="vct-actions"><button type="button" data-vct="attack" '+(!running?'disabled':'')+' onclick="valorCastleTestAttack()">Saldır</button><button type="button" data-vct="auto" '+(!running?'disabled':'')+' onclick="valorCastleTestToggleAuto()">'+(run.auto?'Otomatik Saldırıyı Durdur':'Otomatik Saldırı')+'</button><button type="button" data-vct="pause" onclick="valorCastleTestTogglePause()">'+(running?'Duraklat':'Devam Et')+'</button><button type="button" data-vct="finish" '+(!running?'disabled':'')+' onclick="valorCastleTestFastForward()">Kalan Süreyi Oynat</button></div><label class="vct-speed">Test hızı<select aria-label="Test hızı" onchange="valorCastleTestSetSpeed(this.value)">'+[1,10,30].map(speed=>'<option value="'+speed+'" '+(run.speed===speed?'selected':'')+'>'+speed+'×'+(speed===1?' · Gerçek süre':'')+'</option>').join('')+'</select></label>')+'</div><div class="vct-roster"><h2>Birlik Sıralaması</h2>'+valorCastleTestBoard(run)+'</div>'+valorCastleTestResult(run)+valorCastlePlayerLeaderboard(run?valorCastleTestPlayers(run):[],'test-player',running?'CANLI':finished?'SONUÇ':'BEKLEMEDE');
}
function valorCastleTestPage(){
 return '<section class="vct-page"><header class="vct-hero"><small>KALE SAVAŞI · TEST ALANI</small><h1>Beş Sancak, Tek Kale</h1><p>Senin birliğin + 4 test birliği.<br>Botların ortalama savaş gücü: <b>200.000 SG</b></p><button type="button" onclick="go(\'Birlik\')">‹ Birliğe Dön</button></header><p class="vct-note">Bu denemede 5 birlik ve toplam 10 savaşçı var. Kendi karakterinle oynarsın; diğer savaşçılar test botlarıdır. Her saldırı, sınıfın ana saldırı değerinin %50’si kadar puan kazandırır. Saniyede 1 saldırı yapılır.</p><p class="vct-note">15 dakikalık denemeyi 10× / 30× hızlandırabilir veya kalan süreyi oynatabilirsin. Kalan süre oynatılırken sen yalnızca otomatik saldırın açıksa vurmaya devam edersin. Sayfadan ayrılınca veya ekran kapanınca test duraklar.</p><div id="valor-castle-test-live">'+valorCastleTestLive(valorCastleTestRun())+'</div></section>';
}
function valorCastleTestRefresh(){
 if(!valorCastleTestCanUse())return;const box=document.getElementById('valor-castle-test-live');if(!box)return;
 const next=document.createElement('div');next.innerHTML=valorCastleTestLive(valorCastleTestRun());
 // Keep action controls mounted while refreshing timer and live guild/player standings.
 for(const selector of ['.vct-status','.vct-roster','.vct-result','.vc-player-board']){const old=box.querySelector(selector),fresh=next.querySelector(selector);if(old&&fresh){if(old.outerHTML!==fresh.outerHTML)old.replaceWith(fresh)}else if(old)old.remove();else if(fresh){if(selector==='.vct-result'&&box.querySelector('.vc-player-board'))box.querySelector('.vc-player-board').before(fresh);else box.appendChild(fresh)}}
 const current=box.querySelector('.vct-controls'),fresh=next.querySelector('.vct-controls');
 if(!current||!fresh)return;
 if(current.querySelector('[data-vct]')&&fresh.querySelector('[data-vct]')){for(const button of current.querySelectorAll('[data-vct]')){const other=fresh.querySelector('[data-vct="'+button.dataset.vct+'"]');button.disabled=other.disabled;button.textContent=other.textContent}const select=current.querySelector('select');if(select)select.value=String(valorCastleTestRun().speed)}else if(current.outerHTML!==fresh.outerHTML)current.replaceWith(fresh);
}
const valorCastleTestPreviousGuild=guild;
guild=function(){return '<div class="vct-entry"><button type="button" onclick="valorCastleTestOpen()">Kale Savaşı Testi · 5 Birlik ›</button></div>'+valorCastleTestPreviousGuild()};
const valorCastleTestPreviousGo=go;
go=function(destination){if(page==='Kale Testi'&&destination!=='Kale Testi')valorCastleTestPause();return valorCastleTestPreviousGo(destination)};
const valorCastleTestPreviousRender=render;
render=function(){
 if(valorCastleTestRequested&&state.class&&valorAccountCanPlay()){valorCastleTestRequested=false;page='Kale Testi'}
 const result=valorCastleTestPreviousRender.apply(this,arguments);
 if(valorCastleTestCanUse()){const run=valorCastleTestRun();if(run?.phase==='running'&&valorCastleTestOwner!==state){run.phase='paused';run.auto=false;save()}document.getElementById('main').innerHTML=valorCastleTestPage()}
 return result;
};
setInterval(()=>{if(valorCastleTestUpdate())valorCastleTestRefresh()},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden){valorCastleTestPause();valorCastleTestRefresh()}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(new URLSearchParams(location.search).get('castleTest')==='1'&&valorTestMode()&&state.class&&valorAccountCanPlay()){valorCastleTestRequested=false;valorCastleTestOpen()}},{once:true});
render();
