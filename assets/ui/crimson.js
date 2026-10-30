/* Presentation adapter: all destinations and actions use the existing live game modules. */
(function(){
 'use strict';
 const root=document.documentElement,LAYOUT_KEY='valor-layout-v2';
 const legacy={home,nav,mapPage,render,settings:window.valorSettingsPage};
 const originalHeader=document.querySelector('.top.valor-resource-bar').cloneNode(true);
 // Generated cutout art is shared by Home, Menu and the five navigation tabs.
 const iconNames=new Set(['bag','grid','home','user','chat','settings','swords','map','door','boss','gift','forge','book','farm','horse','wing','pet','gem','shop','group','medal','quest','wheel','arena','castle','event','rank','social','guide','support','valor-dungeon']);
 function icon(name){
  if(name==='search')return '<svg class="vc-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg>';
  return '<img class="vc-icon vc-icon-art" src="assets/ui/icons-realistic/'+(iconNames.has(name)?name:'grid')+'.webp" width="64" height="64" alt="" aria-hidden="true" decoding="async">';
 }
 const modern=()=>root.dataset.valorLayout!=='classic';
 const esc=value=>escapeAttr(String(value??'')).replace(/'/g,'&#39;');
 function short(value){const n=Math.max(0,Number(value)||0);return n>=1e6?(n/1e6).toLocaleString('tr-TR',{maximumFractionDigits:1})+'M':n>=1000?(n/1000).toLocaleString('tr-TR',{maximumFractionDigits:1})+'K':String(n)}
 const entries=[['Macera','Macera','swords','Savaş'],['Sahneler','Sahne','map','Savaş'],['Savaş','Arena','arena','Savaş'],['Zindan','Zindan','door','Savaş'],['Dünya Bossu','Dünya Bossu','boss','Savaş'],['Valor Zindanı','Valor Zindanı','valor-dungeon','Savaş'],['Kale Savaşı','Kale Savaşı','castle','Savaş'],['Birlik','Birlik','group','Topluluk'],['Atölye','Atölye','forge','Gelişim'],['Teknoloji','Teknoloji','book','Gelişim'],['Çiftlik','Çiftlik','farm','Gelişim'],['Binek','Binek','horse','Gelişim'],['Fashion','Kanat','wing','Gelişim'],['Pet','Muhafızlar','pet','Gelişim'],['Astroloji','Astroloji','gem','Gelişim'],['Madalyon','Madalyon','medal','Gelişim'],['Market','Market','shop','Diğer'],['Görevler','Görevler','quest','Diğer'],['Şans Çarkı','Şans Çarkı','wheel','Diğer'],['Etkinlikler','Etkinlikler','event','Diğer'],['Sıralama','Sıralama','rank','Topluluk'],['Sosyal','Sosyal','social','Topluluk'],['Rehber','Rehber','guide','Diğer'],['Destek','Destek','support','Diğer'],['Ayarlar','Ayarlar','settings','Diğer']];
 const shortcutRoutes=['Atölye','Teknoloji','Çiftlik','Binek','Fashion','Pet','Astroloji','Market'];
 function action(route){if(route==='Madalyon')return 'valorMedallionOpenMarket()';if(route==='Valor Zindanı')return 'valorZindan.open()';if(route==='Kale Savaşı')return "valorGuildSection='castle';go('Birlik')";return "go('"+route+"')"}
 function shortcut(e){return '<button type="button" class="vc-shortcut mmorpg-home-tile" aria-label="'+esc(e[0])+'" onclick="'+action(e[0])+'">'+icon(e[2])+'<span>'+e[1]+'</span></button>'}
 function header(){
  if(!modern()||!state.class)return;
  const h=document.querySelector('.top.valor-resource-bar');if(!h||h.dataset.crimsonHeader)return;
  const portrait=h.querySelector('.valor-portrait-button'),nick=h.querySelector('#valor-player-nick'),gold=h.querySelector('.valor-gold'),energy=h.querySelector('.valor-hud-energy'),diamonds=h.querySelector('.valor-diamonds'),level=h.querySelector('.valor-level-block');
  if(![portrait,nick,gold,energy,diamonds,level].every(Boolean))return;
  const brand=document.createElement('div');brand.className='vc-masthead';brand.innerHTML='<div class="vc-wordmark">VALOR <span>ONLINE</span></div><button type="button" aria-label="Ayarlar" onclick="go(\'Ayarlar\')">'+icon('settings')+'</button>';
  h.before(brand);h.replaceChildren();h.dataset.crimsonHeader='1';
  const identity=document.createElement('div');identity.className='vc-identity';identity.append(portrait);
  const copy=document.createElement('div');copy.className='vc-identity-copy';copy.innerHTML='<small id="vc-header-class"></small>';copy.append(nick);copy.insertAdjacentHTML('beforeend','<span class="vc-power">'+icon('swords')+'<b id="vc-header-power"></b><small>Savaş Gücü</small></span>');identity.append(copy);h.append(identity,level);
  const energyLabel=energy.querySelector('#valor-hud-energy-current')?.parentElement;if(energyLabel)for(const node of energyLabel.childNodes)if(node.nodeType===3)node.textContent=node.textContent.replace('Enerji:','');
  const resources=document.createElement('div');resources.className='vc-resources';resources.append(gold,diamonds,energy);h.append(resources);
 }
 function headerValues(){if(!modern()||!state.class)return;const hud=document.querySelector('.top.valor-resource-bar[data-crimson-header]');if(hud&&typeof valorCreationPortrait==='function'){let art=hud.querySelector('.vc-header-character-art');if(!art){art=document.createElement('img');art.className='vc-header-character-art';art.alt='';art.setAttribute('aria-hidden','true');art.decoding='async';const frame=document.createElement('div');frame.className='vc-header-art-frame';frame.setAttribute('aria-hidden','true');frame.append(art);hud.prepend(frame)}const portraitClass=({'Savaşçı':'warrior','Büyücü':'mage','Okçu':'archer'})[state.class];const source=portraitClass?'assets/ui/portraits-left/'+portraitClass+'-'+(state.gender==='female'?'female':'male')+'.webp':valorCreationPortrait(state.class,state.gender);if(art.getAttribute('src')!==source)art.src=source}const cls=document.getElementById('vc-header-class'),power=document.getElementById('vc-header-power');if(cls)cls.textContent=state.class+' · Seviye '+state.level;if(power)power.textContent=money(combatPower());const diamond=document.getElementById('diamonds');if(diamond){diamond.textContent=short(state.diamonds);diamond.title=money(state.diamonds)+' Elmas'}}
 function activeTab(){if(['Anasayfa','Çanta','Profil','Sohbet'].includes(page))return page;if(page==='Ayarlar')return '';return 'Harita'}
 nav=function(){
  if(!modern())return legacy.nav.apply(this,arguments);
  const el=document.getElementById('bottomNav');if(!el)return;
  const playing=!!state.class&&(typeof valorAccountCanPlay!=='function'||valorAccountCanPlay());el.style.display=playing?'grid':'none';if(!playing){el.replaceChildren();return}
  el.innerHTML=[['Çanta','Çanta','bag'],['Harita','Menü','grid'],['Anasayfa','Anasayfa','home'],['Profil','Profil','user'],['Sohbet','Sohbet','chat']].map(([route,label,art])=>'<button type="button" class="bottom-item vc-bottom-item '+(route==='Anasayfa'?'vc-home-nav ':'')+(activeTab()===route?'active':'')+'" aria-label="'+label+'" '+(route==='Harita'?'data-valor-menu ':'')+(activeTab()===route?'aria-current="page" ':'')+'onclick="'+action(route)+'">'+(route==='Anasayfa'?'<span class="vc-home-seal">'+icon(art)+'</span>':icon(art))+'<span class="bottom-label">'+label+'</span></button>').join('');
 };
 function warTile(route,label,style,detail){return '<button type="button" class="vc-war-tile vc-war-'+style+' mmorpg-home-tile" aria-label="'+route+'" onclick="'+action(route)+'"><span class="vc-tile-emblem">'+icon(({dungeon:'door',scene:'map',arena:'arena',adventure:'swords'})[style])+'</span><span class="vc-tile-copy"><strong>'+label+'</strong><small>'+esc(detail)+'</small></span><span class="vc-tile-arrow">›</span></button>'}
 function dailySummary(){if(typeof valorQuestData!=='function')return '';const d=valorQuestData().daily,goals=valorQuestDailyGoals,count=goals.filter(g=>(Number(d.counts[g.id])||0)>=g.target).length;return '<section class="vc-daily"><button type="button" data-guide-target="Görevler" onclick="valorQuestOpen(\'daily\')">'+icon('quest')+'<span><strong>Günlük Görevler</strong><small>'+count+' / '+goals.length+' tamamlandı</small></span></button><button type="button" class="vc-daily-action" onclick="'+(d.claimed||count<goals.length?"valorQuestOpen('daily')":"valorQuestClaimDaily()")+'">'+(d.claimed?'Alındı ✓':count===goals.length?'Ödülü Al':'Görevlere Git ›')+'</button></section>'}
 home=function(){
  if(!modern())return legacy.home.apply(this,arguments);
  stageDailyReset();
  const zone=typeof valorAdventureZones!=='undefined'?[...valorAdventureZones].reverse().find(z=>state.level>=z.min):null;
  const boss=typeof valorBossTiming==='function'?valorBossTiming():null;
  return '<div class="vc-home valor-vertical-home">'+(typeof valorInstallBar==='function'?valorInstallBar():'')
   +'<div class="vc-ribbon"><button type="button" onclick="valorLoginOpen()">'+icon('gift')+'Giriş Ödülü</button><button type="button" onclick="go(\'Şans Çarkı\')">'+icon('wheel')+'Şans Çarkı</button><button type="button" onclick="go(\'Etkinlikler\')">'+icon('event')+'Etkinlikler</button></div>'
   +'<section class="vc-war-section"><div class="vc-zone-heading"><h2>Savaş Alanları</h2><span>Kılıcını kuşan</span></div><div class="vc-war-grid">'
   +warTile('Macera','Macera','adventure',zone?.name||'10 enerji ile keşfe çık')+warTile('Sahneler','Sahne','scene',(state.freeEntries||0)+' giriş hakkı')+warTile('Zindan','Zindan','dungeon','Katları aş, ödülleri topla')+warTile('Savaş','Arena','arena','Rakiplerine meydan oku')+'</div>'
   +'<button type="button" class="vc-boss-strip mmorpg-home-tile" aria-label="Dünya Bossu" onclick="go(\'Dünya Bossu\')"><span class="vc-boss-mark">'+icon('boss')+'</span><span><strong>Dünya Bossu</strong><small>'+(boss?.active?'Savaş şu an açık':'Her gün 10.00 ve 20.00')+'</small></span><span class="vc-boss-action">Savaşı Gör ›</span></button></section>'
   +'<section class="vc-growth"><div class="vc-zone-heading"><h2>Gelişim</h2><span>Gücüne güç kat</span></div><div class="vc-shortcuts">'+shortcutRoutes.map(r=>shortcut(entries.find(e=>e[0]===r))).join('')+'</div></section>'
   +dailySummary()+(typeof valorRewardsStrip==='function'?valorRewardsStrip():'')
   +'<div class="vc-utilities">'+['Birlik','Sıralama','Sosyal','Rehber','Destek'].map(r=>'<button type="button" class="mmorpg-home-tile" aria-label="'+r+'" onclick="'+action(r)+'">'+icon(entries.find(e=>e[0]===r)[2])+'<span>'+r+'</span></button>').join('')+'</div></div>';
 };
 let menuFilter='Tümü',menuQuery='';
 function menuButton(e){return '<button type="button" class="vc-menu-tile valor-map-choice" aria-label="'+e[1]+'" onclick="'+action(e[0])+'">'+icon(e[2])+'<span>'+e[1]+'</span></button>'}
 function menuMatches(){return entries.filter(e=>(menuFilter==='Tümü'||e[3]===menuFilter)&&e[1].toLocaleLowerCase('tr-TR').includes(menuQuery.toLocaleLowerCase('tr-TR')))}
 mapPage=function(){if(!modern())return legacy.mapPage.apply(this,arguments);return '<section class="vc-menu"><header class="vc-page-heading"><div><span>KRALLIĞIN TÜM KAPILARI</span><h1>Menü</h1></div>'+icon('grid')+'</header><label class="vc-menu-search">'+icon('search')+'<input type="search" id="vc-menu-search" aria-label="Oyun bölümü ara" placeholder="Bölüm ara…" value="'+esc(menuQuery)+'" oninput="valorCrimsonSearch(this.value)"></label><div class="vc-menu-filters" aria-label="Bölüm kategorisi">'+['Tümü','Savaş','Gelişim','Topluluk','Diğer'].map(f=>'<button type="button" aria-pressed="'+(f===menuFilter)+'" onclick="valorCrimsonFilter(\''+f+'\')">'+f+'</button>').join('')+'</div><div class="vc-menu-grid" id="vc-menu-grid">'+menuMatches().map(menuButton).join('')+'</div><p id="vc-menu-empty" '+(menuMatches().length?'hidden':'')+'>Aramana uygun bölüm bulunamadı.</p></section>'};
 window.valorCrimsonSearch=function(query){menuQuery=String(query).slice(0,80);const grid=document.getElementById('vc-menu-grid');if(grid){const matches=menuMatches();grid.innerHTML=matches.map(menuButton).join('');document.getElementById('vc-menu-empty').hidden=!!matches.length}};
 window.valorCrimsonFilter=function(filter){if(!['Tümü','Savaş','Gelişim','Topluluk','Diğer'].includes(filter))return;menuFilter=filter;render()};
 window.valorSetLayout=function(layout){if(!['crimson','classic'].includes(layout))return;root.dataset.valorLayout=layout;try{localStorage.setItem(LAYOUT_KEY,layout)}catch{}if(layout==='classic'){const current=document.querySelector('.top.valor-resource-bar');if(current?.dataset.crimsonHeader)current.replaceWith(originalHeader.cloneNode(true));document.querySelector('.vc-masthead')?.remove()}else header();render()};
 window.valorSettingsPage=function(){const template=document.createElement('template');template.innerHTML=legacy.settings.apply(this,arguments);const card=template.content.querySelector('.vhub-card');if(card){const controls=document.createElement('div');controls.className='vc-layout-picker';controls.innerHTML='<p>Arayüz düzeni</p><div role="group" aria-label="Arayüz düzeni"><button type="button" aria-pressed="'+modern()+'" onclick="valorSetLayout(\'crimson\')">Yeni düzen</button><button type="button" aria-pressed="'+!modern()+'" onclick="valorSetLayout(\'classic\')">Klasik görünüm</button></div><small>Klasik görünümünü istediğin zaman geri açabilirsin. Karakterin ve ilerlemen korunur.</small>';card.append(controls)}return template.innerHTML};
 render=function(){header();const result=legacy.render.apply(this,arguments);headerValues();document.body.dataset.valorPage=page;trackPage();backBar();armBack();swapGlyphs(document.getElementById('main'));return result};

 /* Emoji left in older page renderers are swapped for the theme's own art after
    every DOM change. Chat messages and form fields are left untouched. */
 const glyphIcons={'🏰':'castle','💬':'chat','🏆':'rank','🗺️':'map','🗺':'map','🔮':'gem','⚔️':'swords','⚔':'swords'};
 const GLYPHS=/🗺️|🗺|⚔️|⚔|🏰|💬|🏆|🔮|💠|💎|⚡️|⚡|🔒/u;
 const GLYPHS_ALL=new RegExp(GLYPHS.source,'gu');
 function resourceSrc(selector,fallback){return document.querySelector(selector)?.getAttribute('src')||fallback}
 function glyphNode(ch){
  const t=document.createElement('template');
  if(ch==='🔒')t.innerHTML='<svg class="vc-glyph vc-glyph-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  else{let src;if(glyphIcons[ch])src='assets/ui/icons-realistic/'+glyphIcons[ch]+'.webp';else if(ch==='💎')src=resourceSrc('.valor-diamond-icon img','assets/img/491867083df2a72d.webp');else if(ch==='💠')src='assets/img/9109f56d5f3c11e1.webp';else src=resourceSrc('.valor-energy-emblem img','');if(!src)return document.createTextNode(ch);t.innerHTML='<img class="vc-glyph" src="'+esc(src)+'" alt="" aria-hidden="true" decoding="async">'}
  return t.content.firstChild;
 }
 const skipGlyph='input,textarea,script,style,[contenteditable],.vp-empty,.vwf-wheel,[class*="message"],[class*="msg"],.vch-list,.vch-log';
 function swapGlyphs(node){
  if(!modern()||!node)return;
  const texts=[];
  if(node.nodeType===3)texts.push(node);
  else if(node.nodeType===1){const w=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);while(w.nextNode())texts.push(w.currentNode)}
  for(const text of texts){
   const parent=text.parentElement;if(!parent||!GLYPHS.test(text.nodeValue)||parent.closest(skipGlyph)||!parent.closest('#main,.vr-overlay,[role=dialog],.adventure-modal'))continue;
   const frag=document.createDocumentFragment();let last=0;
   for(const m of text.nodeValue.matchAll(GLYPHS_ALL)){frag.append(text.nodeValue.slice(last,m.index),glyphNode(m[0]));last=m.index+m[0].length}
   frag.append(text.nodeValue.slice(last));parent.replaceChild(frag,text);
  }
 }
 let glyphQueue=new Set(),glyphFrame=0;
 new MutationObserver(list=>{for(const m of list){if(m.type==='characterData')glyphQueue.add(m.target);else m.addedNodes.forEach(n=>glyphQueue.add(n))}if(!glyphFrame)glyphFrame=requestAnimationFrame(()=>{glyphFrame=0;const q=glyphQueue;glyphQueue=new Set();q.forEach(n=>{if(n.isConnected)swapGlyphs(n)})})}).observe(document.body,{childList:true,subtree:true,characterData:true});

 /* One back button for every inner page, plus the phone's back gesture.
    Tabs are roots; inner pages remember where the player came from. */
 const tabRoutes=new Set(['Anasayfa','Harita','Çanta','Profil','Sohbet']);
 const routeLabel=r=>r==='Harita'?'Menü':(entries.find(e=>e[0]===r)?.[1]||r);
 let navStack=[],lastPage=null,goingBack=false;
 function trackPage(){if(page===lastPage)return;if(lastPage&&!goingBack){if(tabRoutes.has(page))navStack=[];else{navStack.push(lastPage);if(navStack.length>20)navStack.shift()}}lastPage=page}
 function backTarget(){if(navStack.length)return navStack[navStack.length-1];if(page==='Anasayfa')return null;return tabRoutes.has(page)?'Anasayfa':'Harita'}
 function openDialog(){const list=[...document.querySelectorAll('#vzd-overlay,.vr-overlay,[role=dialog][aria-modal=true]')].filter(e=>e.isConnected&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden');return list[list.length-1]||null}
 function closeDialog(){
  const d=openDialog();if(!d)return false;
  if(d.id==='vzd-overlay'||d.closest('#vzd-overlay')){if(window.valorZindan?.close)valorZindan.close();return true}
  const btn=[...d.querySelectorAll('button')].find(b=>b.matches('.vr-close,[aria-label="Kapat"],[data-close]')||/^(×|✕|Kapat|Vazgeç|İptal)$/.test(b.textContent.trim()));
  if(btn)btn.click();
  return true; // a battle or busy dialog swallows the back gesture instead of leaving the page
 }
 window.valorCrimsonBack=function(){
  if(closeDialog())return true;
  const target=backTarget();if(!target)return false;
  if(navStack.length)navStack.pop();
  goingBack=true;try{if(target==='Kale Savaşı'){valorGuildSection='castle';go('Birlik')}else go(target)}finally{goingBack=false}
  return true;
 };
 function backBar(){
  document.querySelectorAll('#main .vc-backbar').forEach(e=>e.remove());
  const main=document.getElementById('main');if(!main||!modern()||!state.class||tabRoutes.has(page))return;
  // Older pages carried their own "‹ Ana Sayfa" style buttons; the shared bar replaces them.
  main.querySelectorAll('button[onclick^="go("]').forEach(b=>{if(/^‹|Dön$/.test(b.textContent.trim()))b.classList.add('vc-legacy-back')});
  const target=backTarget()||'Harita',bar=document.createElement('nav');
  bar.className='vc-backbar';bar.setAttribute('aria-label','Geri');
  bar.innerHTML='<button type="button" onclick="valorCrimsonBack()"><span aria-hidden="true">‹</span>'+esc(routeLabel(target))+'</button>';
  main.prepend(bar);
 }
 function armBack(){if(!modern()||!state.class)return;try{if(!history.state||!history.state.vcBack)history.pushState({vcBack:1},'')}catch{}}
 window.addEventListener('popstate',()=>{if(!modern()||!state.class||document.body.classList.contains('valor-account-screen'))return;if(valorCrimsonBack())armBack()});
 function install(){header();render()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
