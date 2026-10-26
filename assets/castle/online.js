/* Real guilds (signed-in cloud accounts): create, browse and request to join, leader approval, kick,
   leave, donations that level the guild on the server, guild power ranking and contributions.
   state.guild stays as a local mirror of the server guild so existing features (guild shop, castle war,
   technology bonus) keep working. Guests keep the old local guild. */
const VALOR_GUILD_TTL=30000;
const valorGuildOnline={info:null,list:null,ranking:null,at:0,listAt:0,rankAt:0,loading:false,error:'',search:'',members:{},leaveArmed:false,busy:false};
function valorGuildIsOnline(){return !!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
function valorGuildRpc(name,body){return valorCloudFetch('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body||{})})}
function valorGuildErr(e){return (e.status===404||e.code==='PGRST202')?'Gerçek birlik sistemi sunucuda henüz kurulmadı.':e.message}

/* Keep the local mirror in step with the server. */
function valorGuildApplyInfo(info){
 let changed=false;
 if(info?.guild){
  const g=info.guild,me=(info.members||[]).find(m=>m.user_id===valorAccountActive.id),prev=state.guild&&state.guild.id===g.id?state.guild:{};
  const next={...prev,id:g.id,serverId:g.id,serverName:g.name,name:g.name,level:Number(g.level)||1,progress:Number(g.progress)||0,donated:Number(me?.donated)||0,role:info.role};
  if(JSON.stringify(next)!==JSON.stringify(state.guild)){state.guild=next;changed=true}
 }else if(state.guild?.serverId){state.guild=null;changed=true}
 if(changed)save();
}
async function valorGuildSync(force){
 const o=valorGuildOnline;if(!valorGuildIsOnline()||o.loading||(!force&&o.at&&Date.now()-o.at<VALOR_GUILD_TTL))return;
 o.loading=true;o.error='';
 try{
  // A guild renamed with the market card is sent to the server first.
  const g=state.guild;
  if(g?.serverId&&g.role==='leader'&&g.serverName&&g.name!==g.serverName){
   const r=await valorGuildRpc('guild_rename',{new_name:g.name});
   if(r!=='ok'){g.name=g.serverName;save();toast(r==='taken'?'Bu birlik ismi başka bir birliğe ait. İsim geri alındı.':'Birlik ismi değiştirilemedi.')}
  }
  let info=await valorGuildRpc('guild_info');
  // A guild made before the server existed moves to the server once, keeping its level.
  if(!info?.guild&&state.guild&&!state.guild.serverId&&!state.guildServerMoveTried){
   state.guildServerMoveTried=true;save();
   const local=state.guild;let r=await valorGuildRpc('guild_create',{gname:local.name,start_level:local.level||1,start_progress:local.progress||0});
   if(r==='taken')r=await valorGuildRpc('guild_create',{gname:(local.name+' '+Math.floor(10+Math.random()*90)).slice(0,30),start_level:local.level||1,start_progress:local.progress||0});
   if(r==='ok'){info=await valorGuildRpc('guild_info');toast('Birliğin sunucuya taşındı. Artık oyuncular katılabilir.')}
  }
  if(!info?.guild&&state.guild&&!state.guild.serverId)info={...info,localOnly:true};
  else valorGuildApplyInfo(info);
  o.info=info;o.at=Date.now();
 }catch(e){o.at=Date.now();o.error=valorGuildErr(e)}
 finally{o.loading=false;if(page==='Birlik')render()}
}
async function valorGuildLoadList(force){
 const o=valorGuildOnline;if(o.listLoading||(!force&&o.listAt&&Date.now()-o.listAt<VALOR_GUILD_TTL))return;
 o.listLoading=true;try{o.list=await valorGuildRpc('guild_list',{search:o.search||'',lim:30})}catch(e){o.list=[];o.error=valorGuildErr(e)}finally{o.listAt=Date.now();o.listLoading=false;if(page==='Birlik')render()}
}
async function valorGuildLoadRanking(force){
 const o=valorGuildOnline;if(o.rankLoading||(!force&&o.rankAt&&Date.now()-o.rankAt<VALOR_GUILD_TTL))return;
 o.rankLoading=true;try{if(typeof valorCloudFlush==='function')await valorCloudFlush().catch(()=>{});o.ranking=await valorGuildRpc('guild_ranking',{lim:50})}catch(e){o.ranking=[];o.rankError=valorGuildErr(e)}finally{o.rankAt=Date.now();o.rankLoading=false;if(page==='Birlik')render()}
}
async function valorGuildAct(name,body,okText,after){
 const o=valorGuildOnline;if(o.busy)return;o.busy=true;
 try{const r=await valorGuildRpc(name,body);const status=typeof r==='object'&&r?r.status:r;
  if(status==='ok'||status==='closed'){if(okText)toast(okText);if(after)after(r)}
  else toast({already:'Zaten bir birliktesin.',full:'Birlik dolu (30/30).',too_many:'En fazla 5 birliğe aynı anda istek gönderebilirsin.',not_leader:'Bunu yalnızca birlik lideri yapabilir.',taken:'Bu isim başka bir birliğe ait.',max:'Birlik maksimum seviyede.',invalid:'İşlem yapılamadı.'}[status]||'İşlem yapılamadı.');
  return status;
 }catch(e){toast(valorGuildErr(e))}
 finally{o.busy=false;o.at=0;o.listAt=0;o.rankAt=0;valorGuildSync(true)}
}
function valorGuildSearch(){valorGuildOnline.search=(document.getElementById('vgo-search')?.value||'').trim().slice(0,30);valorGuildLoadList(true)}
function valorGuildJoin(id){valorGuildAct('guild_request',{gid:id},'Katılma isteğin gönderildi. Lider onaylayınca birliğe katılırsın.')}
function valorGuildCancel(id){valorGuildAct('guild_cancel_request',{gid:id},'İstek geri çekildi.')}
function valorGuildAnswer(id,accept){valorGuildAct('guild_answer',{target:id,accept:!!accept},accept?'Oyuncu birliğe katıldı.':'İstek reddedildi.')}
function valorGuildKick(id,name){if(!confirm(name+' birlikten atılsın mı?'))return;valorGuildAct('guild_kick',{target:id},name+' birlikten çıkarıldı.')}
function valorGuildLeave(){const o=valorGuildOnline;if(!o.leaveArmed){o.leaveArmed=true;render();setTimeout(()=>{o.leaveArmed=false;if(page==='Birlik')render()},5000);return}o.leaveArmed=false;valorGuildAct('guild_leave',{},'Birlikten ayrıldın.',()=>{state.guild=null;save()})}

const valorGuildOfflineCreate=createGuild;
createGuild=function(){
 if(!valorGuildIsOnline())return valorGuildOfflineCreate.apply(this,arguments);
 const name=(document.getElementById('vgo-name')?.value||document.getElementById('guildName')?.value||'').trim();
 if(name.length<3||name.length>30||!/^[a-zA-ZğüşöçıİĞÜŞÖÇ0-9_ ]+$/.test(name))return toast('Birlik adı 3–30 karakter olmalı: harf, rakam, boşluk veya alt çizgi.');
 if(state.gold<500000)return toast('Birlik kurmak için 500.000 altın gerekir.');
 valorGuildAct('guild_create',{gname:name},'Birliğin kuruldu!',()=>{state.gold-=500000;save()});
};
const valorGuildOfflineDonate=donate;
donate=function(){
 if(!valorGuildIsOnline()||!state.guild?.serverId)return valorGuildOfflineDonate.apply(this,arguments);
 const amount=Math.floor(Number(document.getElementById('donate')?.value));
 if(!Number.isSafeInteger(amount)||amount<=0||amount>state.gold)return toast('Geçerli bir altın miktarı gir');
 if(state.guild.level>=10)return toast('Birlik maksimum seviyede');
 state.gold-=amount;save();
 valorGuildAct('guild_donate',{amount},'Bağış yapıldı: '+money(amount)+' altın',r=>{state.guild.level=r.level;state.guild.progress=r.progress;state.guild.donated=(Number(state.guild.donated)||0)+amount;save()})
  .then(s=>{if(s!=='ok'){state.gold+=amount;save();render()}});
};

function valorGuildRow(m,i,leader){
 const me=m.user_id===valorAccountActive.id;
 return '<div class="vgh-member '+(me?'vgr-me':'')+'"><b>'+(i+1)+'.</b><div class="vgh-member-name"><span>'+escapeAttr(m.name||'Oyuncu')+(me?' <small>(Sen)</small>':'')+'</span><small>'+(m.role==='leader'?'👑 Lider':'Üye')+(m.class?' · '+escapeAttr(m.class):'')+' · Sv. '+(m.level||1)+' · Bağış '+money(m.donated||0)+'</small></div><strong>'+money(m.power||0)+(leader&&!me?'<button type="button" class="vgo-mini vgo-kick" onclick="valorGuildKick(\''+m.user_id+'\',\''+escapeAttr(String(m.name||'Oyuncu').replace(/'/g,''))+'\')">At</button>':'')+'</strong></div>';
}
function valorGuildNoGuildPage(info){
 const o=valorGuildOnline;valorGuildLoadList();
 const mine=info?.my_requests||[];
 const list=(o.list||[]).map(g=>'<div class="vgh-member"><b>Sv.'+g.level+'</b><div class="vgh-member-name"><span>'+escapeAttr(g.name)+'</span><small>👑 '+escapeAttr(g.leader_name||'—')+' · '+g.members+' / 30 üye · '+money(g.power)+' güç</small></div><strong>'+(g.requested?'<button type="button" class="vgo-mini" onclick="valorGuildCancel(\''+g.id+'\')">İsteği Geri Çek</button>':'<button type="button" class="vgo-mini vgo-primary" '+(g.members>=30?'disabled':'')+' onclick="valorGuildJoin(\''+g.id+'\')">'+(g.members>=30?'Dolu':'Katıl')+'</button>')+'</strong></div>').join('');
 return '<section class="vgr-page"><div class="vgh-card"><h3>Birlik Kur</h3><p>Kendi birliğini kur, lider ol. Ücret: <b>500.000 altın</b>.</p><div class="vgh-donate"><input id="vgo-name" maxlength="30" placeholder="Birlik adı" autocomplete="off"><button type="button" '+(state.gold<500000?'disabled':'')+' onclick="createGuild()">Birlik Kur</button></div></div>'
  +(mine.length?'<div class="vgh-card"><h3>Gönderdiğin İstekler</h3>'+mine.map(r=>'<div class="vgo-req"><span>'+escapeAttr(r.name)+'</span><button type="button" class="vgo-mini" onclick="valorGuildCancel(\''+r.guild_id+'\')">Geri Çek</button></div>').join('')+'<p class="vgr-note">Lider onaylayınca birliğe katılırsın.</p></div>':'')
  +'<div class="vgh-card"><h3>Birliğe Katıl</h3><div class="vgh-donate"><input id="vgo-search" maxlength="30" placeholder="Birlik ara" value="'+escapeAttr(o.search)+'" onkeydown="if(event.key===\'Enter\')valorGuildSearch()"><button type="button" onclick="valorGuildSearch()">Ara</button></div>'
  +'<div class="vgr-table">'+(o.list?(list||'<p class="vgr-note">Birlik bulunamadı.</p>'):'<p class="vgr-note">Birlikler yükleniyor…</p>')+'</div></div></section>';
}
function valorGuildOnlineMembersPage(){
 const o=valorGuildOnline,info=o.info;valorGuildSync();
 if(o.error&&!info)return '<section class="vgr-page"><p>'+escapeAttr(o.error)+'</p><button type="button" onclick="valorGuildSync(true)">Tekrar Dene</button></section>';
 if(!info)return '<section class="vgr-page"><p>Birlik bilgileri yükleniyor…</p></section>';
 if(info.localOnly)return valorGuildOfflineMembersPage();
 if(!info.guild)return valorGuildNoGuildPage(info);
 const g=info.guild,members=info.members||[],leader=info.role==='leader',max=g.level>=10,need=max?0:guildCosts[g.level],power=members.reduce((s,m)=>s+(Number(m.power)||0),0);
 const reqs=(info.requests||[]).map(r=>'<div class="vgo-req"><span><b>'+escapeAttr(r.name||'Oyuncu')+'</b><small>'+escapeAttr(r.class||'')+' · Sv. '+(r.level||1)+' · '+money(r.power||0)+' güç</small></span><span class="vgo-req-actions"><button type="button" class="vgo-mini vgo-primary" onclick="valorGuildAnswer(\''+r.user_id+'\',true)">Kabul</button><button type="button" class="vgo-mini" onclick="valorGuildAnswer(\''+r.user_id+'\',false)">Reddet</button></span></div>').join('');
 return '<section class="vgr-page"><div class="vgh-summary"><div><span class="vdg-eyebrow">BİRLİK · SV. '+g.level+' / 10</span><h2>'+escapeAttr(g.name)+'</h2></div><div class="vgh-stats"><div><span>Birlik Gücü</span><b>'+money(power)+'</b></div><div><span>Üyeler</span><b>'+members.length+' / 30</b></div></div></div>'
  +(leader&&reqs?'<div class="vgh-card vgo-requests"><h3>Katılma İstekleri <small>'+(info.requests||[]).length+'</small></h3>'+reqs+'</div>':'')
  +'<div class="vgr-table"><div class="vgr-table-head"><span>Üye</span><span>Savaş Gücü</span></div>'+members.map((m,i)=>valorGuildRow(m,i,leader)).join('')+'</div>'
  +'<div class="vgh-card"><h3>Birlik Seviyesi</h3><p>'+(max?'Birlik maksimum seviyede.':'Sonraki seviye için '+money(need-g.progress)+' altın gerekli.')+'</p><div class="bar"><div style="width:'+(max?100:Math.min(100,g.progress/need*100))+'%"></div></div>'
  +(max?'':'<div class="vgh-donate"><input type="number" id="donate" min="1" inputmode="numeric" placeholder="Bağış miktarı"><button type="button" onclick="donate()">Altın Bağışla</button></div>')
  +'<p class="vgr-note">Toplam bağışın: '+money(state.guild?.donated||0)+' altın</p></div>'
  +'<button type="button" class="vgo-leave" onclick="valorGuildLeave()">'+(o.leaveArmed?(leader&&members.length>1?'Emin misin? Liderlik en güçlü üyeye geçer · Tekrar bas':leader?'Emin misin? Birlik kapanır · Tekrar bas':'Emin misin? Tekrar bas'):'Birlikten Ayrıl')+'</button></section>';
}
function valorGuildToggleMembers(id,el){if(!el.open||valorGuildOnline.members[id])return;valorGuildRpc('guild_members_of',{gid:id}).then(rows=>{valorGuildOnline.members[id]=rows||[];if(page==='Birlik')render()}).catch(()=>{})}
function valorGuildOnlinePowerPage(){
 const o=valorGuildOnline;valorGuildLoadRanking();
 const rows=o.ranking;
 const body=rows?(rows.length?rows.map(g=>{const ms=o.members[g.id];return '<details class="vgh-guild '+(g.is_mine?'vgr-me':'')+'" '+(ms?'open':'')+' ontoggle="valorGuildToggleMembers(\''+g.id+'\',this)"><summary><b>'+g.rank+'.</b><div class="vgh-member-name"><span>'+escapeAttr(g.name)+(g.is_mine?' <small>(Birliğin)</small>':'')+'</span><small>Sv. '+g.level+' · '+g.members+' üye</small></div><strong>'+money(g.power)+'</strong></summary><div class="vgh-guild-members">'+(ms?ms.map((m,i)=>'<div class="vgh-member"><b>'+(i+1)+'.</b><div class="vgh-member-name"><span>'+escapeAttr(m.name||'Oyuncu')+'</span><small>'+(m.role==='leader'?'👑 Lider':'Üye')+' · '+escapeAttr(m.class||'')+' · Sv. '+(m.level||1)+'</small></div><strong>'+money(m.power||0)+'</strong></div>').join(''):'<p class="vgr-note">Üyeler yükleniyor…</p>')+'</div></details>'}).join(''):'<p class="vgr-note">Henüz birlik yok.</p>'):'<p class="vgr-note">'+(o.rankError?escapeAttr(o.rankError):'Sıralama yükleniyor…')+'</p>';
 return '<section class="vgr-page"><span class="vdg-eyebrow">SAVAŞ GÜCÜ</span><h2>Birlik Sıralaması</h2><p>Birlik gücü, üyelerin savaş güçlerinin toplamıdır. Üyeleri görmek için birliğe dokun. <button type="button" class="vro-refresh" onclick="valorGuildLoadRanking(true)" aria-label="Yenile">↻</button></p><div class="vgr-table"><div class="vgr-table-head"><span>Birlik</span><span>Birlik Gücü</span></div>'+body+'</div></section>';
}
function valorGuildOnlineContributions(){
 const o=valorGuildOnline,info=o.info;valorGuildSync();
 if(!info?.guild)return '<section class="vgr-page"><h2>Katkı Sıralaması</h2><p>Katkı sıralamasını görmek için bir birlikte olmalısın.</p></section>';
 const weekly=valorGuildContributionPeriod==='weekly',rows=(info.members||[]).map(m=>({...m,amount:Number(weekly?m.weekly:m.donated)||0})).sort((a,b)=>b.amount-a.amount);
 return '<section class="vgr-page"><span class="vdg-eyebrow">ALTIN BAĞIŞLARI</span><h2>Katkı Sıralaması</h2><nav class="vgr-tabs"><button type="button" aria-pressed="'+!weekly+'" onclick="valorGuildSelectContributionPeriod(\'total\')">Toplam</button><button type="button" aria-pressed="'+weekly+'" onclick="valorGuildSelectContributionPeriod(\'weekly\')">Bu Hafta</button></nav><div class="vgr-table"><div class="vgr-table-head"><span>Üye</span><span>Bağış</span></div>'+rows.map((m,i)=>'<div class="vgh-member '+(m.user_id===valorAccountActive.id?'vgr-me':'')+'"><b>'+(i+1)+'.</b><div class="vgh-member-name"><span>'+escapeAttr(m.name||'Oyuncu')+'</span><small>'+(m.role==='leader'?'👑 Lider':'Üye')+'</small></div><strong>'+money(m.amount)+'</strong></div>').join('')+'</div><p class="vgr-note">Haftalık sıralama her pazartesi 00.00’da sıfırlanır.</p></section>';
}
const valorGuildOfflineMembersPage=valorGuildMembersPage,valorGuildOfflinePowerPage=valorGuildPowerPage,valorGuildOfflineContributions=valorGuildHubContributions;
valorGuildMembersPage=function(){return valorGuildIsOnline()?valorGuildOnlineMembersPage():valorGuildOfflineMembersPage()};
valorGuildPowerPage=function(){return valorGuildIsOnline()?valorGuildOnlinePowerPage():valorGuildOfflinePowerPage()};
valorGuildHubContributions=function(){return valorGuildIsOnline()&&!valorGuildOnline.info?.localOnly?valorGuildOnlineContributions():valorGuildOfflineContributions()};
/* Fresh data each time the guild screen is opened, and every 20 seconds while it stays open. */
let valorGuildLastPage='';
(function(){const prev=render;render=function(){const entering=page==='Birlik'&&valorGuildLastPage!=='Birlik';valorGuildLastPage=page;if(entering&&valorGuildIsOnline()){valorGuildOnline.at=0;valorGuildOnline.listAt=0;valorGuildOnline.rankAt=0}return prev.apply(this,arguments)}})();
setInterval(()=>{if(page==='Birlik'&&!document.hidden&&valorGuildIsOnline()&&!document.querySelector('#vgo-name:focus,#vgo-search:focus,#donate:focus'))valorGuildSync(true)},20000);
/* Sync once after sign-in so the guild shop and castle war see the right guild. */
if(valorGuildIsOnline()&&state.class)setTimeout(()=>valorGuildSync(true),1500);
if(state.class&&page==='Birlik')render();
