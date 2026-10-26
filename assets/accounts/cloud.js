/* Cloud accounts and saves (Supabase).
   Usernames sign in through Supabase Auth; each character is stored in public.saves (one row per user,
   protected by row level security). The local save stays as a cache, and every change is uploaded a few
   seconds later. A revision number stops an older device from overwriting a newer save. */
const VALOR_CLOUD_URL='https://iwjbvabavszthulvpvda.supabase.co';
const VALOR_CLOUD_KEY='sb_publishable_ObO87ufTLmG9wmgmLITLIA_pMPH_hUu';
const VALOR_CLOUD_SESSION='valor-cloud-session-v1';
const VALOR_CLOUD_DOMAIN='@players.valor-online.app';
const valorCloudRevKey=id=>'valor-cloud-rev-'+id;
let valorCloudStatus='idle',valorCloudTimer=null,valorCloudFirstDirty=0,valorCloudBusy=null,valorCloudDirty=false,valorCloudBlocked=false;

/* Turkish letters are spelled out so every username maps to one valid, unique e-mail address. */
function valorCloudEmail(username){const map={'ç':'c-','ğ':'g-','ı':'i-','ö':'o-','ş':'s-','ü':'u-'};return valorAccountNormalize(username).replace(/[çğıöşü]/g,c=>map[c]).replace(/[^a-z0-9_-]/g,'')+VALOR_CLOUD_DOMAIN}
function valorCloudSession(){return valorAccountRead(VALOR_CLOUD_SESSION)}
function valorCloudStoreSession(s){const expires=Number(s.expires_at)||Math.floor(Date.now()/1000)+(Number(s.expires_in)||3600);localStorage.setItem(VALOR_CLOUD_SESSION,JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:expires,user:{id:s.user?.id}}))}
function valorCloudClearSession(){localStorage.removeItem(VALOR_CLOUD_SESSION)}
function valorCloudErrorText(status,body,fallback){
 const code=String(body?.error_code||body?.code||''),msg=String(body?.msg||body?.message||body?.error_description||'');
 if(code==='invalid_credentials'||/invalid login/i.test(msg))return 'Kullanıcı adı veya şifre hatalı.';
 if(code==='user_already_exists'||code==='email_exists'||/already (registered|exists)/i.test(msg))return 'Bu kullanıcı adı alınmış. Başka bir ad dene.';
 if(code==='weak_password')return 'Şifre çok zayıf. Daha uzun ya da karışık bir şifre seç.';
 if(code==='email_not_confirmed')return 'Sunucuda e-posta onayı açık. Yönetici ayarlardan kapatmalı.';
 if(code==='signup_disabled')return 'Yeni kayıtlar şu an kapalı.';
 if(status===429||/rate limit/i.test(code+msg))return 'Çok fazla deneme yapıldı. Birkaç dakika bekleyip tekrar dene.';
 if(code==='email_address_invalid')return 'Bu kullanıcı adı kullanılamıyor. Başka bir ad dene.';
 return fallback||'Sunucu hatası ('+status+'). Biraz sonra tekrar dene.';
}
async function valorCloudFetch(path,opt={},auth=true){
 const headers={apikey:VALOR_CLOUD_KEY,'Content-Type':'application/json',...(opt.headers||{})};
 if(auth){const s=await valorCloudFreshSession();if(!s){const e=Error('Oturumun sona erdi. Tekrar giriş yap.');e.code='no_session';throw e}headers.Authorization='Bearer '+s.access_token}
 let res;try{res=await fetch(VALOR_CLOUD_URL+path,{...opt,headers})}catch(err){const e=Error('Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.');e.code='offline';throw e}
 const text=await res.text();let body=null;try{body=text?JSON.parse(text):null}catch{}
 if(!res.ok){const e=Error(valorCloudErrorText(res.status,body));e.status=res.status;e.code=body?.error_code||body?.code;throw e}
 return body;
}
let valorCloudRefreshing=null;
async function valorCloudFreshSession(){
 const s=valorCloudSession();if(!s?.access_token)return null;
 if(Number(s.expires_at)*1000-Date.now()>60000)return s;
 if(!valorCloudRefreshing)valorCloudRefreshing=(async()=>{try{const body=await valorCloudFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:s.refresh_token})},false);if(!body?.access_token)throw Error('refresh');valorCloudStoreSession(body);return valorCloudSession()}catch(e){if(e.code!=='offline')valorCloudClearSession();return e.code==='offline'?s:null}finally{valorCloudRefreshing=null}})();
 return valorCloudRefreshing;
}
async function valorCloudAuth(kind,username,password){
 const signup=kind==='signup';
 const body=await valorCloudFetch(signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify(signup?{email:valorCloudEmail(username),password,data:{username}}:{email:valorCloudEmail(username),password})},false);
 if(!body?.access_token)throw Error(signup?'Hesap oluşturuldu ama oturum açılamadı: sunucuda e-posta onayı kapatılmalı.':'Giriş yapılamadı. Tekrar dene.');
 valorCloudStoreSession(body);return body.user;
}
function valorCloudMeta(snapshot,live=false){const s=snapshot?.state||{};let power=0;try{if(live&&state.class&&typeof combatPower==='function')power=Math.floor(Number(combatPower())||0)}catch{}return {name:String(s.name||'').slice(0,40),class:s.class||null,level:Math.max(1,Math.floor(Number(s.level)||1)),power}}
async function valorCloudLoad(uid){const rows=await valorCloudFetch('/rest/v1/saves?select=data,rev,updated_at&user_id=eq.'+encodeURIComponent(uid));return Array.isArray(rows)&&rows[0]||null}
function valorCloudNameless(meta){const m={...meta};delete m.name;return m}
async function valorCloudCreate(uid,username,snapshot){const body=meta=>JSON.stringify({user_id:uid,username,data:snapshot,rev:1,...meta});let rows;try{rows=await valorCloudFetch('/rest/v1/saves',{method:'POST',headers:{Prefer:'return=representation'},body:body(valorCloudMeta(snapshot))})}catch(e){if(e.code!=='23505'||/saves_pkey/.test(e.message))throw e;rows=await valorCloudFetch('/rest/v1/saves',{method:'POST',headers:{Prefer:'return=representation'},body:body(valorCloudNameless(valorCloudMeta(snapshot)))})}localStorage.setItem(valorCloudRevKey(uid),'1');return rows}
function valorCloudRev(uid){return Number(localStorage.getItem(valorCloudRevKey(uid)))||0}

