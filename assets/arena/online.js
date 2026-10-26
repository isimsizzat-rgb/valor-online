/* Solo arena against real players (signed-in cloud accounts).
   Rivals are other players' saved combat profiles, closest to my power. The fight runs locally with the
   same engine (fury, guardians, astrology, medallions) and is then reported to the server, which keeps
   the 10-per-day limit and shows defenders who attacked them. Guests keep the sample rivals. */
const VALOR_ARENA_ONLINE_TTL=120000;
const valorArenaOnline={rivals:null,top:null,myRank:null,defenses:null,at:0,loading:false,error:''};
function valorArenaIsOnline(){return !!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
function valorArenaRpc(name,body){return valorCloudFetch('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body||{})})}
function valorArenaPortrait(cls,gender){return typeof valorCreationPortrait==='function'?valorCreationPortrait(cls,gender):heroImages[Math.max(0,classes.indexOf(cls))]}
async function valorArenaOnlineLoad(force){
 const o=valorArenaOnline;if(o.loading||(!force&&o.at&&Date.now()-o.at<VALOR_ARENA_ONLINE_TTL))return;
 o.loading=true;o.error='';
 try{
  if(typeof valorCloudFlush==='function')await valorCloudFlush().catch(()=>{});
  const uid=valorAccountActive.id;
  const [rivals,top,my,defs]=await Promise.all([
   valorArenaRpc('arena_rivals',{lim:15}),
   valorArenaRpc('arena_top',{lim:10}).catch(()=>[]),
   valorArenaRpc('arena_my_rank').catch(()=>null),
   valorCloudFetch('/rest/v1/arena_log?select=attacker_name,win,draw,rounds,created_at&defender=eq.'+encodeURIComponent(uid)+'&order=created_at.desc&limit=10').catch(()=>[])
  ]);
  o.rivals=(Array.isArray(rivals)?rivals:[]).filter(r=>r&&r.combat&&classes.includes(r.class)).map((r,i)=>({id:1000+i,uid:r.id,name:r.name,cls:r.class,level:r.level,power:Number(r.power)||0,wins:Number(r.arena_wins)||0,combatStats:r.combat,portrait:valorArenaPortrait(r.class,r.profile?.gender)})).sort((a,b)=>b.power-a.power);
  o.top=Array.isArray(top)?top:[];o.myRank=typeof my==='number'?my:null;o.defenses=Array.isArray(defs)?defs:[];o.at=Date.now();
  valorArenaNotifyDefenses();
 }catch(e){o.at=Date.now();o.error=(e.status===404||e.code==='PGRST202')?'Gerçek oyuncu arenası sunucuda henüz kurulmadı.':e.message}
 finally{o.loading=false;if(page==='Savaş')render()}
}
/* New defense results since the last visit appear once as a toast. */
function valorArenaNotifyDefenses(){const list=valorArenaOnline.defenses||[];if(!list.length)return;const d=valorArenaData(),seen=Number(d.defenseSeen)||0,fresh=list.filter(x=>Date.parse(x.created_at)>seen);if(!fresh.length)return;d.defenseSeen=Math.max(...list.map(x=>Date.parse(x.created_at)||0));save();const lost=fresh.filter(x=>x.win).length,held=fresh.length-lost;toast('Sen yokken '+fresh.length+' kez saldırıya uğradın · '+held+' savunma kazandın, '+lost+' kaybettin')}
function valorArenaAgo(iso){const m=Math.max(0,Math.round((Date.now()-Date.parse(iso))/60000));return m<1?'az önce':m<60?m+' dk önce':m<1440?Math.round(m/60)+' sa önce':Math.round(m/1440)+' gün önce'}

const valorArenaOfflineCandidates=valorArenaCandidates;
valorArenaCandidates=function(){if(!valorArenaIsOnline())return valorArenaOfflineCandidates.apply(this,arguments);return valorArenaOnline.rivals||[]};

function valorArenaOnlinePage(){
 const o=valorArenaOnline,d=valorArenaData(),remaining=Math.max(0,10-d.used);valorArenaOnlineLoad();
 const myPower=Math.max(1,combatPower());
 const tag=p=>{const r=p.power/myPower;return r<.85?['Kolay','#8be0a3']:r<=1.15?['Denk','#f3d294']:['Zor','#e3a08f']};
 let rivals;
 if(o.rivals&&o.rivals.length)rivals='<div class="arena-rivals">'+o.rivals.map(p=>{const [t,c]=tag(p);return '<article class="arena-rival"><img src="'+p.portrait+'" alt="'+p.cls+'"><div><b>'+escapeAttr(p.name)+'</b><small>'+p.cls+' · Sv. '+p.level+' · '+money(p.power)+' güç</small><small class="arena-difficulty" style="color:'+c+'">'+t+' · '+money(p.wins)+' zafer</small></div><button type="button" '+(!remaining?'disabled':'')+' onclick="valorArenaFight('+p.id+')">Savaş</button></article>'}).join('')+'</div>';
 else if(o.error)rivals='<div class="vro-state"><p>'+escapeAttr(o.error)+'</p><button type="button" onclick="valorArenaOnlineLoad(true)">Tekrar Dene</button></div>';
 else if(o.rivals)rivals='<div class="vro-state"><p>Henüz savaşabileceğin başka oyuncu yok. Denk Rakip ile pratik yapabilirsin.</p></div>';
 else rivals='<div class="vro-state"><p>Rakipler yükleniyor…</p></div>';
 const top=(o.top||[]).map((p,i)=>'<div class="arena-rank-row '+(p.is_me?'arena-me':'')+'">'+valorArenaBadge(Number(p.rank)||i+1)+'<div><b>'+escapeAttr(p.name)+(p.is_me?' <small>(Sen)</small>':'')+'</b><small>'+escapeAttr(p.class||'')+' · Sv. '+p.level+'</small></div><strong>'+money(p.is_me?d.wins:p.arena_wins)+'<small>Zafer</small></strong></div>').join('');
 const defs=(o.defenses||[]).map(x=>'<div class="vao-def '+(x.win?'lost':x.draw?'draw':'held')+'"><b>'+escapeAttr(x.attacker_name||'Bir oyuncu')+'</b><span>'+(x.draw?'Berabere':x.win?'Savunmayı kaybettin':'Savunmayı kazandın')+'</span><small>'+valorArenaAgo(x.created_at)+'</small></div>').join('');
 return '<section class="valor-arena"><div class="arena-heading"><h1>Zafer Arenası</h1></div><div class="arena-summary"><div><span>Günlük Hak</span><b>'+remaining+'<small>/10</small></b></div><div><span>Zaferlerin</span><b>'+money(d.wins)+'</b></div><div><span>Arena Sıran</span><b>'+(o.myRank?'#'+o.myRank:'—')+'</b></div></div>'
  +valorArenaTrainingCard()
  +'<div class="arena-section-heading"><h2>Rakibini Seç</h2><span>Gerçek oyuncular <button type="button" class="vro-refresh" onclick="valorArenaOnlineLoad(true)" aria-label="Rakipleri yenile">↻</button></span></div>'+rivals
  +'<div class="arena-section-heading"><h2>Savunma Kayıtları</h2><span>Son 10</span></div>'+(defs?'<div class="vao-defs">'+defs+'</div>':'<p class="arena-range-note">Henüz kimse sana saldırmadı.</p>')
  +'<div class="arena-section-heading"><h2>Zafer Sıralaması</h2><span>İlk 10</span></div><div class="arena-ranking">'+(top||'<p class="arena-range-note">Sıralama yükleniyor…</p>')+'</div>'+(o.myRank>10?'<div class="arena-own-rank">Arena sıran: <b>#'+o.myRank+'</b></div>':'')+'</section>';
}
const valorArenaOfflinePage=valorArenaPage;
valorArenaPage=function(){
 const html=valorArenaOfflinePage.apply(this,arguments);
 if(!valorArenaIsOnline()||(typeof valorArenaMode!=='undefined'&&valorArenaMode==='team'))return html;
 const i=html.indexOf('<section class="valor-arena">');return (i>=0?html.slice(0,i):'')+valorArenaOnlinePage();
};

/* Rewards are the same as before: +5 fame, +500 gold, 10% luck stone on a win. */
function valorArenaOnlineFinish(rival,battle){
 const d=valorArenaData();d.used++;let gold=0,stone=0;
 if(battle.win){d.wins++;state.fame=(Number(state.fame)||0)+5;gold=500;state.gold+=gold;if(Math.random()<.10){const roll=Math.random();stone=roll<.60?1:roll<.90?2:3;addLuckStoneStack(stone,1)}}
 else if(battle.draw)d.draws=(d.draws||0)+1;else d.losses++;
 const result={...battle,opponent:rival.name,gold,stone,fame:battle.win?5:0,rank:null,oldRank:null,at:Date.now()};
 d.last=result;d.history.unshift({...result,log:undefined});d.history=d.history.slice(0,20);save();render();valorArenaResult(result);
 valorArenaRpc('arena_report',{target:rival.uid,won:!!battle.win,was_draw:!!battle.draw,fight_rounds:battle.rounds|0}).then(r=>{if(r==='limit')toast('Sunucu: bugünkü 10 savaş hakkın dolmuş.')}).catch(()=>{});
 valorArenaOnline.at=0; // refresh rivals, ranking and my position next time
}
const valorArenaOfflineFight=valorArenaFight;
valorArenaFight=function(id){
 if(!valorArenaIsOnline())return valorArenaOfflineFight.apply(this,arguments);
 if(page!=='Savaş'||!state.class||valorArenaPendingBattle||document.getElementById('valor-arena-result'))return;
 if(valorArenaData().used>=10)return toast('Bugünkü 10 savaş hakkını kullandın');
 const rival=(valorArenaOnline.rivals||[]).find(p=>p.id===id);if(!rival)return;
 const mine=valorArenaStats(),battle=valorArenaWithFury(()=>valorBattleAnimPrevSimulate(mine,state.class,{...rival.combatStats},rival.cls));
 valorBattlePlay({left:{name:state.name||'Sen',portrait:valorBattlePortraitMine(),sub:state.class+' · Sv. '+state.level,maxHp:battle.myMaxHp},right:{name:rival.name,portrait:rival.portrait,sub:rival.cls+' · Sv. '+rival.level,maxHp:battle.enemyMaxHp},battle,meFirst:(battle.log?.[0]?.events?.[0]?.side||'me')==='me',
  onDone:()=>valorArenaOnlineFinish(rival,battle)});
};
if(state.class&&page==='Savaş')render();
