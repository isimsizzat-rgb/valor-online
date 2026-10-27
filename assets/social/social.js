/* Social: friends, friend requests and blocking. Everything lives on the server (supabase/friends.sql);
   the screen keeps a short-lived copy of social_state() and calls one function per action. */
const VALOR_FRIEND_LIMIT=50,VALOR_SOCIAL_TTL=20000;
let valorSocialTab='friends';
const valorSocial={data:null,at:0,loading:false,busy:false,error:'',notice:'',noticeOk:false,owner:null};
function valorSocialOnline(){return !!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
function valorSocialSelect(tab){
 if(!['friends','add','manage'].includes(tab))return;
 valorSocialTab=tab;valorSocial.notice='';if(page==='Sosyal'){render();document.getElementById('vsocial-tab-'+tab)?.focus({preventScroll:true})}
}
function valorSocialSetupError(e){return (e.status===404||e.code==='PGRST202')?'Arkadaş sistemi sunucuda henüz kurulmadı.':(e.message||'Bağlantı kurulamadı.')}
async function valorSocialLoad(force){
 if(!valorSocialOnline()||!state.class)return;
 if(valorSocial.owner!==valorAccountActive.id){valorSocial.owner=valorAccountActive.id;valorSocial.data=null;valorSocial.at=0}
 if(valorSocial.loading||(!force&&valorSocial.at&&Date.now()-valorSocial.at<VALOR_SOCIAL_TTL))return;
 valorSocial.loading=true;const before=JSON.stringify(valorSocial.data)+valorSocial.error;
 try{const r=await valorCloudFetch('/rest/v1/rpc/social_state',{method:'POST',body:'{}'});valorSocial.data={friends:r?.friends||[],incoming:r?.incoming||[],outgoing:r?.outgoing||[],blocked:r?.blocked||[]};valorSocial.error=''}
 catch(e){valorSocial.error=valorSocialSetupError(e)}
 finally{valorSocial.at=Date.now();valorSocial.loading=false;if(JSON.stringify(valorSocial.data)+valorSocial.error!==before&&(page==='Sosyal'||page==='Sohbet'))render()}
}
const VALOR_SOCIAL_MESSAGES={
 sent:['Arkadaşlık isteği gönderildi.',true],accepted:['Artık arkadaşsınız!',true],declined:['İstek reddedildi.',true],ok:['Tamam.',true],
 not_found:['Bu isimde bir oyuncu bulunamadı.'],self:['Kendini arkadaş olarak ekleyemezsin.'],already:['Bu oyuncu zaten arkadaşın.'],
 pending:['Bu oyuncuya zaten istek gönderdin.'],you_blocked:['Bu oyuncuyu engellemişsin. Önce engeli kaldır.'],unavailable:['Bu oyuncuya istek gönderilemiyor.'],
 my_limit:['Arkadaş listen dolu (en fazla '+VALOR_FRIEND_LIMIT+').'],their_limit:['Bu oyuncunun arkadaş listesi dolu.'],too_many:['Çok fazla bekleyen isteğin var.'],
 no_request:['Bu istek artık geçerli değil.'],invalid:['İşlem yapılamadı.']
};
async function valorSocialCall(fn,body,success){
 if(valorSocial.busy||!valorSocialOnline())return null;
 valorSocial.busy=true;let code=null;
 try{if(typeof valorCloudFlush==='function')await valorCloudFlush().catch(()=>{});code=await valorCloudFetch('/rest/v1/rpc/'+fn,{method:'POST',body:JSON.stringify(body)})}
 catch(e){valorSocial.notice=valorSocialSetupError(e);valorSocial.noticeOk=false}
 finally{valorSocial.busy=false}
 if(code!==null){const m=VALOR_SOCIAL_MESSAGES[code]||['İşlem yapılamadı.'];valorSocial.notice=code==='ok'&&success?success:m[0];valorSocial.noticeOk=!!m[1]}
 await valorSocialLoad(true);if(page==='Sosyal')render();
 if(code&&valorSocial.notice)toast(valorSocial.notice);
 return code;
}
function valorSocialList(kind){return valorSocial.data?.[kind]||[]}
function valorSocialName(kind,i){return valorSocialList(kind)[i]?.name||''}
function valorSocialAdd(){
 const input=document.getElementById('vsocial-player'),name=(input?.value||'').trim();
 if(name.length<3){valorSocial.notice='Karakter adını yaz.';valorSocial.noticeOk=false;render();return}
 valorSocialCall('friend_request',{target:name}).then(code=>{if(code==='sent'||code==='accepted'){const i=document.getElementById('vsocial-player');if(i)i.value=''}});
}
function valorSocialAnswer(i,accept){const n=valorSocialName('incoming',i);if(n)valorSocialCall('friend_answer',{target:n,accept})}
function valorSocialCancel(i){const n=valorSocialName('outgoing',i);if(n)valorSocialCall('friend_cancel',{target:n},'İstek geri alındı.')}
function valorSocialRemove(i){const n=valorSocialName('friends',i);if(n&&confirm(n+' arkadaş listenden çıkarılsın mı? Sen de onun listesinden çıkarsın.'))valorSocialCall('friend_remove',{target:n},n+' arkadaş listenden çıkarıldı.')}
function valorSocialBlockName(n){if(n&&confirm(n+' engellensin mi? Arkadaşlığınız biter, sana istek gönderemez ve sohbet mesajlarını görmezsin.'))return valorSocialCall('player_block',{target:n},n+' engellendi.');return Promise.resolve(null)}
function valorSocialBlock(i){valorSocialBlockName(valorSocialName('friends',i))}
function valorSocialBlockTyped(){const n=(document.getElementById('vsocial-block-name')?.value||'').trim();if(n.length<3){valorSocial.notice='Engellemek istediğin karakter adını yaz.';valorSocial.noticeOk=false;render();return}valorSocialBlockName(n)}
function valorSocialUnblock(i){const n=valorSocialName('blocked',i);if(n)valorSocialCall('player_unblock',{target:n},n+' adlı oyuncunun engeli kaldırıldı.')}
function valorSocialHeart(i){const n=valorSocialName('friends',i);if(n&&typeof valorHeartOpen==='function')valorHeartOpen(n)}
function valorSocialSeen(iso){
 const t=Date.parse(iso);if(!t)return '';const m=Math.floor((Date.now()-t)/60000);
 if(m<10)return '<span class="vsocial-online">● Çevrimiçi</span>';
 return '<span class="vsocial-seen">'+(m<60?m+' dk önce':m<1440?Math.floor(m/60)+' sa önce':Math.floor(m/1440)+' gün önce')+'</span>';
}
function valorSocialWho(p){return '<div class="vsocial-who"><b>'+escapeAttr(p.name)+'</b><small>'+escapeAttr(p.class||'')+' · Sv. '+(Number(p.level)||1)+(p.power?' · '+money(Number(p.power)||0)+' SG':'')+'</small></div>'}
function valorSocialRow(p,extra,buttons){return '<li class="vsocial-row">'+valorSocialWho(p)+(extra||'')+'<div class="vsocial-row-actions">'+buttons+'</div></li>'}
function valorSocialEmpty(title,text){return '<div class="vsocial-empty"><p>'+title+'</p><small>'+text+'</small></div>'}
function valorSocialNotice(){return valorSocial.notice?'<p class="vsocial-notice '+(valorSocial.noticeOk?'ok':'bad')+'" role="status">'+escapeAttr(valorSocial.notice)+'</p>':''}
function valorSocialPanel(id,mark,title,sub,body){return '<section class="vhub-card vsocial-panel" id="vsocial-panel" role="tabpanel" aria-labelledby="vsocial-tab-'+id+'"><div class="vsocial-panel-heading"><span class="vsocial-mark" aria-hidden="true">'+mark+'</span><div><h2>'+title+'</h2><p>'+sub+'</p></div></div>'+valorSocialNotice()+body+'</section>'}
function valorSocialContent(){
 const d=valorSocial.data,dis=valorSocial.busy?' disabled':'';
 if(!valorSocialOnline())return valorSocialPanel('friends','♜','Arkadaşlarım','Yol arkadaşların bir arada.',valorSocialEmpty('Hesabınla giriş yapmalısın.','Arkadaş eklemek için çevrimiçi hesabınla oyna.'));
 if(!d)return valorSocialPanel(valorSocialTab,'♜','Sosyal','',valorSocial.error?valorSocialEmpty(escapeAttr(valorSocial.error),'<button type="button" onclick="valorSocialLoad(true)">Tekrar Dene</button>'):valorSocialEmpty('Yükleniyor…',''));
 if(valorSocialTab==='add'){
  const out=d.outgoing.length?'<h3 class="vsocial-sub">Gönderdiğin istekler ('+d.outgoing.length+')</h3><ul class="vsocial-list">'+d.outgoing.map((p,i)=>valorSocialRow(p,'',('<button type="button" class="vsocial-ghost" onclick="valorSocialCancel('+i+')"'+dis+'>Geri Al</button>'))).join('')+'</ul>':'';
  return valorSocialPanel('add','+','Arkadaş Ekle','Birlikte maceraya atılacağın oyuncuyu bul.','<label class="vsocial-label" for="vsocial-player">Karakter adı</label><form class="vsocial-add-row" onsubmit="event.preventDefault();valorSocialAdd()"><input id="vsocial-player" type="text" maxlength="20" autocomplete="off" placeholder="Oyuncunun karakter adı"><button type="submit"'+dis+'>İstek Gönder</button></form><p class="vsocial-note">Oyuncu isteğini kabul edince arkadaş olursunuz. En fazla '+VALOR_FRIEND_LIMIT+' arkadaş.</p>'+out);
 }
 if(valorSocialTab==='manage'){
  const friends=d.friends.length?'<ul class="vsocial-list">'+d.friends.map((p,i)=>valorSocialRow(p,'','<button type="button" class="vsocial-ghost" onclick="valorSocialRemove('+i+')"'+dis+'>Çıkar</button><button type="button" class="vsocial-danger" onclick="valorSocialBlock('+i+')"'+dis+'>Engelle</button>')).join('')+'</ul>':valorSocialEmpty('Henüz arkadaşın yok.','Arkadaş ekledikçe burada düzenleyebileceksin.');
  const blocked='<h3 class="vsocial-sub">Engellenenler ('+d.blocked.length+')</h3>'+(d.blocked.length?'<ul class="vsocial-list">'+d.blocked.map((p,i)=>valorSocialRow(p,'','<button type="button" class="vsocial-ghost" onclick="valorSocialUnblock('+i+')"'+dis+'>Engeli Kaldır</button>')).join('')+'</ul>':'<p class="vsocial-note">Engellediğin kimse yok.</p>')
   +'<form class="vsocial-add-row vsocial-block-row" onsubmit="event.preventDefault();valorSocialBlockTyped()"><input id="vsocial-block-name" type="text" maxlength="20" autocomplete="off" placeholder="Engellenecek karakter adı"><button type="submit" class="vsocial-danger"'+dis+'>Engelle</button></form>';
  return valorSocialPanel('manage','≡','Arkadaş Yönetimi','Arkadaşlarını çıkar, oyuncuları engelle.','<h3 class="vsocial-sub">Arkadaşların ('+d.friends.length+' / '+VALOR_FRIEND_LIMIT+')</h3>'+friends+blocked);
 }
 const inc=d.incoming.length?'<h3 class="vsocial-sub">Gelen istekler ('+d.incoming.length+')</h3><ul class="vsocial-list vsocial-incoming">'+d.incoming.map((p,i)=>valorSocialRow(p,'','<button type="button" onclick="valorSocialAnswer('+i+',true)"'+dis+'>Kabul Et</button><button type="button" class="vsocial-ghost" onclick="valorSocialAnswer('+i+',false)"'+dis+'>Reddet</button>')).join('')+'</ul>':'';
 const heart=typeof valorHeartOpen==='function';
 const list=d.friends.length?'<ul class="vsocial-list">'+d.friends.map((p,i)=>valorSocialRow(p,valorSocialSeen(p.seen),heart?'<button type="button" class="vsocial-ghost" onclick="valorSocialHeart('+i+')" aria-label="'+escapeAttr(p.name)+' adlı oyuncuya kalp gönder">❤ Kalp</button>':'')).join('')+'</ul>':valorSocialEmpty('Henüz arkadaşın yok.','Arkadaş Ekle sekmesinden karakter adıyla istek gönderebilirsin.')+'<button type="button" class="vsocial-primary" onclick="valorSocialSelect(\'add\')">Arkadaş Ekle ›</button>';
 return valorSocialPanel('friends','♜','Arkadaşlarım',d.friends.length+' / '+VALOR_FRIEND_LIMIT+' arkadaş',inc+(inc?'<h3 class="vsocial-sub">Arkadaşların</h3>':'')+list);
}
function valorSocialPage(){
 valorSocialLoad();
 const n=valorSocial.data?.incoming?.length||0;
 const tabs=[['friends','Arkadaşlarım'+(n?' <span class="vsocial-badge">'+n+'</span>':'')],['add','Arkadaş Ekle'],['manage','Arkadaş Yönetimi']];
 return '<section class="vhub-page vsocial-page">'+valorHubHeader('Sosyal','Dostlarınla aynı dünyayı paylaş.')+'<div class="vsocial-intro"><img src="assets/home-fantasy/sosyal.webp?v=1" alt=""><div><span>YOL ARKADAŞLARI</span><h2>Birlikte daha güçlüsünüz</h2><p>Arkadaşlarını ekle, listeni düzenle ve bağını koru.</p></div></div><nav class="vsocial-tabs" role="tablist" aria-label="Sosyal menüsü">'+tabs.map(([id,title])=>'<button type="button" id="vsocial-tab-'+id+'" role="tab" aria-selected="'+(valorSocialTab===id)+'" aria-controls="vsocial-panel" onclick="valorSocialSelect(\''+id+'\')">'+title+'</button>').join('')+'</nav>'+valorSocialContent()+'</section>';
}
/* Chat uses the same block list: blocked players' messages are hidden, and the chat block button blocks on the server. */
(function(){
 if(typeof valorChatBlocked==='function'){
  const localBlocked=valorChatBlocked;
  valorChatBlocked=function(){return [...new Set([...localBlocked(),...valorSocialList('blocked').map(p=>p.name)])]};
 }
 if(typeof valorChatBlock==='function'){
  const localBlock=valorChatBlock;
  valorChatBlock=function(name){if(!valorSocialOnline())return localBlock(name);valorSocialBlockName(name).then(code=>{if(code==='ok'&&typeof valorChatPaint==='function')valorChatPaint()})};
 }
 if(typeof valorChatUnblock==='function'){
  const localUnblock=valorChatUnblock;
  valorChatUnblock=function(name){const i=valorSocialList('blocked').findIndex(p=>p.name===name);if(i>=0)valorSocialUnblock(i);return localUnblock(name)};
 }
 setInterval(()=>{if(!document.hidden&&state.class&&(page==='Sosyal'||page==='Sohbet'))valorSocialLoad()},VALOR_SOCIAL_TTL);
})();
if(state.class)valorSocialLoad();