/* Upload the current character. Returns true when saved, false on a revision conflict. */
async function valorCloudUpload(keepalive=false){
 const acc=valorAccountActive;if(!acc?.cloud||valorCloudBlocked)return true;
 const base=valorCloudRev(acc.id),snapshot=valorAccountSnapshot();
 const meta=valorCloudMeta(snapshot,true),url='/rest/v1/saves?user_id=eq.'+encodeURIComponent(acc.id)+'&rev=eq.'+base;
 const opt=m=>({method:'PATCH',headers:{Prefer:'return=representation'},keepalive:!!keepalive,body:JSON.stringify({data:snapshot,rev:base+1,updated_at:new Date().toISOString(),...m})});
 let rows;try{rows=await valorCloudFetch(url,opt(meta))}catch(e){if(e.code!=='23505')throw e;rows=await valorCloudFetch(url,opt(valorCloudNameless(meta)))}
 if(Array.isArray(rows)&&rows.length){localStorage.setItem(valorCloudRevKey(acc.id),String(base+1));return true}
 const row=await valorCloudLoad(acc.id);
 if(!row){await valorCloudCreate(acc.id,acc.username,snapshot);return true}
 return false;
}
async function valorCloudFlush(keepalive=false){
 clearTimeout(valorCloudTimer);valorCloudTimer=null;
 if(!valorAccountActive?.cloud||valorCloudBlocked)return;
 if(valorCloudBusy){valorCloudDirty=true;return valorCloudBusy}
 valorCloudDirty=false;valorCloudFirstDirty=0;valorCloudSetStatus('saving');
 valorCloudBusy=(async()=>{try{const ok=await valorCloudUpload(keepalive);if(!ok)return valorCloudConflict();valorCloudSetStatus('saved')}catch(e){valorCloudSetStatus(e.code==='offline'?'offline':'error');if(e.code==='no_session')return valorCloudExpired();clearTimeout(valorCloudTimer);valorCloudTimer=setTimeout(valorCloudFlush,30000);return}finally{valorCloudBusy=null}if(valorCloudDirty)valorCloudSchedule()})();
 return valorCloudBusy;
}
function valorCloudSchedule(){
 if(!valorAccountActive?.cloud||valorCloudBlocked)return;
 if(valorCloudStatus==='offline'||valorCloudStatus==='error'){valorCloudDirty=true;return}
 const now=Date.now();if(!valorCloudFirstDirty)valorCloudFirstDirty=now;valorCloudSetStatus('pending');
 clearTimeout(valorCloudTimer);valorCloudTimer=setTimeout(valorCloudFlush,now-valorCloudFirstDirty>20000?0:4000);
}
function valorCloudSetStatus(s){valorCloudStatus=s;const el=document.getElementById('valor-cloud-status');if(el){el.textContent=valorCloudStatusText();el.dataset.state=s}}
function valorCloudStatusText(){return {idle:'☁ Bulut kayıt',pending:'☁ Kaydedilecek…',saving:'☁ Kaydediliyor…',saved:'☁ Buluta kaydedildi',offline:'☁ Çevrimdışı · bağlanınca kaydedilecek',error:'☁ Kaydedilemedi · tekrar denenecek'}[valorCloudStatus]||''}
function valorCloudOverlay(title,text,button,action){document.getElementById('valor-cloud-overlay')?.remove();const o=document.createElement('div');o.id='valor-cloud-overlay';o.className='vr-overlay';o.innerHTML='<div class="vr-dialog" role="alertdialog" aria-modal="true"><span class="vr-eyebrow">HESAP</span><h2>'+title+'</h2><p class="vr-lead">'+text+'</p><button type="button" class="vr-claim" onclick="'+action+'">'+button+'</button></div>';document.body.appendChild(o)}
/* Another device saved a newer version: stop uploading and offer to load it. */
function valorCloudConflict(){valorCloudBlocked=true;valorCloudSetStatus('error');valorCloudOverlay('Hesabın başka bir yerde açık','Bu karakter başka bir cihazda ya da sekmede daha yeni kaydedilmiş. Kayıtların karışmaması için en güncel kaydı yüklemen gerekiyor.','Güncel Kaydı Yükle','valorCloudReloadLatest()')}
function valorCloudExpired(){valorCloudBlocked=true;valorCloudOverlay('Oturumun sona erdi','Karakterini korumak için tekrar giriş yapman gerekiyor.','Giriş Yap','valorCloudForceLogin()')}
/* Load a cloud snapshot: uploads stop and the in-memory state is swapped first, so nothing older is written back while the page reloads. */
function valorCloudApply(acc,row){valorCloudBlocked=true;clearTimeout(valorCloudTimer);localStorage.setItem(valorCloudRevKey(acc.id),String(row.rev));try{state=JSON.parse(JSON.stringify(row.data.state))}catch{}try{if(typeof stageRun!=='undefined')stageRun=row.data.stage?JSON.parse(JSON.stringify(row.data.stage)):null}catch{}valorAccountActivate(acc,row.data,false)}
async function valorCloudReloadLatest(){try{const row=await valorCloudLoad(valorAccountActive.id);if(!row)return location.reload();valorCloudApply(valorAccountActive,row)}catch(e){toast(e.message)}}
function valorCloudForceLogin(){document.getElementById('valor-cloud-overlay')?.remove();valorCloudClearSession();valorAccountActive=null;sessionStorage.removeItem(VALOR_ACCOUNT_SESSION);valorAccountGate=true;valorAccountMessage='Oturumun sona erdi. Tekrar giriş yap.';render()}

