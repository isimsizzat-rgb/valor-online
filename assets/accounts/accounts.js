/* Device-local accounts. No remote identity or cloud-sync claim is made. */
const VALOR_ACCOUNTS_KEY='valor-accounts-v1',VALOR_ACCOUNT_OWNER=key+'-account-owner',VALOR_ACCOUNT_SESSION='valor-account-session-v1';
const valorAccountStorageKey=id=>'valor-account-save-'+id;
const valorAccountRead=(name,fallback=null)=>{try{return JSON.parse(localStorage.getItem(name))??fallback}catch{return fallback}};
function valorAccountRegistry(){const r=valorAccountRead(VALOR_ACCOUNTS_KEY,[]);return Array.isArray(r)?r:[]}
const valorAccountEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valorAccountNormalize=v=>String(v).trim().normalize('NFKC').toLocaleLowerCase('tr-TR');
let valorAccountActive=null,valorAccountGate=true,valorAccountTab='login',valorAccountBusy=false,valorAccountSelected='',valorAccountMessage='',valorAccountRecoveryOpen=false;
try{const session=sessionStorage.getItem(VALOR_ACCOUNT_SESSION);valorAccountActive=valorAccountRegistry().find(a=>a.id===session)||null}catch{}
const valorAccountHasLegacy=()=>!localStorage.getItem(VALOR_ACCOUNT_OWNER)&&!!state.class;
/* Keep a one-time copy of the pre-account character before any migration. */
if(valorAccountHasLegacy()&&!localStorage.getItem(key+'-before-accounts-v1')){
  localStorage.setItem(key+'-before-accounts-v1',JSON.stringify({state,stage:typeof stageRun!=='undefined'?stageRun:null}));
}
function valorAccountSnapshot(){return {state:JSON.parse(JSON.stringify(state)),stage:typeof stageRun!=='undefined'&&stageRun?JSON.parse(JSON.stringify(stageRun)):null}}
function valorAccountPersist(){
  if(!valorAccountActive)return;
  localStorage.setItem(valorAccountStorageKey(valorAccountActive.id),JSON.stringify(valorAccountSnapshot()));
}
const valorAccountOldSave=save;
save=function(){
  if(valorAccountActive){valorAccountPersist();if(localStorage.getItem(VALOR_ACCOUNT_OWNER)===valorAccountActive.id)valorAccountOldSave();}
  else if(!localStorage.getItem(VALOR_ACCOUNT_OWNER)){valorAccountOldSave();if(state.class)localStorage.setItem(key+'-guest-checkpoint-v1',JSON.stringify(valorAccountSnapshot()));}
};
const valorAccountOldStageSave=stageRunSave;
stageRunSave=function(){if(valorAccountActive){valorAccountPersist();if(localStorage.getItem(VALOR_ACCOUNT_OWNER)===valorAccountActive.id)valorAccountOldStageSave();}else if(!localStorage.getItem(VALOR_ACCOUNT_OWNER))valorAccountOldStageSave();};
function valorAccountLegacySaved(){if(valorAccountHasLegacy())return valorAccountSnapshot();if(localStorage.getItem(key+'-legacy-linked'))return null;return valorAccountRead(key+'-guest-checkpoint-v1')||valorAccountRead(key+'-before-accounts-v1');}
function valorAccountRestoreGuest(saved){
  if(!saved?.state||!classes.includes(saved.state.class)){valorAccountError('Bu tarayıcıda açılabilir eski karakter kaydı bulunamadı.');return;}
  // Recover into a separate guest session; never overwrite a named account save.
  if(valorAccountActive)valorAccountPersist();
  if(state.class)localStorage.setItem(key+'-before-legacy-restore-v1',JSON.stringify(valorAccountSnapshot()));
  localStorage.setItem(key,JSON.stringify(saved.state));
  if(saved.stage)localStorage.setItem(key+'-stage-run',JSON.stringify(saved.stage));else localStorage.removeItem(key+'-stage-run');
  localStorage.removeItem(VALOR_ACCOUNT_OWNER);sessionStorage.setItem(VALOR_ACCOUNT_SESSION,'guest');location.reload();
}
function valorAccountContinueLegacy(){valorAccountRestoreGuest(valorAccountLegacySaved());}
function valorAccountRecoveryCandidates(){
  const candidates=[];
  if(valorAccountHasLegacy())candidates.push({source:'current',label:'Mevcut eski karakter',saved:valorAccountSnapshot()});
  for(const [source,label] of [['guest-checkpoint-v1','Son misafir kaydı'],['before-accounts-v1','Hesap sisteminden önceki yedek']]){
    const saved=valorAccountRead(key+'-'+source);if(saved?.state&&classes.includes(saved.state.class))candidates.push({source,label,saved});
  }
  return candidates.filter((candidate,index,list)=>list.findIndex(other=>JSON.stringify(other.saved)===JSON.stringify(candidate.saved))===index);
}
function valorAccountToggleRecovery(){if(valorAccountBusy)return;valorAccountRecoveryOpen=!valorAccountRecoveryOpen;render();}
function valorAccountRecover(source){if(valorAccountBusy)return;const candidate=valorAccountRecoveryCandidates().find(item=>item.source===source);if(!candidate)return valorAccountError('Bu kayıt artık bulunamıyor. Sayfayı yenileyip tekrar dene.');valorAccountRestoreGuest(candidate.saved);}
function valorAccountRecoveryHtml(){
  let html='<button type="button" class="vauth-text-button" onclick="valorAccountToggleRecovery()" style="display:block;width:100%;margin:12px 0">'+(valorAccountRecoveryOpen?'Kayıtları gizle':'Eski karakterimi bul')+'</button>';
  if(!valorAccountRecoveryOpen)return html;
  const candidates=valorAccountRecoveryCandidates();
  html+='<div class="vauth-saved"><span class="vauth-eyebrow">ESKİ KARAKTER KAYITLARI</span><div class="vauth-account-list">'+(candidates.length?candidates.map(({source,label,saved})=>'<button type="button" class="vauth-account" onclick="valorAccountRecover(\''+source+'\')"><img src="'+heroImages[Math.max(0,classes.indexOf(saved.state.class))]+'" alt=""><span><b>'+valorAccountEscape(saved.state.name)+' · Sv. '+Number(saved.state.level||1)+'</b><small>'+label+' · Açmak için dokun</small></span><i aria-hidden="true">›</i></button>').join(''):'<p class="vauth-subtitle">Bu tarayıcıda eski karakter yedeği bulunamadı. Oyunu daha önce oynadığın tarayıcıdan aç. Bir hesaba bağladığın karakter için aşağıdaki hesabını seçerek giriş yap.</p>')+'</div><p class="vauth-subtitle">Yedek ayrı bir misafir oturumunda açılır. Hesaplarına ait kayıtlar korunur.</p></div>';
  return html;
}
function valorAccountFreshState(){return {class:null,name:'',level:1,xp:0,gold:50000,diamonds:500,hp:100,statPoints:0,stats:{Saldırı:0,Sihir:0,Savunma:0,'Sihir Savunma':0,Can:0,Kritik:0,Bloke:0},inventory:[],equipped:{},stones:{1:3,2:1},shards:0,freeEntries:5,papers:2,stageWins:{},guild:null,questWins:0,logs:[]}}
function valorAccountCanPlay(){return !valorAccountGate&&(!!valorAccountActive||sessionStorage.getItem(VALOR_ACCOUNT_SESSION)==='guest'&&valorAccountHasLegacy())}
function valorAccountActivate(account,snapshot,preserveCurrent=true){
  if(!snapshot||!snapshot.state||typeof snapshot.state!=='object'||Array.isArray(snapshot.state))throw Error('Hesap kaydı okunamadı. Mevcut kayıt korunuyor.');
  if(preserveCurrent&&valorAccountActive){if(valorAccountActive.id===account.id)snapshot=valorAccountSnapshot();valorAccountPersist();}
  localStorage.setItem(valorAccountStorageKey(account.id),JSON.stringify(snapshot));
  localStorage.setItem(key,JSON.stringify(snapshot.state));
  if(snapshot.stage)localStorage.setItem(key+'-stage-run',JSON.stringify(snapshot.stage));else localStorage.removeItem(key+'-stage-run');
  localStorage.setItem(VALOR_ACCOUNT_OWNER,account.id);
  sessionStorage.setItem(VALOR_ACCOUNT_SESSION,account.id);
  location.reload();
}
async function valorAccountHash(password,salt,iterations=250000){
  if(!globalThis.crypto?.subtle)throw Error('Şifreli giriş için güncel bir tarayıcı kullanmalısın.');
  const bytes=Uint8Array.from(salt.match(/.{2}/g)||[],h=>parseInt(h,16));
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations,hash:'SHA-256'},material,256);
  return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('');
}
function valorAccountError(message){valorAccountMessage=message;const error=document.getElementById('valor-account-error');if(error)error.textContent=message;}
function valorAccountSetBusy(busy){valorAccountBusy=busy;document.querySelectorAll('.vauth-form input,.vauth-form button,.vauth-tabs button,.vauth-account').forEach(el=>el.disabled=busy);const submit=document.getElementById('valor-account-submit');if(submit)submit.textContent=busy?'Lütfen bekle…':valorAccountTab==='register'?'Kayıt Ol':'Giriş Yap';}
function valorAccountSetTab(tab){if(valorAccountBusy)return;valorAccountTab=tab==='register'?'register':'login';valorAccountMessage='';render();}
function valorAccountChoose(id){if(valorAccountBusy)return;const account=valorAccountRegistry().find(a=>a.id===id);if(!account)return;valorAccountSelected=account.username;valorAccountTab='login';valorAccountMessage='';render();document.getElementById('valor-account-password')?.focus();}
async function valorAccountSubmit(event){
  event?.preventDefault();if(valorAccountBusy)return;
  const username=document.getElementById('valor-account-username')?.value.trim()||'',password=document.getElementById('valor-account-password')?.value||'',confirm=document.getElementById('valor-account-confirm')?.value||'',attach=!!document.getElementById('valor-account-attach')?.checked;
  valorAccountSelected=username;valorAccountError('');
  if(!/^[a-zA-Z0-9ğüşöçıİĞÜŞÖÇ_]{3,20}$/.test(username))return valorAccountError('Kullanıcı adı 3–20 harf, rakam veya alt çizgi içermeli.');
  if(password.length<8||password.length>128)return valorAccountError('Şifren 8–128 karakter olmalı.');
  const register=valorAccountTab==='register';if(register&&password!==confirm)return valorAccountError('Şifreler birbiriyle eşleşmiyor.');
  valorAccountSetBusy(true);
  try{
    let registry=valorAccountRegistry(),account=registry.find(a=>valorAccountNormalize(a.username)===valorAccountNormalize(username));
    if(register){
      if(account)throw Error('Bu kullanıcı adı bu cihazda zaten kayıtlı.');
      const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),hash=await valorAccountHash(password,salt);
      registry=valorAccountRegistry();if(registry.some(a=>valorAccountNormalize(a.username)===valorAccountNormalize(username)))throw Error('Bu kullanıcı adı bu cihazda zaten kayıtlı.');
      account={id:crypto.randomUUID(),username,salt,hash,iterations:250000,createdAt:Date.now()};
      const previous=valorAccountLegacySaved(),snapshot=attach&&previous?previous:{state:valorAccountFreshState(),stage:null};
      if(previous)localStorage.setItem(key+'-before-accounts-v1',JSON.stringify(previous));
      localStorage.setItem(valorAccountStorageKey(account.id),JSON.stringify(snapshot));
      localStorage.setItem(VALOR_ACCOUNTS_KEY,JSON.stringify([...registry,account]));
      if(attach&&previous)localStorage.setItem(key+'-legacy-linked',account.id);
      valorAccountActivate(account,snapshot);
    }else{
      if(!account)throw Error('Kullanıcı adı veya şifre hatalı.');
      const hash=await valorAccountHash(password,account.salt,account.iterations);let diff=hash.length^account.hash.length;for(let i=0;i<hash.length;i++)diff|=hash.charCodeAt(i)^account.hash.charCodeAt(i);
      if(diff)throw Error('Kullanıcı adı veya şifre hatalı.');
      const snapshot=valorAccountRead(valorAccountStorageKey(account.id));if(!snapshot)throw Error('Bu hesabın kayıt dosyası bulunamadı.');
      valorAccountActivate(account,snapshot);
    }
  }catch(error){valorAccountError(error?.message||'İşlem tamamlanamadı. Yeniden dene.');valorAccountSetBusy(false);}
}
function valorAccountOpen(){if(valorAccountBusy)return;if(typeof valorArenaCancelPending==='function')valorArenaCancelPending();if(valorAccountActive)valorAccountPersist();valorAccountGate=true;valorAccountSelected=valorAccountActive?.username||'';valorAccountTab='login';valorAccountMessage='';document.querySelectorAll('.valor-item-overlay').forEach(el=>el.remove());render();}
function valorAccountReturn(){if(valorAccountActive||valorAccountHasLegacy()){valorAccountGate=false;if(!valorAccountActive)sessionStorage.setItem(VALOR_ACCOUNT_SESSION,'guest');render();}}
function valorAccountLogout(){if(valorAccountBusy)return;valorAccountPersist();valorAccountActive=null;sessionStorage.removeItem(VALOR_ACCOUNT_SESSION);valorAccountGate=true;valorAccountSelected='';valorAccountMessage='';render();}
function valorAccountPage(){
  const accounts=valorAccountRegistry(),register=valorAccountTab==='register',legacySave=valorAccountLegacySaved(),legacy=!!legacySave?.state?.class,legacyState=legacySave?.state;
  const cards=accounts.map(a=>{const hero=valorAccountRead(valorAccountStorageKey(a.id))?.state;return `<button type="button" class="vauth-account ${valorAccountNormalize(a.username)===valorAccountNormalize(valorAccountSelected)?'is-selected':''}" onclick="valorAccountChoose('${a.id}')"><img src="${valorCreationPortrait(hero?.class,hero?.gender)}" alt=""><span><b>${valorAccountEscape(a.username)}</b><small>${hero?.class?valorAccountEscape(hero.class)+' · Sv. '+Number(hero.level||1):'Karakter oluştur'}</small></span><i aria-hidden="true">›</i></button>`;}).join('');
  return `<section class="vauth-portal vauth-compact">
    <header class="vauth-mythic-cover"><img src="assets/accounts/valor-mythic-cover.webp" width="1200" height="600" alt="Valor Online — büyücü, savaşçı ve okçu kale önünde savaşa hazırlanıyor" decoding="async" fetchpriority="high"></header>
    <div class="vauth-panel">
      ${valorAccountActive?'<div class="vauth-back"><button type="button" class="vauth-text-button" onclick="valorAccountReturn()">‹ Oyuna dön</button></div>':''}
      <div class="vauth-tabs" role="tablist" aria-label="Hesap işlemi">
        <button type="button" role="tab" aria-selected="${!register}" class="${!register?'is-active':''}" onclick="valorAccountSetTab('login')">Giriş Yap</button>
        <button type="button" role="tab" aria-selected="${register}" class="${register?'is-active':''}" onclick="valorAccountSetTab('register')">Kayıt Ol</button>
      </div>

      <form class="vauth-form" onsubmit="valorAccountSubmit(event)">
        <label for="valor-account-username">Kullanıcı adı</label>
        <input id="valor-account-username" name="username" autocomplete="username" minlength="3" maxlength="20" required spellcheck="false" autocapitalize="none" placeholder="Kullanıcı adın" value="${valorAccountEscape(valorAccountSelected)}">
        <label for="valor-account-password">Şifre</label>
        <input id="valor-account-password" name="password" type="password" autocomplete="${register?'new-password':'current-password'}" minlength="8" maxlength="128" required placeholder="${register?'En az 8 karakter':'Şifren'}">
        ${register?`<label for="valor-account-confirm">Şifre tekrar</label><input id="valor-account-confirm" name="confirm-password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required placeholder="Şifreni tekrar yaz">${legacy?`<label class="vauth-check"><input id="valor-account-attach" type="checkbox" checked><span>Mevcut karakterimi kullan<small>${valorAccountEscape(legacyState.name)} · Sv. ${Number(legacyState.level||1)}</small></span></label>`:''}`:''}
        <p id="valor-account-error" class="vauth-error" role="alert">${valorAccountEscape(valorAccountMessage)}</p>
        <button id="valor-account-submit" type="submit" class="vauth-primary">${register?'Kayıt Ol':'Giriş Yap'}<span aria-hidden="true">›</span></button>
      </form>
      ${!register&&cards?`<details class="vauth-saved vauth-saved-picker"><summary>Kayıtlı hesaplar <span>${accounts.length}</span></summary><div class="vauth-account-list">${cards}</div></details>`:''}
      ${!register&&legacy?`<div class="vauth-legacy"><div><b>${valorAccountEscape(legacyState.name)}</b><small>Sv. ${Number(legacyState.level||1)} · Mevcut karakter</small></div><button type="button" onclick="valorAccountContinueLegacy()">Devam et ›</button></div>`:''}
      <div class="vauth-help">${valorAccountRecoveryHtml()}</div>
      <p class="vauth-storage-note">Kayıtlar bu tarayıcıda saklanır; veriler silinirse kaybolur.</p>
      ${valorAccountActive?'<button type="button" class="vauth-text-button vauth-logout" onclick="valorAccountLogout()">Çıkış yap</button>':''}
    </div>
    <footer class="vauth-story"><span aria-hidden="true">✦</span><h2>Hikâyen seni bekliyor.</h2><p>Kadim krallıklar karanlığa gömülürken yeni bir efsane doğuyor. Kılıcını kuşan, büyünü uyandır ya da yayını ger. Valor’da kaderini sen yaz.</p></footer>
  </section>`;
}
const valorCharacterDetails={
 'Savaşçı':{title:'Çeliğin iradesi.',desc:'Ön saflarda yerini al. Kılıcın ve zırhınla rakibinin karşısında dimdik dur.',type:'Yakın dövüş',weapon:'Kılıç',accent:'#d58b62'},
 'Büyücü':{title:'Gücün sınırlarını aş.',desc:'Kadim büyülerin özünü açığa çıkar. Gizemli enerjileri düşmanlarının üzerine sal.',type:'Sihirli saldırı',weapon:'Asa',accent:'#b69ae0'},
 'Okçu':{title:'Tek atış. Tek kader.',desc:'Hedefini gölgelerden izle. Yayını ger ve okunla savaşın akışını değiştir.',type:'Menzilli saldırı',weapon:'Yay',accent:'#9fbc82'}
};
let creationGender='male';
function valorChooseCreationGender(gender){
 if(gender!=='male'&&gender!=='female')return;
 creationNick=document.getElementById('characterNick')?.value??creationNick;
 creationGender=gender;render();
}
const VALOR_CREATION_CUTOUTS={'Savaşçı':'warrior','Büyücü':'mage','Okçu':'archer'};
function valorCreationCutout(cls,gender){const type=VALOR_CREATION_CUTOUTS[cls]||'warrior';return 'assets/character/selection/'+type+'-'+(gender==='female'?'female':'male')+(type==='warrior'?'-v2':'')+'.webp'}
function valorCharacterCreationPage(){
 const c=valorCharacterDetails[creationClass]||valorCharacterDetails.Savaşçı;
 const genderLabel=creationGender==='female'?'Kadın':'Erkek';
 const tabs=classes.map((cls,i)=>'<button type="button" role="tab" aria-selected="'+(cls===creationClass)+'" class="'+(cls===creationClass?'is-active':'')+'" onclick="pickClass(\''+cls+'\')"><img src="'+(cls==='Savaşçı'?valorCreationCutout(cls,creationGender):valorCreationPortrait(cls,creationGender))+'" alt=""><span>'+cls+'</span><small>0'+(i+1)+'</small></button>').join('');
 const genderButtons=[['male','Erkek'],['female','Kadın']].map(([value,label])=>'<button type="button" aria-label="'+label+'" title="'+label+'" aria-pressed="'+(value===creationGender)+'" class="'+(value===creationGender?'is-active':'')+'" onclick="valorChooseCreationGender(\''+value+'\')"><span aria-hidden="true">'+(value==='male'?'♂':'♀')+'</span></button>').join('');
 return '<section class="vcreate-page" style="--class-accent:'+c.accent+'"><header class="vcreate-header"><div><span class="vauth-eyebrow">VALOR ONLINE</span></div><button type="button" class="vauth-text-button" onclick="valorAccountOpen()">‹ Hesaplar</button></header><div class="vcreate-tabs" role="tablist" aria-label="Karakter sınıfı">'+tabs+'</div><div class="vcreate-content"><div class="vcreate-art"><fieldset class="vcreate-gender"><legend>Cinsiyet</legend><div>'+genderButtons+'</div></fieldset><img src="'+valorCreationCutout(creationClass,creationGender)+'" alt="'+genderLabel+' '+creationClass+'"><span class="vcreate-art-label">'+genderLabel.toLocaleUpperCase('tr-TR')+' '+creationClass.toLocaleUpperCase('tr-TR')+'</span></div><div class="vcreate-info"><div class="vcreate-description"><span class="vauth-eyebrow">'+c.type.toLocaleUpperCase('tr-TR')+' · '+c.weapon.toLocaleUpperCase('tr-TR')+'</span><h2>'+creationClass+'</h2><h3>'+c.title+'</h3><p>'+c.desc+'</p><div class="vcreate-divider">✦</div></div><form class="vauth-form" onsubmit="event.preventDefault();createCharacter()"><label for="characterNick">Karakterinin adı</label><input id="characterNick" name="character-name" maxlength="20" minlength="3" required placeholder="Krallık seni nasıl tanısın?" autocomplete="off" spellcheck="false" value="'+valorAccountEscape(creationNick)+'" oninput="creationNick=this.value"><p class="vcreate-name-hint">3–20 karakter · Harf, rakam, boşluk ve alt çizgi</p><p id="createError" class="vauth-error" role="alert"></p><button class="vauth-primary" type="submit">Maceraya Başla <span>›</span></button></form><p class="vcreate-account-label">Hesap: '+valorAccountEscape(valorAccountActive?.username||'Misafir')+'</p></div></div></section>';
}
const valorAccountOldPickClass=pickClass;
pickClass=function(cls){if(!classes.includes(cls))return;creationNick=document.getElementById('characterNick')?.value??creationNick;creationClass=cls;render();};
const valorAccountOldProfile=profile;
profile=function(){return valorAccountOldProfile()+'<div class="vauth-profile-link"><span>'+valorAccountEscape(valorAccountActive?.username||'Mevcut karakter')+'</span><button type="button" onclick="valorAccountOpen()">Hesaplar</button></div>'};
const valorAccountOldRender=render;
render=function(){
  const playing=valorAccountCanPlay(),creating=playing&&!state.class;
  document.body.classList.toggle('valor-account-screen',!playing||creating);
  document.body.classList.toggle('character-selection',!playing||creating);
  if(!playing||creating){document.body.classList.remove('valor-home','valor-profile-page','valor-market-page');const nav=document.getElementById('bottomNav');if(nav)nav.style.display='none';document.getElementById('main').innerHTML=creating?valorCharacterCreationPage():valorAccountPage();return;}
  return valorAccountOldRender.apply(this,arguments);
};
/* Existing startup listeners must not replace the account gate with Home. */
window.valorAccountsReady=true;window.valorAccountsCanPlay=valorAccountCanPlay;
valorAccountGate=!valorAccountActive&&!(sessionStorage.getItem(VALOR_ACCOUNT_SESSION)==='guest'&&valorAccountHasLegacy());
if(valorAccountActive&&localStorage.getItem(VALOR_ACCOUNT_OWNER)!==valorAccountActive.id){const saved=valorAccountRead(valorAccountStorageKey(valorAccountActive.id));if(saved)valorAccountActivate(valorAccountActive,saved,false);else{valorAccountActive=null;valorAccountGate=true;}}
render();
