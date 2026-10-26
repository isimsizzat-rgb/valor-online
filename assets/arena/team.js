/* Takım Arenası (1v1 / 2v2 / 3v3) with rooms, passwords and invites.
   Local version: other room members and rivals are computer-controlled players from the arena list.
   Everything a server would provide goes through valorTeamRoomSource / valorTeamInviteCandidates. */
const VALOR_TEAM_DAILY=15,VALOR_TEAM_WIN_GOLD=1000,VALOR_TEAM_WIN_FAME=5,VALOR_TEAM_RATING_WIN=20,VALOR_TEAM_RATING_LOSS=15;
let valorArenaMode='solo',valorTeamInviteOpen=false,valorTeamJoinTarget=null,valorTeamNotice='';

function valorTeamData(){
 let d=state.teamArenaV1,changed=false;
 if(!d||typeof d!=='object'){d=state.teamArenaV1={day:'',used:0,wins:0,losses:0,draws:0,rating:1000,history:[],room:null,rooms:[],roomsDay:''};changed=true}
 const day=vsToday();if(d.day!==day){d.day=day;d.used=0;changed=true}
 for(const [k,v] of [['wins',0],['losses',0],['draws',0],['rating',1000]])if(!Number.isFinite(d[k])){d[k]=v;changed=true}
 if(!Array.isArray(d.history)){d.history=[];changed=true}
 if(!Array.isArray(d.rooms)){d.rooms=[];changed=true}
 if(changed)save();return d;
}
function valorTeamRemaining(){return Math.max(0,VALOR_TEAM_DAILY-valorTeamData().used)}

/* Computer-controlled players: names/classes from the arena list, power relative to the player. */
function valorTeamPool(){return valorArenaPlayers().map(p=>({id:'npc-'+p.id,name:p.name,cls:p.cls,level:p.level}))}
function valorTeamBotStats(ratio,cls){
 const snap=valorArenaStats(),mine=state.class==='Büyücü'?'Sihir':'Saldırı',primary=cls==='Büyücü'?'Sihir':'Saldırı',out={};
 for(const k of ['Saldırı','Sihir','Savunma','Sihir Savunma','Can','Kritik','Bloke'])out[k]=Math.round((Number(snap[k])||0)*ratio);
 out[primary]=Math.round((Number(snap[mine])||0)*ratio);out[primary==='Sihir'?'Saldırı':'Sihir']=Math.round((Number(snap[mine==='Sihir'?'Saldırı':'Sihir'])||0)*ratio);
 return out;
}
function valorTeamPick(n,exclude=[]){const used=new Set(exclude),pool=valorTeamPool().filter(p=>!used.has(p.id)).sort(()=>Math.random()-.5);return pool.slice(0,n)}
function valorTeamMember(p,ratio){return {id:p.id,name:p.name,cls:p.cls,level:p.level,ratio:Math.round(ratio*100)/100}}

