/* Admin panel (only for accounts in public.admins) and ban screen. */
const valorAdmin={status:null,tab:'players',q:'',players:null,sel:null,cheats:null,chat:null,stats:null,busy:false};
function valorAdminRpc(name,body){return valorCloudFetch('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body||{})})}
function valorAdminIs(){return !!valorAdmin.status?.admin}
function valorAdminDate(v){if(!v)return '';if(v==='kalıcı')return 'kalıcı';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
async function valorAdminCheck(){
 if(!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud))return;
 try{valorAdmin.status=await valorAdminRpc('my_status');if(valorAdmin.status?.ban)valorAdminBanScreen(valorAdmin.status.ban);else if(page==='Profil')render()}catch{}
}
function valorAdminBanScreen(ban){
 document.getElementById('valor-ban')?.remove();
 const o=document.createElement('div');o.id='valor-ban';o.className='vr-overlay';o.style.zIndex='9999';
 o.innerHTML='<div class="vr-dialog" role="alertdialog" aria-modal="true"><span class="vr-eyebrow">HESAP</span><h2>Hesabın yasaklandı</h2><p class="vr-lead">'+(ban?.reason?'Sebep: <b>'+escapeAttr(ban.reason)+'</b><br>':'')+(ban?.until?'Bitiş: <b>'+valorAdminDate(ban.until)+'</b>':'Bu yasak kalıcıdır.')+'<br>İtiraz için oyun yöneticisiyle iletişime geç.</p><button type="button" class="vr-claim" onclick="document.getElementById(\'valor-ban\').remove();valorAccountLogout()">Çıkış Yap</button></div>';
 document.body.appendChild(o);
}

/* ---------- Panel ---------- */
async function valorAdminLoad(what){
 if(valorAdmin.busy)return;valorAdmin.busy=true;
 try{
  if(what==='stats'||!valorAdmin.stats)valorAdmin.stats=await valorAdminRpc('admin_stats');
  if(what==='players')valorAdmin.players=await valorAdminRpc('admin_find',{q:valorAdmin.q});
  if(what==='cheats')valorAdmin.cheats=await valorAdminRpc('admin_cheat_log',{lim:100});
  if(what==='chat')valorAdmin.chat=await valorAdminRpc('admin_chat',{lim:80});
 }catch(e){toast((e.status===404||e.code==='PGRST202')?'Yönetim sunucuda henüz kurulmadı.':e.message)}
 finally{valorAdmin.busy=false;if(page==='Yönetim')render()}
}
async function valorAdminDo(name,body,ok){
 try{const r=await valorAdminRpc(name,body);if(r==='ok'){toast(ok)}else toast({not_admin:'Yetkin yok.',weak:'Şifre 8–72 karakter olmalı.',invalid:'İşlem yapılamadı.'}[r]||'İşlem yapılamadı.');}
 catch(e){toast(e.message)}
 valorAdminLoad('players');valorAdminLoad('stats');
}
function valorAdminTab(t){valorAdmin.tab=t;valorAdmin.sel=null;render();valorAdminLoad(t)}
function valorAdminSearch(){valorAdmin.q=(document.getElementById('vad-q')?.value||'').trim();valorAdminLoad('players')}
function valorAdminPick(id){valorAdmin.sel=valorAdmin.sel===id?null:id;render()}
function valorAdminVal(id){return document.getElementById(id)?.value||''}
function valorAdminGrant(uid){const d=Math.trunc(Number(valorAdminVal('vad-dia'))||0),g=Math.trunc(Number(valorAdminVal('vad-gold'))||0);if(!d&&!g)return toast('Miktar gir');if(!confirm('Elmas '+d+', altın '+g+' verilsin mi?'))return;valorAdminDo('admin_grant',{uid,add_diamonds:d,add_gold:g},'Verildi. Oyuncu oyunu yenileyince görür.')}
function valorAdminHours(id){const v=valorAdminVal(id);return v==='perm'?null:Number(v)}
function valorAdminMute(uid){valorAdminDo('admin_mute',{uid,hours:valorAdminHours('vad-mute'),why:valorAdminVal('vad-mute-why')},'Sohbet cezası güncellendi.')}
function valorAdminBan(uid,name){const h=valorAdminHours('vad-ban');if(h!==0&&!confirm(name+' yasaklansın mı?'))return;valorAdminDo('admin_ban',{uid,hours:h,why:valorAdminVal('vad-ban-why')},h===0?'Yasak kaldırıldı.':'Oyuncu yasaklandı.')}
function valorAdminPass(uid,name){const p=valorAdminVal('vad-pass');if(p.length<8)return toast('Şifre en az 8 karakter olmalı');if(!confirm(name+' için şifre değiştirilsin mi?'))return;valorAdminDo('admin_reset_password',{uid,new_password:p},'Şifre değiştirildi. Yeni şifreyi oyuncuya ilet.')}
function valorAdminDelMsg(id){valorAdminRpc('admin_delete_message',{mid:id}).then(()=>{toast('Mesaj silindi');valorAdminLoad('chat')}).catch(e=>toast(e.message))}
/* ---------- Eşya Ver ---------- */
valorAdmin.giftKind='item';
function valorAdminOptions(list,sel){return list.map(([v,t])=>'<option value="'+escapeAttr(String(v))+'"'+(String(v)===String(sel)?' selected':'')+'>'+escapeAttr(t)+'</option>').join('')}
function valorAdminStackList(){
 const ids=[...new Set([...(typeof marketProducts!=='undefined'?marketProducts.map(x=>x.id):[]),'petFood','luckBag','mosaicStone','mountStone','energyBottle','expeditionPaper','anniversaryBox','luckFeather','evoPiece','wheelFashionBag'])];
 return ids.map(id=>[id,(typeof marketProduct==='function'&&marketProduct(id)?.name)||id]).filter(([id,n])=>n);
}
function valorAdminGiftForm(p){
 const k=valorAdmin.giftKind,num=(id,v,min,max,ph)=>'<input id="'+id+'" type="number" min="'+min+'" max="'+max+'" value="'+v+'" placeholder="'+ph+'">';
 let f='';
 if(k==='item')f='<div class="vad-line"><select id="vad-gc">'+valorAdminOptions(classes.map(c=>[c,c]),p.class||classes[0])+'</select><select id="vad-gs">'+valorAdminOptions([...slots.map(x=>[x,x]),['set','Tüm set (6 parça)']],'set')+'</select></div><div class="vad-line"><label class="vad-mini-label">Seviye'+num('vad-gl',Math.max(1,Number(p.level)||1),1,100,'Seviye')+'</label><label class="vad-mini-label">Artı'+num('vad-gp',0,0,21,'+')+'</label><select id="vad-gt">'+valorAdminOptions([[0,'Normal'],[1,'Epik'],[2,'Ebedi'],[3,'İlahi']],0)+'</select><label class="vad-mini-label">Adet'+num('vad-gn',1,1,10,'Adet')+'</label></div>';
 else if(k==='stack')f='<div class="vad-line"><select id="vad-gid">'+valorAdminOptions(valorAdminStackList(),'petFood')+'</select>'+num('vad-gn',10,1,999999,'Adet')+'</div>';
 else if(k==='stone')f='<div class="vad-line"><select id="vad-glv">'+valorAdminOptions(Array.from({length:8},(_,i)=>[i+1,'Şans Taşı Sv.'+(i+1)]),4)+'</select>'+num('vad-gn',5,1,9999,'Adet')+'</div>';
 else if(k==='gem')f='<div class="vad-line"><select id="vad-gty">'+valorAdminOptions((typeof veGemTypes!=='undefined'?veGemTypes:[]).map(t=>[t,t]),'')+'</select><select id="vad-glv">'+valorAdminOptions(Array.from({length:10},(_,i)=>[i+1,'Sv.'+(i+1)]),3)+'</select>'+num('vad-gn',1,1,999,'Adet')+'</div>';
 else if(k==='talisman'){const T=window.valorTalismanTypes||[],C=window.valorTalismanColors||[];f='<div class="vad-line"><select id="vad-tt">'+valorAdminOptions([['','Rastgele tür'],...T.map(t=>[t.id,t.name.replace(' Tılsımı','')])],'')+'</select><select id="vad-tc">'+valorAdminOptions([['','Rastgele renk'],...C.map(c=>[c.id,c.name])],'')+'</select></div><div class="vad-line"><label class="vad-mini-label">Seviye'+num('vad-tl',1,1,10,'Sv')+'</label><label class="vad-mini-label">Adet'+num('vad-gn',1,1,20,'Adet')+'</label></div>'}
 else if(k==='wing'){const W=typeof valorWings!=='undefined'?valorWings:[];f='<div class="vad-line"><select id="vad-wid">'+valorAdminOptions(W.map(w=>[w.id,w.name]),W[0]?.id)+'</select><label class="vad-mini-label">Seviye'+num('vad-wl',1,1,10,'Sv')+'</label><label class="vad-mini-label">Adet'+num('vad-gn',1,1,20,'Adet')+'</label></div>'}
 else f='<div class="vad-line">'+num('vad-gn',500,1,9999999,'Dukat')+'</div>';
 return '<div><label>Eşya ver</label><div class="vad-line"><select id="vad-gk" onchange="valorAdmin.giftKind=this.value;render()">'+valorAdminOptions([['item','Ekipman'],['talisman','Tılsım'],['wing','Kanat'],['stack','Market / çanta eşyası (Şans Tüyü, Evrim Parçası…)'],['stone','Şans taşı'],['gem','Mozaik taşı'],['dukat','Dukat']],k)+'</select></div>'+f+'<div class="vad-line"><button type="button" class="vad-give" onclick="valorAdminGive(\''+p.user_id+'\')">'+(p.user_id===valorAccountActive?.id?'Kendime Ver':'Ver')+'</button></div></div>';
}
function valorAdminGiftOps(){
 const v=id=>document.getElementById(id)?.value,n=(id,min,max)=>Math.max(min,Math.min(max,Math.floor(Number(v(id))||min))),k=valorAdmin.giftKind,ops=[];
 if(k==='item'){const cls=v('vad-gc'),sl=v('vad-gs'),lvl=n('vad-gl',1,100),plus=n('vad-gp',0,21),tier=n('vad-gt',0,3),count=n('vad-gn',1,10);
  for(let c=0;c<count;c++)for(const slot of sl==='set'?slots:[sl])ops.push({kind:'item',item:JSON.parse(JSON.stringify({...item(slot,cls,lvl),plus,epic:tier>0,evolutionTier:tier}))})}
 else if(k==='stack'){const id=v('vad-gid'),pr=typeof marketProduct==='function'?marketProduct(id):null;ops.push({kind:'stack',id,name:pr?.name||id,description:pr?.description||'',count:n('vad-gn',1,999999)})}
 else if(k==='talisman'&&typeof valorTalismanMake==='function'){const type=v('vad-tt')||null,col=v('vad-tc'),lvl=n('vad-tl',1,10),count=n('vad-gn',1,20);for(let c=0;c<count;c++){const it=valorTalismanMake(lvl,type,col===''?null:Number(col));ops.push({kind:'item',talisman:true,item:JSON.parse(JSON.stringify(it))})}}
 else if(k==='wing'){const w=(typeof valorWings!=='undefined'?valorWings:[]).find(x=>x.id===v('vad-wid'));if(w){const lvl=n('vad-wl',1,10),count=n('vad-gn',1,20);for(let c=0;c<count;c++)ops.push({kind:'item',wing:true,item:{id:valorUniqueItemId(),wingId:w.id,slot:'Kanat',name:w.name,cls:'Tüm Sınıflar',level:lvl,wingLevel:lvl,plus:0,epic:false}})}}
 else if(k==='stone')ops.push({kind:'stone',level:n('vad-glv',1,8),count:n('vad-gn',1,9999)});
 else if(k==='gem')ops.push({kind:'gem',type:v('vad-gty'),level:n('vad-glv',1,10),count:n('vad-gn',1,999)});
 else ops.push({kind:'dukat',count:n('vad-gn',1,9999999)});
 return ops;
}
function valorAdminGiftLabel(ops){const o=ops[0];if(!o)return '';if(o.talisman){const c=(window.valorTalismanColors||[])[o.item.talismanColor];return ops.length+' × '+(new Set(ops.map(x=>x.item.talismanType)).size>1?'Tılsım':o.item.name)+(new Set(ops.map(x=>x.item.talismanColor)).size>1?'':' ('+(c?.name||'')+')')+' Sv.'+o.item.talismanLevel}if(o.wing)return ops.length+' × '+o.item.name+' Sv.'+o.item.wingLevel;return o.kind==='item'?ops.length+' ekipman':o.kind==='stack'?o.count+' × '+o.name:o.kind==='stone'?o.count+' × Şans Taşı Sv.'+o.level:o.kind==='gem'?o.count+' × '+o.type+' Sv.'+o.level:o.count+' Dukat'}
async function valorAdminGive(uid){
 const ops=valorAdminGiftOps();if(!ops.length)return;const label=valorAdminGiftLabel(ops);
 if(uid===valorAccountActive?.id){
  // To myself: straight into my bag, saved like any other change.
  for(const o of ops){if(o.kind==='item')state.inventory.push(o.item);else if(o.kind==='stack')addMarketStack(o.id,o.count);else if(o.kind==='stone')addLuckStoneStack(o.level,o.count);else if(o.kind==='gem')vwAddGem(o.type,o.level,o.count);else{const d=valorCastleData();d.medallions=(Number(d.medallions)||0)+o.count}}
  save();render();toast(label+' çantana eklendi');return;
 }
 if(!confirm(label+' verilsin mi?'))return;
 valorAdminDo('admin_give',{uid,ops},label+' verildi. Oyuncu oyunu yenileyince görür.');
}
function valorAdminPlayerRow(p){
 const tags=[p.hidden?'<i class="vad-tag">gizli</i>':'',p.trusted?'<i class="vad-tag ok">test</i>':'',p.muted?'<i class="vad-tag warn">susturulmuş</i>':'',p.banned?'<i class="vad-tag bad">yasaklı</i>':'',p.cheats?'<i class="vad-tag warn">'+p.cheats+' hile kaydı</i>':''].join('');
 const open=valorAdmin.sel===p.user_id,nm=escapeAttr(String(p.name||p.username).replace(/'/g,''));
 return '<article class="vad-player'+(open?' open':'')+'"><button type="button" class="vad-row" onclick="valorAdminPick(\''+p.user_id+'\')"><span><b>'+escapeAttr(p.name||'—')+'</b><small>'+escapeAttr(p.username)+' · '+escapeAttr(p.class||'')+' Sv.'+(p.level||1)+' · '+money(p.power||0)+' güç</small><small>💎 '+money(p.diamonds||0)+' · 🪙 '+money(p.gold||0)+' · '+valorAdminDate(p.updated_at)+'</small></span><span class="vad-tags">'+tags+'</span></button>'
  +(open?'<div class="vad-actions">'
   +'<div><label>Elmas / altın ver (eksi = al)</label><div class="vad-line"><input id="vad-dia" type="number" placeholder="Elmas"><input id="vad-gold" type="number" placeholder="Altın"><button type="button" onclick="valorAdminGrant(\''+p.user_id+'\')">Ver</button></div></div>'
   +'<div class="vad-line"><button type="button" onclick="valorAdminDo(\'admin_flag\',{uid:\''+p.user_id+'\',flag:\'hidden\',val:'+!p.hidden+'},\'Güncellendi\')">'+(p.hidden?'Sıralamada göster':'Sıralamadan gizle')+'</button><button type="button" onclick="valorAdminDo(\'admin_flag\',{uid:\''+p.user_id+'\',flag:\'trusted\',val:'+!p.trusted+'},\'Güncellendi\')">'+(p.trusted?'Test işaretini kaldır':'Test hesabı yap')+'</button></div>'
   +'<div><label>Sohbet cezası '+(p.muted?'(şu an: '+valorAdminDate(p.muted)+')':'')+'</label><div class="vad-line"><select id="vad-mute"><option value="1">1 saat</option><option value="24">24 saat</option><option value="168">7 gün</option><option value="perm">Kalıcı</option><option value="0">Cezayı kaldır</option></select><input id="vad-mute-why" placeholder="Sebep"><button type="button" onclick="valorAdminMute(\''+p.user_id+'\')">Uygula</button></div></div>'
   +'<div><label>Hesap yasağı '+(p.banned?'(şu an: '+valorAdminDate(p.banned)+')':'')+'</label><div class="vad-line"><select id="vad-ban"><option value="24">24 saat</option><option value="168">7 gün</option><option value="720">30 gün</option><option value="perm">Kalıcı</option><option value="0">Yasağı kaldır</option></select><input id="vad-ban-why" placeholder="Sebep"><button type="button" class="vad-danger" onclick="valorAdminBan(\''+p.user_id+'\',\''+nm+'\')">Uygula</button></div></div>'
   +valorAdminGiftForm(p)
   +'<div><label>Şifre sıfırla</label><div class="vad-line"><input id="vad-pass" type="text" autocomplete="off" placeholder="Yeni şifre (en az 8)"><button type="button" onclick="valorAdminPass(\''+p.user_id+'\',\''+nm+'\')">Değiştir</button></div></div>'
  +'</div>':'')+'</article>';
}
function valorAdminPage(){
 if(!valorAdminIs())return '<section class="vad-page"><p>Bu sayfa yalnızca yöneticiler içindir.</p></section>';
 const a=valorAdmin,s=a.stats;if(!s)valorAdminLoad('stats');
 const stats=s?[['Oyuncu',s.players],['Bugün aktif',s.active_today],['Çevrimiçi',s.online],['Birlik',s.guilds],['Yasaklı',s.bans],['Bugün hile',s.cheats_today]].map(([k,v])=>'<div><span>'+k+'</span><b>'+money(v||0)+'</b></div>').join(''):'<p class="small">Yükleniyor…</p>';
 let body='';
 if(a.tab==='players'){if(!a.players&&!a.busy)valorAdminLoad('players');body='<div class="vad-line"><input id="vad-q" placeholder="Karakter ya da kullanıcı adı" value="'+escapeAttr(a.q)+'" onkeydown="if(event.key===\'Enter\')valorAdminSearch()"><button type="button" onclick="valorAdminSearch()">Ara</button></div>'+(a.players?(a.players.map(valorAdminPlayerRow).join('')||'<p class="small">Oyuncu bulunamadı.</p>'):'<p class="small">Yükleniyor…</p>')}
 else if(a.tab==='cheats'){if(!a.cheats&&!a.busy)valorAdminLoad('cheats');body=a.cheats?(a.cheats.map(c=>'<div class="vad-log"><b>'+escapeAttr(c.name||'—')+'</b><span>'+escapeAttr(c.kind)+': '+money(c.old)+' → '+money(c.new)+' (izin: '+money(c.allowed)+')</span><small>'+valorAdminDate(c.at)+'</small></div>').join('')||'<p class="small">Hile kaydı yok.</p>'):'<p class="small">Yükleniyor…</p>'}
 else{if(!a.chat&&!a.busy)valorAdminLoad('chat');body=a.chat?(a.chat.map(m=>'<div class="vad-log"><b>'+escapeAttr(m.name)+' <small>'+(m.channel==='world'?'Dünya':'Birlik')+'</small></b><span>'+escapeAttr(m.body)+'</span><small>'+valorAdminDate(m.at)+' <button type="button" class="vad-danger vad-mini" onclick="valorAdminDelMsg('+m.id+')">Sil</button></small></div>').join('')||'<p class="small">Mesaj yok.</p>'):'<p class="small">Yükleniyor…</p>'}
 return '<section class="vad-page"><h1>🛠 Yönetim</h1><div class="vad-stats">'+stats+'</div><nav class="vad-tabs">'+[['players','Oyuncular'],['cheats','Hile Kayıtları'],['chat','Sohbet']].map(([k,v])=>'<button type="button" aria-pressed="'+(a.tab===k)+'" onclick="valorAdminTab(\''+k+'\')">'+v+'</button>').join('')+'</nav>'+body+'</section>';
}
(function(){
 const prevRender=render;
 render=function(){const r=prevRender.apply(this,arguments);if(page==='Yönetim'&&state.class&&!document.body.classList.contains('valor-account-screen')){const main=document.getElementById('main');if(main)main.innerHTML=valorAdminPage()}return r};
 const prevProfile=profile;
 profile=function(){const html=prevProfile.apply(this,arguments);return valorAdminIs()?html.replace('<div class="vauth-profile-link">','<div class="vauth-profile-link"><button type="button" class="vad-open" onclick="go(\'Yönetim\')">🛠 Yönetim</button>'):html};
 /* A save refused with "banned" shows the ban screen. */
 const prevStatus=valorCloudSetStatus;
 valorCloudSetStatus=function(s){const r=prevStatus.apply(this,arguments);if(s==='error'&&/banned/i.test(valorCloudLastError||''))valorAdminCheck();return r};
 if(state.class)setTimeout(valorAdminCheck,1200);
})();
