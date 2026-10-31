/* Four-stage evolution for all three classes and every supported equipment set. */
(function(){
 const names=['Normal','Epik','Ebedi','İlahi'],colors=['#b7bdc9','#d5b16b','#bda0ef','#f0db9e'];
 const epicCosts=[10,30,90];
 /* Evrim Parçası: bought with Dukat (Castle War) in Market → Madalyonlar. Epik→Ebedi needs 5, Ebedi→İlahi 15,
    so the top stages cannot be reached with diamonds alone. */
 const pieceCosts=[0,5,15],PIECE_ID='evoPiece',PIECE_PRICE=20;
 function pieceArt(){return '<img class="evo-piece-art" src="assets/items/evolution-cards/epic.webp" alt="Evrim Parçası" width="512" height="512" style="display:block;width:100%;height:100%;object-fit:contain">'}
 function pieceStock(){return (state.inventory||[]).filter(i=>i.marketItemId===PIECE_ID).reduce((n,i)=>n+Math.max(1,Number(i.count)||1),0)}
 function pieceAdd(n){const old=state.inventory.find(i=>i.marketItemId===PIECE_ID);if(old)old.count=Math.max(1,Number(old.count)||1)+n;else state.inventory.push({id:valorUniqueItemId(),slot:'Eşya',marketItemId:PIECE_ID,name:'Evrim Parçası',count:n,description:'Ebedi ve İlahi evrimlerinde kullanılır.'})}
 function pieceTake(n){let left=n;for(const it of [...state.inventory]){if(left<=0)break;if(it.marketItemId!==PIECE_ID)continue;const c=Math.max(1,Number(it.count)||1),take=Math.min(c,left);left-=take;if(take===c)state.inventory.splice(state.inventory.indexOf(it),1);else it.count=c-take}return n-left}
 {const prevProduct=marketProduct;marketProduct=function(id){return id===PIECE_ID?{id:PIECE_ID,name:'Evrim Parçası',icon:pieceArt(),description:'Ebedi (5) ve İlahi (15) evrimlerinde Epik Taşı ile birlikte kullanılır. Market → Madalyonlar’da Dukat ile alınır.'}:prevProduct.apply(this,arguments)}}
 {const prevMaterial=isDirectStoneMaterial;isDirectStoneMaterial=function(id){return id===PIECE_ID||prevMaterial.apply(this,arguments)}}
 window.valorEvoPieceCount=pieceStock;
 const oldPower=equipmentPower;let pending=null;
 const familiesByClass={'Savaşçı':['varkhan','mordrak','lumeris'],'Büyücü':['oryndis','aeloria','zephyriel'],'Okçu':['selthir','vaelthorn','eryndor']};
 function sceneSet(it){if(!it||it.starterSet)return null;const families=familiesByClass[it.cls],level=Number(it.level);if(!families)return null;return level>75&&level<=100?families[2]:level>50&&level<=75?families[1]:level>25&&level<=50?families[0]:null}
 const eligible=it=>!!it&&!!familiesByClass[it.cls]&&(it.starterSet==='starter-v1'||(Number(it.level)>=1&&Number(it.level)<=25)||sceneSet(it))&&VALOR_STARTER_SLOTS.includes(it.slot)&&!it.wingId&&!it.marketItemId;
 const artBanks={
  'Savaşçı':{starter:typeof VALOR_WARRIOR_EVOLUTION_ART!=='undefined'?VALOR_WARRIOR_EVOLUTION_ART:null,varkhan:typeof VALOR_WARRIOR_VARKHAN_ART!=='undefined'?VALOR_WARRIOR_VARKHAN_ART:null,mordrak:typeof VALOR_WARRIOR_MORDRAK_ART!=='undefined'?VALOR_WARRIOR_MORDRAK_ART:null,lumeris:typeof VALOR_WARRIOR_LUMERIS_ART!=='undefined'?VALOR_WARRIOR_LUMERIS_ART:null},
  'Okçu':{starter:VALOR_ARCHER_STARTER_ART,selthir:VALOR_ARCHER_SELTHIR_ART,vaelthorn:VALOR_ARCHER_VAELTHORN_ART,eryndor:VALOR_ARCHER_ERYNDOR_ART},
  'Büyücü':{starter:typeof VALOR_MAGE_STARTER_ART!=='undefined'?VALOR_MAGE_STARTER_ART:null,oryndis:typeof VALOR_MAGE_ORYNDIS_ART!=='undefined'?VALOR_MAGE_ORYNDIS_ART:null,aeloria:typeof VALOR_MAGE_AELORIA_ART!=='undefined'?VALOR_MAGE_AELORIA_ART:null,zephyriel:typeof VALOR_MAGE_ZEPHYRIEL_ART!=='undefined'?VALOR_MAGE_ZEPHYRIEL_ART:null}
 };
 function artFor(it){
  if(!it||!VALOR_STARTER_SLOTS.includes(it.slot)||it.wingId||it.marketItemId)return null;
  const level=Number(it.level);
  const family=it.starterSet==='starter-v1'||(level>=1&&level<=25)?'starter':it.cls==='Okçu'?(level>75&&level<=100?'eryndor':level>50&&level<=75?'vaelthorn':level>25&&level<=50?'selthir':null):sceneSet(it);
  return artBanks[it.cls]?.[family]||null;
 }
 function tier(it){if(!eligible(it))return it?.epic?1:0;const n=it.evolutionTier;return Number.isInteger(n)&&n>=0&&n<4?n:it.epic?1:0}
 function at(it,t,plus){
  if(t===0)return oldPower({...it,epic:false,plus});
  let cap=oldPower({...it,epic:false,plus:21}),base=0;
  for(let n=1;n<=t;n++){base=Math.ceil(cap*1.4);cap=Math.floor(base*(1+21*.13))}
  return Math.floor(base*(1+plus*.13));
 }
 window.valorEvolutionTier=tier;
 window.valorEvolutionPowerAt=function(it,t,plus){return eligible(it)&&Number.isInteger(t)&&t>=0&&t<=3&&Number.isInteger(plus)&&plus>=0&&plus<=21?at(it,t,plus):null};
 equipmentPower=function(it){return eligible(it)?at(it,tier(it),Math.max(0,Math.min(21,Math.trunc(Number(it.plus)||0)))):oldPower.apply(this,arguments)};
 const oldIcon=equipmentIcon;
 equipmentIcon=function(it){const art=artFor(it),visualTier=Number.isInteger(it?.evolutionTier)&&it.evolutionTier>=0&&it.evolutionTier<4?it.evolutionTier:tier(it);return art?art[visualTier]?.[it.slot]||oldIcon.apply(this,arguments):oldIcon.apply(this,arguments)};
 function stoneStock(){const n=Number(state.shards);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0}
 function stoneCost(it){return epicCosts[tier(it)]||0}
 function pieceCost(it){return pieceCosts[tier(it)]||0}
 function costMarkup(it){const cost=stoneCost(it),owned=stoneStock(),pc=pieceCost(it),ph=pieceStock();return (cost?'<p class="evo-cost '+(owned<cost?'evo-cost-missing':'')+'">Epik Taşı: <b>'+money(cost)+'</b> · Mevcut: <b>'+money(owned)+'</b>'+(owned<cost?' · Yetersiz':'')+'</p>':'')+(pc?'<p class="evo-cost '+(ph<pc?'evo-cost-missing':'')+'">Evrim Parçası: <b>'+pc+'</b> · Mevcut: <b>'+ph+'</b>'+(ph<pc?' · Yetersiz <span class="evo-piece-hint">(Market → Madalyonlar, Dukat ile)</span>':'')+'</p>':'')}
 function canPay(it){return stoneStock()>=stoneCost(it)&&pieceStock()>=pieceCost(it)}
 function label(it){return names[tier(it)]+' +'+(Number(it.plus)||0)}
 function find(id){return veFindItem(id)}
 function button(id){const b=document.createElement('button');b.type='button';b.className='evo-button';b.textContent='EVRİMLEŞTİR';const it=find(id);b.disabled=Number(it?.plus)!==21||!canPay(it);b.onclick=()=>valorEvolutionAsk(id);return b}
 function panel(it,withButton=true){
  const t=tier(it),ready=Number(it.plus)===21&&t<3,p=equipmentPower(it),next=t<3?at(it,t+1,0):null;
  const el=document.createElement('section');el.className='evo-panel';el.style.setProperty('--evo-color',colors[t]);
  el.innerHTML='<b class="evo-current">'+label(it)+'</b><div class="evo-track">'+names.map((name,i)=>'<span class="'+(i===t?'active':'')+'">'+name+'</span>').join('')+'</div>'+(next!==null?'<p>'+names[t]+' +21 → '+names[t+1]+' +0</p><div class="evo-values"><span>Şimdi <strong>'+valorEquipmentStatsText(it,p)+'</strong></span><span>'+names[t+1]+' +0 <strong>'+valorEquipmentStatsText(it,next)+'</strong></span></div><small>'+(ready?'Evrime hazır. + seviyesi sıfırlanır; taşlar ve efsunlar korunur.':'+21’e ulaştığında sonraki aşamaya evrimleştirebilirsin.')+'</small>':'<small>'+(it.plus===21?'İlahi +21 · Son gelişim aşaması.':'Son evrim aşaması · +21’e kadar güçlendirebilirsin.')+'</small>');
  if(t<3)el.insertAdjacentHTML('beforeend',costMarkup(it));
  if(withButton&&t<3){el.appendChild(button(it.id));if(!ready){const enhance=document.createElement('button');enhance.type='button';enhance.className='evo-enhance-link';enhance.dataset.itemId=String(it.id);enhance.textContent='Güçlendirmeye Git';el.appendChild(enhance)}}return el;
 }
 function decorateQuality(dialog,it,headingSelector){
  const t=tier(it);dialog.dataset.evolutionTier=String(t);
  let badge=dialog.querySelector('.evo-quality');
  if(!badge){badge=document.createElement('div');badge.className='evo-quality';const heading=dialog.querySelector(headingSelector);if(!heading)return;heading.after(badge)}
  badge.textContent=names[t];badge.style.setProperty('--evo-color',colors[t]);
 }
 function decoratePopup(it,id){
  if(!artFor(it))return;const root=document.getElementById(id),dialog=root?.querySelector('.valor-item-dialog');if(!dialog)return;
  decorateQuality(dialog,it,'h3');const rarity=dialog.querySelector('.detail-rarity');if(rarity)rarity.textContent=it.slot;
  for(const p of dialog.querySelectorAll(':scope > p'))if(/^(✦ Epik|Normal) ·/.test(p.textContent))p.textContent=p.textContent.replace(/^(✦ Epik|Normal) · /,'');
 }
 const oldBagPopup=showBagItemPopup;
 showBagItemPopup=function(n){const r=oldBagPopup.apply(this,arguments);decoratePopup(state.inventory[n],'valor-bag-popup');return r};
 const oldProfilePopup=showProfileDetails;
 showProfileDetails=function(slot){const r=oldProfilePopup.apply(this,arguments);decoratePopup(state.equipped[slot],'valor-item-overlay');return r};
 const oldBag=bag;
 bag=function(){const template=document.createElement('template');template.innerHTML=oldBag.apply(this,arguments);template.content.querySelectorAll('.bag-slot').forEach(el=>{const m=el.getAttribute('onclick')?.match(/selectItem\((\d+)\)/),it=m&&state.inventory[Number(m[1])];if(!eligible(it))return;el.dataset.evolutionTier=String(tier(it));el.title=it.name+' · '+label(it);});return template.innerHTML};
 const oldWorkshop=workshop;
 workshop=function(){const template=document.createElement('template');template.innerHTML=oldWorkshop.apply(this,arguments);const root=template.content;root.querySelectorAll('.vw-item').forEach(el=>{const m=el.getAttribute('onclick')?.match(/vwChooseItem\('([^']+)'\)/),it=m&&find(m[1]);if(eligible(it)){el.dataset.evolutionTier=String(tier(it));el.title=it.name+' · '+label(it);const name=el.querySelector('.forge-item-name,div');if(name)name.textContent=it.name+' · '+names[tier(it)]}});
  {const nav=[...root.querySelectorAll('.forge-nav button')].find(b=>b.getAttribute('onclick')?.includes("workTab='epic'"));if(nav){nav.querySelector('span').textContent='Evrim';nav.querySelector('small').textContent='+21 ekipmanını sonraki aşamaya taşı'}if(workTab==='epic'){const box=root.querySelector('.vw-panel'),it=find(vwSelectedItemId);if(box){const h=box.querySelector('h2');if(h)h.textContent='Evrim';const intro=box.querySelector('.forge-panel-intro');if(intro)intro.textContent='Normal → Epik → Ebedi → İlahi.';if(eligible(it)){box.querySelector('.vw-action')?.remove();const hint=document.createElement('p');hint.className='evo-pick-hint';hint.textContent='Evrim bilgilerini görmek için ekipmana dokun.';box.append(hint)}}}}
  return template.innerHTML;
 };
 // Template serialization drops DOM listeners, so bind evolution controls after render.
 const oldRender=render;
 render=function(){const r=oldRender.apply(this,arguments);document.querySelectorAll('#main .evo-button').forEach(b=>{b.onclick=()=>valorEvolutionAsk(vwSelectedItemId)});document.querySelectorAll('#main .evo-enhance-link').forEach(b=>{b.onclick=()=>{const id=b.dataset.itemId;if(!find(id))return;workTab='enhance';vwSelectedItemId=id;render();vwOpenEnhance(id)}});return r};
 const oldDraw=vwDrawEnhance;
 vwDrawEnhance=function(){const r=oldDraw.apply(this,arguments),it=vwEnhanceItem(),root=document.getElementById('vw-enhance-overlay');if(eligible(it)&&root){decorateQuality(root.querySelector('.vw-enhance-dialog'),it,'h2')}return r};
 /* Evrim tab: tapping an item opens its evolution card in a popup (same frame as Güçlendirme). */
 function closeItem(){document.getElementById('valor-evolution-item')?.remove();if(!document.getElementById('vw-enhance-overlay'))document.body.style.overflow=''}
 window.valorEvolutionCloseItem=closeItem;
 window.valorEvolutionOpenItem=function(id){
  const it=find(id);if(!eligible(it))return;closeItem();vwSelectedItemId=it.id;
  const root=document.createElement('div');root.id='valor-evolution-item';root.className='vw-enhance-overlay evo-item-overlay';
  root.innerHTML='<section class="vw-enhance-dialog evo-item-dialog" role="dialog" aria-modal="true" aria-label="Ekipman Evrimi"><button type="button" class="vw-enhance-close" aria-label="Kapat">×</button><div class="vw-enhance-kicker">✦ ATÖLYE · EVRİM ✦</div><img class="vw-enhance-art" src="'+equipmentIcon(it)+'" alt=""><h2>'+escapeAttr(it.name)+'</h2></section>';
  const dialog=root.firstChild;decorateQuality(dialog,it,'h2');dialog.append(panel(it));
  dialog.querySelector('.vw-enhance-close').onclick=closeItem;
  const link=dialog.querySelector('.evo-enhance-link');if(link)link.onclick=()=>{closeItem();workTab='enhance';vwSelectedItemId=it.id;render();vwOpenEnhance(it.id)};
  root.addEventListener('click',e=>{if(e.target===root)closeItem()});
  document.body.append(root);document.body.style.overflow='hidden';dialog.querySelector('.vw-enhance-close').focus({preventScroll:true});
 };
 const oldChoose=vwChooseItem;
 vwChooseItem=function(id){const it=find(id);if(workTab==='epic'&&eligible(it)){vwSelectedItemId=it.id;render();return valorEvolutionOpenItem(it.id)}return oldChoose.apply(this,arguments)};
 // After an evolution the open card shows the new stage.
 window.addEventListener('valor-equipment-evolved',()=>{if(document.getElementById('valor-evolution-item')&&find(vwSelectedItemId))valorEvolutionOpenItem(vwSelectedItemId)});
 const oldEpic=epic;
 epic=function(id){const it=find(id);if(eligible(it)){if(Number(it.plus)!==21)return toast('Evrim için ekipmanı +21 yapmalısın.');return valorEvolutionAsk(id)}return oldEpic.apply(this,arguments)};
 window.valorEvolutionCancel=function(){pending=null;document.getElementById('valor-evolution-confirm')?.remove()};
 window.valorEvolutionAsk=function(id){
  const it=find(id);if(!eligible(it)||Number(it.plus)!==21||tier(it)>=3)return toast('Bu ekipman şu anda evrimleşemez.');
  if(stoneStock()<stoneCost(it))return toast('Epik Taşı yetersiz. Gereken: '+stoneCost(it)+' · Mevcut: '+stoneStock());
  if(pieceStock()<pieceCost(it))return toast('Evrim Parçası yetersiz. Gereken: '+pieceCost(it)+' · Mevcut: '+pieceStock()+' · Market → Madalyonlar’dan Dukat ile alabilirsin');
  valorEvolutionCancel();pending={owner:state,item:it,id:it.id,tier:tier(it),from:equipmentPower(it),cost:stoneCost(it),pieces:pieceCost(it),enhance:!!document.getElementById('vw-enhance-overlay')};
  const root=document.createElement('div');root.id='valor-evolution-confirm';root.className='evo-overlay';
  root.innerHTML='<section class="evo-dialog" role="dialog" aria-modal="true" aria-labelledby="evo-title"><h2 id="evo-title">Ekipman Evrimi</h2><p>'+escapeAttr(it.name)+'</p><div class="evo-confirm-stages">'+label(it)+'<span>↓</span>'+names[tier(it)+1]+' +0</div><div class="evo-values"><span>Şimdi <strong>'+valorEquipmentStatsText(it)+'</strong></span><span>Evrim Sonrası <strong>'+valorEquipmentStatsText(it,at(it,tier(it)+1,0))+'</strong></span></div>'+costMarkup(it)+'<p>Epik taşları'+(pieceCost(it)?' ve Evrim Parçaları':'')+' harcanır. Takılı mozaik taşları ve efsunlar korunur. Evrim başarı oranı %100.</p><div class="evo-confirm-actions"><button type="button" class="evo-cancel">Vazgeç</button><button type="button" class="evo-confirm">Evrimleştir</button></div></section>';
  root.querySelector('.evo-cancel').onclick=valorEvolutionCancel;root.querySelector('.evo-confirm').onclick=valorEvolutionConfirm;root.addEventListener('click',e=>{if(e.target===root)valorEvolutionCancel()});document.body.append(root);root.querySelector('.evo-confirm').focus();
 };
 window.valorEvolutionConfirm=function(){
  const p=pending;if(!p)return;const it=find(p.id);if(state!==p.owner||it!==p.item||!eligible(it)||Number(it.plus)!==21||tier(it)!==p.tier||equipmentPower(it)!==p.from){valorEvolutionCancel();return toast('Ekipman değişti. Evrimi yeniden aç.');}
  if(stoneCost(it)!==p.cost||stoneStock()<p.cost){valorEvolutionCancel();return toast('Epik Taşı yetersiz. Gereken: '+stoneCost(it)+' · Mevcut: '+stoneStock())}
  if(pieceCost(it)!==p.pieces||pieceStock()<p.pieces){valorEvolutionCancel();return toast('Evrim Parçası yetersiz. Gereken: '+pieceCost(it)+' · Mevcut: '+pieceStock())}
  const before={shards:state.shards,tier:it.evolutionTier,epic:it.epic,plus:it.plus,inventory:state.inventory.map(x=>x.marketItemId===PIECE_ID?{...x}:x)};
  pending=null;document.getElementById('valor-evolution-confirm')?.remove();
  state.shards=stoneStock()-p.cost;if(p.pieces)pieceTake(p.pieces);it.evolutionTier=p.tier+1;it.epic=true;it.plus=0;
  try{save()}catch(error){state.inventory=before.inventory;state.shards=before.shards;if(before.tier===undefined)delete it.evolutionTier;else it.evolutionTier=before.tier;it.epic=before.epic;it.plus=before.plus;return toast('Evrim kaydedilemedi. Taşların ve parçaların harcanmadı.')}
  closeBagPopup();closeProfileDetails();if(p.enhance)vwCloseEnhance();render();
  window.dispatchEvent(new CustomEvent('valor-equipment-evolved',{detail:{name:it.name,tier:it.evolutionTier}}));
  if(p.enhance){vwSelectedItemId=it.id;vwDrawEnhance({success:true,message:names[it.evolutionTier]+' +0 · Evrim başarılı!'})}
  toast(it.name+' → '+names[it.evolutionTier]+' +0');
 };
 const oldGo=go;go=function(){valorEvolutionCancel();closeItem();return oldGo.apply(this,arguments)};
 function dukat(){return Math.max(0,Number(valorCastleData().medallions)||0)}
 if(typeof valorMedallionMarket==='function'){const prevMarket=valorMedallionMarket;valorMedallionMarket=function(){
  const html=prevMarket.apply(this,arguments),bal=dukat(),have=pieceStock();
  const buy=n=>'<button type="button" '+(bal<n*PIECE_PRICE?'disabled':'')+' onclick="valorEvoPieceAsk('+n+')">'+n+' Al · '+money(n*PIECE_PRICE)+'</button>';
  const card='<article class="evo-piece-shop"><div class="evo-piece-icon">'+pieceArt()+'</div><div class="evo-piece-copy"><small>DUKAT İLE · KALICI MALZEME</small><h3>Evrim Parçası</h3><p>Ebedi evrimi <b>5</b>, İlahi evrimi <b>15</b> parça ister. Elinde: <b>'+have+'</b></p><div class="evo-piece-price">'+valorCastleMedalIcon()+'<b>'+PIECE_PRICE+'</b> Dukat / adet</div><div class="evo-piece-buy">'+buy(1)+buy(5)+buy(15)+'</div></div></article>';
  return html.replace('<div class="vmed-grid">',card+'<div class="vmed-grid">');
 }}
 let piecePending=0;
 window.valorEvoPieceAsk=function(n){
  if(![1,5,15].includes(n)||!state.class)return;if(valorCastleSettle())save();const bal=dukat(),price=n*PIECE_PRICE;piecePending=n;
  valorMedallionDialog('<div class="evo-piece-preview">'+pieceArt()+'</div><small class="vmed-kicker">DUKAT MARKETİ</small><h3>'+n+' Evrim Parçası</h3><p>Ebedi evrimi 5, İlahi evrimi 15 parça ister. Parçalar çantanda Malzeme olarak durur, süresi dolmaz.</p><p>Fiyat: <b>'+valorCastleCurrency(price)+' Dukat</b><br>Bakiyen: '+money(bal)+'</p><div class="vmed-dialog-actions"><button type="button" onclick="closeBagPopup()">Vazgeç</button><button type="button" '+(bal<price?'disabled':'')+' onclick="valorEvoPieceBuy()">'+(bal<price?'Dukatın Yetersiz':'Satın Al · '+money(price))+'</button></div>');
 };
 window.valorEvoPieceBuy=function(){
  const n=piecePending;piecePending=0;if(!n||!document.getElementById('valor-bag-popup')||!valorAccountCanPlay())return;
  if(valorCastleSettle())save();const wallet=valorCastleData(),bal=Math.max(0,Number(wallet.medallions)||0),price=n*PIECE_PRICE;if(bal<price){closeBagPopup();return toast('Dukatın yetersiz')}
  const oldInv=state.inventory.map(x=>x.marketItemId===PIECE_ID?{...x}:x);wallet.medallions=bal-price;pieceAdd(n);
  try{if(typeof valorCastleMedalSync==='function')valorCastleMedalSync();save()}catch(error){wallet.medallions=bal;state.inventory=oldInv;throw error}
  closeBagPopup();render();toast(n+' Evrim Parçası çantana eklendi · −'+money(price)+' Dukat');
 };
 document.addEventListener('keydown',e=>{const root=document.getElementById('valor-evolution-confirm');if(!root){if(e.key==='Escape'&&document.getElementById('valor-evolution-item')){e.preventDefault();closeItem()}return}if(e.key==='Escape'){e.preventDefault();valorEvolutionCancel()}if(e.key==='Tab'){const a=[...root.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===a.at(-1)){e.preventDefault();a[0].focus()}}});
 const style=document.createElement('style');style.textContent=`
.evo-quality{display:table;margin:8px auto 12px;padding:5px 14px;border:1px solid var(--evo-color);border-radius:5px;background:#0e0b10cc;color:var(--evo-color);font:700 14px/1.4 Georgia,serif;letter-spacing:.5px;text-align:center}.evo-panel{padding:14px;margin:12px 0;border:1px solid var(--evo-color,#ac9063);border-radius:8px;background:#121016;color:#dcd0bd;text-align:left}.evo-current{display:block;color:var(--evo-color);font:700 19px Georgia}.evo-track{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.evo-track span{padding:4px 7px;color:#8d8580;border:1px solid #ffffff15;border-radius:4px;font:11px system-ui}.evo-track .active{color:var(--evo-color);border-color:var(--evo-color)}.evo-panel p,.evo-panel small{font:12px/1.7 system-ui;color:#c6bca9}.evo-panel small{display:block}.evo-values{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.evo-values span{display:block;font:11px/1.6 system-ui;color:#bfb19b}.evo-values strong{display:block;font:700 20px Georgia;color:#f0d8a1;margin-top:4px}.evo-cost b{color:#efd198}.evo-cost-missing,.evo-cost-missing b{color:#ed9990!important}.evo-enhance-link{display:block;width:100%;min-height:44px;margin-top:8px;border:1px solid #766347;border-radius:5px;background:#1b181c;color:#d7c5a6}.evo-button:disabled{opacity:.45;cursor:not-allowed}.evo-button{width:100%;min-height:44px;margin-top:12px;background:#382b1d;color:#f1d79b;border:1px solid #b59961;border-radius:5px}.evo-badge{position:absolute;bottom:3px;left:3px;padding:2px 4px;background:#0a090ddd;border-radius:3px;font:9px Georgia;pointer-events:none}.bag-slot[data-evolution-tier="2"],.vw-item[data-evolution-tier="2"]{border-color:#bda0ef!important}.bag-slot[data-evolution-tier="3"],.vw-item[data-evolution-tier="3"]{border-color:#f0db9e!important;box-shadow:inset 0 0 8px #e7d4a133}.evo-piece-shop{display:flex;gap:14px;align-items:center;margin:0 0 16px;padding:14px;border:1px solid #b08ae0;border-radius:10px;background:linear-gradient(135deg,#1e1628,#130f18);color:#ecdcf8}.evo-piece-icon{flex:none;width:84px;height:84px}.evo-piece-copy{flex:1;min-width:0}.evo-piece-copy small{font:600 10px system-ui;letter-spacing:1.2px;opacity:.75}.evo-piece-copy h3{margin:2px 0 4px;font:700 19px Georgia,serif;color:#e6cdfd}.evo-piece-copy p{margin:0 0 6px;font:12.5px/1.5 system-ui}.evo-piece-price{display:flex;align-items:center;gap:5px;font:12px system-ui;margin-bottom:8px}.evo-piece-price img,.evo-piece-price svg{width:18px;height:18px}.evo-piece-buy{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.evo-piece-buy button{min-height:36px;padding:0 4px;font:600 12px system-ui;white-space:nowrap}.evo-piece-preview{width:110px;height:110px;margin:0 auto 6px}.evo-piece-hint{font-weight:400;opacity:.85}html[data-valor-theme=light] .evo-piece-shop{background:linear-gradient(135deg,#f4ecfb,#ece1d0);border-color:#b79ad8;color:#2e2340}html[data-valor-theme=light] .evo-piece-copy h3{color:#5b3a8c}.evo-pick-hint{margin:14px 0 4px;font:13px/1.6 system-ui;opacity:.75;text-align:center}.evo-item-dialog .evo-panel{margin:14px 0 0}.evo-item-dialog .evo-quality{margin:4px auto 0}.evo-overlay{position:fixed;inset:0;z-index:1000001;display:grid;place-items:center;padding:16px;background:#08070be8}.evo-dialog{width:min(100%,420px);max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;padding:22px;border:1px solid #b59961;border-radius:10px;background:#1d171b;color:#ead8b6}.evo-dialog h2{font:700 25px Georgia;color:#efd198}.evo-dialog p{font:13px/1.7 system-ui}.evo-confirm-stages{font:700 22px Georgia;text-align:center;color:#efd198;margin:20px 0}.evo-confirm-stages span{display:block;padding:9px;color:#9c8660}.evo-confirm-actions{display:flex;gap:10px}.evo-confirm-actions button{flex:1;min-height:44px;border:1px solid #9c8458;border-radius:5px;background:#34271d;color:#f1d79b}
`;document.head.append(style);
 if(state.class&&typeof valorAccountCanPlay==='function'&&valorAccountCanPlay())render();
})();
