/* Shared world boss (signed-in cloud accounts): hits are added up locally and reported every few
   seconds; the ranking card shows every player's damage for the running session. */
const valorBossOnline={pending:0,hits:0,sending:false,board:null,boardAt:0,boardSession:null,lastSend:0};
function valorBossIsOnline(){return !!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
function valorBossRpc(name,body){return valorCloudFetch('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body||{})})}
async function valorBossFlush(){
 const o=valorBossOnline,w=bossSchedule();if(o.sending||!o.pending||!w.active||!w.id)return;
 o.sending=true;const dmg=Math.floor(o.pending),hits=o.hits;o.pending=0;o.hits=0;o.lastSend=Date.now();
 try{const r=await valorBossRpc('boss_hit',{sess:w.id,dmg,hit_count:hits});if(r==='ok')o.boardAt=0}
 catch(e){if(e.code==='offline'){o.pending+=dmg;o.hits+=hits}}
 finally{o.sending=false}
}
async function valorBossLoadBoard(){
 const o=valorBossOnline,w=bossSchedule(),sess=w.id||o.boardSession;if(!sess||o.boardLoading||(o.boardAt&&Date.now()-o.boardAt<5000&&o.boardSession===sess))return;
 o.boardLoading=true;try{o.board=await valorBossRpc('boss_board',{sess});o.boardSession=sess;o.boardError=''}catch(e){o.boardError=(e.status===404||e.code==='PGRST202')?'Ortak sıralama sunucuda henüz kurulmadı.':e.message}finally{o.boardAt=Date.now();o.boardLoading=false;if(page==='Dünya Bossu')render()}
}
(function(){
 const prevTick=bossTick;
 bossTick=function(){
  const w=bossSchedule(),e=w.active&&w.id?bossSession(w.id):null,before=e?e.damage:0,hitsBefore=e?e.hits:0;
  const r=prevTick.apply(this,arguments);
  if(e&&valorBossIsOnline()){valorBossOnline.pending+=Math.max(0,e.damage-before);valorBossOnline.hits+=Math.max(0,e.hits-hitsBefore);if(Date.now()-valorBossOnline.lastSend>5000)valorBossFlush()}
  if(!bossAttacking&&valorBossOnline.pending)valorBossFlush();
  return r;
 };
 const prevPage=bossPage;
 bossPage=function(){
  const html=prevPage.apply(this,arguments);if(!valorBossIsOnline()||!html.includes('wb-ranking'))return html;
  const w=bossSchedule();if(w.active)valorBossOnline.boardSession=w.id;valorBossLoadBoard();
  const o=valorBossOnline,b=o.board;
  let card='<div class="wb-card wb-ranking"><h3>🏆 Hasar Sıralaması</h3>';
  if(!w.active&&!o.boardSession)card+='<p class="small">Etkinlik başlayınca tüm oyuncuların hasarı burada sıralanır.</p>';
  else if(o.boardError)card+='<p class="small">'+escapeAttr(o.boardError)+'</p>';
  else if(!b)card+='<p class="small">Sıralama yükleniyor…</p>';
  else{
   card+='<p class="small wbo-total">Toplam hasar: <b>'+money(b.total||0)+'</b> · '+(b.players||0)+' oyuncu'+(w.active?'':' · son etkinlik')+'</p>';
   card+=(b.top||[]).map(p=>'<div class="wb-rank-row'+(p.me?' wbo-me':'')+'"><span>'+p.rank+'. '+escapeAttr(p.name||'Oyuncu')+(p.me?' (Sen)':'')+'</span><strong>'+money(p.damage)+' hasar</strong></div>').join('')||'<p class="small">Henüz kimse vurmadı. İlk sen başla!</p>';
   if(b.me&&b.me.rank>10)card+='<div class="wb-rank-row wbo-me"><span>'+b.me.rank+'. Sen</span><strong>'+money(b.me.damage)+' hasar</strong></div>';
  }
  card+='</div>';
  return html.replace(/<div class="wb-card wb-ranking">[\s\S]*?<\/div>(?=<button)/,card);
 };
 addEventListener('pagehide',()=>{if(valorBossOnline.pending)valorBossFlush()});
})();