function valorCloudRegistryPut(account,replaceLocal){const norm=valorAccountNormalize(account.username);let list=valorAccountRegistry().filter(a=>a.id!==account.id&&!(replaceLocal&&!a.cloud&&valorAccountNormalize(a.username)===norm));list.push(account);localStorage.setItem(VALOR_ACCOUNTS_KEY,JSON.stringify(list))}
async function valorCloudLocalPasswordOk(local,password){if(!local?.salt||!local?.hash)return false;try{const h=await valorAccountHash(password,local.salt,local.iterations);let d=h.length^local.hash.length;for(let i=0;i<h.length;i++)d|=h.charCodeAt(i)^local.hash.charCodeAt(i);return !d}catch{return false}}

valorAccountSubmit=async function(event){
 event?.preventDefault();if(valorAccountBusy)return;
 const username=document.getElementById('valor-account-username')?.value.trim()||'',password=document.getElementById('valor-account-password')?.value||'',confirm=document.getElementById('valor-account-confirm')?.value||'',attach=!!document.getElementById('valor-account-attach')?.checked;
 valorAccountSelected=username;valorAccountError('');
 if(!/^[a-zA-Z0-9ğüşöçıİĞÜŞÖÇ_]{3,20}$/.test(username))return valorAccountError('Kullanıcı adı 3–20 harf, rakam veya alt çizgi içermeli.');
 if(password.length<8||password.length>72)return valorAccountError('Şifren 8–72 karakter olmalı.');
 const register=valorAccountTab==='register';if(register&&password!==confirm)return valorAccountError('Şifreler birbiriyle eşleşmiyor.');
 valorAccountSetBusy(true);
 try{
  const norm=valorAccountNormalize(username),local=valorAccountRegistry().find(a=>!a.cloud&&valorAccountNormalize(a.username)===norm);
  let user,snapshot=null,row=null,migrated=false;
  if(register){
   user=await valorCloudAuth('signup',username,password);
   const previous=valorAccountLegacySaved();
   if(attach&&previous){snapshot=previous;localStorage.setItem(key+'-before-accounts-v1',JSON.stringify(previous));localStorage.setItem(key+'-legacy-linked',user.id)}
   else snapshot={state:valorAccountFreshState(),stage:null};
  }else{
   try{user=await valorCloudAuth('login',username,password)}
   catch(e){
    // A device-only account from before the server: move it to the cloud with the same name and password.
    if(e.message!=='Kullanıcı adı veya şifre hatalı.'||!local||!await valorCloudLocalPasswordOk(local,password))throw e;
    try{user=await valorCloudAuth('signup',username,password)}catch(e2){if(/alınmış/.test(e2.message))throw Error('Bu kullanıcı adı sunucuda başka bir oyuncuya ait. “Kayıt Ol” sekmesinden yeni bir adla kaydol; bu cihazdaki karakterin korunur.');throw e2}
    snapshot=valorAccountRead(valorAccountStorageKey(local.id));migrated=true;
   }
   if(!snapshot){row=await valorCloudLoad(user.id);
    if(row){snapshot=row.data;localStorage.setItem(valorCloudRevKey(user.id),String(row.rev))}
    else if(local&&await valorCloudLocalPasswordOk(local,password)){snapshot=valorAccountRead(valorAccountStorageKey(local.id));migrated=true}
    else snapshot={state:valorAccountFreshState(),stage:null};}
  }
  if(!snapshot?.state)snapshot={state:valorAccountFreshState(),stage:null};
  if(!row)await valorCloudCreate(user.id,username,snapshot);
  if(valorAccountActive){valorAccountPersist();if(valorAccountActive.cloud)await valorCloudFlush().catch(()=>{})}
  const account={id:user.id,username,cloud:true,createdAt:Date.now()};
  valorCloudRegistryPut(account,migrated||!!local);
  valorAccountActivate(account,snapshot,false);
 }catch(error){valorAccountError(error?.message||'İşlem tamamlanamadı. Yeniden dene.');valorAccountSetBusy(false)}
};

