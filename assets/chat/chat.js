/* World and guild chat (signed-in cloud accounts). Messages are stored on the server; while the chat
   screen is open new messages are fetched every few seconds. Sending is rate limited by the server. */
const VALOR_CHAT_POLL=4000,VALOR_CHAT_MAX=200;
const valorChat={channel:'world',msgs:{},last:{},loading:false,error:'',sending:false,timer:null,draft:'',inflight:null};
function valorChatOnline(){return !!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
function valorChatGuildChannel(){return state.guild?.serverId?'guild:'+state.guild.serverId:null}
function valorChatCurrent(){if(valorChat.channel!=='world'&&valorChat.channel!==valorChatGuildChannel())valorChat.channel='world';return valorChat.channel}
function valorChatBlocked(){return Array.isArray(state.chatBlocked)?state.chatBlocked:[]}
function valorChatTime(iso){const d=new Date(iso);return isNaN(d)?'':d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'})}
const valorChatColors={Savaşçı:'#e3a08f',Büyücü:'#c4a8f0',Okçu:'#9fd48a'};
function valorChatRow(m){
 const mine=m.user_id===valorAccountActive?.id,blocked=valorChatBlocked().includes(m.name);
 if(blocked)return '';
 return '<div class="vch-msg'+(mine?' mine':'')+(m.pending?' vch-pending':'')+'"><div class="vch-meta"><b style="color:'+(valorChatColors[m.class]||'#ecd7b4')+'">'+escapeAttr(m.name)+'</b><small>Sv.'+(m.level||1)+' · '+(m.pending?'gönderiliyor…':valorChatTime(m.created_at))+'</small>'+(mine?'':'<button type="button" class="vch-more" onclick="valorChatBlock(\''+escapeAttr(String(m.name).replace(/'/g,''))+'\')" aria-label="'+escapeAttr(m.name)+' engelle" title="Engelle">⊘</button>')+'</div><p>'+escapeAttr(m.body)+'</p></div>';
}
function valorChatListHtml(ch){const list=valorChat.msgs[ch];if(!list)return '<p class="vch-empty">Mesajlar yükleniyor…</p>';const rows=list.map(valorChatRow).join('');return rows||'<p class="vch-empty">Henüz mesaj yok. İlk mesajı sen yaz!</p>'}
function valorChatPaint(toBottom){
 const el=document.getElementById('vch-list');if(!el)return;
 const near=toBottom||el.scrollHeight-el.scrollTop-el.clientHeight<80;el.innerHTML=valorChatListHtml(valorChatCurrent());if(near||!el.dataset.painted)el.scrollTop=el.scrollHeight;el.dataset.painted='1';valorChatMarkSeen();
}
/* Only one read runs at a time. A forced read (right after sending) waits for the running one and then
   reads again, so the new message always shows up immediately. */
async function valorChatFetch(force){
 if(valorChat.inflight){if(!force)return valorChat.inflight;await valorChat.inflight.catch(()=>{})}
 valorChat.inflight=valorChatFetchOnce();
 try{return await valorChat.inflight}finally{valorChat.inflight=null}
}
async function valorChatFetchOnce(){
 const ch=valorChatCurrent();valorChat.loading=true;
 try{
  const last=valorChat.last[ch]||0;
  // The tag column arrives with supabase/chat-tags.sql; until it exists the list is read without it.
  const cols='id,user_id,name,class,level,body,created_at'+(valorChat.noTag?'':',tag'),rest='&channel=eq.'+encodeURIComponent(ch)+(last?'&id=gt.'+last+'&order=id.asc&limit=100':'&order=id.desc&limit=50');
  let rows;
  try{rows=await valorCloudFetch('/rest/v1/chat_messages?select='+cols+rest)}
  catch(e){if(valorChat.noTag||!(e.status===400||e.code==='42703'||e.code==='PGRST204'))throw e;valorChat.noTag=true;rows=await valorCloudFetch('/rest/v1/chat_messages?select=id,user_id,name,class,level,body,created_at'+rest)}rows=Array.isArray(rows)?rows:[];if(!last)rows.reverse();
  const list=valorChat.msgs[ch]||(valorChat.msgs[ch]=[]);
  if(rows.length){list.push(...rows.filter(r=>!list.some(x=>x.id===r.id)));if(list.length>150)list.splice(0,list.length-150);valorChat.last[ch]=Math.max(last,...rows.map(r=>r.id))}
  if(valorChat.error){valorChat.error='';if(page==='Sohbet')render()}
  valorChatPaint();
 }catch(e){const msg=(e.status===404||e.code==='PGRST205'||e.code==='42P01')?'Sohbet sunucuda henüz kurulmadı.':e.message;if(msg!==valorChat.error){valorChat.error=msg;if(page==='Sohbet')render()}}
 finally{valorChat.loading=false}
}
/* Sending shows the message at once (greyed while on its way), clears the box and keeps the keyboard
   open. If the server refuses it, the bubble is removed and the text goes back into the box. */
async function valorChatRpc(body,tag){
 if(tag&&!valorChat.noTagSend){try{return await valorCloudFetch('/rest/v1/rpc/chat_send',{method:'POST',body:JSON.stringify({...body,tag})})}catch(e){if(!(e.status===404||e.code==='PGRST202'))throw e;valorChat.noTagSend=true}}
 return valorCloudFetch('/rest/v1/rpc/chat_send',{method:'POST',body:JSON.stringify(body)});
}
async function valorChatSend(){
 const input=document.getElementById('vch-input'),text=(input?.value||'').replace(/\s+/g,' ').trim();
 if(!text)return;if(text.length>VALOR_CHAT_MAX)return toast('Mesaj en fazla '+VALOR_CHAT_MAX+' karakter olabilir');
 if(valorChat.sending)return toast('Önceki mesajın gönderiliyor…');
 valorChat.sending=true;
 const ch=valorChatCurrent(),list=valorChat.msgs[ch]||(valorChat.msgs[ch]=[]);
 const temp={id:'p'+Date.now(),pending:true,user_id:valorAccountActive?.id,name:state.name,class:state.class,level:state.level,body:text,created_at:new Date().toISOString(),tag:typeof valorTitleActive==='function'?valorTitleActive():null};
 list.push(temp);if(input){input.value='';input.focus({preventScroll:true})}valorChat.draft='';valorChatCount();valorChatPaint(true);
 const drop=()=>{const i=list.indexOf(temp);if(i>=0)list.splice(i,1)};
 try{
  // The selected title travels with the message; the server keeps it only if I still hold it.
  const body={ch,msg:text};
  let r=await valorChatRpc(body,temp.tag);
  // A brand-new character may not be in the cloud yet: save once, then try again.
  if(r==='no_character'&&typeof valorCloudFlush==='function'){await valorCloudFlush().catch(()=>{});r=await valorChatRpc(body,temp.tag)}
  if(r!=='ok'){drop();valorChatRestore(text);valorChatPaint();toast({slow:'Çok hızlı yazıyorsun. 3 saniye bekleyip tekrar gönder.',muted:'Sohbet yasağın var.',not_member:'Bu birliğin üyesi değilsin.',no_character:'Önce karakterin buluta kaydedilmeli.',invalid:'Mesaj gönderilemedi.'}[r]||'Mesaj gönderilemedi.');return}
  await valorChatFetch(true);drop();valorChatPaint(true);
 }catch(e){drop();valorChatRestore(text);valorChatPaint();toast((e.status===404||e.code==='PGRST202')?'Sohbet sunucuda henüz kurulmadı.':'Mesaj gönderilemedi: '+(e.message||'bağlantı hatası'))}
 finally{valorChat.sending=false}
}
function valorChatRestore(text){const input=document.getElementById('vch-input');if(input&&!input.value){input.value=text;valorChat.draft=text;valorChatCount()}}
function valorChatCount(){const i=document.getElementById('vch-input'),c=document.getElementById('vch-count');if(i)valorChat.draft=i.value;if(i&&c){c.textContent=i.value.length+' / '+VALOR_CHAT_MAX;c.classList.toggle('vch-near',i.value.length>=VALOR_CHAT_MAX-40)}}
function valorChatSwitch(ch){if(ch!=='world'&&ch!==valorChatGuildChannel())return;valorChat.channel=ch;render();valorChatFetch()}
function valorChatBlock(name){if(!confirm(name+' engellensin mi? Mesajlarını artık görmeyeceksin.'))return;state.chatBlocked=[...new Set([...valorChatBlocked(),name])];save();valorChatPaint();toast(name+' engellendi')}
function valorChatUnblock(name){state.chatBlocked=valorChatBlocked().filter(n=>n!==name);save();render()}
chatPage=function(){
 if(!valorChatOnline())return '<section class="vch-page"><h1>💬 Sohbet</h1><p class="vch-empty">Sohbet için hesabınla giriş yapmalısın.</p></section>';
 const ch=valorChatCurrent(),guild=valorChatGuildChannel(),blocked=valorChatBlocked();
 setTimeout(()=>{valorChatPaint();if(!valorChat.msgs[ch])valorChatFetch()},0);
 return '<section class="vch-page">'+(ch!=='world'&&state.guild?.name?'<p class="vch-channel">🛡 '+escapeAttr(state.guild.name)+' · birlik sohbeti</p>':'')
  +(valorChat.error?'<p class="vch-error">'+escapeAttr(valorChat.error)+'</p>':'')
  +'<div id="vch-list" class="vch-list" aria-live="polite">'+valorChatListHtml(ch)+'</div>'
  +'<form class="vch-form" onsubmit="event.preventDefault();valorChatSend()"><input id="vch-input" maxlength="'+VALOR_CHAT_MAX+'" autocomplete="off" enterkeyhint="send" value="'+escapeAttr(valorChat.draft)+'" placeholder="'+(ch==='world'?'Herkese yaz…':'Birliğine yaz…')+'" oninput="valorChatCount()"><button type="submit" onpointerdown="event.preventDefault()" onmousedown="event.preventDefault()">Gönder</button></form><small id="vch-count" class="vch-count">'+valorChat.draft.length+' / '+VALOR_CHAT_MAX+'</small>'
  +(blocked.length?'<details class="vch-blocked"><summary>Engellenenler ('+blocked.length+')</summary>'+blocked.map(n=>'<div><span>'+escapeAttr(n)+'</span><button type="button" onclick="valorChatUnblock(\''+escapeAttr(String(n).replace(/\'/g,''))+'\')">Kaldır</button></div>').join('')+'</details>':'')
  +'<p class="vch-rules">Saygılı ol. Küfür, hakaret ve reklam yasaktır; kurallara uymayanlar sohbetten uzaklaştırılır.</p></section>';
};
/* One tab row: Sohbet (world) · Haberler · Birlik (guild chat). "Birlik" is added next to the existing
   Sohbet / Haberler tabs; Sohbet always opens the world channel. */
function valorChatOpenGuild(){const g=valorChatGuildChannel();if(!g)return toast('Birlik sohbeti için önce bir birliğe katılmalısın.');valorChat.channel=g;if(typeof window.valorSocialSelectTab==='function')window.valorSocialSelectTab('chat');else render();document.getElementById('valor-guild-chat-tab')?.focus({preventScroll:true});valorChatFetch()}
function valorChatDecorateTabs(){
 if(page!=='Sohbet')return;const bar=document.querySelector('.valor-social-tabs');if(!bar)return;
 const sel=window.valorSocialSelectTab;if(typeof sel==='function'&&!sel.valorChatWrapped){const wrapped=function(tab){if(tab==='chat'&&!wrapped.keepGuild)valorChat.channel='world';wrapped.keepGuild=false;return sel.apply(this,arguments)};wrapped.valorChatWrapped=true;window.valorSocialSelectTab=wrapped}
 let btn=document.getElementById('valor-guild-chat-tab');
 if(!btn){btn=document.createElement('button');btn.type='button';btn.id='valor-guild-chat-tab';btn.setAttribute('role','tab');btn.textContent='Birlik';btn.addEventListener('click',()=>{if(window.valorSocialSelectTab)window.valorSocialSelectTab.keepGuild=true;valorChatOpenGuild()});bar.appendChild(btn)}
 bar.style.gridTemplateColumns='repeat(3,1fr)';
 const chatTab=document.getElementById('valor-chat-tab'),onChat=chatTab?.getAttribute('aria-selected')==='true',guildOn=onChat&&valorChat.channel!=='world';
 btn.setAttribute('aria-selected',String(guildOn));btn.classList.toggle('vch-tab-off',!valorChatGuildChannel());btn.title=valorChatGuildChannel()?'Birlik sohbeti':'Birliğe katılınca açılır';
 if(guildOn&&chatTab)chatTab.setAttribute('aria-selected','false');
}
/* Fixed chat screen: the page does not scroll, the list takes the remaining height. The keyboard is
   detected from the focused input plus a shrinking visual viewport (no screen-size guesses). */
let valorChatBaseH=0;
function valorChatFit(){
 const root=document.documentElement,body=document.body,on=body.classList.contains('valor-chat-page')&&!!document.getElementById('vch-list');
 if(!on){if(root.classList.contains('vch-lock')){root.classList.remove('vch-lock');body.classList.remove('vch-kb')}return}
 if(!root.classList.contains('vch-lock')){root.classList.add('vch-lock');window.scrollTo(0,0)}
 const vv=window.visualViewport,vh=vv?vv.height:innerHeight,focused=document.activeElement?.id==='vch-input';
 if(!focused)valorChatBaseH=vh;else if(!valorChatBaseH)valorChatBaseH=innerHeight;
 const kb=focused&&vh<valorChatBaseH-120;
 body.classList.toggle('vch-kb',kb);
 if(kb&&window.scrollY)window.scrollTo(0,0);
 const list=document.getElementById('vch-list');
 const off=vv?Math.max(0,vv.offsetTop):0,near=list.scrollHeight-list.scrollTop-list.clientHeight<80,top=list.getBoundingClientRect().top-off;
 let tail=8;for(let el=list.nextElementSibling;el;el=el.nextElementSibling){const cs=getComputedStyle(el);if(cs.display!=='none')tail+=el.offsetHeight+(parseFloat(cs.marginTop)||0)+(parseFloat(cs.marginBottom)||0)}
 const nav=kb?0:(document.getElementById('bottomNav')?.offsetHeight||0);
 list.style.height=Math.max(120,Math.floor(vh-nav-top-tail-10))+'px';
 if(near)list.scrollTop=list.scrollHeight;
}
(function(){
 const prev=render;let shownPage=null,held=false;
 render=function(){
  if(page==='Sohbet'&&shownPage==='Sohbet'&&document.activeElement?.id==='vch-input'&&document.getElementById('vch-list')){held=true;valorChatPaint();return}
  held=false;shownPage=page;const r=prev.apply(this,arguments);document.body.classList.toggle('valor-chat-page',!!state.class&&page==='Sohbet');try{valorChatDecorateTabs()}catch(e){}try{valorChatFit()}catch(e){}return r};
 const later=()=>{valorChatFit();setTimeout(valorChatFit,120);setTimeout(valorChatFit,400)};
 if(window.visualViewport){visualViewport.addEventListener('resize',valorChatFit);visualViewport.addEventListener('scroll',valorChatFit)}
 window.addEventListener('resize',valorChatFit);
 document.addEventListener('focusin',e=>{if(e.target&&e.target.id==='vch-input')later()});
 document.addEventListener('focusout',e=>{if(e.target&&e.target.id==='vch-input'){later();setTimeout(()=>{if(held&&page==='Sohbet'&&document.activeElement?.id!=='vch-input')render()},150)}});
})();
setInterval(()=>{if(page==='Sohbet'&&!document.hidden&&valorChatOnline()&&state.class)valorChatFetch()},VALOR_CHAT_POLL);
if(state.class&&page==='Sohbet')render();

/* Unread badge: while the player is elsewhere in the game, new world/guild messages are counted on the
   Sohbet tab of the bottom menu. Seen positions are kept per device; own and blocked messages never count. */
const VALOR_CHAT_BADGE_POLL=20000,VALOR_CHAT_SEEN_KEY='valor-chat-seen-v1';
let valorChatUnread=0;
function valorChatSeen(){try{return JSON.parse(localStorage.getItem(VALOR_CHAT_SEEN_KEY))||{}}catch{return {}}}
function valorChatSetSeen(ch,id){const s=valorChatSeen();if((s[ch]||0)>=id)return;s[ch]=id;try{localStorage.setItem(VALOR_CHAT_SEEN_KEY,JSON.stringify(s))}catch{}}
function valorChatMarkSeen(){if(page!=='Sohbet')return;const ch=valorChatCurrent(),list=valorChat.msgs[ch];const ids=(list||[]).map(m=>m.id).filter(Number.isFinite);if(ids.length)valorChatSetSeen(ch,Math.max(...ids));if(ch==='world'||ch===valorChatGuildChannel()){valorChatUnread=0;valorChatBadge()}}
function valorChatBadge(){
 const btn=document.querySelector('#bottomNav [aria-label="Sohbet"]')||[...document.querySelectorAll('#bottomNav button')].find(b=>b.textContent.trim().startsWith('Sohbet'));
 if(!btn)return;let b=btn.querySelector('.vch-badge');
 if(!valorChatUnread||page==='Sohbet'){b?.remove();return}
 if(!b){b=document.createElement('span');b.className='vch-badge';btn.append(b)}
 b.textContent=valorChatUnread>9?'9+':String(valorChatUnread);b.setAttribute('aria-label',valorChatUnread+' okunmamış mesaj');
}
async function valorChatCheckUnread(){
 if(!valorChatOnline()||!state.class||page==='Sohbet'||document.hidden)return;
 const me=valorAccountActive?.id,blocked=valorChatBlocked(),seen=valorChatSeen(),chans=['world',valorChatGuildChannel()].filter(Boolean);let total=0;
 try{
  for(const ch of chans){
   const from=seen[ch]||0,q='/rest/v1/chat_messages?select=id,user_id,name&channel=eq.'+encodeURIComponent(ch);
   // First visit on this device: start counting from the newest message instead of the whole history.
   if(!from){const top=await valorCloudFetch(q+'&order=id.desc&limit=1');if(Array.isArray(top)&&top[0])valorChatSetSeen(ch,top[0].id);continue}
   const rows=await valorCloudFetch(q+'&id=gt.'+from+'&order=id.asc&limit=50');
   if(Array.isArray(rows))total+=rows.filter(r=>r.user_id!==me&&!blocked.includes(r.name)).length;
  }
 }catch{return}
 valorChatUnread=total;valorChatBadge();
}
(function(){const prev=render;render=function(){const r=prev.apply(this,arguments);try{valorChatBadge()}catch{}return r}})();
setInterval(valorChatCheckUnread,VALOR_CHAT_BADGE_POLL);
setTimeout(valorChatCheckUnread,4000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)valorChatCheckUnread()});