/* ---------- Rooms ---------- */
const VALOR_TEAM_ROOM_NAMES=['Gece Baskını','Ejder Avcıları','Kızıl Yemin','Çelik Kalkan','Sessiz Oklar','Kadim Birlik','Fırtına Takımı','Alev Muhafızları','Ay Işığı','Bozkır Kurtları'];
function valorTeamRoomSource(){
 const d=valorTeamData();
 if(d.roomsDay!==d.day||!d.rooms.length){
  const names=VALOR_TEAM_ROOM_NAMES.slice().sort(()=>Math.random()-.5).slice(0,7);
  d.rooms=names.map((name,i)=>{const capacity=1+Math.floor(Math.random()*3),count=Math.max(1,Math.min(capacity,1+Math.floor(Math.random()*capacity))),members=valorTeamPick(count).map(p=>valorTeamMember(p,.8+Math.random()*.4));
   return {id:'room-'+Date.now()+'-'+i,name,capacity,members,locked:Math.random()<.3,password:Math.random()<.3?String(1000+Math.floor(Math.random()*9000)):''}}).map(r=>({...r,locked:!!r.password}));
  d.roomsDay=d.day;save();
 }
 return d.rooms;
}
function valorTeamRefreshRooms(){const d=valorTeamData();d.rooms=[];valorTeamRoomSource();valorTeamNotice='Oda listesi yenilendi.';render()}
function valorTeamCreateRoom(){
 const d=valorTeamData();if(d.room)return;
 const name=(document.getElementById('vt-room-name')?.value||'').trim().slice(0,24)||((state.name||'Oyuncu')+' Odası');
 const capacity=Math.max(1,Math.min(3,Number(document.getElementById('vt-room-size')?.value)||3));
 const password=(document.getElementById('vt-room-pass')?.value||'').trim().slice(0,12);
 d.room={id:'own-'+Date.now(),name,capacity,password,own:true,members:[]};valorTeamInviteOpen=capacity>1;valorTeamNotice='Odan kuruldu.'+(capacity>1?' Takım arkadaşlarını davet et ya da tek başına savaşa gir.':'');save();render();
}
function valorTeamJoinStart(id){const room=valorTeamRoomSource().find(r=>r.id===id);if(!room)return;if(room.members.length>=room.capacity){valorTeamNotice='Bu oda dolu.';render();return}if(room.locked){valorTeamJoinTarget=id;render();return}valorTeamJoin(id,'')}
function valorTeamJoin(id,password){
 const d=valorTeamData();if(d.room)return;const room=valorTeamRoomSource().find(r=>r.id===id);if(!room)return;
 if(room.members.length>=room.capacity){valorTeamNotice='Bu oda dolu.';render();return}
 if(room.locked&&password!==room.password){valorTeamNotice='Şifre yanlış.';render();return}
 d.room={id:room.id,name:room.name,capacity:room.capacity,password:room.password,own:false,members:room.members.slice()};
 d.rooms=d.rooms.filter(r=>r.id!==id);valorTeamJoinTarget=null;valorTeamNotice=room.name+' odasına katıldın.';save();render();
}
function valorTeamLeave(){const d=valorTeamData();d.room=null;valorTeamInviteOpen=false;valorTeamNotice='Odadan çıktın.';save();render()}
function valorTeamInviteCandidates(){const d=valorTeamData(),inRoom=new Set((d.room?.members||[]).map(m=>m.id));return valorTeamPool().filter(p=>!inRoom.has(p.id)).slice(0,12)}
function valorTeamInvite(id){
 const d=valorTeamData(),room=d.room;if(!room)return;
 if(1+room.members.length>=room.capacity){valorTeamNotice='Oda dolu.';render();return}
 const p=valorTeamPool().find(x=>x.id===id);if(!p||room.members.some(m=>m.id===id))return;
 room.members.push(valorTeamMember(p,.85+Math.random()*.3));valorTeamNotice=p.name+' davetini kabul etti.';
 if(1+room.members.length>=room.capacity)valorTeamInviteOpen=false;save();render();
}
function valorTeamKick(id){const room=valorTeamData().room;if(!room?.own)return;room.members=room.members.filter(m=>m.id!==id);save();render()}

