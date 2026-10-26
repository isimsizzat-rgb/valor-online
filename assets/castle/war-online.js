/* Shared Castle War (signed-in cloud accounts in a server guild). The local attack loop stays; damage is
   reported every 5 seconds and the guild scores, top players, final ranking, rewards and castle owner
   come from the server. Without the server functions the local version keeps working. */
const valorCastleNet={pending:0,hits:0,lastSend:0,sending:false,boardAt:{},loading:{},owner:null,ownerAt:0,unavailable:false};
function valorCastleIsOnline(){return !valorCastleNet.unavailable&&!!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
function valorCastleRpc(name,body){return valorCloudFetch('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body||{})})}
function valorCastleMissing(e){if(e&&(e.status===404||e.code==='PGRST202')){valorCastleNet.unavailable=true;return true}return false}

/* Server board → the local war object the existing panel already knows how to draw. */
function valorCastleApply(id,board){
 const d=valorCastleData(),cal=valorCastleCalendar(),meta=cal.sessions.find(s=>s.id===id)||{id,start:Date.parse(id+'T21:00:00+03:00'),end:Date.parse(id+'T21:15:00+03:00')};
 const war=d.sessions[id]||(d.sessions[id]={...meta,guilds:{},settled:false});
 war.guilds={};(board.guilds||[]).forEach(g=>{war.guilds[g.id]={id:g.id,name:g.name,score:Number(g.score)||0,hits:Number(g.hits)||0,updatedAt:Number(g.rank)||0,members:board.mine?.guild_id===g.id?[d.playerId]:[]}});
 war.players={};(board.players||[]).forEach((p,i)=>{const pid=p.me?d.playerId:'srv-'+i;war.players[pid]={id:pid,name:p.name||'Oyuncu',guildName:p.guild_name,cls:p.class,power:Number(p.power)||0,score:Number(p.score)||0,hits:Number(p.hits)||0,updatedAt:i}});
 if(board.ended&&!war.serverFinal){
  const old=war.payouts?.[d.playerId];war.rankings=valorCastleRank(Object.values(war.guilds));war.payouts={};
  if(board.mine){const rank=Number(board.mine.rank);war.payouts[d.playerId]={guildId:board.mine.guild_id,rank,amount:[500,400,300][rank-1]||200,fame:valorCastleFame(rank),claimed:!!old?.claimed,fameClaimed:!!old?.fameClaimed}}
  war.settled=true;war.serverFinal=true;war.bonusUntil=valorCastleNextEnd(war.start);
 }
 return war;
}
async function valorCastleLoadBoard(id,force){
 const n=valorCastleNet;if(!valorCastleIsOnline()||n.loading[id]||(!force&&n.boardAt[id]&&Date.now()-n.boardAt[id]<3000))return;
 n.loading[id]=true;
 try{const board=await valorCastleRpc('castle_board',{sess:id});valorCastleApply(id,board);if(valorCastleSettle())save();else save();if(page==='Birlik')valorCastleRefresh()}
 catch(e){valorCastleMissing(e)}
 finally{n.boardAt[id]=Date.now();n.loading[id]=false}
}
async function valorCastleLoadOwner(){
 const n=valorCastleNet;if(!valorCastleIsOnline()||n.ownerLoading||(n.ownerAt&&Date.now()-n.ownerAt<60000))return;
 n.ownerLoading=true;try{const o=await valorCastleRpc('castle_owner');n.owner=o&&o.id?{id:o.id,name:o.name,from:Date.parse(o.from),until:Date.parse(o.until)}:null}catch(e){valorCastleMissing(e)}finally{n.ownerAt=Date.now();n.ownerLoading=false}
}
async function valorCastleFlush(){
 const n=valorCastleNet,active=valorCastleCalendar().active;if(n.sending||!n.pending||!active||!valorCastleIsOnline()||!state.guild?.serverId)return;
 n.sending=true;const dmg=Math.floor(n.pending),hits=n.hits;n.pending=0;n.hits=0;n.lastSend=Date.now();
 try{await valorCastleRpc('castle_hit',{sess:active.id,dmg,hit_count:hits});n.boardAt[active.id]=0}
 catch(e){if(!valorCastleMissing(e)&&e.code==='offline'){n.pending+=dmg;n.hits+=hits}}
 finally{n.sending=false}
}
(function(){
 const prevAttack=valorCastleAttack;
 valorCastleAttack=function(){
  const ok=prevAttack.apply(this,arguments);
  if(ok&&valorCastleIsOnline()){const active=valorCastleCalendar().active,war=active&&state.castleV1?.sessions?.[active.id];if(war?.lastHit){valorCastleNet.pending+=Number(war.lastHit.damage)||0;valorCastleNet.hits++}if(Date.now()-valorCastleNet.lastSend>5000)valorCastleFlush()}
  return ok;
 };
 /* Finished wars are ranked by the server; until its answer arrives they wait instead of being ranked locally. */
 const prevSettle=valorCastleSettle;
 valorCastleSettle=function(now=Date.now()){
  if(!valorCastleIsOnline()||!state.class)return prevSettle.apply(this,arguments);
  const d=valorCastleData(now),held={};
  for(const [id,war] of Object.entries(d.sessions)){if(now>=war.end&&!war.settled&&!war.serverFinal){held[id]=war;delete d.sessions[id];valorCastleLoadBoard(id)}}
  try{return prevSettle.apply(this,arguments)}finally{Object.assign(d.sessions,held)}
 };
 const prevOwner=valorCastleOwner;
 valorCastleOwner=function(now=Date.now()){if(!valorCastleIsOnline())return prevOwner.apply(this,arguments);valorCastleLoadOwner();const o=valorCastleNet.owner;return o&&now<o.until?{id:o.id,name:o.name,until:o.until}:null};
 const prevOverlap=valorCastleOverlap;
 valorCastleOverlap=function(start,end,now=Date.now()){if(!valorCastleIsOnline())return prevOverlap.apply(this,arguments);const o=valorCastleNet.owner;if(!o||o.id!==state.guild?.id)return 0;return Math.max(0,Math.min(end,o.until)-Math.max(start,o.from))};
 const prevPanel=valorCastlePanel;
 valorCastlePanel=function(){
  if(valorCastleIsOnline()){const active=valorCastleCalendar().active;if(active)valorCastleLoadBoard(active.id);valorCastleLoadOwner()}
  const html=prevPanel.apply(this,arguments);
  return valorCastleIsOnline()?html.replace(/<p class="vc-local">[\s\S]*?<\/p>/,'<p class="vc-local vc-online">Tüm birlikler aynı kaleye saldırır · puanlar ve ödüller sunucuda tutulur'+(state.guild&&!state.guild.serverId?' · Birliğin henüz sunucuda değil':'')+'</p>'):html;
 };
 addEventListener('pagehide',()=>{if(valorCastleNet.pending)valorCastleFlush()});
 setInterval(()=>{if(valorCastleNet.pending&&Date.now()-valorCastleNet.lastSend>5000)valorCastleFlush()},2000);
})();
