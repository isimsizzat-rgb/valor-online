/* Installable app: registers the service worker and offers "add to home screen" on the home page. */
let valorInstallPrompt=null;
function valorIsStandalone(){return window.matchMedia&&matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
function valorIsIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
function valorInstallDismissed(){try{return localStorage.getItem('valorInstallHidden')==='1'}catch(e){return false}}
function valorInstallHide(){try{localStorage.setItem('valorInstallHidden','1')}catch(e){}document.querySelector('.vpwa-bar')?.remove()}
function valorInstallBar(){if(valorIsStandalone()||valorInstallDismissed())return '';if(!valorInstallPrompt&&!valorIsIos())return '';return '<div class="vpwa-bar"><img src="assets/pwa/icon-192.png" alt=""><span><b>Valor’u ana ekrana ekle</b><small>'+(valorInstallPrompt?'Uygulama gibi tam ekran ve daha hızlı açılır.':'Safari’de Paylaş <b>⎋</b> → <b>Ana Ekrana Ekle</b>')+'</small></span>'+(valorInstallPrompt?'<button type="button" class="vpwa-install" onclick="valorInstallApp()">Yükle</button>':'')+'<button type="button" class="vpwa-close" onclick="valorInstallHide()" aria-label="Kapat">×</button></div>'}
async function valorInstallApp(){if(!valorInstallPrompt)return;const p=valorInstallPrompt;valorInstallPrompt=null;p.prompt();try{const r=await p.userChoice;if(r&&r.outcome==='accepted'){valorInstallHide();toast('Valor ana ekranına eklendi')}}catch(e){}if(typeof render==='function')render()}
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();valorInstallPrompt=e;if(state&&state.class&&page==='Anasayfa')render()});
window.addEventListener('appinstalled',function(){valorInstallPrompt=null;valorInstallHide()});
(function(){
 const baseHome=home;
 home=function(){return valorInstallBar()+baseHome.apply(this,arguments)};
 if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
})();
