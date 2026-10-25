/* Start at Home and prevent browser scroll restoration across game pages. */
(function(){
 if('scrollRestoration' in history)history.scrollRestoration='manual';
 let startupTouched=false;
 for(const event of ['touchstart','wheel','pointerdown','keydown'])window.addEventListener(event,()=>{startupTouched=true},{passive:true,once:true});
 function top(){const root=document.scrollingElement||document.documentElement;root.scrollTop=0;root.scrollLeft=0;window.scrollTo({top:0,left:0,behavior:'instant'});}
 function reset(){top();requestAnimationFrame(top);}
 const previousGo=go;
 go=function(destination){const result=previousGo.apply(this,arguments);reset();return result;};
 function start(){
  if(typeof valorAccountCanPlay==='function'&&valorAccountCanPlay()&&state.class){
   const url=new URL(location.href);
   const navigation=performance.getEntriesByType('navigation')[0];
   const castleTest=url.searchParams.get('castleTest')==='1'&&navigation?.type==='navigate';
   if(url.searchParams.has('castleTest')){url.searchParams.delete('castleTest');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
   page=castleTest?'Kale Testi':'Anasayfa';selected=null;
  }
  render();reset();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.addEventListener('load',()=>{if(!startupTouched)reset();},{once:true});
 window.addEventListener('pageshow',event=>{if(event.persisted){startupTouched=false;start();}else if(!startupTouched)reset();});
})();

/* Daily boss cycle in Turkey time: morning 10:00, evening 20:00, 15 minutes each. */
function valorBossTiming(now=Date.now()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 const day=parts.year+'-'+parts.month+'-'+parts.day;
 const midnight=Date.parse(day+'T00:00:00+03:00'),morning=midnight+10*3600000,evening=midnight+20*3600000;
 const phase=now>=evening?'evening':'morning';
 const activeStart=[morning,evening].find(start=>now>=start&&now<start+900000);
 const next=now<morning?morning:now<evening?evening:midnight+34*3600000;
 return {active:activeStart!==undefined,id:activeStart===undefined?null:day+'-'+(activeStart===morning?10:20),end:activeStart===undefined?null:activeStart+900000,next,phase,nextPhase:next===evening?'evening':'morning',reset:midnight+86400000};
}
(function(){
 const names={morning:'Kadimlerin Efendisi',evening:'Kara Alev Ejderhası'};
 const arts={morning:'assets/boss/world-boss-v2.webp',evening:'assets/boss/evening-dragon.webp'};
 bossSchedule=function(){return valorBossTiming()};
 bossSettle=function(){
  if(!state.class)return;
  const store=bossStore();
  for(const [id,s] of Object.entries(store.sessions)){
   if(s.paid||!/^\d{4}-\d{2}-\d{2}-(10|20)$/.test(id))continue;
   const hour=id.slice(11),end=Date.parse(id.slice(0,10)+'T'+hour+':15:00+03:00');
   if(Date.now()<end)continue;
   s.paid=true;s.reward=Math.floor(s.damage);s.bonus=0;
   if(s.hits){state.gold+=s.reward;store.pending.push(id)}save();
  }
 };
 function countdown(ms){const n=Math.max(0,Math.ceil(ms/1000));return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(v=>String(v).padStart(2,'0')).join(':')}
 const previousPage=bossPage;
 bossPage=function(){
  let html=previousPage();if(!html.includes('wb-art'))return html;
  const w=bossSchedule(),name=names[w.phase];
  const heading='<div class="wb-title"><b>DÜNYA BOSSU</b><b>'+(w.active?'ETKİNLİK AÇIK':'SIRADAKİ ETKİNLİK')+'</b></div>';
  html=html.replace(/<div class="wb-title">[\s\S]*?<\/div>/,heading)
   .replace(/(<img class="wb-demon" src=")[^"]+/,(_,prefix)=>prefix+arts[w.phase])
   .replace('alt="Kadimlerin Efendisi şeytani dünya bossu"','alt="'+name+'"')
   .replace('KADİMLERİN EFENDİSİ',name.toLocaleUpperCase('tr-TR'))
   .replace('<p>∞ SINIRSIZ CAN</p>','');
  const timer='<div class="wb-countdown" role="timer" aria-label="'+(w.active?'Etkinlik bitişine':'Sıradaki bossa')+' kalan süre"><span>'+(w.active?'ETKİNLİK BİTİŞİNE':'SIRADAKİ BOSS · '+names[w.nextPhase].toLocaleUpperCase('tr-TR'))+'</span><strong>'+countdown((w.active?w.end:w.next)-Date.now())+'</strong><small>Her gün 10:00 ve 20:00 · Türkiye saati</small></div>';
  return html.replace('<div class="wb-card wb-ranking">',timer+'<div class="wb-card wb-ranking">');
 };
})();

/* Workshop presentation: keep the existing crafting actions and selections. */
(function(){
 const previousWorkshop=workshop;
 const groups=[
  ['Ekipman',[['enhance','Güçlendirme','Yükseltme seviyesini artır'],['refine','Arıtma','Efsunları yeniden belirle'],['epic','Epik','Ekipmanını epik yap']]],
  ['Mozaik',[['mosaic','Taş Tak / Çıkar','Ekipman yuvalarını düzenle'],['gemcombine','Taş Birleştir','Üst seviye mozaik üret'],['gemswap','Tür Değiştir','Aynı seviyede taş değiştir']]],
  ['Birleştirme',[['stones','Şans Taşı','Üst seviye şans taşı üret'],['wings','Kanat','İki kanadı birleştir'],['combine','Binek Kartı','Ruh parçalarını birleştir']]]
 ];
 workshop=function(){
  const template=document.createElement('template');template.innerHTML=previousWorkshop();
  const shell=template.content.querySelector('.vw-shell');if(!shell)return template.innerHTML;
  shell.classList.add('valor-forge');
  const current=groups.flatMap(g=>g[1]).find(t=>t[0]===workTab)||groups[0][1][0];
  const menu=document.createElement('nav');menu.className='forge-nav';menu.setAttribute('aria-label','Atölye işlemleri');
  menu.innerHTML=groups.map(([name,tabs])=>'<section class="forge-nav-group"><h3>'+name+'</h3><div>'+tabs.map(([id,label,hint])=>'<button type="button" '+(workTab===id?'class="active" aria-current="page" ':'')+'onclick="workTab=\''+id+'\';render()"><span>'+label+'</span><small>'+hint+'</small></button>').join('')+'</div></section>').join('');
  shell.querySelector('.vw-top-dropdown')?.replaceWith(menu);
  const panel=shell.querySelector('.vw-panel');
  panel.dataset.forgeTab=workTab;
  const title=panel.querySelector('h2');if(title)title.insertAdjacentHTML('afterend','<p class="forge-panel-intro">'+current[2]+'.</p>');
  const equippedIds=new Set(Object.values(state.equipped||{}).filter(Boolean).map(it=>String(it.id)));
  const all=[...(state.inventory||[]),...Object.values(state.equipped||{}).filter(Boolean)];
  panel.querySelectorAll('.vw-item').forEach(button=>{
   const id=button.getAttribute('onclick')?.match(/vwChooseItem\('([^']+)'\)/)?.[1];
   const item=all.find(it=>String(it.id)===id);if(!item)return;
   button.setAttribute('aria-pressed',String(String(vwSelectedItemId)===String(item.id)));
   button.title=item.name+' +'+(item.plus||0);
   const name=button.querySelector('div');if(name){name.classList.add('forge-item-name');name.textContent=item.name;}
   if(equippedIds.has(String(item.id))){const badge=document.createElement('span');badge.className='forge-equipped';badge.textContent='TAKILI';button.append(badge);}
  });
  if(panel.querySelector('.vw-item-list')&&!panel.querySelector('.vw-item'))panel.insertAdjacentHTML('beforeend','<div class="forge-empty">Bu işlem için uygun ekipmanın yok.<small>Çantana ekipman eklediğinde burada görünecek.</small></div>');
  return template.innerHTML;
 };
})();

/* Lucky wheel assets are isolated from the existing game panels. */
(function(){
 const css=document.createElement('link');css.rel='stylesheet';css.href='assets/wheel/wheel.css?v=20261025-9';document.head.appendChild(css);
 const js=document.createElement('script');js.src='assets/wheel/wheel.js?v=20261026-prizes';document.head.appendChild(js);
})();

/* The one-time +100.000 diamond wheel test top-up is retired; accounts that already received it keep it. */
