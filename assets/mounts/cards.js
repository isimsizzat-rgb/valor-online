/* Mount cards: buying a mount puts its card in the bag; using the card adds it to the collection.
   A card for a mount already in the collection can be shattered into Binek Ruh Parçası, and
   Atölye → Birleştir turns those shards into timed mounts (their cards also go to the bag). */
const VALOR_CRAFT_MOUNTS=[
 {id:'kultayi',name:'Kül Tayı',kind:'horse',color:'#d98c5f',stats:[40,40,40,40],days:7,cost:100,art:'kozy ele'},
 {id:'firtinakurdu',name:'Fırtına Kurdu',kind:'wolf',color:'#7fb7e6',stats:[70,70,70,70],days:7,cost:250,art:'ayazkurt'},
 {id:'golgegrifonu',name:'Gölge Grifonu',kind:'griffin',color:'#8f7bc8',stats:[110,110,110,110],days:15,cost:600,art:'griffin'},
 {id:'ejderruhu',name:'Ejder Ruhu',kind:'dragon',color:'#e0b25c',stats:[160,160,160,160],days:30,cost:1500,art:'gokkiran'}
];
for(const m of VALOR_CRAFT_MOUNTS)if(!valorMounts.some(x=>x.id===m.id))valorMounts.push({id:m.id,name:m.name,kind:m.kind,color:m.color,stats:m.stats,spirit:Math.round(m.stats.reduce((a,b)=>a+b,0)*1.25),boxOnly:true,craftOnly:true});
function valorCraftMount(id){return VALOR_CRAFT_MOUNTS.find(m=>m.id===id)}
(function(){const prev=vmMountImage;vmMountImage=function(m){const c=m&&valorCraftMount(m.id);return prev.call(this,c?{...m,id:c.art}:m)}})();

/* Shards for one card: a fifth of the mount's spirit (10 for a 10-stat mount, 80 for Kadim Ejder). */
function valorMountShards(m){return Math.max(5,Math.round(vmSpirit(m)/5))}
function valorShardCount(){vwInit();return Math.max(0,Math.floor(Number(state.mountSpiritFragments)||0))}
function valorMountOwned(id){return id==='threeDragon'?dragonRegistered():vmData().owned.includes(id)}
function valorTempLeft(id){const t=vmData().temporary.find(x=>x.id===id);return t?Math.max(0,t.until-Date.now()):0}
function valorTimeLeft(ms){const h=Math.floor(ms/3600000);return h>=24?Math.floor(h/24)+' gün '+(h%24)+' sa':h+' sa '+Math.floor(ms%3600000/60000)+' dk'}
function valorMountCard(m,extra){return {id:valorUniqueItemId(),slot:'Binek',mountId:m.id,name:m.name+(extra?.days?' ('+extra.days+' Gün)':''),cls:state.class,level:1,epic:true,...(extra||{})}}

/* Market: the card goes to the bag. A mount you already have can be bought again for shards. */
buyMarketMount=function(id){
 const m=valorMounts.find(x=>x.id===id&&x.price);if(!m)return;
 if(state.gold<m.price)return toast('Yeterli altının yok');
 state.gold-=m.price;state.inventory.push(valorMountCard(m));save();render();toast(m.name+' kartı çantana eklendi');
};
(function(){const prev=marketCategoryContent;marketCategoryContent=function(active){
 let html=prev.apply(this,arguments);if(active!=='mounts')return html;
 html=html.replace('Binekleri altınla satın al. Satın aldığın binek kalıcı olarak koleksiyonuna eklenir ve ruh değerine katkı sağlar.','Binekleri altınla satın al. Kart çantana düşer; çantadan kullanınca koleksiyonuna eklenir. Koleksiyonundaki bineğin fazla kartını parçalayıp Binek Ruh Parçası alırsın.');
 return html.replace(/<button type="button" disabled onclick="buyMarketMount\('([^']+)'\)">✓ Sahipsin<\/button>/g,'<button type="button" onclick="buyMarketMount(\'$1\')">Kart Al · Koleksiyonda</button>');
}})();

