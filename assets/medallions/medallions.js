/* Fame ranks and seven-day equipment bought with the Castle War wallet. */
const VALOR_MEDALLION_LIFETIME=7*24*60*60*1000;
const VALOR_MEDALLIONS=[
 {id:'zalim',resistance:1000,health:1000,name:'Zalim',fame:0,price:200,color:'#bd987a'},
 {id:'karanlik',resistance:2000,health:2000,name:'Karanlık Lord',fame:500,price:250,color:'#b695ed'},
 {id:'kudretli',resistance:3000,health:3000,name:'Kudretli Lord',fame:1500,price:300,color:'#df8c63'},
 {id:'yenilmez',resistance:4500,health:4500,name:'Yenilmez Lord',fame:4000,price:350,color:'#86baff'},
 {id:'dokunulmaz',resistance:6000,health:6000,name:'Dokunulmaz Lord',fame:8000,price:400,color:'#70dbac'},
 {id:'kutsal',resistance:8000,health:8000,name:'Kutsal Lord',fame:15000,price:450,color:'#f1dfb3'},
 {id:'yuce',resistance:10000,health:10000,name:'Yüce Lord',fame:25000,price:500,color:'#ed8b9e'},
 {id:'ebedi',resistance:13000,health:13000,name:'Ebedî Lord',fame:40000,price:600,color:'#8ee9f2'},
 {id:'ilahi',resistance:16000,health:16000,name:'İlahi Lord',fame:65000,price:750,color:'#f7c2d8'},
 {id:'efendi',resistance:20000,health:20000,name:'Lordların Efendisi',fame:100000,price:1000,color:'#ffc16a'}
];
function valorMedallionProduct(id){return VALOR_MEDALLIONS.find(p=>p.id===id)}
function valorMedallionRank(){const fame=Math.max(0,Number(state.fame)||0);return [...VALOR_MEDALLIONS].reverse().find(p=>fame>=p.fame)}
function valorIsMedallion(it){return it?.slot==='Madalyon'||!!it?.medallionId}
function valorMedallionAlive(it,now=Date.now()){return !!valorMedallionProduct(it?.medallionId)&&Number.isFinite(it.expiresAt)&&it.expiresAt>now}
function valorMedallionFind(id){return (state.inventory||[]).find(it=>String(it.id)===String(id)&&valorMedallionAlive(it))}
function valorMedallionOwned(id){return (state.inventory||[]).find(it=>it.medallionId===id&&valorMedallionAlive(it))}
function valorMedallionRemaining(it,now=Date.now()){
 const sec=Math.max(0,Math.ceil(((Number(it?.expiresAt)||0)-now)/1000));if(!sec)return 'Süresi doldu';
 const days=Math.floor(sec/86400),hours=Math.floor(sec%86400/3600),minutes=Math.floor(sec%3600/60);
 return days?days+'g '+hours+'sa':hours?hours+'sa '+minutes+'dk':minutes?minutes+'dk':sec+'sn';
}
function valorMedallionDate(time){return new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(time))}
function valorMedallionPrune(now=Date.now()){
 if(!state?.class)return false;let changed=false;
 const old=state.inventory||[],next=old.filter(it=>!valorIsMedallion(it)||valorMedallionAlive(it,now));
 if(next.length!==old.length){state.inventory=next;selected=null;changed=true}
 const worn=state.equipped?.Madalyon;
 if(worn){const canonical=next.find(it=>String(it.id)===String(worn.id)&&valorMedallionAlive(it,now));if(!canonical){delete state.equipped.Madalyon;changed=true}else if(worn!==canonical){state.equipped.Madalyon=canonical;changed=true}}
 return changed;
}
function valorMedallionStatsHtml(p){return '<div class="vmed-stat-list"><span>Direnç <b>+'+money(p.resistance)+'</b></span><span>Can <b>+'+money(p.health)+'</b></span></div>'}
function valorMedallionArt(p){return VALOR_MEDALLION_ART[p.id]}
function valorMedallionOpenMarket(){closeBagPopup();go('Market');window.valorMarketCategory='medallions';render()}
function valorMedallionMarket(){
 if(valorCastleSettle())save();const rank=valorMedallionRank(),fame=Math.max(0,Number(state.fame)||0),balance=Number(valorCastleData().medallions)||0,next=VALOR_MEDALLIONS[VALOR_MEDALLIONS.indexOf(rank)+1];
 return '<section class="vmed-page"><header class="vmed-heading"><small>KALE SAVAŞI · ŞÖHRET RÜTBELERİ</small><h2>Hükmünün Nişanı</h2><p>Şöhretinle açılan madalyonunu seç. Kale Savaşı ödüllerinle satın al ve profilinde kuşan.</p></header><div class="vmed-summary"><div><small>Ünvanın</small><b style="color:'+rank.color+'">'+rank.name+'</b><span>'+money(fame)+' Şöhret</span></div><div><small>Kale Madalyonun</small><b>'+money(balance)+'</b><span>Birlik savaşından kazanılır</span></div></div>'+(next?'<p class="vmed-next">Sonraki ünvan: <b>'+next.name+'</b> · '+money(Math.max(0,next.fame-fame))+' şöhret kaldı</p>':'<p class="vmed-next">En yüksek şöhret rütbesine ulaştın.</p>')+'<p class="vmed-notice">Her madalyon satın alındığı andan itibaren <b>7 gün</b> geçerlidir. Süresi dolunca çantadan ve takılı yuvadan kaldırılır.</p><div class="vmed-grid">'+VALOR_MEDALLIONS.map((p,i)=>{
 const owned=valorMedallionOwned(p.id),locked=fame<p.fame,poor=balance<p.price;
 return '<article class="vmed-card '+(locked?'vmed-locked':'')+'" style="--medal-color:'+p.color+'"><button type="button" class="vmed-art" onclick="valorMedallionPreview(\''+p.id+'\')" aria-label="'+p.name+' madalyonunu incele"><img src="'+valorMedallionArt(p)+'" alt="'+p.name+' madalyonu" width="320" height="320" loading="lazy"></button><div class="vmed-copy"><small>RÜTBE '+(i+1)+' · 7 GÜN</small><h3>'+p.name+'</h3><p>'+money(p.fame)+'+ Şöhret</p>'+valorMedallionStatsHtml(p)+'<div class="vmed-price"><b>'+money(p.price)+'</b> Kale Madalyonu</div><button type="button" '+(!owned&&(locked||poor)?'disabled':'')+' onclick="'+(owned?"valorMedallionShowItem('"+escapeAttr(String(owned.id))+"')":"valorMedallionPreview('"+p.id+"')")+'">'+(owned?'Çantanda · '+valorMedallionRemaining(owned):locked?'Şöhretin Yetersiz':poor?'Madalyonun Yetersiz':'Satın Al')+'</button></div></article>';
 }).join('')+'</div></section>';
}
function valorMedallionDialog(html){closeBagPopup();const overlay=document.createElement('div');overlay.id='valor-bag-popup';overlay.className='valor-item-overlay';overlay.innerHTML='<section class="valor-item-dialog vmed-dialog" role="dialog" aria-modal="true" aria-label="Madalyon bilgileri"><button type="button" class="valor-item-close" onclick="closeBagPopup()" aria-label="Kapat">×</button>'+html+'</section>';overlay.addEventListener('click',e=>{if(e.target===overlay)closeBagPopup()});document.body.appendChild(overlay)}
let valorMedallionPending=null;
const valorMedallionPreviousClose=closeBagPopup;
closeBagPopup=function(){valorMedallionPending=null;return valorMedallionPreviousClose.apply(this,arguments)};
function valorMedallionPreview(id){
 const p=valorMedallionProduct(id);if(!p||!state.class||!valorAccountCanPlay())return;
 if(valorCastleSettle())save();const owned=valorMedallionOwned(id);if(owned)return valorMedallionShowItem(owned.id);
 const fame=Number(state.fame)||0,balance=Number(valorCastleData().medallions)||0,can=fame>=p.fame&&balance>=p.price;
 valorMedallionDialog('<img class="vmed-preview" src="'+valorMedallionArt(p)+'" alt="'+p.name+' madalyonu"><small class="vmed-kicker">7 GÜNLÜK RÜTBE MADALYONU</small><h3>'+p.name+'</h3>'+valorMedallionStatsHtml(p)+'<p>Gereken şöhret: <b>'+money(p.fame)+'</b><br>Şöhretin: '+money(fame)+'</p><p>Fiyat: <b>'+money(p.price)+' Kale Madalyonu</b><br>Bakiyen: '+money(balance)+'</p><p class="vmed-notice">Süre satın aldığın anda başlar. Çantada beklerken de işler. Kuşanıp çıkarmak süreyi yenilemez.</p><div class="vmed-dialog-actions"><button type="button" onclick="closeBagPopup()">Vazgeç</button><button type="button" '+(!can?'disabled':'')+' onclick="valorMedallionConfirmBuy()">'+(fame<p.fame?'Şöhretin Yetersiz':balance<p.price?'Madalyonun Yetersiz':'Satın Al · '+money(p.price))+'</button></div>');
 valorMedallionPending={owner:state,accountId:valorAccountActive?.id||null,id};
}
function valorMedallionConfirmBuy(){
 const pending=valorMedallionPending;valorMedallionPending=null;
 if(!pending||pending.owner!==state||pending.accountId!==(valorAccountActive?.id||null)||!document.getElementById('valor-bag-popup')||!valorAccountCanPlay())return;
 const p=valorMedallionProduct(pending.id);if(!p)return;
 if(valorCastleSettle())save();valorMedallionPrune();
 if((Number(state.fame)||0)<p.fame)return toast('Bu madalyon için şöhretin yetersiz');
 if(valorMedallionOwned(p.id))return toast('Bu madalyon zaten çantanda');
 const wallet=valorCastleData(),balance=Math.max(0,Number(wallet.medallions)||0);if(balance<p.price)return toast('Kale Madalyonun yetersiz');
 const now=Date.now(),it={id:valorUniqueItemId(),slot:'Madalyon',medallionId:p.id,name:p.name+' Madalyonu',cls:state.class,level:1,plus:0,epic:false,purchasedAt:now,expiresAt:now+VALOR_MEDALLION_LIFETIME,affixes:[],gems:[]};
 const oldInventory=state.inventory;wallet.medallions=balance-p.price;state.inventory=[...(state.inventory||[]),it];
 try{save()}catch(error){wallet.medallions=balance;state.inventory=oldInventory;valorCastleMedalSync();throw error}
 closeBagPopup();render();toast(p.name+' Madalyonu çantana eklendi · 7 gün');
}
function valorMedallionShowItem(id){
 if(valorMedallionPrune())save();const it=valorMedallionFind(id);if(!it)return toast('Madalyonun süresi dolmuş');
 const p=valorMedallionProduct(it.medallionId),worn=String(state.equipped?.Madalyon?.id)===String(it.id);
 valorMedallionDialog('<img class="vmed-preview" src="'+valorMedallionArt(p)+'" alt="'+it.name+'"><small class="vmed-kicker">RÜTBE MADALYONU · '+(worn?'TAKILI':'ÇANTADA')+'</small><h3>'+p.name+'</h3>'+valorMedallionStatsHtml(p)+'<p class="vmed-time" data-medallion-timer="'+escapeAttr(String(it.id))+'">Kalan süre: '+valorMedallionRemaining(it)+'</p><p>Bitiş: '+valorMedallionDate(it.expiresAt)+' · Türkiye saati</p><p>Tüm sınıflar kuşanabilir. Bonuslar yalnızca takılıyken geçerlidir. Direnç her vuruşta gelen hasarın en fazla %30’unu karşılar. Astrolojiyle toplanmaz; güçlü olan koruma uygulanır.</p><div class="vmed-dialog-actions"><button type="button" onclick="valorMedallionOpenMarket()">Madalyon Pazarı</button><button type="button" onclick="'+(worn?'valorMedallionRemove()':"valorMedallionEquip('"+escapeAttr(String(it.id))+"')")+'">'+(worn?'Çıkar':'Kuşan')+'</button></div>');
}
function valorMedallionEquip(id){
 if(!state.class||!valorAccountCanPlay())return;if(valorMedallionPrune())save();const it=valorMedallionFind(id);if(!it)return toast('Madalyon bulunamadı veya süresi dolmuş');
 state.equipped=state.equipped||{};state.equipped.Madalyon=it;save();closeBagPopup();render();toast(it.name+' kuşanıldı');
}
function valorMedallionRemove(){if(!state.equipped?.Madalyon)return;delete state.equipped.Madalyon;save();closeBagPopup();render();toast('Madalyon çıkarıldı; süresi işlemeye devam ediyor')}
valorMedallionProfileSlot=function(){
 const it=state.equipped?.Madalyon,p=valorMedallionAlive(it)?valorMedallionProduct(it.medallionId):null;
 return '<button type="button" class="vp-slot vf-medallion-equipment vmed-profile-slot" title="'+(p?p.name+' Madalyonu':'Boş madalyon yuvası')+'" aria-label="'+(p?p.name+' madalyonunu incele':'Madalyon Pazarına Git')+'" onclick="'+(p?"valorMedallionShowItem('"+escapeAttr(String(it.id))+"')":'valorMedallionOpenMarket()')+'">'+(p?'<img src="'+valorMedallionArt(p)+'" alt="'+p.name+' Madalyonu"><span class="vp-plus-badge" data-medallion-timer="'+escapeAttr(String(it.id))+'">'+valorMedallionRemaining(it)+'</span>':'<span class="vp-empty">◇</span><small class="vf-slot-caption">MADALYON</small>')+'</button>';
};
const valorMedallionPreviousGuild=guild;
guild=function(){return '<div class="vmed-guild-link"><button type="button" onclick="valorMedallionOpenMarket()">Madalyon Pazarı ›</button></div>'+valorMedallionPreviousGuild()};
const valorMedallionPreviousCategory=marketCategoryContent;
marketCategoryContent=function(active){return active==='medallions'?valorMedallionMarket():valorMedallionPreviousCategory(active)};
const valorMedallionPreviousIcon=equipmentIcon;
equipmentIcon=function(it){const p=valorMedallionProduct(it?.medallionId);return p?valorMedallionArt(p):valorMedallionPreviousIcon(it)};
const valorMedallionPreviousPopup=showBagItemPopup;
showBagItemPopup=function(n){const it=state.inventory[n];if(it?.marketItemId==='castleMedallion'){valorMedallionDialog('<div class="vmed-currency">'+valorCastleMedalArt()+'</div><h3>Kale Madalyonu</h3><p>Kale Savaşı ödül bakiyen: <b>'+money(valorCastleData().medallions)+'</b></p><p>Şöhret rütbene uygun, 7 günlük madalyon ekipmanları satın alabilirsin.</p><button type="button" onclick="valorMedallionOpenMarket()">Madalyon Pazarına Git</button>');return}return valorIsMedallion(it)?valorMedallionShowItem(it.id):valorMedallionPreviousPopup(n)};
const valorMedallionPreviousEquip=equip;
equip=function(n){const it=state.inventory[n];return valorIsMedallion(it)?valorMedallionEquip(it.id):valorMedallionPreviousEquip(n)};
const valorMedallionPreviousPower=equipmentPower;
equipmentPower=function(it){return valorIsMedallion(it)?0:valorMedallionPreviousPower(it)};
const valorMedallionPreviousBulk=bagCanSelect;
bagCanSelect=function(it){return !valorIsMedallion(it)&&valorMedallionPreviousBulk(it)};
const valorMedallionPreviousDelete=deleteInventoryItem;
deleteInventoryItem=function(n){if(valorIsMedallion(state.inventory[n]))return toast('Süreli madalyonlar süreleri bitince kaldırılır');return valorMedallionPreviousDelete(n)};
const valorMedallionPreviousBag=bag;
bag=function(){
 if(valorMedallionPrune())save();let html=valorMedallionPreviousBag();
 return html.replace(/<button class="bag-slot [\s\S]*?<\/button>/g,button=>{const match=button.match(/onclick="selectItem\((\d+)\)"/),it=match&&state.inventory[Number(match[1])];if(!valorIsMedallion(it))return button;return button.replace('class="bag-slot ','class="bag-slot vmed-bag-item ').replace('other-class ','').replace(/<span class="slot-plus">[\s\S]*?<\/span>/,'<span class="vmed-bag-time" data-medallion-timer="'+escapeAttr(String(it.id))+'">'+valorMedallionRemaining(it)+'</span>')});
};
const valorMedallionPreviousProfile=profile;
profile=function(){const rank=valorMedallionRank(),html=valorMedallionPreviousProfile();return html.replace('<div class="vp-scene','<div class="vmed-profile-rank" style="--medal-color:'+rank.color+'"><span>'+rank.name+'</span><small>'+money(Number(state.fame)||0)+' Şöhret</small></div><div class="vp-scene')};
const valorMedallionPreviousSave=save;
save=function(){valorMedallionPrune();return valorMedallionPreviousSave.apply(this,arguments)};
const valorMedallionPreviousRender=render;
render=function(){if(valorMedallionPrune())save();return valorMedallionPreviousRender.apply(this,arguments)};
function valorMedallionTick(){
 if(!state.class||!valorAccountCanPlay())return;
 if(valorMedallionPrune()){save();valorMedallionPending=null;closeBagPopup();render();toast('Süresi dolan madalyon kaldırıldı')}
 for(const label of document.querySelectorAll('[data-medallion-timer]')){const it=valorMedallionFind(label.dataset.medallionTimer);if(it)label.textContent=(label.classList.contains('vmed-time')?'Kalan süre: ':'')+valorMedallionRemaining(it)}
}
setInterval(valorMedallionTick,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)valorMedallionTick()});
render();