/* Character names are unique (case-insensitive). The server reserves the name before the character exists. */
async function valorCloudClaimName(name){return valorCloudFetch('/rest/v1/rpc/claim_character_name',{method:'POST',body:JSON.stringify({new_name:name})})}
let valorCloudClaiming=false;
(function(){
 const prevCreate=createCharacter;
 createCharacter=async function(){
  const input=document.getElementById('characterNick'),err=document.getElementById('createError'),n=(input?.value||'').trim();
  if(!valorAccountActive?.cloud||state.class||n.length<3||n.length>20||!/^[a-zA-ZğüşöçıİĞÜŞÖÇ0-9_ ]+$/.test(n))return prevCreate.apply(this,arguments);
  if(valorCloudClaiming)return;valorCloudClaiming=true;const btn=document.querySelector('.vcreate-page .vauth-primary');if(btn)btn.disabled=true;
  try{
   const r=await valorCloudClaimName(n);
   if(r==='taken'){if(err)err.textContent='Bu karakter adı başka bir oyuncuya ait. Başka bir ad seç.';return}
   if(r==='invalid'){if(err)err.textContent='Bu karakter adı kullanılamıyor.';return}
  }catch(e){
   // Before the name function exists on the server (404) creation still works; other errors stop it.
   if(e.status!==404&&e.code!=='PGRST202'){if(err)err.textContent=e.message;return}
  }finally{valorCloudClaiming=false;if(btn)btn.disabled=false}
  return prevCreate.apply(this,arguments);
 };
 const prevSave=save;
 save=function(){const r=prevSave.apply(this,arguments);if(valorAccountActive?.cloud&&!valorAccountGate&&state.class!==undefined)valorCloudSchedule();return r};
 const prevStageSave=stageRunSave;
 stageRunSave=function(){const r=prevStageSave.apply(this,arguments);if(valorAccountActive?.cloud&&!valorAccountGate)valorCloudSchedule();return r};
 const prevLogout=valorAccountLogout;
 valorAccountLogout=function(){if(valorAccountBusy)return;const was=valorAccountActive?.cloud;if(was){valorAccountPersist();const s=valorCloudSession();valorCloudFlush(true).catch(()=>{}).finally(()=>{if(s?.access_token)fetch(VALOR_CLOUD_URL+'/auth/v1/logout',{method:'POST',keepalive:true,headers:{apikey:VALOR_CLOUD_KEY,Authorization:'Bearer '+s.access_token}}).catch(()=>{})});valorCloudClearSession()}return prevLogout.apply(this,arguments)};
 const prevPage=valorAccountPage;
 valorAccountPage=function(){return prevPage.apply(this,arguments).replace('Kayıtlar bu tarayıcıda saklanır; veriler silinirse kaybolur.','Hesabın ve karakterin sunucuda saklanır; istediğin cihazdan giriş yapabilirsin.')};
 const prevProfile=profile;
 profile=function(){const html=prevProfile.apply(this,arguments);return valorAccountActive?.cloud?html.replace('<div class="vauth-profile-link">','<div class="vauth-profile-link"><small id="valor-cloud-status" class="valor-cloud-status" data-state="'+valorCloudStatus+'">'+valorCloudStatusText()+'</small>'):html};
 addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&(valorCloudTimer||valorCloudDirty))valorCloudFlush(true)});
 addEventListener('pagehide',()=>{if(valorCloudTimer||valorCloudDirty)valorCloudFlush(true)});
 addEventListener('online',()=>{if(valorCloudStatus==='offline'||valorCloudStatus==='error')valorCloudFlush()});
 /* On start: a cloud account needs a live session, and a newer save from another device wins. */
 const acc=valorAccountActive;
 if(acc?.cloud&&!valorAccountGate){
  if(!valorCloudSession()?.access_token){valorCloudForceLogin();return}
  valorCloudLoad(acc.id).then(row=>{
   if(!row)return valorCloudCreate(acc.id,acc.username,valorAccountSnapshot());
   if(Number(row.rev)>valorCloudRev(acc.id))valorCloudApply(acc,row);
   else valorCloudSetStatus('saved');
  }).catch(e=>{if(e.code==='no_session')valorCloudExpired();else valorCloudSetStatus(e.code==='offline'?'offline':'error')});
 }
})();