/* ---------- Battle ---------- */
function valorTeamUnit(name,cls,stats,side,me=false){const u=valorArenaUnit({...stats},cls);return {...u,name,cls,side,me,dealt:0}}
function valorTeamSimulate(teamA,teamB,rng=Math.random){
 const all=[...teamA,...teamB],log=[];
 const alive=side=>all.filter(u=>u.side===side&&u.hp>0);
 for(let round=1;alive('A').length&&alive('B').length&&round<=300;round++){
  const fury=valorArenaFury(round),order=all.filter(u=>u.hp>0).sort((a,b)=>b.attack-a.attack||rng()-.5),acts=[];
  const strike=(a,b)=>{
   const hit=valorArenaHit(a,b,rng),pb=a.stats.petBuff;
   if(fury>0&&!hit.resisted)hit.damage=Math.max(1,Math.round(hit.damage*(1+fury)));
   if(pb?.id==='safakkanat'&&!hit.resisted&&b.hp<b.maxHp*.25)hit.damage=Math.max(1,Math.round(hit.damage*(1+pb.bonus)));
   const dmg=Math.min(b.hp,hit.damage);b.hp-=dmg;a.dealt+=dmg;
   if(pb?.id==='kozpence'&&b.hp>0&&rng()<pb.chance){b.burn={rounds:3,damage:Math.max(1,Math.round(b.maxHp*pb.burn)),from:a};hit.ignite=true}
   hit.healed=valorAstrologyHeal(b,b.stats.astrologyHealing,rng);return {hit,dmg};
  };
  for(const a of order){
   if(a.hp<=0)continue;const foes=alive(a.side==='A'?'B':'A');if(!foes.length)break;
   const b=foes[Math.floor(rng()*foes.length)],s=strike(a,b);let dmg=s.dmg;
   if(a.stats.petBuff?.id==='gecegaga'&&b.hp>0&&rng()<a.stats.petBuff.chance){const x=strike(a,b);dmg+=x.dmg;s.hit.shadow=x.dmg}
   acts.push({a:a.name,b:b.name,dmg,hit:s.hit,ko:b.hp<=0});
  }
  for(const u of all){if(!u.burn||u.hp<=0)continue;const d=Math.min(u.hp,u.burn.damage);u.hp-=d;if(u.burn.from)u.burn.from.dealt+=d;acts.push({a:'Yanık',b:u.name,dmg:d,hit:null,ko:u.hp<=0});if(--u.burn.rounds<=0)u.burn=null}
  log.push({round,acts});
 }
 const aLeft=alive('A').length,bLeft=alive('B').length,win=aLeft>0&&bLeft===0,draw=aLeft>0&&bLeft>0;
 return {win,draw,rounds:log.length,log,units:all.map(u=>({name:u.name,cls:u.cls,side:u.side,me:u.me,hp:u.hp,maxHp:u.maxHp,dealt:u.dealt}))};
}
function valorTeamFight(){
 if(page!=='Savaş'||!state.class||valorArenaPendingBattle||document.getElementById('valor-arena-result'))return;
 const d=valorTeamData(),room=d.room;if(!room)return;
 if(valorTeamRemaining()<1){valorTeamNotice='Bugünkü '+VALOR_TEAM_DAILY+' takım savaşı hakkını kullandın.';render();return}
 valorArenaBeginWait(()=>valorArenaWithFury(()=>valorTeamResolve()));
}
function valorTeamResolve(){
 const d=valorTeamData(),room=d.room;if(!room||valorTeamRemaining()<1)return;
 const size=1+room.members.length,mine=valorArenaStats();
 const teamA=[valorTeamUnit(state.name||'Sen',state.class,mine,'A',true),...room.members.map(m=>valorTeamUnit(m.name,m.cls,valorTeamBotStats(m.ratio,m.cls),'A'))];
 const avg=(1+room.members.reduce((s,m)=>s+m.ratio,0))/size,rivals=valorTeamPick(size,room.members.map(m=>m.id));
 const teamB=rivals.map(p=>{const ratio=avg*(.9+Math.random()*.2);return valorTeamUnit(p.name,p.cls,valorTeamBotStats(ratio,p.cls),'B')});
 const battle=valorTeamSimulate(teamA,teamB);d.used++;
 let gold=0,fame=0,delta=0;
 if(battle.win){d.wins++;gold=VALOR_TEAM_WIN_GOLD;fame=VALOR_TEAM_WIN_FAME;state.gold+=gold;state.fame=(Number(state.fame)||0)+fame;delta=VALOR_TEAM_RATING_WIN}
 else if(battle.draw)d.draws++;else{d.losses++;delta=-Math.min(d.rating,VALOR_TEAM_RATING_LOSS)}
 d.rating+=delta;
 const result={...battle,size,gold,fame,delta,rating:d.rating,room:room.name,at:Date.now()};
 d.history.unshift({win:battle.win,draw:battle.draw,size,rounds:battle.rounds,delta,at:result.at});d.history=d.history.slice(0,20);
 save();render();valorTeamShowResult(result);
}
function valorTeamShowResult(r){
 document.getElementById('valor-arena-result')?.remove();
 const bar=u=>'<div class="vt-unit '+(u.hp<=0?'vt-down':'')+(u.me?' vt-me':'')+'"><div><b>'+escapeAttr(u.name)+(u.me?' (Sen)':'')+'</b><small>'+escapeAttr(u.cls)+' · '+money(u.dealt)+' hasar</small></div><div class="vt-hp"><i style="width:'+Math.max(0,u.hp/u.maxHp*100)+'%"></i></div><span>'+money(u.hp)+' / '+money(u.maxHp)+'</span></div>';
 const side=s=>r.units.filter(u=>u.side===s).map(bar).join('');
 const rounds=r.log.slice(0,80).map(l=>'<div class="arena-turn"><b>'+l.round+'. tur</b>'+l.acts.map(x=>'<p>'+escapeAttr(x.a)+' → '+escapeAttr(x.b)+': '+money(x.dmg)+(x.hit?valorArenaHitLabel(x.hit):'')+(x.ko?' <strong class="arena-critical">Düştü!</strong>':'')+'</p>').join('')+'</div>').join('');
 const overlay=document.createElement('div');overlay.id='valor-arena-result';overlay.className='valor-item-overlay';
 overlay.innerHTML='<section class="valor-item-dialog arena-result-dialog vt-result" role="dialog" aria-modal="true" aria-labelledby="vt-result-title"><div class="arena-result-emblem">'+(r.win?'✦':'⚔')+'</div><h2 id="vt-result-title">'+(r.draw?'BERABERLİK':r.win?'ZAFER':'MAĞLUBİYET')+'</h2><p>'+r.size+'v'+r.size+' · '+r.rounds+' tur</p><div class="vt-sides"><div><h3>Takımın</h3>'+side('A')+'</div><div><h3>Rakip Takım</h3>'+side('B')+'</div></div><details class="arena-combat-log"><summary>Tur detayları</summary>'+rounds+(r.log.length>80?'<p>… ilk 80 tur gösteriliyor</p>':'')+'</details><div class="arena-result-rewards">'+(r.win?'<b>+'+money(r.gold)+' Altın</b><b>+'+r.fame+' Şöhret</b>':'<span>Altın ve şöhret kaybetmedin.</span>')+'<b>3v3 Puanı '+(r.delta>=0?'+':'')+r.delta+' → '+r.rating+'</b></div><p class="arena-result-remaining">Kalan takım hakkı: '+valorTeamRemaining()+'/'+VALOR_TEAM_DAILY+'</p><button type="button" onclick="document.getElementById(\'valor-arena-result\').remove()">Devam Et</button></section>';
 overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});document.body.appendChild(overlay);
}

