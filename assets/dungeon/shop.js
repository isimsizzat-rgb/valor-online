/* Dungeon coins, purchases and lifetime rewards stay in the character save. */
const valorDungeonProducts=[
 {id:'mountStones',name:'10 Binek Taşı',price:15,limit:5,stack:'mountStone',amount:10,description:'Binek gelişiminde kullanılır. Her paket 10 taş içerir.'},
 {id:'energy',name:'Enerji Şişesi',price:20,limit:2,stack:'energyBottle',amount:1,description:'Çantadan kullanıldığında +50 macera enerjisi verir.'},
 {id:'luckBag',name:'Şans Çantası',price:25,limit:3,stack:'luckBag',amount:1,description:'Çantadan açılır. İçinden Sv. 1–4 arasında bir şans taşı çıkar.'},
 {id:'paper',name:'Sefer Kağıdı',price:40,limit:1,stack:'expeditionPaper',amount:1,description:'Çantadan kullanıldığında sahneler için +1 giriş verir.'},
 {id:'mosaic',name:'Sv. 3 Mozaik Taşı',price:60,limit:2,description:'Rastgele bir özellik türünde, garantili Sv. 3 mozaik taşı. Atölyede takılır.'},
 {id:'luckStone',name:'Sv. 4 Şans Taşı',price:80,limit:1,description:'Garantili Sv. 4 şans taşı. Atölyede güçlendirme için kullanılır.'},
 {id:'kulpence',name:'Külpençe',price:1500,limit:1,lifetime:true,description:'Zindana özel kalıcı binek. Güç, Zeka, Zırh ve Beden +50; Ruh Değeri 250. Kartı çantadan kullanarak koleksiyonuna ekle.'}
];
const valorDungeonMount={id:'dungeon-kulpence',name:'Külpençe',kind:'wolf',color:'#e28b48',stats:[50,50,50,50],spirit:250,boxOnly:true,dungeonOnly:true};
if(!valorMounts.some(m=>m.id===valorDungeonMount.id))valorMounts.push(valorDungeonMount);
const valorDungeonMountImage=vmMountImage;
vmMountImage=function(m){return m.id===valorDungeonMount.id?VALOR_KULPENCE_ART:valorDungeonMountImage(m)};
let valorDungeonShopView=false,valorDungeonPurchase=null;
function valorDungeonShopData(){
 const d=vsData().dungeon,day=marketTodayKey();let changed=false;
 if(!d.shop){d.shop={day,counts:{},kulpenceBought:false};changed=true}
 if(d.shop.day!==day){d.shop.day=day;d.shop.counts={};changed=true}
 if(!d.shop.counts){d.shop.counts={};changed=true}
 if(changed)save();return d.shop;
}
function valorDungeonOwnsMount(){return !!state.mountsV1?.owned?.includes(valorDungeonMount.id)||state.inventory.some(it=>it.slot==='Binek'&&it.mountId===valorDungeonMount.id)}
function valorDungeonShopRemaining(p){const d=valorDungeonShopData();return p.lifetime?(d.kulpenceBought||valorDungeonOwnsMount()?0:1):Math.max(0,p.limit-(Number(d.counts[p.id])||0))}
function valorDungeonProductArt(p){
 if(p.lifetime)return '<img src="'+VALOR_KULPENCE_ART+'" alt="Külpençe">';
 if(p.id==='mosaic')return vgArt(veGemTypes[0],3);
 if(p.id==='luckStone')return luckStoneGraphic(4);
 return marketProduct(p.stack)?.icon||'';
}
function valorDungeonOpenShop(){valorDungeonClosePurchase();valorDungeonShopView=true;page='Zindan';render()}
function valorDungeonCloseShop(){valorDungeonClosePurchase();valorDungeonShopView=false;render()}
function valorDungeonClosePurchase(){document.getElementById('valor-dungeon-purchase')?.remove();valorDungeonPurchase=null}
function valorDungeonShowPurchase(id){
 if(!state.class||page!=='Zindan'||!valorDungeonShopView)return;
 const p=valorDungeonProducts.find(p=>p.id===id);if(!p)return;
 valorDungeonClosePurchase();const left=valorDungeonShopRemaining(p);
 if(!left)return toast(p.lifetime?'Külpençe zaten alındı':'Günlük alım limitine ulaştın');
 valorDungeonPurchase={id,qty:1,owner:state};
 const overlay=document.createElement('div');overlay.id='valor-dungeon-purchase';overlay.className='vds-overlay';
 overlay.innerHTML=`<section class="vds-dialog" role="dialog" aria-modal="true" aria-labelledby="vds-purchase-title"><button type="button" class="vds-close" onclick="valorDungeonClosePurchase()" aria-label="Kapat">×</button><div class="vds-dialog-art">${valorDungeonProductArt(p)}</div><span class="vdg-eyebrow">ZİNDAN MARKETİ</span><h2 id="vds-purchase-title">${p.name}</h2><p>${p.description}</p><p>${p.lifetime?'Hesap başına bir kez':`Bugün kalan: ${left} / ${p.limit}`}</p><label class="vds-quantity">${p.id==='mountStones'?'Paket adedi':'Adet'} <input id="vds-qty" type="number" inputmode="numeric" min="1" max="${left}" value="1" oninput="valorDungeonSetQty(this.value)"></label><div class="vds-purchase-total"><span>Toplam</span><b id="vds-total">${money(p.price)} Zindan Parası</b></div><button type="button" id="vds-confirm" onclick="valorDungeonBuy()">Satın Al</button><small id="vds-funds"></small></section>`;
 overlay.addEventListener('click',e=>{if(e.target===overlay)valorDungeonClosePurchase()});document.body.appendChild(overlay);valorDungeonSetQty(1);
}
function valorDungeonSetQty(value){
 const intent=valorDungeonPurchase;if(!intent||intent.owner!==state)return;
 const p=valorDungeonProducts.find(p=>p.id===intent.id),left=valorDungeonShopRemaining(p);
 intent.qty=Math.max(1,Math.min(left||1,Math.floor(Number(value)||1)));
 const qty=document.getElementById('vds-qty'),total=document.getElementById('vds-total'),button=document.getElementById('vds-confirm'),funds=document.getElementById('vds-funds');
 if(qty)qty.value=intent.qty;
 if(total)total.textContent=money(p.price*intent.qty)+' Zindan Parası';
 const affordable=vsData().dungeon.coins>=p.price*intent.qty;
 if(button)button.disabled=!left||!affordable;
 if(funds)funds.textContent=affordable?'Bakiye: '+money(vsData().dungeon.coins)+' Zindan Parası':'Zindan paran yetersiz.';
}
function valorDungeonBuy(){
 const intent=valorDungeonPurchase;
 if(!intent||intent.owner!==state||!state.class||page!=='Zindan'||!valorDungeonShopView)return;
 const p=valorDungeonProducts.find(p=>p.id===intent.id),qty=intent.qty;
 if(!p||!Number.isSafeInteger(qty)||qty<1||qty>valorDungeonShopRemaining(p))return;
 const d=vsData().dungeon,cost=p.price*qty;
 if(!Number.isFinite(d.coins)||d.coins<cost)return toast('Zindan paran yetersiz');
 // Consume the confirmation before granting items; repeated clicks cannot buy twice.
 valorDungeonPurchase=null;
 d.coins-=cost;const shop=valorDungeonShopData();
 if(p.lifetime){shop.kulpenceBought=true;state.inventory.push({id:valorUniqueItemId(),slot:'Binek',mountId:valorDungeonMount.id,name:valorDungeonMount.name,cls:state.class,level:1,epic:true})}
 else{shop.counts[p.id]=(Number(shop.counts[p.id])||0)+qty;
  if(p.stack)addMarketStack(p.stack,p.amount*qty);
  else if(p.id==='mosaic')for(let n=0;n<qty;n++)vwAddGem(veGemTypes[Math.floor(Math.random()*veGemTypes.length)],3,1);
  else if(p.id==='luckStone')addLuckStoneStack(4,qty);
 }
 save();valorDungeonClosePurchase();render();toast(p.lifetime?'Külpençe kartı çantana eklendi':qty+' '+(p.id==='mountStones'?'paket Binek Taşı':p.name)+' çantana eklendi');
}
function valorDungeonShopPage(){
 const d=vsData().dungeon;valorDungeonShopData();
 return `<section class="vsys vds-page"><header class="vds-heading"><button type="button" onclick="valorDungeonCloseShop()">‹ Zindana Dön</button><span class="vdg-eyebrow">DERİNLİKLERİN HAZİNESİ</span><h2>Zindan Marketi</h2><div class="vds-wallet"><span>Zindan Parası</span><b>${money(d.coins)}</b></div><p>Her 5. katı geçerek kazandığın parayı burada harca. Günlük limitler Türkiye saatiyle 00.00’da yenilenir.</p></header><div class="vds-grid">${valorDungeonProducts.map(p=>{const left=valorDungeonShopRemaining(p);return `<article class="vds-product ${p.lifetime?'vds-exclusive':''}"><div class="vds-product-art">${valorDungeonProductArt(p)}</div><div class="vds-product-info"><span class="vds-tag">${p.lifetime?'ZİNDANA ÖZEL · KALICI':'GÜNLÜK TEDARİK'}</span><h3>${p.name}</h3><p>${p.description}</p><small>${p.lifetime?(left?'Hesap başına 1 kez':'Alındı · Hesap başına 1 kez'):`Bugün kalan: ${left} / ${p.limit}`}</small><b class="vds-price">${money(p.price)} <small>Zindan Parası</small></b><button type="button" ${!left?'disabled':''} onclick="valorDungeonShowPurchase('${p.id}')">${!left?(p.lifetime?'Alındı':'Limit Doldu'):'Satın Al'}</button></div></article>`}).join('')}</div></section>`;
}
const valorDungeonShopPreviousPage=vsDungeon;
vsDungeon=function(){
 if(valorDungeonShopView)return valorDungeonShopPage();
 const html=valorDungeonShopPreviousPage();
 return html.replace('</header>','<button type="button" class="vds-entry" onclick="valorDungeonOpenShop()">Zindan Marketi ›</button></header>');
};
const valorDungeonShopPreviousGo=go;
go=function(x){valorDungeonClosePurchase();valorDungeonShopView=false;return valorDungeonShopPreviousGo(x)};
document.addEventListener('keydown',e=>{if(e.key==='Escape')valorDungeonClosePurchase()});
