/* Single-use identity cards. Cloud changes and card consumption commit in one revision. */
function valorChangeCardArt(kind){
 const names={gender:'Cinsiyet Değiştirme Kartı',nick:'Nick Değiştirme Kartı',guild:'Birlik İsmi Değiştirme Kartı'};
 return '<img class="valor-change-card-art" src="assets/items/change-cards/'+kind+'.webp" alt="'+names[kind]+'" width="512" height="512" decoding="async">';
}
const VALOR_CHANGE_CARDS=[
 {id:'genderChangeCard',name:'Cinsiyet Değiştirme Kartı',price:149,kind:'gender',description:'Karakterinin cinsiyetini değiştirir.'},
 {id:'nickChangeCard',name:'Nick Değiştirme Kartı',price:149,kind:'nick',description:'Karakter adını değiştirir. Kullanıcı adın aynı kalır.'},
 {id:'guildNameChangeCard',name:'Birlik İsmi Değiştirme Kartı',price:149,kind:'guild',description:'Birliğinin ismini değiştirir. Yalnızca birlik lideri kullanabilir.'}
];
for(const card of VALOR_CHANGE_CARDS){if(!marketProducts.some(p=>p.id===card.id))marketProducts.push({...card,changeCard:true,icon:valorChangeCardArt(card.kind)})}
function valorChangeCardProduct(id){return VALOR_CHANGE_CARDS.find(p=>p.id===id)}
const valorCardsPreviousCategory=marketCategoryContent;
marketCategoryContent=function(active){
 if(active==='cards')return '<div class="vm-page vm-market-body"><div class="vm-section-title"><div><span class="vm-eyebrow">MARKET</span><h2>Kartlar</h2></div></div><p class="vm-lead">Satın al, çantandan kullan.</p><div class="vm-limited-grid">'+VALOR_CHANGE_CARDS.map(p=>'<button type="button" class="vm-limited-product" onclick="openMarketPurchase(\''+p.id+'\')"><span class="vm-limited-art"><span>'+valorChangeCardArt(p.kind)+'</span></span><strong>'+p.name+'</strong><span class="vm-limited-price">149 💎</span></button>').join('')+'</div></div>';
 if(active!=='limited')return valorCardsPreviousCategory.apply(this,arguments);
 // Preserve the existing daily shop without mixing unlimited cards into it.
 const cards=marketProducts.filter(p=>p.changeCard);for(const card of cards)marketProducts.splice(marketProducts.indexOf(card),1);
 try{return valorCardsPreviousCategory.apply(this,arguments)}finally{marketProducts.push(...cards)}
};
const valorCardsPreviousMarket=mountMarket;
mountMarket=function(){const active=window.valorMarketCategory==='cards';return valorCardsPreviousMarket.apply(this,arguments).replace('</nav>','<button type="button" data-category="cards" class="vm-market-category '+(active?'active':'')+'" aria-pressed="'+active+'" onclick="selectMarketCategory(\'cards\')">Kartlar</button></nav>')};
const valorCardsPreviousPurchase=openMarketPurchase;
openMarketPurchase=function(id){
 const p=valorChangeCardProduct(id);if(!p)return valorCardsPreviousPurchase.apply(this,arguments);
 closeMarketPurchase();marketPurchaseId=id;marketPurchaseQty=1;
 const overlay=document.createElement('div');overlay.id='vm-market-purchase';overlay.className='vm-market-purchase-overlay';
 overlay.innerHTML='<section class="vm-market-purchase-dialog" role="dialog" aria-modal="true" aria-label="'+p.name+' satın al"><button class="vm-market-purchase-close" onclick="closeMarketPurchase()" aria-label="Kapat">×</button><div class="vm-market-purchase-art">'+valorChangeCardArt(p.kind)+'</div><div class="vm-market-purchase-kicker">KARTLAR</div><h2>'+p.name+'</h2><p>'+p.description+'</p><p>Tek kullanımlık · Çantana eklenir</p><div class="vm-market-total"><span>Fiyat</span><strong>149 💎</strong></div><button id="vmMarketPurchaseConfirm" type="button" class="vm-market-buy-confirm" onclick="buyMarketProduct()">Satın Al</button></section>';
 overlay.addEventListener('click',e=>{if(e.target===overlay)closeMarketPurchase()});document.body.appendChild(overlay);
};
const valorCardsPreviousBuy=buyMarketProduct;
buyMarketProduct=function(){
 const p=valorChangeCardProduct(marketPurchaseId);if(!p)return valorCardsPreviousBuy.apply(this,arguments);
 if(window.valorMarketBuying)return;
 if((Number(state.diamonds)||0)<149)return toast('Yeterli elmasın yok');
 window.valorMarketBuying=true;
 try{state.diamonds-=149;addMarketStack(p.id,1);save();closeMarketPurchase();render();toast(p.name+' çantana eklendi')}finally{window.valorMarketBuying=false}
};
const valorCardsPreviousBulk=bulkInventoryControls;
bulkInventoryControls=function(n,it){return valorChangeCardProduct(it.marketItemId)?'<button type="button" onclick="valorOpenChangeCard('+n+')">Kullan</button>':valorCardsPreviousBulk.apply(this,arguments)};
const valorCardsPreviousUse=useInventoryItem;
useInventoryItem=function(n){return valorChangeCardProduct(state.inventory[n]?.marketItemId)?valorOpenChangeCard(n):valorCardsPreviousUse.apply(this,arguments)};
const valorCardsPreviousStack=useInventoryStack;
useInventoryStack=function(n,amount){return valorChangeCardProduct(state.inventory[n]?.marketItemId)?valorOpenChangeCard(n):valorCardsPreviousStack.apply(this,arguments)};
let valorChangeCardPending=null,valorChangeCardBusy=false;
function valorCanRenameGuild(){
 const g=state.guild;if(!g)return false;
 if(g.role)return g.role==='Lider';
 if(g.leaderId)return String(g.leaderId)===String(valorAccountActive?.id);
 return typeof valorGuildMyMembers==='function'&&valorGuildMyMembers().some(m=>m.me&&m.role==='Lider');
}
function valorCloseChangeCard(){if(valorChangeCardBusy)return;document.getElementById('valor-change-card')?.remove();valorChangeCardPending=null}
function valorOpenChangeCard(n){
 if(valorChangeCardBusy)return;
 const it=state.inventory[n],p=valorChangeCardProduct(it?.marketItemId);if(!p)return;
 if(p.kind==='guild'&&!valorCanRenameGuild())return toast(state.guild?'Bu kartı yalnızca birlik lideri kullanabilir':'Önce bir birliğin olmalı');
 closeBagPopup();valorCloseChangeCard();
 valorChangeCardPending={id:String(it.id),product:p.id,gender:state.gender==='female'?'female':'male'};
 const o=document.createElement('div');o.id='valor-change-card';o.className='valor-item-overlay';
 o.innerHTML='<section class="valor-item-dialog vcc-dialog" role="dialog" aria-modal="true" aria-labelledby="vcc-title"><button type="button" class="valor-item-close" onclick="valorCloseChangeCard()" aria-label="Kapat">×</button><div class="vcc-art">'+valorChangeCardArt(p.kind)+'</div><h3 id="vcc-title">'+p.name+'</h3><form onsubmit="event.preventDefault();valorCommitChangeCard()">'+(p.kind==='gender'?'<fieldset class="vcc-genders"><legend>Yeni cinsiyet</legend>'+[['male','Erkek'],['female','Kadın']].map(([value,label])=>'<button type="button" data-gender="'+value+'" aria-pressed="'+(value===valorChangeCardPending.gender)+'" onclick="valorSelectCardGender(\''+value+'\')">'+label+'</button>').join('')+'</fieldset>':'<label for="vcc-name">'+(p.kind==='nick'?'Yeni karakter adı':'Yeni birlik ismi')+'</label><input id="vcc-name" autocomplete="off" maxlength="'+(p.kind==='nick'?20:30)+'" minlength="3" required placeholder="'+(p.kind==='nick'?'3–20 karakter':'3–30 karakter')+'">')+'<p id="vcc-error" role="alert"></p><p class="vcc-note">Değişiklik tamamlanınca 1 kart kullanılır.</p><button type="submit" class="vcc-submit">Değiştir</button><button type="button" class="vcc-cancel" onclick="valorCloseChangeCard()">Vazgeç</button></form></section>';
 o.addEventListener('click',e=>{if(e.target===o)valorCloseChangeCard()});document.body.appendChild(o);document.getElementById('vcc-name')?.focus();
}
function valorSelectCardGender(gender){if(valorChangeCardBusy||!valorChangeCardPending||!['male','female'].includes(gender))return;valorChangeCardPending.gender=gender;document.querySelectorAll('#valor-change-card [data-gender]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gender===gender)))}
function valorApplyCardChange(target,kind,value){
 if(kind==='gender')target.gender=value;
 else if(kind==='nick')target.name=value;
 else target.guild.name=value;
}
function valorRemoveChangeCard(target,id){const n=target.inventory.findIndex(it=>String(it.id)===id);if(n<0)throw Error('Kart çantanda bulunamadı.');const it=target.inventory[n];if((Number(it.count)||1)>1)it.count--;else target.inventory.splice(n,1)}
async function valorCommitChangeCard(){
 if(valorChangeCardBusy||!valorChangeCardPending)return;
 const pending={...valorChangeCardPending},p=valorChangeCardProduct(pending.product),before=state,owner=typeof valorAccountActive==='undefined'?null:valorAccountActive;
 const error=document.getElementById('vcc-error');const fail=message=>{if(error)error.textContent=message};
 if(!state.inventory.some(it=>String(it.id)===pending.id&&it.marketItemId===p.id))return fail('Kart çantanda bulunamadı.');
 const value=p.kind==='gender'?pending.gender:(document.getElementById('vcc-name')?.value||'').trim().normalize('NFC');
 if(p.kind==='gender'&&value===(state.gender==='female'?'female':'male'))return fail('Farklı bir cinsiyet seç.');
 if(p.kind!=='gender'){
  const max=p.kind==='nick'?20:30;
  if(value.length<3||value.length>max||!/^[a-zA-ZğüşöçıİĞÜŞÖÇ0-9_ ]+$/.test(value))return fail('3–'+max+' karakter kullan: harf, rakam, boşluk veya alt çizgi.');
  if(value===(p.kind==='nick'?state.name:state.guild?.name))return fail('Farklı bir isim yaz.');
 }
 if(p.kind==='guild'&&!valorCanRenameGuild())return fail('Bu kartı yalnızca birlik lideri kullanabilir.');
 // Device-only accounts still reject a name already used by another local character.
 if(p.kind==='nick'&&!owner?.cloud&&typeof valorAccountRegistry==='function'){
  const taken=valorAccountRegistry().some(a=>a.id!==owner?.id&&valorAccountNormalize(valorAccountRead(valorAccountStorageKey(a.id))?.state?.name||'')===valorAccountNormalize(value));
  if(taken)return fail('Bu karakter adı başka bir oyuncuya ait.');
 }
 valorChangeCardBusy=true;fail('');document.querySelectorAll('#valor-change-card button,#valor-change-card input').forEach(e=>e.disabled=true);
 try{
  if(owner?.cloud){
   await valorCloudFlush();
   if(valorCloudBlocked||valorCloudStatus!=='saved')throw Error('Bulut kaydı tamamlanamadı. Tekrar dene; kartın korunuyor.');
   if(state!==before||valorAccountActive?.id!==owner.id)throw Error('Aktif karakter değişti. Tekrar dene.');
   const snapshot=valorAccountSnapshot(),next=snapshot.state,base=valorCloudRev(owner.id);
   valorApplyCardChange(next,p.kind,value);valorRemoveChangeCard(next,pending.id);
   const operation=valorCloudFetch('/rest/v1/saves?user_id=eq.'+encodeURIComponent(owner.id)+'&rev=eq.'+base,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data:snapshot,rev:base+1,updated_at:new Date().toISOString(),...valorCloudMeta(snapshot,true)})});
   valorCloudBusy=operation;
   let rows;try{rows=await operation}finally{valorCloudBusy=null}
   if(!Array.isArray(rows)||!rows.length){valorCloudConflict();throw Error('Başka bir cihazdaki kayıt değişti. Güncel kaydı yükle; kartın kullanılmadı.');}
   localStorage.setItem(valorCloudRevKey(owner.id),String(base+1));
   if(state!==before||valorAccountActive?.id!==owner.id)throw Error('Değişiklik buluta kaydedildi. Karakterine tekrar giriş yap.');
  }
  valorApplyCardChange(state,p.kind,value);valorRemoveChangeCard(state,pending.id);
  selected=null;save();valorChangeCardBusy=false;valorCloseChangeCard();render();toast(p.kind==='gender'?'Cinsiyetin değiştirildi':p.kind==='nick'?'Karakter adın değiştirildi':'Birlik ismi değiştirildi');
 }catch(e){fail(e.code==='23505'?'Bu karakter adı başka bir oyuncuya ait. Başka bir ad seç.':e.message||'Değişiklik tamamlanamadı. Kartın korunuyor.');}
 finally{valorChangeCardBusy=false;document.querySelectorAll('#valor-change-card button,#valor-change-card input').forEach(e=>e.disabled=false);if(owner?.cloud&&valorCloudDirty&&!valorCloudBlocked)valorCloudSchedule();}
}
if(state.class)render();