/* ---------- Ranking ---------- */
function valorTeamRanking(){
 const npcs=valorArenaPlayers().slice(0,20).map(p=>({name:p.name,level:p.level,rating:Math.round(900+(Number(p.wins)||0)*12+(p.power/Math.max(1,combatPower()))*60)}));
 const d=valorTeamData();return [...npcs,{name:state.name||'Oyuncu',level:state.level,rating:d.rating,me:true}].sort((a,b)=>b.rating-a.rating||(a.me?-1:1));
}

/* ---------- Page ---------- */
function valorTeamPage(){
 const d=valorTeamData(),room=d.room,rows=valorTeamRanking(),rank=rows.findIndex(r=>r.me)+1,remaining=valorTeamRemaining();
 let html='<div class="arena-summary"><div><span>Günlük Hak</span><b>'+remaining+'<small>/'+VALOR_TEAM_DAILY+'</small></b></div><div><span>3v3 Puanı</span><b>'+money(d.rating)+'</b></div><div><span>Sıran</span><b>#'+rank+'</b></div></div>';
 if(valorTeamNotice){html+='<p class="vt-notice">'+escapeAttr(valorTeamNotice)+'</p>';valorTeamNotice=''}
 if(room){
  const size=1+room.members.length,full=size>=room.capacity;
  html+='<section class="vt-room"><div class="arena-section-heading"><h2>'+escapeAttr(room.name)+'</h2><span>'+(room.password?'🔒 Şifreli · ':'')+size+' / '+room.capacity+' kişi</span></div><div class="vt-slots">'
   +'<div class="vt-slot vt-me"><b>'+escapeAttr(state.name||'Sen')+' <small>(Sen'+(room.own?' · Lider':'')+')</small></b><small>'+escapeAttr(state.class)+' · Sv. '+state.level+' · '+money(combatPower())+' güç</small></div>'
   +room.members.map(m=>'<div class="vt-slot"><b>'+escapeAttr(m.name)+(!room.own&&m===room.members[0]?' <small>(Lider)</small>':'')+'</b><small>'+escapeAttr(m.cls)+' · Sv. '+m.level+' · '+money(Math.round(combatPower()*m.ratio))+' güç</small>'+(room.own?'<button type="button" class="vt-mini" onclick="valorTeamKick(\''+m.id+'\')">Çıkar</button>':'')+'</div>').join('')
   +Array.from({length:room.capacity-size},()=>'<div class="vt-slot vt-empty">Boş yer'+(room.own?'':'')+'</div>').join('')+'</div>'
   +'<div class="vt-actions">'+(room.own&&!full?'<button type="button" onclick="valorTeamInviteOpen=!valorTeamInviteOpen;render()">'+(valorTeamInviteOpen?'Daveti Kapat':'Oyuncu Davet Et')+'</button>':'')+'<button type="button" class="vt-primary" '+(remaining<1?'disabled':'')+' onclick="valorTeamFight()">'+size+'v'+size+' Savaşa Gir</button><button type="button" onclick="valorTeamLeave()">Odadan Çık</button></div>';
  if(room.own&&valorTeamInviteOpen&&!full)html+='<div class="vt-invite"><p>Davet edilebilecek oyuncular</p>'+valorTeamInviteCandidates().map(p=>'<div class="vt-slot"><b>'+escapeAttr(p.name)+'</b><small>'+escapeAttr(p.cls)+' · Sv. '+p.level+'</small><button type="button" class="vt-mini" onclick="valorTeamInvite(\''+p.id+'\')">Davet Et</button></div>').join('')+'</div>';
  html+='<p class="vt-hint">Savaşta herkes sırayla rastgele bir rakibe saldırır. Rakip takım, takımınla aynı sayıda ve benzer güçte oyunculardan oluşur.</p></section>';
 }else{
  html+='<section class="vt-create"><div class="arena-section-heading"><h2>Oda Kur</h2><span>1, 2 veya 3 kişilik</span></div><div class="vt-form"><input id="vt-room-name" maxlength="24" placeholder="Oda adı"><select id="vt-room-size" aria-label="Oda kapasitesi"><option value="3">3 kişi (3v3)</option><option value="2">2 kişi (2v2)</option><option value="1">1 kişi (1v1)</option></select><input id="vt-room-pass" maxlength="12" placeholder="Şifre (isteğe bağlı)" autocomplete="off"><button type="button" class="vt-primary" onclick="valorTeamCreateRoom()">Oda Kur</button></div></section>'
   +'<section class="vt-list"><div class="arena-section-heading"><h2>Açık Odalar</h2><button type="button" class="vt-mini" onclick="valorTeamRefreshRooms()">Yenile</button></div>'
   +valorTeamRoomSource().map(r=>{const full=r.members.length>=r.capacity;return '<div class="vt-room-row"><div><b>'+(r.locked?'🔒 ':'')+escapeAttr(r.name)+'</b><small>Lider: '+escapeAttr(r.members[0]?.name||'-')+' · '+r.members.length+' / '+r.capacity+' kişi</small></div>'+(valorTeamJoinTarget===r.id?'<div class="vt-pass"><input id="vt-join-pass" maxlength="12" placeholder="Şifre" autocomplete="off"><button type="button" class="vt-mini" onclick="valorTeamJoin(\''+r.id+'\',document.getElementById(\'vt-join-pass\').value.trim())">Gir</button></div>':'<button type="button" class="vt-mini" '+(full?'disabled':'')+' onclick="valorTeamJoinStart(\''+r.id+'\')">'+(full?'Dolu':'Katıl')+'</button>')+'</div>'}).join('')+'</section>';
 }
 html+='<div class="arena-section-heading"><h2>3v3 Sıralaması</h2><span>İlk 10</span></div><div class="arena-ranking">'+rows.slice(0,10).map((p,i)=>'<div class="arena-rank-row '+(p.me?'arena-me':'')+'">'+valorArenaBadge(i+1)+'<div><b>'+escapeAttr(p.name)+(p.me?' <small>(Sen)</small>':'')+'</b><small>Sv. '+p.level+'</small></div><strong>'+money(p.rating)+'<small>Puan</small></strong></div>').join('')+'</div>'+(rank>10?'<div class="arena-own-rank">3v3 sıran: <b>#'+rank+'</b></div>':'')
  +'<p class="vc-local">Yerel deneme: odalardaki diğer oyuncular ve rakipler bilgisayar kontrollüdür. Gerçek oyuncularla oda ve davet için sunucu bağlantısı gerekir.</p>';
 return html;
}
const valorTeamPreviousArenaPage=valorArenaPage;
valorArenaPage=function(){
 const tabs='<nav class="vt-mode" aria-label="Arena modu"><button type="button" aria-pressed="'+(valorArenaMode==='solo')+'" onclick="valorArenaMode=\'solo\';render()">Bireysel</button><button type="button" aria-pressed="'+(valorArenaMode==='team')+'" onclick="valorArenaMode=\'team\';render()">Takım (3v3)</button></nav>';
 if(valorArenaMode!=='team')return tabs+valorTeamPreviousArenaPage();
 return tabs+'<section class="valor-arena vt-page"><div class="arena-heading"><h1>Takım Arenası</h1></div>'+valorTeamPage()+'</section>';
};
if(state.class&&page==='Savaş')render();
