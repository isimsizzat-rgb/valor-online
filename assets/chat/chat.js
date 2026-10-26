/* World and guild chat (signed-in cloud accounts). Messages are stored on the server; while the chat
   screen is open new messages are fetched every few seconds. Sending is rate limited by the server. */
const VALOR_CHAT_POLL=4000,VALOR_CHAT_MAX=200;
const valorChat={channel:'world',msgs:{},last:{},loading:false,error:'',sending:false,timer:null};
function valorChatOnline(){return !!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
function valorChatGuildChannel(){return state.guild?.serverId?'guild:'+state.guild.serverId:null}
function valorChatCurrent(){if(valorChat.channel!=='world'&&valorChat.channel!==valorChatGuildChannel())valorChat.channel='world';return valorChat.channel}
function valorChatBlocked(){return Array.isArray(state.chatBlocked)?state.chatBlocked:[]}
function valorChatTime(iso){const d=new Date(iso);return isNaN(d)?'':d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'})}
const valorChatColors={Savaşçı:'#e3a08f',Büyücü:'#c4a8f0',Okçu:'#9fd48a'};
function valorChatRow(m){
 const mine=m.user_id===valorAccountActive?.id,blocked=valorChatBlocked().includes(m.name);
 if(blocked)return '';
 return '<div class="vch-msg'+(mine?' mine':'')+'"><div class="vch-meta"><b style="color:'+(valorChatColors[m.class]||'#ecd7b4')+'">'+escapeAttr(m.name)+'</b><small>Sv.'+(m.level||1)+' · '+valorChatTime(m.created_at)+'</small>'+(mine?'':'<button type="button" class="vch-more" onclick="valorChatBlock(\''+escapeAttr(String(m.name).replace(/'/g,''))+'\')" aria-label="'+escapeAttr(m.name)+' engelle" title="Engelle">⊘</button>')+'</div><p>'+escapeAttr(m.body)+'</p></div>';
}
function valorChatListHtml(ch){const list=valorChat.msgs[ch];if(!list)return '<p class="vch-empty">Mesajlar yükleniyor…</p>';const rows=list.map(valorChatRow).join('');return rows||'<p class="vch-empty">Henüz mesaj yok. İlk mesajı sen yaz!</p>'}
function valorChatPaint(){
 const el=document.getElementById('vch-list');if(!el)return;
 const near=el.scrollHeight-el.scrollTop-el.clientHeight<80;el.innerHTML=valorChatListHtml(valorChatCurrent());if(near||!el.dataset.painted)el.scrollTop=el.scrollHeight;el.dataset.painted='1';
}
async function valorChatFetch(){
 const ch=valorChatCurrent();if(valorChat.loading)return;valorChat.loading=true;
 try{
  const last=valorChat.last[ch]||0;
  const q='/rest/v1/chat_messages?select=id,user_id,name,class,level,body,created_at&channel=eq.'+encodeURIComponent(ch)+(last?'&id=gt.'+last+'&order=id.asc&limit=100':'&order=id.desc&limit=50');
  let rows=await valorCloudFetch(q);rows=Array.isArray(rows)?rows:[];if(!last)rows.reverse();
  const list=valorChat.msgs[ch]||(valorChat.msgs[ch]=[]);
  if(rows.length){list.push(...rows.filter(r=>!list.some(x=>x.id===r.id)));if(list.length>150)list.splice(0,list.length-150);valorChat.last[ch]=Math.max(last,...rows.map(r=>r.id))}
  if(valorChat.error){valorChat.error='';if(page==='Sohbet')render()}
  valorChatPaint();
 }catch(e){const msg=(e.status===404||e.code==='PGRST205'||e.code==='42P01')?'Sohbet sunucuda henüz kurulmadı.':e.message;if(msg!==valorChat.error){valorChat.error=msg;if(page==='Sohbet')render()}}
 finally{valorChat.loading=false}
}
async function valorChatSend(){
 if(valorChat.sending)return;const input=document.getElementById('vch-input'),text=(input?.value||'').replace(/\s+/g,' ').trim();
 if(!text)return;if(text.length>VALOR_CHAT_MAX)return toast('Mesaj en fazla '+VALOR_CHAT_MAX+' karakter olabilir');
 valorChat.sending=true;
 try{
  if(typeof valorCloudFlush==='function')await valorCloudFlush().catch(()=>{});
  const r=await valorCloudFetch('/rest/v1/rpc/chat_send',{method:'POST',body:JSON.stringify({ch:valorChatCurrent(),msg:text})});
  if(r==='ok'){if(input){input.value='';valorChatCount()}await valorChatFetch()}
  else toast({slow:'Çok hızlı yazıyorsun. Birkaç saniye bekle.',muted:'Sohbet yasağın var.',not_member:'Bu birliğin üyesi değilsin.',no_character:'Önce karakterin buluta kaydedilmeli.',invalid:'Mesaj gönderilemedi.'}[r]||'Mesaj gönderilemedi.');
 }catch(e){toast((e.status===404||e.code==='PGRST202')?'Sohbet sunucuda henüz kurulmadı.':e.message)}
 finally{valorChat.sending=false;input?.focus()}
}
function valorChatCount(){const i=document.getElementById('vch-input'),c=document.getElementById('vch-count');if(i&&c)c.textContent=i.value.length+' / '+VALOR_CHAT_MAX}
function valorChatSwitch(ch){if(ch!=='world'&&ch!==valorChatGuildChannel())return;valorChat.channel=ch;render();valorChatFetch()}
function valorChatBlock(name){if(!confirm(name+' engellensin mi? Mesajlarını artık görmeyeceksin.'))return;state.chatBlocked=[...new Set([...valorChatBlocked(),name])];save();valorChatPaint();toast(name+' engellendi')}
function valorChatUnblock(name){state.chatBlocked=valorChatBlocked().filter(n=>n!==name);save();render()}
chatPage=function(){
 if(!valorChatOnline())return '<section class="vch-page"><h1>💬 Sohbet</h1><p class="vch-empty">Sohbet için hesabınla giriş yapmalısın.</p></section>';
 const ch=valorChatCurrent(),guild=valorChatGuildChannel(),blocked=valorChatBlocked();
 setTimeout(()=>{valorChatPaint();if(!valorChat.msgs[ch])valorChatFetch()},0);
 return '<section class="vch-page"><nav class="vch-tabs"><button type="button" aria-pressed="'+(ch==='world')+'" onclick="valorChatSwitch(\'world\')">🌍 Dünya</button><button type="button" aria-pressed="'+(ch!=='world')+'" '+(guild?'':'disabled title="Birliğe katılınca açılır"')+' onclick="valorChatSwitch(\''+(guild||'')+'\')">🛡 Birlik'+(state.guild?.name&&guild?' · '+escapeAttr(state.guild.name):'')+'</button></nav>'
  +(valorChat.error?'<p class="vch-error">'+escapeAttr(valorChat.error)+'</p>':'')
  +'<div id="vch-list" class="vch-list" aria-live="polite">'+valorChatListHtml(ch)+'</div>'
  +'<form class="vch-form" onsubmit="event.preventDefault();valorChatSend()"><input id="vch-input" maxlength="'+VALOR_CHAT_MAX+'" autocomplete="off" placeholder="'+(ch==='world'?'Herkese yaz…':'Birliğine yaz…')+'" oninput="valorChatCount()"><button type="submit">Gönder</button></form><small id="vch-count" class="vch-count">0 / '+VALOR_CHAT_MAX+'</small>'
  +(blocked.length?'<details class="vch-blocked"><summary>Engellenenler ('+blocked.length+')</summary>'+blocked.map(n=>'<div><span>'+escapeAttr(n)+'</span><button type="button" onclick="valorChatUnblock(\''+escapeAttr(String(n).replace(/\'/g,''))+'\')">Kaldır</button></div>').join('')+'</details>':'')
  +'<p class="vch-rules">Saygılı ol. Küfür, hakaret ve reklam yasaktır; kurallara uymayanlar sohbetten uzaklaştırılır.</p></section>';
};
setInterval(()=>{if(page==='Sohbet'&&!document.hidden&&valorChatOnline()&&state.class)valorChatFetch()},VALOR_CHAT_POLL);
if(state.class&&page==='Sohbet')render();
