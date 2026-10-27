/* Chat: a portrait before each nick (class + gender) and tapping the portrait or nick opens the player's profile.
   Looks and profiles come from supabase/profiles.sql; until it is run the portrait uses the class only. */
const VALOR_CHAT_AVATAR={'Büyücü':'mage','Savaşçı':'warrior','Okçu':'archer'};
const valorChatLooks={gender:{},pending:new Set(),timer:null,off:false};
function valorChatAvatarSrc(cls,gender){return 'assets/chat/avatars/'+(VALOR_CHAT_AVATAR[cls]||'warrior')+'-'+(gender==='female'?'female':'male')+'.webp'}
function valorChatGenderOf(name){if(name===state.name)return state.gender==='female'?'female':'male';return valorChatLooks.gender[String(name).toLocaleLowerCase('tr')]}
function valorChatWantLooks(name){
 if(valorChatLooks.off||!name||name===state.name||valorChatGenderOf(name))return;
 valorChatLooks.pending.add(name);
 if(!valorChatLooks.timer)valorChatLooks.timer=setTimeout(valorChatLoadLooks,250);
}
async function valorChatLoadLooks(){
 valorChatLooks.timer=null;const names=[...valorChatLooks.pending].slice(0,60);valorChatLooks.pending.clear();if(!names.length)return;
 try{
  const rows=await valorCloudFetch('/rest/v1/rpc/player_looks',{method:'POST',body:JSON.stringify({names})});
  for(const n of names)valorChatLooks.gender[n.toLocaleLowerCase('tr')]='male';   // unknown names: stop asking
  for(const r of Array.isArray(rows)?rows:[])valorChatLooks.gender[String(r.name).toLocaleLowerCase('tr')]=r.gender==='female'?'female':'male';
  if(typeof valorChatPaint==='function')valorChatPaint();
 }catch(e){if(e.status===404||e.code==='PGRST202')valorChatLooks.off=true}
}
function valorChatJs(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
(function(){
 const prevRow=valorChatRow;
 valorChatRow=function(m){
  let html=prevRow.apply(this,arguments);if(!html)return html;
  valorChatWantLooks(m.name);
  const arg=escapeAttr(valorChatJs(m.name)),tag=m.tag?escapeAttr(valorChatJs(m.tag)):'',open='valorChatOpenProfile(\''+arg+'\',\''+tag+'\')';
  const avatar='<button type="button" class="vch-avatar" onclick="'+open+'" aria-label="'+escapeAttr(m.name)+' profilini aç"><img src="'+valorChatAvatarSrc(m.class,valorChatGenderOf(m.name))+'" alt="" loading="lazy" decoding="async"></button>';
  html=html.replace(/^<div class="vch-msg([^"]*)">/,'<div class="vch-msg vch-has-av$1">'+avatar+'<div class="vch-body">');
  html=html.replace(/(<b style="[^"]*">)([\s\S]*?)(<\/b>)/,'<button type="button" class="vch-name" onclick="'+open+'">$1$2$3</button>');
  return html.replace(/<\/div>$/,'</div></div>');
 };
})();
/* Another player's profile is drawn by the game's own Profil screen. While it is drawn, the global state is
   swapped for the viewed character (from player_card), and saving and cloud uploads are paused, so nothing of
   the viewed character can ever be written into your save. Everything is read-only. */
let valorProfileView=null,valorProfileViewOpening=false;
function valorProfileViewState(p){
 const v=JSON.parse(JSON.stringify(p.view||{})),eq=v.equipped&&typeof v.equipped==='object'?v.equipped:{};
 return {...v,name:p.name,class:p.class,level:Number(p.level)||Number(v.level)||1,equipped:eq,
  inventory:Object.values(eq).filter(it=>it&&typeof it==='object'),gemInventory:[],gold:0,diamonds:0,logs:[],stats:v.stats||{}};
}
function valorProfileViewClose(){const back=valorProfileView?.back||'Sohbet';valorProfileView=null;go(back)}
async function valorChatOpenProfile(name,tag){
 if(!name)return;
 if(name===state.name){go('Profil');return}
 let p=null;
 try{p=await valorCloudFetch('/rest/v1/rpc/player_card',{method:'POST',body:JSON.stringify({n:name})})}
 catch(e){return toast((e.status===404||e.code==='PGRST202')?'Oyuncu profilleri sunucuda henüz kurulmadı.':'Profil açılamadı.')}
 if(!p||!p.name)return toast('Bu oyuncu bulunamadı.');
 if(p.is_me){go('Profil');return}
 if(!p.view)return toast('Profil için sunucudaki profiles.sql güncellenmeli.');
 valorProfileView={name:p.name,tag:tag||'',back:page==='Profil'?'Sohbet':page,state:valorProfileViewState(p),power:Number(p.power)||0,rank:p.rank,popularity:Number(p.popularity)||0};
 valorProfileViewOpening=true;try{go('Profil')}finally{valorProfileViewOpening=false}
 window.scrollTo(0,0);
}
function valorProfileViewAddFriend(btn){
 const n=valorProfileView?.name;if(!n||typeof valorSocialCall!=='function')return;btn.disabled=true;
 valorSocialCall('friend_request',{target:n}).then(code=>{btn.textContent=code==='sent'?'İstek Gönderildi':code==='accepted'||code==='already'?'✓ Arkadaşın':'+ Arkadaş Ekle';btn.disabled=['sent','accepted','already','pending'].includes(code)});
}
(function(){
 const prevGo=go;
 go=function(){if(!valorProfileViewOpening)valorProfileView=null;return prevGo.apply(this,arguments)};
 const prevProfile=profile;
 profile=function(){
  const view=valorProfileView;if(!view||page!=='Profil')return prevProfile.apply(this,arguments);
  const real=state,realSave=save,realBlocked=valorCloudBlocked;let html;
  try{state=view.state;save=function(){};valorCloudBlocked=true;html=prevProfile.apply(this,arguments)}
  finally{state=real;save=realSave;valorCloudBlocked=realBlocked}
  const t=document.createElement('template');t.innerHTML=html;const c=t.content;
  // Read-only: no account box, no title picker, no stat buttons, no taps on equipment.
  c.querySelectorAll('.vauth-profile-link,.vtl-picker,.vp-plus,.vp-hint,.valor-profile-tag').forEach(e=>e.remove());
  c.querySelectorAll('[onclick],[ondblclick]').forEach(e=>{e.removeAttribute('onclick');e.removeAttribute('ondblclick')});
  c.querySelectorAll('button').forEach(b=>{b.disabled=true;b.tabIndex=-1});
  if(view.tag)c.querySelector('.vp-gear.vp-left')?.insertAdjacentHTML('beforebegin','<div class="valor-profile-tag">✦ '+escapeAttr(view.tag)+' ✦</div>');
  const friend=(typeof valorSocialList==='function'?valorSocialList('friends'):[]).some(f=>f.name===view.name);
  const bar='<div class="vpv-bar"><button type="button" class="vpv-back" onclick="valorProfileViewClose()">‹ Geri</button><span>OYUNCU PROFİLİ</span></div>'
   +'<div class="vpv-actions">'+(typeof valorSocialCall==='function'?'<button type="button" '+(friend?'disabled':'')+' onclick="valorProfileViewAddFriend(this)">'+(friend?'✓ Arkadaşın':'+ Arkadaş Ekle')+'</button>':'')
   +(typeof valorHeartOpen==='function'?'<button type="button" onclick="valorHeartOpen(\''+escapeAttr(view.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'"))+'\')">♥ Kalp Gönder</button>':'')+'</div>';
  const wrap=c.querySelector('.vp-wrap');
  if(wrap){wrap.classList.add('vpv-wrap');wrap.insertAdjacentHTML('afterbegin',bar)}else return bar+t.innerHTML;
  return t.innerHTML;
 };
})();
