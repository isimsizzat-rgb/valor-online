/* Real Team Arena (signed-in cloud accounts). Rooms, passwords, invites and members live on the server.
   The leader starts the fight: rivals are random real players (not matched by power), the fight runs on the
   leader's screen with the same engine, and the stored result plays on every member's screen. Members who
   close the game drop out of the room after 45 seconds. Without the server functions the local version stays. */
const valorTeamNet={lobby:null,lobbyAt:0,room:undefined,stateAt:0,cands:null,top:null,myRank:null,topAt:0,busy:false,unavailable:false};
function valorTeamIsOnline(){return !valorTeamNet.unavailable&&!!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
function valorTeamRpc(name,body){return valorCloudFetch('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body||{})})}
function valorTeamMissing(e){if(e&&(e.status===404||e.code==='PGRST202')){valorTeamNet.unavailable=true;return true}return false}
function valorTeamMsg(r){return {closed:'Takım Arenası şu an kapalı.',already:'Zaten bir odadasın.',full:'Bu oda dolu.',gone:'Bu oda artık yok.',wrong_password:'Şifre yanlış.',not_leader:'Bunu yalnızca oda lideri yapabilir.',busy:'Bu oyuncu başka bir odada.'}[r]||'İşlem yapılamadı.'}
function valorTeamRedraw(){if(page==='Savaş'&&valorArenaMode==='team'&&!document.getElementById('valor-arena-result')&&!valorArenaPendingBattle&&!document.querySelector('.vt-page input:focus'))render()}

/* Server room → the local room object the existing page draws. */
function valorTeamMirror(room){
 const d=valorTeamData(),me=valorAccountActive.id;
 if(!room){if(d.room){d.room=null;valorTeamInviteOpen=false}return}
 const others=(room.members||[]).filter(m=>m.user_id!==me),base=Math.max(1,combatPower());
 d.room={id:room.id,name:room.name,capacity:VALOR_TEAM_CAPACITY,password:room.locked?'•':'',own:room.leader===me,server:true,leader:room.leader,
  members:others.map(m=>({id:m.user_id,name:m.name||'Oyuncu',cls:m.class,level:m.level||1,portrait:valorArenaPortrait(m.class,m.profile?.gender),ratio:(Number(m.power)||0)/base,power:Number(m.power)||0,combat:m.combat,left:m.left,leader:m.user_id===room.leader})),
  meLeft:(room.members||[]).find(m=>m.user_id===me)?.left};
 if(d.room.members.length&&!d.room.own){const i=d.room.members.findIndex(m=>m.leader);if(i>0)d.room.members.unshift(d.room.members.splice(i,1)[0])}
}
async function valorTeamPoll(force){
 const n=valorTeamNet;if(!valorTeamIsOnline()||!state.class||n.polling)return;n.polling=true;
 try{
  const st=await valorTeamRpc('team_state');const room=st?.room||null,prevId=n.room?.id;n.room=room;n.stateAt=Date.now();
  valorTeamMirror(room);valorTeamCheckResult(room,prevId);
  if(!room&&(force||!n.lobbyAt||Date.now()-n.lobbyAt>5000)){n.lobby=await valorTeamRpc('team_lobby');n.lobbyAt=Date.now();const d=valorTeamData();if(Number.isFinite(n.lobby?.used))d.used=Math.max(d.used,n.lobby.used);if(Number.isFinite(n.lobby?.rating))d.rating=n.lobby.rating}
  if(force||!n.topAt||Date.now()-n.topAt>30000){const [top,my]=await Promise.all([valorTeamRpc('team_top',{lim:10}),valorTeamRpc('team_my_rank').catch(()=>null)]);n.top=Array.isArray(top)?top:[];n.myRank=typeof my==='number'?my:null;n.topAt=Date.now()}
  valorTeamRedraw();
 }catch(e){valorTeamMissing(e)}
 finally{n.polling=false}
}
async function valorTeamAct(name,body,ok,after){
 const n=valorTeamNet;if(n.busy)return;n.busy=true;
 try{const r=await valorTeamRpc(name,body);if(r==='ok'){if(ok)valorTeamNotice=ok;if(after)after()}else valorTeamNotice=valorTeamMsg(r);return r}
 catch(e){if(!valorTeamMissing(e))valorTeamNotice=e.message}
 finally{n.busy=false;n.lobbyAt=0;await valorTeamPoll(true);render()}
}

/* A new result on my room: the leader already saw it; everyone else watches it now and gets the rewards. */
function valorTeamCheckResult(room,prevId){
 const d=valorTeamData(),me=valorAccountActive.id;if(!room){return}
 const key=room.id+':'+room.result_id,seen=d.seenResult;
 if(!seen||seen.split(':')[0]!==room.id||prevId!==room.id&&!seen){d.seenResult=key;return}
 if(seen===key||!room.result||room.result.reporter===me){d.seenResult=key;return}
 d.seenResult=key;
 const prep=valorTeamFillPrep(JSON.parse(JSON.stringify(room.result)));
 if(!prep.start.some(u=>u.me))return; // I joined after this fight started
 const finish=()=>valorTeamApplyResult(prep);
 if(!(typeof valorTeamPlay==='function'&&page==='Savaş'&&valorTeamPlay(prep,finish)))finish();
}
/* Server results carry no portraits; add them (and mark which fighter is me). */
function valorTeamFillPrep(prep){
 const me=valorAccountActive.id,mine=document.getElementById('valor-hud-portrait')?.src;
 const fill=u=>{u.me=u.uid===me;u.portrait=u.portrait||(u.me&&mine)||valorArenaPortrait(u.cls,u.gender)};
 (prep.start||[]).forEach(fill);(prep.battle?.units||[]).forEach(fill);return prep;
}
function valorTeamApplyResult(prep){
 const d=valorTeamData(),battle=prep.battle;d.used++;let gold=0,fame=0,delta=0;
 if(battle.win){d.wins++;gold=VALOR_TEAM_WIN_GOLD;fame=VALOR_TEAM_WIN_FAME;state.gold+=gold;state.fame=(Number(state.fame)||0)+fame;delta=VALOR_TEAM_RATING_WIN}
 else if(battle.draw)d.draws++;else{d.losses++;delta=-Math.min(d.rating,VALOR_TEAM_RATING_LOSS)}
 d.rating+=delta;
 const result={...battle,size:prep.size,label:prep.label,gold,fame,delta,rating:d.rating,room:d.room?.name||'',at:Date.now()};
 d.history.unshift({win:battle.win,draw:battle.draw,size:prep.size,label:prep.label,rounds:battle.rounds,delta,at:result.at});d.history=d.history.slice(0,20);
 save();render();valorTeamShowResult(result);valorTeamNet.topAt=0;
}

(function(){
 const off={};
 const wrap=(name,fn)=>{off[name]=window[name];window[name]=function(){return valorTeamIsOnline()?fn.apply(this,arguments):off[name].apply(this,arguments)}};
 wrap('valorTeamRoomSource',function(){
  if(!valorTeamNet.lobby)valorTeamPoll(true);
  return (valorTeamNet.lobby?.rooms||[]).map(r=>({id:r.id,name:r.name,capacity:VALOR_TEAM_CAPACITY,locked:!!r.locked,password:r.locked?'•':'',members:Array.from({length:Number(r.members)||1},(_,i)=>({name:i?'Üye':(r.leader_name||'-')}))}));
 });
 wrap('valorTeamRefreshRooms',function(){valorTeamNotice='Oda listesi yenilendi.';valorTeamPoll(true).then(render)});
 wrap('valorTeamCreateRoom',function(){
  if(!valorTeamOpen())return valorTeamClosedNotice();
  const name=(document.getElementById('vt-room-name')?.value||'').trim().slice(0,24),pass=(document.getElementById('vt-room-pass')?.value||'').trim().slice(0,12);
  valorTeamAct('team_create',{rname:name,pass},'Odan kuruldu. Takım arkadaşlarını davet et ya da tek başına savaşa gir.',()=>{valorTeamInviteOpen=true});
 });
 wrap('valorTeamJoinStart',function(id){if(!valorTeamOpen())return valorTeamClosedNotice();const r=(valorTeamNet.lobby?.rooms||[]).find(x=>x.id===id);if(r?.locked){valorTeamJoinTarget=id;render();return}valorTeamJoin(id,'')});
 wrap('valorTeamJoin',function(id,pass){valorTeamJoinTarget=null;valorTeamAct('team_join',{rid:id,pass:pass||''},'Odaya katıldın.')});
 wrap('valorTeamLeave',function(){valorTeamInviteOpen=false;valorTeamAct('team_leave',{},'Odadan çıktın.',()=>{valorTeamData().room=null})});
 wrap('valorTeamKick',function(id){valorTeamAct('team_kick',{target:id},'Oyuncu odadan çıkarıldı.')});
 wrap('valorTeamInviteCandidates',function(){
  if(!valorTeamNet.cands&&!valorTeamNet.candsLoading){valorTeamNet.candsLoading=true;valorTeamRpc('team_invite_candidates').then(r=>{valorTeamNet.cands=Array.isArray(r)?r:[];valorTeamNet.candsAt=Date.now()}).catch(()=>{valorTeamNet.cands=[]}).finally(()=>{valorTeamNet.candsLoading=false;valorTeamRedraw()})}
  else if(valorTeamNet.candsAt&&Date.now()-valorTeamNet.candsAt>20000)valorTeamNet.cands=null;
  return (valorTeamNet.cands||[]).map(p=>({id:p.user_id,name:p.name,cls:p.class,level:p.level}));
 });
 wrap('valorTeamInvite',function(id){valorTeamAct('team_invite',{target:id},'Davet gönderildi. Oyuncu kabul edince odana gelir.')});
 wrap('valorTeamRanking',function(){
  const rows=(valorTeamNet.top||[]).map(p=>({name:p.name,level:p.level,rating:p.team_rating,me:p.is_me}));
  if(!rows.some(r=>r.me))rows.push({name:state.name||'Oyuncu',level:state.level,rating:valorTeamData().rating,me:true});
  return rows;
 });
 wrap('valorTeamFight',async function(){
  if(page!=='Savaş'||!state.class||valorArenaPendingBattle||document.getElementById('valor-arena-result'))return;
  if(!valorTeamOpen())return valorTeamClosedNotice();
  const d=valorTeamData(),room=d.room;if(!room)return;
  if(!room.own){valorTeamNotice='Savaşı oda lideri başlatır. Lider başlatınca savaş senin ekranında da oynar.';render();return}
  if(valorTeamRemaining()<1){valorTeamNotice='Bugünkü '+VALOR_TEAM_DAILY+' takım savaşı hakkını kullandın.';render();return}
  if(valorTeamNet.busy)return;valorTeamNet.busy=true;
  try{
   if(typeof valorCloudFlush==='function')await valorCloudFlush().catch(()=>{});
   // The server picks the rivals and computes the fight (arena-fight function); local only if it is not deployed yet.
   const srv=typeof valorFightCall==='function'?await valorFightCall({mode:'team'}):{missing:true};
   if(!srv.missing){
    if(!srv.prep){valorTeamNotice=valorFightError(srv.error);render();return}
    const prep=valorTeamFillPrep(srv.prep);
    const done=()=>valorTeamApplyResult(prep);
    if(!(typeof valorTeamPlay==='function'&&valorTeamPlay(prep,done)))done();
    return;
   }
   const me=valorAccountActive.id,size=1+room.members.length,rivalSize=Math.random()<VALOR_TEAM_RIVAL3_CHANCE?3:2;
   let rivals=await valorTeamRpc('team_rivals',{n:rivalSize});rivals=(Array.isArray(rivals)?rivals:[]).filter(r=>r.combat&&classes.includes(r.class));
   const teamA=[valorTeamUnit(state.name||'Sen',state.class,valorArenaStats(),'A',true,document.getElementById('valor-hud-portrait')?.src,state.level),...room.members.map(m=>valorTeamUnit(m.name,m.cls,m.combat?{...m.combat}:valorTeamBotStats(Math.max(.1,m.ratio),m.cls),'A',false,m.portrait,m.level))];
   const uidsA=[me,...room.members.map(m=>m.id)];
   const teamB=rivals.map(r=>valorTeamUnit(r.name,r.class,{...r.combat},'B',false,valorArenaPortrait(r.class,r.profile?.gender),r.level));const uidsB=rivals.map(r=>r.user_id);
   for(const p of valorTeamPick(Math.max(0,rivalSize-teamB.length))){teamB.push(valorTeamUnit(p.name,p.cls,p.combatStats?{...p.combatStats}:valorTeamBotStats(.3+Math.random()*2.7,p.cls),'B',false,valorTeamPortrait(p),p.level));uidsB.push(null)}
   const uids=[...uidsA,...uidsB],start=[...teamA,...teamB].map((u,i)=>({uid:uids[i],name:u.name,cls:u.cls,side:u.side,me:u.me,maxHp:u.maxHp,portrait:u.portrait,level:u.level}));
   const battle=valorArenaWithFury(()=>valorTeamSimulate(teamA,teamB));(battle.units||[]).forEach((u,i)=>u.uid=uids[i]);
   if(battle.log.length>150)battle.log=battle.log.slice(0,150);
   const prep={reporter:me,size,rivalSize:teamB.length,label:size+'v'+teamB.length,start,battle};
   const r=await valorTeamRpc('team_report',{fight:prep,won:!!battle.win,was_draw:!!battle.draw});
   if(r!=='ok'){valorTeamNotice=String(r).startsWith('limit:')?String(r).slice(6)+' bugünkü takım savaşı hakkını doldurdu.':valorTeamMsg(r);render();return}
   const done=()=>valorTeamApplyResult(prep);
   if(!(typeof valorTeamPlay==='function'&&valorTeamPlay(prep,done)))done();
  }catch(e){if(!valorTeamMissing(e)){valorTeamNotice=e.message;render()}}
  finally{valorTeamNet.busy=false;setTimeout(()=>valorTeamPoll(true),1500)}
 });
 const prevPage=valorTeamPage;
 valorTeamPage=function(){
  let html=prevPage.apply(this,arguments);if(!valorTeamIsOnline())return html;
  const n=valorTeamNet,d=valorTeamData();
  if(n.myRank)html=html.replace(/(<span>Sıran<\/span><b>)#\d+/,'$1#'+n.myRank);
  html=html.replace(/<p class="vc-local">[\s\S]*?<\/p>/,'<p class="vc-local vc-online">Odalar ve takım arkadaşların gerçek oyuncular · rakipler rastgele seçilen gerçek oyunculardır.'+(d.room&&!d.room.own?' Savaşı oda lideri başlatır.':'')+'</p>');
  const inv=(!d.room&&n.lobby?.invites)||[];
  if(inv.length&&valorTeamOpen())html=html.replace('<section class="vt-create">','<section class="vt-invites"><div class="arena-section-heading"><h2>Davetler</h2><span>'+inv.length+'</span></div>'+inv.map(i=>'<div class="vt-room-row"><div><b>'+escapeAttr(i.room_name)+'</b><small>'+escapeAttr(i.from_name||'Bir oyuncu')+' seni davet etti</small></div><button type="button" class="vt-mini vt-primary" onclick="valorTeamJoin(\''+i.room_id+'\',\'\')">Katıl</button><button type="button" class="vt-mini" onclick="valorTeamAct(\'team_decline\',{rid:\''+i.room_id+'\'},\'Davet reddedildi.\')">Reddet</button></div>').join('')+'</section><section class="vt-create">');
  if(d.room&&!d.room.own)html=html.replace(/(<button type="button" class="vt-primary"[^>]*onclick="valorTeamFight\(\)">)[^<]*/,'$1Lider Başlatacak');
  return html;
 };
 setInterval(()=>{if(!state.class||document.hidden||!valorTeamIsOnline()||!valorTeamOpen())return;const inRoom=!!valorTeamData().room?.server,onTab=page==='Savaş'&&valorArenaMode==='team';if(onTab||inRoom)valorTeamPoll(false)},3000);
})();
