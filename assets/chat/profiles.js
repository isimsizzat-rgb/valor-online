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
/* Opens the same profile window the rankings use (equipment, stats, heart gift), plus Arkadaş Ekle. */
async function valorChatOpenProfile(name,tag){
 if(!name)return;
 if(name===state.name){go('Profil');return}
 let p=null;
 try{p=await valorCloudFetch('/rest/v1/rpc/player_card',{method:'POST',body:JSON.stringify({n:name})})}
 catch(e){
  // Before profiles.sql: use the rankings if this player is listed there.
  if(typeof valorRankOnline!=='undefined')for(const k of Object.keys(valorRankOnline)){const r=(valorRankOnline[k]?.rows||[]).find(x=>x.name===name);if(r){p={...r,rank:null};break}}
  if(!p)return toast((e.status===404||e.code==='PGRST202')?'Oyuncu profilleri sunucuda henüz kurulmadı.':'Profil açılamadı.');
 }
 if(!p||!p.name)return toast('Bu oyuncu bulunamadı.');
 if(p.is_me){go('Profil');return}
 const row={name:p.name,class:p.class,level:Number(p.level)||1,power:Number(p.power)||0,xp:Number(p.xp)||0,spirit:Number(p.spirit)||0,fame:Number(p.fame)||0,popularity:Number(p.popularity)||0,profile:p.profile||null,rank:p.rank==null?'—':Number(p.rank)};
 window.valorRankShown=[row];valorOpenRankProfile(0);
 const modal=document.getElementById('valor-rank-modal');if(!modal)return;
 const back=modal.querySelector('.valor-rank-back');if(back)back.textContent='‹ Sohbete Dön';
 const label=modal.querySelector('.valor-rank-profile-toolbar span');if(label)label.textContent='OYUNCU PROFİLİ';
 modal.querySelectorAll('.vp-stat span').forEach(s=>{if(s.textContent==='Sıra')s.textContent='Güç Sırası'});
 const t=modal.querySelector('.valor-profile-tag');
 if(t){if(tag){t.textContent='✦ '+tag+' ✦';t.classList.remove('valor-tag-reserved')}else{t.textContent='';t.classList.add('valor-tag-reserved')}}
 if(typeof valorSocialCall==='function'){
  const friend=(typeof valorSocialList==='function'?valorSocialList('friends'):[]).some(f=>f.name===p.name);
  const box=document.createElement('div');box.className='vch-profile-actions';
  box.innerHTML='<button type="button" '+(friend?'disabled':'')+'>'+(friend?'✓ Arkadaşın':'+ Arkadaş Ekle')+'</button>';
  box.querySelector('button').addEventListener('click',async ev=>{const b=ev.currentTarget;b.disabled=true;const code=await valorSocialCall('friend_request',{target:p.name});b.textContent=code==='sent'?'İstek Gönderildi':code==='accepted'?'✓ Arkadaşın':'+ Arkadaş Ekle';b.disabled=code==='sent'||code==='accepted'||code==='already'||code==='pending'});
  const host=modal.querySelector('.vp-header')||modal.querySelector('.valor-rank-full-profile');host?.insertAdjacentElement('afterend',box);
 }
}
