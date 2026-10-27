/* Wallet and gift totals live on the server; the bag entry is only a display mirror. */
const VALOR_HEART_PACKS=[{id:'heart99',amount:99,price:49},{id:'heart999',amount:999,price:499},{id:'heart9999',amount:9999,price:4999}];
function valorHeartArt(){return '<img class="vheart-art" src="assets/hearts/heart.webp" alt="Kalp" decoding="async">'}
for(const p of VALOR_HEART_PACKS)marketProducts.push({...p,name:money(p.amount)+' Kalp',icon:valorHeartArt(),description:'Sevdiklerine hediye et. Her kalp, alana +1 popülerlik kazandırır.'});
const valorHeartOldProduct=marketProduct;
marketProduct=function(id){return id==='heartGift'?{id,name:'Kalp',icon:valorHeartArt(),description:'Başka bir oyuncuya gönder. Her kalp alana +1 popülerlik verir.'}:valorHeartOldProduct.apply(this,arguments)};
const valorHearts={balance:null,owner:null,loading:null,at:0,busy:false,pending:null};
function valorHeartsOnline(){return typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function'}
function valorHeartMirror(balance){
 state.inventory=state.inventory.filter(it=>it.marketItemId!=='heartGift');
 if(balance>0)state.inventory.push({id:'heart-wallet',slot:'Eşya',marketItemId:'heartGift',name:'Kalp',count:balance});
}
function valorHeartError(e){return e.status===404||e.code==='PGRST202'?'Kalp sistemi sunucuda henüz etkinleştirilmedi.':e.message||'İşlem tamamlanamadı. Tekrar dene.'}
async function valorHeartsLoad(force=false){
 if(!valorHeartsOnline())return;
 const owner=valorAccountActive.id;
 if(valorHearts.owner!==owner){valorHearts.owner=owner;valorHearts.balance=null;valorHearts.at=0;valorHearts.pending=null;valorHeartMirror(0)}
 if(valorHearts.loading)return valorHearts.loading;
 if(!force&&Date.now()-valorHearts.at<15000)return;
 valorHearts.loading=(async()=>{
  try{const result=await valorCloudFetch('/rest/v1/rpc/heart_balance',{method:'POST',body:'{}'});
   if(valorAccountActive?.id!==owner)return;
   valorHearts.balance=Number(result)||0;valorHearts.at=Date.now();valorHeartMirror(valorHearts.balance);
   if(page==='Çanta')render();return valorHearts.balance;
  }finally{valorHearts.loading=null}
 })();return valorHearts.loading;
}
const valorHeartOldPurchase=openMarketPurchase;
openMarketPurchase=function(id){
 const pack=VALOR_HEART_PACKS.find(p=>p.id===id);if(!pack)return valorHeartOldPurchase.apply(this,arguments);
 closeMarketPurchase();marketPurchaseId=id;
 const o=document.createElement('div');o.id='vm-market-purchase';o.className='vm-market-purchase-overlay';
 o.innerHTML='<section class="vm-market-purchase-dialog" role="dialog" aria-modal="true" aria-label="Kalp paketi satın al"><button class="vm-market-purchase-close" onclick="closeMarketPurchase()" aria-label="Kapat">×</button><div class="vm-market-purchase-art">'+valorHeartArt()+'</div><div class="vm-market-purchase-kicker">SINIRLI MAĞAZA</div><h2>'+money(pack.amount)+' Kalp</h2><p>Sevdiklerine gönder. Alan oyuncuya kalp başına +1 popülerlik verir.</p><div class="vm-market-total"><span>Fiyat</span><strong>'+money(pack.price)+' 💎</strong></div><p id="vheart-buy-error" role="alert"></p><button id="vmMarketPurchaseConfirm" class="vm-market-buy-confirm" onclick="buyMarketProduct()">Satın Al</button></section>';
 o.addEventListener('click',e=>{if(e.target===o&&!valorHearts.busy)closeMarketPurchase()});document.body.appendChild(o);
};
const valorHeartOldBuy=buyMarketProduct;
buyMarketProduct=async function(){
 const pack=VALOR_HEART_PACKS.find(p=>p.id===marketPurchaseId);if(!pack)return valorHeartOldBuy.apply(this,arguments);
 if(valorHearts.busy)return;
 const error=document.getElementById('vheart-buy-error'),button=document.getElementById('vmMarketPurchaseConfirm');
 if(!valorHeartsOnline()){if(error)error.textContent='Kalp satın almak ve göndermek için çevrimiçi hesabına giriş yap.';return}
 const owner=valorAccountActive.id,before=state;valorHearts.busy=true;if(button)button.disabled=true;
 try{
  // Reconcile a previous unknown network outcome before sending the same idempotent request again.
  if(valorHearts.pending?.kind==='buy'&&valorHearts.pending.pack!==pack.amount)throw Error('Önce önceki kalp paketini tekrar deneyerek işlemi tamamla.');
  await valorCloudFlush();if(valorCloudBlocked||valorCloudStatus!=='saved')throw Error('Bulut kaydı tamamlanamadı. Tekrar dene.');
  if(state!==before||valorAccountActive?.id!==owner)throw Error('Aktif karakter değişti.');
  const pending=valorHearts.pending||{kind:'buy',pack:pack.amount,expected_rev:valorCloudRev(owner),request_id:crypto.randomUUID()};valorHearts.pending=pending;
  const operation=valorCloudFetch('/rest/v1/rpc/heart_buy',{method:'POST',body:JSON.stringify({pack:pending.pack,expected_rev:pending.expected_rev,request_id:pending.request_id})});
  valorCloudBusy=operation;const result=await operation;
  if(state!==before||valorAccountActive?.id!==owner)throw Error('İşlem tamamlandı. Hesabına tekrar giriş yap.');
  // Load authoritative data instead of rolling the revision back after a lost response.
  const latest=await valorCloudLoad(owner);if(!latest)throw Error('Güncel kayıt yüklenemedi. Tekrar dene.');
  const serverDiamonds=Number(latest.data.state.diamonds)||0;state.diamonds=serverDiamonds;localStorage.setItem(valorCloudRevKey(owner),String(latest.rev));
  valorHearts.owner=owner;valorHearts.balance=Number(await valorCloudFetch('/rest/v1/rpc/heart_balance',{method:'POST',body:'{}'}));valorHeartMirror(valorHearts.balance);valorHearts.pending=null;
  save();closeMarketPurchase();render();toast(money(pack.amount)+' kalp çantana eklendi');
 }catch(e){
  if(e.status>=400&&e.status<500&&e.code!=='offline')valorHearts.pending=null;
  else if(valorHearts.pending?.kind==='buy'){valorCloudConflict();}
  if(error)error.textContent=valorHeartError(e);
 }
 finally{valorCloudBusy=null;valorHearts.busy=false;if(button)button.disabled=false;if(valorCloudDirty&&!valorCloudBlocked)valorCloudSchedule()}
};
function valorHeartClose(){if(!valorHearts.busy){document.getElementById('valor-heart-dialog')?.close();document.getElementById('valor-heart-dialog')?.remove()}}
async function valorHeartOpen(name=''){
 if(!valorHeartsOnline())return toast('Kalp göndermek için çevrimiçi hesabına giriş yap.');
 if(valorHearts.busy)return;
 if(typeof closeBagPopup==='function')closeBagPopup();
 try{await valorHeartsLoad(true)}catch(e){return toast(valorHeartError(e))}
 document.getElementById('valor-heart-dialog')?.remove();const d=document.createElement('dialog');d.id='valor-heart-dialog';d.className='vheart-dialog';
 d.innerHTML=valorHeartArt()+'<h2>Kalp Gönder</h2><p class="vheart-count">Çantandaki kalp: '+money(valorHearts.balance)+'</p><form id="vheart-form"><label for="vheart-name">Oyuncunun karakter adı</label><input id="vheart-name" required maxlength="20" autocomplete="off" value="'+escapeAttr(name)+'"><label for="vheart-amount">Kalp adedi</label><input id="vheart-amount" type="number" inputmode="numeric" min="1" max="'+Math.min(1000000,valorHearts.balance)+'" step="1" value="'+Math.min(99,valorHearts.balance)+'" required><p>Her kalp alana +1 popülerlik verir.</p><p id="vheart-send-error" class="vheart-error" role="alert"></p><footer><button type="button" onclick="valorHeartClose()">Vazgeç</button><button type="submit" '+(valorHearts.balance<1?'disabled':'')+'>Gönder</button></footer></form>';
 d.querySelector('form').addEventListener('submit',valorHeartSend);d.addEventListener('cancel',e=>{if(valorHearts.busy)e.preventDefault()});document.body.appendChild(d);d.showModal();
}
async function valorHeartSend(event){
 event.preventDefault();if(valorHearts.busy||!valorHeartsOnline())return;
 const name=document.getElementById('vheart-name').value.trim(),amount=Number(document.getElementById('vheart-amount').value),error=document.getElementById('vheart-send-error');
 if(!name||!Number.isInteger(amount)||amount<1||amount>1000000||amount>valorHearts.balance){error.textContent='Göndereceğin kalp adedini kontrol et.';return}
 if(name.toLocaleLowerCase('tr')===state.name?.toLocaleLowerCase('tr')){error.textContent='Kendine kalp gönderemezsin.';return}
 const owner=valorAccountActive.id;
 if(valorHearts.pending&&(valorHearts.pending.kind!=='send'||valorHearts.pending.recipient_name!==name||valorHearts.pending.amount!==amount)){error.textContent='Önce önceki işlemi aynı ad ve adetle tekrar dene.';return}
 const pending=valorHearts.pending||{kind:'send',recipient_name:name,amount,request_id:crypto.randomUUID()};valorHearts.pending=pending;
 valorHearts.busy=true;document.querySelectorAll('#valor-heart-dialog button,#valor-heart-dialog input').forEach(b=>b.disabled=true);
 try{
  const r=await valorCloudFetch('/rest/v1/rpc/heart_send',{method:'POST',body:JSON.stringify({recipient_name:pending.recipient_name,amount:pending.amount,request_id:pending.request_id})});
  if(valorAccountActive?.id!==owner)throw Error('İşlem tamamlandı. Hesabına tekrar giriş yap.');
  valorHearts.balance=Number(r.balance);valorHeartMirror(valorHearts.balance);valorHearts.pending=null;
  if(typeof valorRankOnline!=='undefined')delete valorRankOnline.popularity;
  save();valorHearts.busy=false;valorHeartClose();document.getElementById('valor-rank-modal')?.remove();render();toast(r.recipient+' adlı oyuncuya '+money(r.amount)+' kalp gönderdin!');
 }catch(e){if(e.status>=400&&e.status<500&&e.code!=='offline')valorHearts.pending=null;error.textContent=valorHeartError(e)}
 finally{valorHearts.busy=false;document.querySelectorAll('#valor-heart-dialog button,#valor-heart-dialog input').forEach(b=>b.disabled=false)}
}
for(const key of ['bulkInventoryControls','useInventoryItem','useInventoryStack']){
 const old=window[key];window[key]=function(n){return state.inventory[n]?.marketItemId==='heartGift'?(key==='bulkInventoryControls'?'<button type="button" onclick="valorHeartOpen()">Kalp Gönder</button>':valorHeartOpen()):old.apply(this,arguments)};
}
const valorHeartOldOpenProfile=valorOpenRankProfile;
valorOpenRankProfile=function(index){const r=valorHeartOldOpenProfile.apply(this,arguments),p=(window.valorRankShown||[])[index],container=document.querySelector('#valor-rank-modal .valor-rank-full-profile');if(p&&!p.me&&container){const box=document.createElement('div');box.className='vheart-profile';const b=document.createElement('button');b.type='button';b.className='vheart-send';b.textContent='♥ Kalp Gönder';b.addEventListener('click',()=>valorHeartOpen(p.name));box.appendChild(b);container.appendChild(box)}return r};
const valorHeartOldGo=go;
go=function(destination){const r=valorHeartOldGo.apply(this,arguments);if(['Çanta','Market','Profil'].includes(destination))valorHeartsLoad().catch(()=>{});return r};
if(state.class){valorHeartsLoad().catch(()=>{});render()}