/* Using a card: permanent → collection, timed → adds (or extends) its time. */
(function(){const prev=activateMountToken;activateMountToken=function(n){
 const token=state.inventory[n];if(!token||token.slot!=='Binek')return;
 if(token.tempDays){const m=valorMounts.find(x=>x.id===token.mountId);if(!m)return toast('Binek kartı tanınmadı');
  const d=vmData(),now=Date.now();d.temporary=d.temporary.filter(t=>t.until>now);let t=d.temporary.find(x=>x.id===m.id);
  if(!t){t={id:m.id,until:now};d.temporary.push(t)}t.until=Math.max(t.until,now)+token.tempDays*86400000;
  state.inventory.splice(n,1);selected=null;save();closeBagPopup();render();toast(m.name+' etkin · '+valorTimeLeft(t.until-now)+' kaldı');return}
 return prev.apply(this,arguments);
}})();
function valorShatterMountCard(n){
 const it=state.inventory[n];if(!it||it.slot!=='Binek'||it.tempDays)return;
 const m=valorMounts.find(x=>x.id===it.mountId);if(!m)return;
 if(!valorMountOwned(m.id)&&!confirm(m.name+' henüz koleksiyonunda değil. Yine de parçalansın mı?'))return;
 const shards=valorMountShards(m);vwInit();state.mountSpiritFragments=valorShardCount()+shards;
 state.inventory.splice(n,1);selected=null;save();closeBagPopup();render();toast(m.name+' kartı parçalandı · +'+shards+' Binek Ruh Parçası');
}
(function(){const prev=showBagItemPopup;showBagItemPopup=function(n){
 const r=prev.apply(this,arguments),it=state.inventory[n];if(!it||it.slot!=='Binek')return r;
 const box=document.querySelector('#valor-bag-popup .popup-actions'),m=valorMounts.find(x=>x.id===it.mountId);if(!box||!m)return r;
 const info=document.createElement('p');info.className='vmc-note';
 if(it.tempDays){info.textContent='Süreli binek · Kullanınca '+it.tempDays+' gün etkin olur'+(valorTempLeft(m.id)?' (kalan süreye eklenir).':'.');}
 else if(m.id!=='threeDragon'){
  const owned=valorMountOwned(m.id),shards=valorMountShards(m);
  info.textContent=owned?'Bu binek zaten koleksiyonunda. Kartı parçalayıp '+shards+' Binek Ruh Parçası alabilirsin.':'Kullanınca koleksiyonuna eklenir. Parçalarsan '+shards+' Binek Ruh Parçası verir.';
  const use=box.querySelector('button');if(use&&owned)use.remove();
  box.insertAdjacentHTML('beforeend','<button type="button" class="vmc-shatter" onclick="valorShatterMountCard('+n+')">Parçala · +'+shards+'</button>');
 }
 box.insertAdjacentElement('beforebegin',info);return r;
}})();

/* Atölye → Birleştir: timed mounts from shards. */
function valorCraftMountCard(id){
 const c=valorCraftMount(id),m=valorMounts.find(x=>x.id===id);if(!c||!m)return;
 if(valorShardCount()<c.cost)return toast('Binek Ruh Parçası yetersiz');
 state.mountSpiritFragments=valorShardCount()-c.cost;state.inventory.push(valorMountCard(m,{tempDays:c.days,days:c.days}));
 save();render();toast(c.name+' ('+c.days+' gün) kartı çantana eklendi');
}
function valorCraftPanel(){
 const have=valorShardCount();
 return '<p class="vw-muted">Binek kartlarını Çanta’da parçalayarak Binek Ruh Parçası toplarsın. Parçalarla süreli binek kartı üret; kartı çantadan kullanınca binek o süre boyunca koleksiyonuna sayılır. Aynı bineği tekrar kullanırsan süresi uzar.</p><div class="vmc-have">Binek Ruh Parçası: <b>'+money(have)+'</b></div><div class="vmc-grid">'
 +VALOR_CRAFT_MOUNTS.map(c=>{const m=valorMounts.find(x=>x.id===c.id),left=valorTempLeft(c.id);return '<article class="vmc-card" style="--mount-color:'+c.color+'"><div class="vmc-art"><img src="'+vmMountImage(m)+'" alt="" loading="lazy"></div><h3>'+c.name+'</h3><div class="vmc-days">⏳ '+c.days+' gün'+(left?' · Etkin: '+valorTimeLeft(left):'')+'</div><div class="vmc-stats">Güç, Zeka, Zırh, Beden +'+c.stats[0]+' · ✦ '+vmSpirit(m)+' Ruh</div><button type="button" '+(have<c.cost?'disabled':'')+' onclick="valorCraftMountCard(\''+c.id+'\')">'+money(c.cost)+' Parça ile Üret</button></article>'}).join('')+'</div>';
}
(function(){const prev=workshop;workshop=function(){
 const html=prev.apply(this,arguments);if(workTab!=='combine')return html;
 const m=/<section class="vw-panel"[^>]*>/.exec(html);if(!m)return html;const end=html.indexOf('</section>',m.index);if(end<0)return html;
 return html.slice(0,m.index)+m[0]+'<h2>Binek Birleştir</h2>'+valorCraftPanel()+html.slice(end);
}})();

