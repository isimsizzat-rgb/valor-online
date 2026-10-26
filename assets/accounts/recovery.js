/* Password recovery with a one-time code: made in the profile, used from "Şifremi unuttum" on the login screen. */
let valorRecoveryKnown=null; // created_at of the current code, '' when none, null when not loaded
function valorRecoveryRpc(name,body,auth=true){return valorCloudFetch('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body||{})},auth)}
function valorRecoveryClose(){document.getElementById('valor-recovery')?.remove()}
function valorRecoveryDialog(html){valorRecoveryClose();const o=document.createElement('div');o.id='valor-recovery';o.className='vr-overlay';o.innerHTML='<div class="vr-dialog vrc-dialog" role="dialog" aria-modal="true"><button class="vr-close" onclick="valorRecoveryClose()" aria-label="Kapat">×</button>'+html+'</div>';o.addEventListener('click',e=>{if(e.target===o)valorRecoveryClose()});document.body.appendChild(o);return o}

/* Profile: create (or replace) the code and show it once. */
function valorRecoveryAsk(){
 valorRecoveryDialog('<span class="vr-eyebrow">HESAP GÜVENLİĞİ</span><h2>Kurtarma Kodu</h2><p class="vr-lead">Şifreni unutursan bu kodla yeni şifre belirleyebilirsin. Kod yalnızca bir kez gösterilir; bir yere yaz ya da ekran görüntüsünü al.'+(valorRecoveryKnown?'<br><b>Yeni kod oluşturursan eski kodun geçersiz olur.</b>':'')+'</p><button type="button" class="vr-claim" onclick="valorRecoveryCreate()">'+(valorRecoveryKnown?'Yeni Kod Oluştur':'Kod Oluştur')+'</button>');
}
async function valorRecoveryCreate(){
 const btn=document.querySelector('#valor-recovery .vr-claim');if(btn){btn.disabled=true;btn.textContent='Oluşturuluyor…'}
 try{const code=await valorRecoveryRpc('recovery_new');if(!code)throw Error('Kod oluşturulamadı.');valorRecoveryKnown=new Date().toISOString();
  valorRecoveryDialog('<span class="vr-eyebrow">HESAP GÜVENLİĞİ</span><h2>Kurtarma Kodun</h2><div class="vrc-code" id="vrc-code">'+escapeAttr(code)+'</div><p class="vr-lead">Bu kodu güvenli bir yere yaz. Kimseyle paylaşma: kodu bilen biri şifreni değiştirebilir. Kod bir kez kullanılınca geçersiz olur.</p><button type="button" class="vr-claim" onclick="navigator.clipboard?.writeText(document.getElementById(\'vrc-code\').textContent).then(()=>toast(\'Kod kopyalandı\'),()=>{})">Kopyala</button>');
  if(page==='Profil')render();
 }catch(e){toast((e.status===404||e.code==='PGRST202')?'Şifre kurtarma sunucuda henüz kurulmadı.':e.message);valorRecoveryClose()}
}
async function valorRecoveryLoadStatus(){try{const r=await valorRecoveryRpc('recovery_status');valorRecoveryKnown=r||'';if(page==='Profil')render()}catch{valorRecoveryKnown=''}}

/* Login screen: set a new password with the code. */
function valorRecoveryForgot(){
 const name=document.getElementById('valor-account-username')?.value||'';
 valorRecoveryDialog('<span class="vr-eyebrow">ŞİFREMİ UNUTTUM</span><h2>Yeni Şifre Belirle</h2><p class="vr-lead">Profilinde oluşturduğun kurtarma kodunu gir. Kodun yoksa oyun yöneticisine yaz.</p><form class="vauth-form vrc-form" onsubmit="event.preventDefault();valorRecoverySubmit()"><label for="vrc-login">Kullanıcı adı veya karakter adı</label><input id="vrc-login" autocomplete="username" maxlength="20" value="'+escapeAttr(name)+'"><label for="vrc-input">Kurtarma kodu</label><input id="vrc-input" autocomplete="one-time-code" maxlength="20" placeholder="XXXX-XXXX-XXXX" autocapitalize="characters" spellcheck="false"><label for="vrc-pass">Yeni şifre</label><input id="vrc-pass" type="password" autocomplete="new-password" minlength="8" maxlength="72" placeholder="En az 8 karakter"><label for="vrc-pass2">Yeni şifre tekrar</label><input id="vrc-pass2" type="password" autocomplete="new-password" minlength="8" maxlength="72"><p id="vrc-error" class="vauth-error" role="alert"></p><button type="submit" class="vauth-primary">Şifreyi Değiştir <span>›</span></button></form>');
 document.getElementById(name?'vrc-input':'vrc-login')?.focus();
}
async function valorRecoverySubmit(){
 const v=id=>document.getElementById(id)?.value||'',err=m=>{const e=document.getElementById('vrc-error');if(e)e.textContent=m};
 const login=v('vrc-login').trim(),code=v('vrc-input'),pass=v('vrc-pass'),pass2=v('vrc-pass2');
 if(login.length<3)return err('Kullanıcı adını ya da karakter adını yaz.');
 if(code.replace(/[^A-Za-z0-9]/g,'').length!==12)return err('Kurtarma kodu 12 karakterdir (XXXX-XXXX-XXXX).');
 if(pass.length<8||pass.length>72)return err('Yeni şifre 8–72 karakter olmalı.');
 if(pass!==pass2)return err('Şifreler birbiriyle eşleşmiyor.');
 const btn=document.querySelector('.vrc-form .vauth-primary');if(btn)btn.disabled=true;err('');
 try{
  const r=await valorRecoveryRpc('recovery_reset',{login,code,new_password:pass},false);
  if(r==='ok'){valorRecoveryDialog('<span class="vr-eyebrow">ŞİFREMİ UNUTTUM</span><h2>Şifren değişti</h2><p class="vr-lead">Yeni şifrenle giriş yapabilirsin. Kurtarma kodun kullanıldı; giriş yaptıktan sonra profilinden yeni bir kod oluştur.</p><button type="button" class="vr-claim" onclick="valorRecoveryClose()">Girişe Dön</button>');const u=document.getElementById('valor-account-username');if(u&&!u.value)u.value=login;return}
  err({wrong:'Kullanıcı adı ya da kurtarma kodu hatalı.',locked:'Çok fazla hatalı deneme. Bir saat sonra tekrar dene.',weak:'Yeni şifre 8–72 karakter olmalı.'}[r]||'Şifre değiştirilemedi.');
 }catch(e){err((e.status===404||e.code==='PGRST202')?'Şifre kurtarma sunucuda henüz kurulmadı. Oyun yöneticisine yaz.':e.message)}
 finally{if(btn)btn.disabled=false}
}

(function(){
 const prevPage=valorAccountPage;
 valorAccountPage=function(){const html=prevPage.apply(this,arguments);if(valorAccountTab==='register')return html;return html.replace('</form>','</form><button type="button" class="vauth-text-button vrc-forgot" onclick="valorRecoveryForgot()">Şifremi unuttum</button>')};
 const prevProfile=profile;
 profile=function(){const html=prevProfile.apply(this,arguments);if(!valorAccountActive?.cloud)return html;if(valorRecoveryKnown===null){valorRecoveryKnown='';valorRecoveryLoadStatus()}
  const label=valorRecoveryKnown?'Kurtarma kodun var':'Kurtarma kodu oluştur';
  return html.replace('<div class="vauth-profile-link">','<div class="vauth-profile-link"><button type="button" class="vrc-profile-btn'+(valorRecoveryKnown?'':' vrc-missing')+'" onclick="valorRecoveryAsk()">🔑 '+label+'</button>')};
})();
