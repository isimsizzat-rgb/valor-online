/* Home hubs reuse the existing game schedules, navigation and account controls. */
const VALOR_HOME_HUBS=[['Etkinlikler','etkinlikler'],['Kurallar','kurallar'],['Ayarlar','ayarlar']];
const valorHubsPreviousHome=home;
home=function(){
 const template=document.createElement('template');template.innerHTML=valorHubsPreviousHome.apply(this,arguments);
 const grid=template.content.querySelector('.mmorpg-home-grid');if(!grid)return template.innerHTML;
 grid.classList.add('valor-home-expanded');
 for(const [name,art] of VALOR_HOME_HUBS)grid.insertAdjacentHTML('beforeend','<button type="button" class="mmorpg-home-tile valor-vertical-tile" onclick="go(\''+name+'\')" aria-label="'+name+'" title="'+name+'"><img src="assets/home-fantasy/'+art+'.webp?v=1" alt="'+name+'" decoding="async" draggable="false"></button>');
 return template.innerHTML;
};
function valorHubHeader(title,subtitle){return '<header class="vhub-heading"><div><span>VALOR ONLINE</span><h1>'+title+'</h1><p>'+subtitle+'</p></div><button type="button" onclick="go(\'Anasayfa\')">‹ Ana Sayfa</button></header>'}
function valorHubTime(time){return Number.isFinite(time)?new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(time)):'Takvim hazırlanıyor'}
function valorHubEvents(now=Date.now()){
 const boss=valorBossTiming(now),team=valorTeamClock(now),castle=valorCastleCalendar(now);
 return [
  {id:'boss',name:'Dünya Bossu',art:'boss',schedule:'Her gün · 10.00 ve 20.00 · 15 dakika',open:boss.active,detail:boss.active?'Bitiş: '+valorHubTime(boss.end):'Sıradaki: '+valorHubTime(boss.next),action:"go('Dünya Bossu')"},
  {id:'team',name:'Takım Arenası',art:'savas-v2',schedule:'Her gün · 12.00–13.00 ve 18.00–19.00',open:team.open,detail:team.open?'Bitiş: '+valorHubTime(team.until):'Sıradaki: '+valorHubTime(team.opensAt),action:"valorArenaMode='team';go('Savaş')"},
  {id:'castle',name:'Kale Savaşı',art:'birlik',schedule:'Pazartesi, Çarşamba, Cuma · 21.00 · 15 dakika',open:!!castle.active,detail:castle.active?'Bitiş: '+valorHubTime(castle.active.end):'Sıradaki: '+valorHubTime(castle.next?.start),action:"valorGuildSection='castle';go('Birlik')"}
 ];
}
function valorEventsPage(){
 return '<section class="vhub-page">'+valorHubHeader('Etkinlikler','Tüm saatler Türkiye saatine göredir.')+'<div class="vhub-events">'+valorHubEvents().map(e=>'<article class="vhub-event"><img src="assets/home-fantasy/'+e.art+'.webp" alt="" loading="lazy"><div><span class="vhub-status" data-event-status="'+e.id+'" data-open="'+e.open+'">'+(e.open?'Şimdi açık':'Sıradaki etkinlik')+'</span><h2>'+e.name+'</h2><p>'+e.schedule+'</p><small data-event-time="'+e.id+'">'+e.detail+'</small><button type="button" onclick="'+e.action.replace(/"/g,'&quot;')+'">Etkinliğe Git ›</button></div></article>').join('')+'</div><section class="vhub-card"><h2>Günlük Fırsatlar</h2><p>Giriş ödülünü al, elmas sandığını kontrol et veya şansını dene.</p><div class="vhub-actions"><button type="button" onclick="valorLoginOpen()">Giriş Ödülü</button><button type="button" onclick="valorChestOpen()">Elmas Sandığı</button><button type="button" onclick="go(\'Şans Çarkı\')">Şans Çarkı</button></div></section></section>';
}
function valorRulesPage(){
 const rules=[
  ['Karakter ve Ekipman','Savaşçı, Büyücü veya Okçu olarak oynarsın. Karakter seviyesi en fazla 100’dür. Ekipmanlar sınıfına ve gereken seviyeye uygun olmalıdır.'],
  ['Güçlendirme ve Evrim','Ekipmanlar +21’e kadar güçlendirilir. Evrim sırası Normal → Epik → Ebedi → İlahi’dir. Her evrimden sonra +0’a dönersin; sonraki aşama için yeniden +21 gerekir.'],
  ['Sahne ve Macera','Sahnelerde Kolay, Zor ve Kabus modları bulunur. Macera enerji kullanır; sahne girişleri ayrı haklarla yapılır.'],
  ['Etkinlik Saatleri','Etkinlik takvimi Türkiye saatine göre işler. Güncel açık ve kapalı durumları Etkinlikler bölümünde görebilirsin.'],
  ['Hesap ve Karakter Adı','Kullanıcı adın ile karakter adın farklı olabilir. Nick değiştirme kartı karakter adını değiştirir; hesabının kullanıcı adını değiştirmez.']
 ];
 return '<section class="vhub-page">'+valorHubHeader('Kurallar','Oyunun temel işleyişi.')+'<div class="vhub-rules">'+rules.map(([title,body],i)=>'<article class="vhub-card"><span class="vhub-rule-number">0'+(i+1)+'</span><h2>'+title+'</h2><p>'+body+'</p></article>').join('')+'</div></section>';
}
const VALOR_INTERFACE_PREFS='valor-interface-preferences-v1';
let valorInterfacePrefs={reducedMotion:false};
try{const prefs=JSON.parse(localStorage.getItem(VALOR_INTERFACE_PREFS));if(prefs&&typeof prefs.reducedMotion==='boolean')valorInterfacePrefs.reducedMotion=prefs.reducedMotion}catch{}
function valorApplyInterfacePrefs(){document.documentElement.classList.toggle('valor-reduced-motion',valorInterfacePrefs.reducedMotion)}
function valorSetReducedMotion(enabled){valorInterfacePrefs.reducedMotion=!!enabled;valorApplyInterfacePrefs();try{localStorage.setItem(VALOR_INTERFACE_PREFS,JSON.stringify(valorInterfacePrefs));toast('Görünüm ayarı kaydedildi')}catch{toast('Ayar bu oturum için uygulandı')}}
async function valorToggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();if(page==='Ayarlar')render()}catch{toast('Bu tarayıcıda tam ekran açılamadı.')}}
function valorSettingsPage(){
 const account=typeof valorAccountActive!=='undefined'?valorAccountActive:null;
 const name=typeof valorAccountEscape==='function'?valorAccountEscape(account?.username||'Misafir'):'';
 return '<section class="vhub-page">'+valorHubHeader('Ayarlar','Hesabını ve görünüm tercihlerini yönet.')+'<section class="vhub-card"><h2>Görünüm</h2><label class="vhub-toggle"><span><b>Hareket efektlerini azalt</b><small>Parlama ve geçiş animasyonlarını sadeleştirir.</small></span><input type="checkbox" '+(valorInterfacePrefs.reducedMotion?'checked':'')+' onchange="valorSetReducedMotion(this.checked)"></label><p class="vhub-note">Bu tercih kullandığın tarayıcıda saklanır.</p>'+(document.fullscreenEnabled?'<button type="button" onclick="valorToggleFullscreen()">'+(document.fullscreenElement?'Tam Ekrandan Çık':'Tam Ekran Aç')+'</button>':'')+'</section><section class="vhub-card"><h2>Hesap</h2><div class="vhub-account"><span>Kullanıcı adı</span><b>'+name+'</b></div><p>'+(account?.cloud?'Hesabın bulut kaydıyla kullanılıyor.':'Hesaplarını görmek veya giriş yapmak için hesap ekranını aç.')+'</p><button type="button" onclick="valorAccountOpen()">Hesapları Aç</button></section></section>';
}
valorApplyInterfacePrefs();
setInterval(()=>{if(page!=='Etkinlikler'||document.hidden||!state.class)return;for(const e of valorHubEvents()){const status=document.querySelector('[data-event-status="'+e.id+'"]'),time=document.querySelector('[data-event-time="'+e.id+'"]');if(status){status.textContent=e.open?'Şimdi açık':'Sıradaki etkinlik';status.dataset.open=String(e.open)}if(time)time.textContent=e.detail}},10000);
const valorHubsPreviousRender=render;
render=function(){
 const result=valorHubsPreviousRender.apply(this,arguments);
 if(page==='Anasayfa'&&state.class){const grid=document.querySelector('#main .valor-home-expanded');if(grid)for(const [name] of VALOR_HOME_HUBS){const button=grid.querySelector('[aria-label="'+name+'"]');if(button)grid.appendChild(button)}}
 return result;
};
if(state.class&&typeof valorAccountCanPlay==='function'&&valorAccountCanPlay())render();