/* Mount page: timed mounts show their remaining time; craft mounts point to the workshop. */
(function(){const prev=vmMountPage;vmMountPage=function(){
 const t=document.createElement('template');t.innerHTML=prev.apply(this,arguments);
 t.content.querySelectorAll('.vm-cards>.vm-card').forEach((card,i)=>{
  const m=valorMounts[i],state_=card.querySelector('.vm-card-state');if(!m||!state_)return;
  const left=valorTempLeft(m.id);
  if(left&&!valorMountOwned(m.id))state_.textContent='⏳ '+valorTimeLeft(left)+' kaldı';
  else if(valorCraftMount(m.id))state_.textContent='Atölye → Birleştir ile üretilir';
 });
 return t.innerHTML;
}})();

/* Quick shatter: every spare permanent mount card in the bag at once. A card is spare when that mount
   is already in the collection; if it is not, one card is kept so it can still be used. The Üç Başlı
   Ejderha and timed cards are never touched. */
function valorSpareMountCards(){
 const seen=new Set(),out=[];
 (state.inventory||[]).forEach((it,n)=>{
  if(!it||it.slot!=='Binek'||it.tempDays||it.mountId==='threeDragon')return;
  const m=valorMounts.find(x=>x.id===it.mountId);if(!m)return;
  if(!valorMountOwned(m.id)&&!seen.has(m.id)){seen.add(m.id);return}
  out.push({n,id:it.id,m,shards:valorMountShards(m)});
 });
 return out;
}
function valorSpareMountsBar(){
 const spare=valorSpareMountCards();if(!spare.length)return '';
 const total=spare.reduce((s,c)=>s+c.shards,0);
 return '<div class="vmc-spare"><span><b>'+spare.length+' fazla binek kartı</b><small>Parçalarsan +'+money(total)+' Binek Ruh Parçası</small></span><button type="button" onclick="valorShatterSpareAsk()">Hepsini Parçala</button></div>';
}
function valorShatterSpareClose(){document.getElementById('vmc-spare-confirm')?.remove()}
function valorShatterSpareAsk(){
 const spare=valorSpareMountCards();if(!spare.length)return toast('Parçalanacak fazla binek kartı yok');
 const groups=new Map();for(const c of spare){const g=groups.get(c.m.id)||{m:c.m,count:0,shards:0};g.count++;g.shards+=c.shards;groups.set(c.m.id,g)}
 const total=spare.reduce((s,c)=>s+c.shards,0);valorShatterSpareClose();
 const o=document.createElement('div');o.id='vmc-spare-confirm';o.className='vr-overlay';
 o.innerHTML='<div class="vr-dialog vmc-spare-dialog" role="dialog" aria-modal="true" aria-label="Fazla binekleri parçala"><button type="button" class="vr-close" aria-label="Kapat" onclick="valorShatterSpareClose()">×</button><span class="vr-eyebrow">ÇANTA · BİNEK KARTLARI</span><h2>Fazla Binekleri Parçala</h2><p class="vr-lead">Koleksiyonunda zaten olan binek kartları parçalanır. Koleksiyonunda olmayan bir bineğin bir kartı kullanman için çantada bırakılır.</p><ul class="vmc-spare-list">'+[...groups.values()].map(g=>'<li><img src="'+vmMountImage(g.m)+'" alt=""><span>'+escapeAttr(g.m.name)+' <small>×'+g.count+'</small></span><b>+'+money(g.shards)+'</b></li>').join('')+'</ul><p class="vmc-spare-total">Toplam: <b>+'+money(total)+' Binek Ruh Parçası</b></p><div class="vmc-spare-actions"><button type="button" class="vmc-spare-cancel" onclick="valorShatterSpareClose()">Vazgeç</button><button type="button" class="vr-claim" onclick="valorShatterSpare()">'+spare.length+' Kartı Parçala</button></div></div>';
 o.addEventListener('click',e=>{if(e.target===o)valorShatterSpareClose()});document.body.append(o);
}
function valorShatterSpare(){
 const spare=valorSpareMountCards();valorShatterSpareClose();if(!spare.length)return;
 const ids=new Set(spare.map(c=>String(c.id))),total=spare.reduce((s,c)=>s+c.shards,0);
 vwInit();state.mountSpiritFragments=valorShardCount()+total;
 state.inventory=state.inventory.filter(it=>!ids.has(String(it.id)));selected=null;closeBagPopup();save();render();
 toast(spare.length+' binek kartı parçalandı · +'+money(total)+' Binek Ruh Parçası');
}
(function(){
 const prevBag=bag;bag=function(){const html=prevBag.apply(this,arguments),bar=valorSpareMountsBar();if(!bar)return html;return html.replace('<div class="bag-layout">',bar+'<div class="bag-layout">')};
 const prevPanel=valorCraftPanel;valorCraftPanel=function(){const html=prevPanel.apply(this,arguments),bar=valorSpareMountsBar();return bar?html.replace('<div class="vmc-grid">',bar+'<div class="vmc-grid">'):html};
})();
