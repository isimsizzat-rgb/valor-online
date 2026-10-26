/* Aurora cosmetic sets. Five fashion slots remain separate from normal gear.
   Only the established wing contributes combat bonuses; the five-piece reward is visual. */
const valorAuroraSets=[
 {id:'aurora-warrior',cls:'Savaşçı',art:'warrior',weapon:'Kılıç'},
 {id:'aurora-mage',cls:'Büyücü',art:'mage',weapon:'Asa'},
 {id:'aurora-archer',cls:'Okçu',art:'archer',weapon:'Yay'}
].map(s=>({...s,name:'Aurora Seti',price:999}));
const valorAuroraPartFiles={Silah:'weapon',Kıyafet:'outfit',Kask:'crown',Ayakkabı:'boots',Kanat:'wings'};
const valorAuroraPartLabels={Kıyafet:'Kıyafeti',Kask:'Tacı',Ayakkabı:'Çizmeleri',Kanat:'Kanatları'};
function valorAuroraSet(id){return valorAuroraSets.find(s=>s.id===id)}
function valorAuroraPartArt(set,slot){return 'assets/fashion/aurora/'+set.art+'-'+valorAuroraPartFiles[slot]+'.webp'}
function valorAuroraPortrait(set,gender=state.gender){return 'assets/fashion/aurora/'+set.art+'-'+(gender==='female'?'female':'male')+'.webp'}
function valorAuroraValidPart(it,set,slot){return !!it&&it.fashionSetId===set.id&&it.fashionSlot===slot&&it.cls===set.cls}
function valorAuroraOwnedParts(set){return valorFashionSlots.map(slot=>(state.inventory||[]).find(it=>valorAuroraValidPart(it,set,slot))||Object.values(state.fashionEquipped||{}).find(it=>valorAuroraValidPart(it,set,slot))||(valorAuroraValidPart(state.equipped?.Kanat,set,slot)?state.equipped.Kanat:null))}
function valorAuroraEquippedCount(set){return valorFashionSlots.filter(slot=>valorAuroraValidPart(valorFashionEquipped(slot),set,slot)).length}
function valorAuroraFullSet(){return valorAuroraSets.find(s=>s.cls===state.class&&valorAuroraEquippedCount(s)===5)||null}
function valorFashionPortrait(){const set=valorAuroraFullSet();return set?valorAuroraPortrait(set):valorCreationPortrait(state.class,state.gender)}
function valorAuroraCurrentSet(){return valorAuroraSets.find(s=>s.cls===state.class)}
function valorAuroraEquipSet(id){
 const set=valorAuroraSet(id);if(!set||set.cls!==state.class)return toast('Bu set sınıfına uygun değil');
 const parts=valorAuroraOwnedParts(set);if(parts.some(it=>!it))return toast('Kuşanmak için setin beş parçası da gerekli');
 state.fashionEquipped=state.fashionEquipped||{};state.equipped=state.equipped||{};
 valorFashionSlots.forEach((slot,i)=>{if(slot==='Kanat')state.equipped.Kanat=parts[i];else state.fashionEquipped[slot]=parts[i]});
 save();closeBagPopup();render();toast('Aurora Seti 5/5 kuşanıldı');
}
function valorAuroraDialog(html){
 closeBagPopup();const overlay=document.createElement('div');overlay.id='valor-bag-popup';overlay.className='valor-item-overlay';
 overlay.innerHTML='<section class="valor-item-dialog vf-dialog vaf-dialog" role="dialog" aria-modal="true" aria-labelledby="vaf-dialog-title"><button type="button" class="valor-item-close" onclick="valorAuroraCloseDialog()" aria-label="Kapat">×</button>'+html+'</section>';
 overlay.addEventListener('click',e=>{if(e.target===overlay)valorAuroraCloseDialog()});document.body.appendChild(overlay);
}
let valorAuroraPendingPurchase=null;
function valorAuroraCloseDialog(){valorAuroraPendingPurchase=null;closeBagPopup()}
function valorAuroraMiniParts(set){return '<div class="vaf-mini-parts">'+valorFashionSlots.map(slot=>'<span title="'+(slot==='Silah'?set.weapon:slot)+'"><img src="'+valorAuroraPartArt(set,slot)+'" alt="'+(slot==='Silah'?set.weapon:slot)+'"></span>').join('')+'</div>'}
function valorAuroraAskBuy(id){
 const set=valorAuroraSet(id);if(!set||set.cls!==state.class)return toast('Bu set sınıfına uygun değil');
 if(valorAuroraOwnedParts(set).every(Boolean))return toast('Bu set zaten sende');
 valorAuroraPendingPurchase=null;
 valorAuroraDialog('<h3 id="vaf-dialog-title">Aurora Seti · '+set.cls+'</h3><img class="vaf-dialog-portrait" src="'+valorAuroraPortrait(set)+'" alt="Aurora '+set.cls+' seti">'+valorAuroraMiniParts(set)+'<p>'+set.weapon+', kıyafet, taç, çizme ve kanat.<br><b>'+money(set.price)+' elmas</b> karşılığında seti satın al?</p><div class="vf-purchase-actions"><button type="button" onclick="valorAuroraCloseDialog()">Vazgeç</button><button type="button" onclick="valorAuroraConfirmBuy()">Satın Al</button></div>');
 valorAuroraPendingPurchase=id;
}
function valorAuroraConfirmBuy(){const id=valorAuroraPendingPurchase;if(!id||!document.getElementById('valor-bag-popup'))return;valorAuroraPendingPurchase=null;valorAuroraBuy(id)}
function valorAuroraBuy(id){
 const set=valorAuroraSet(id);if(!set||set.cls!==state.class)return toast('Bu set sınıfına uygun değil');
 if(valorAuroraOwnedParts(set).every(Boolean))return toast('Bu set zaten sende');
 if(!Number.isFinite(Number(state.diamonds))||Number(state.diamonds)<set.price)return toast('Elmasın yetersiz');
 const items=valorFashionSlots.map(slot=>({id:valorUniqueItemId(),slot:slot==='Kanat'?'Kanat':'Fashion',fashionSlot:slot,fashionSetId:set.id,fashionArt:valorAuroraPartArt(set,slot),name:'Aurora '+(slot==='Silah'?({Kılıç:'Kılıcı',Asa:'Asası',Yay:'Yayı'}[set.weapon]):valorAuroraPartLabels[slot]),cls:set.cls,level:1,plus:0,epic:false,...(slot==='Kanat'?{wingId:'ayaz',wingLevel:1}:{})}));
 state.inventory=state.inventory||[];state.diamonds=Number(state.diamonds)-set.price;state.inventory.push(...items);save();closeBagPopup();render();toast('Aurora Seti: 5 parça Fashion koleksiyonuna eklendi');
}
function valorAuroraWardrobeSummary(){
 const set=valorAuroraCurrentSet();if(!set)return '';
 const owned=valorAuroraOwnedParts(set).filter(Boolean).length,count=valorAuroraEquippedCount(set);
 return '<section class="vaf-set-status '+(count===5?'is-complete':'')+'"><div><strong>Aurora Seti <span>'+count+'/5</span></strong><small>'+(count===5?'Aurora görünümü aktif':'5 parça kuşanıldığında Aurora görünümü açılır')+'</small></div>'+(owned===5&&count<5?'<button type="button" onclick="valorAuroraEquipSet(\''+set.id+'\')">Seti Kuşan</button>':'')+'</section>';
}
function valorFashionCollection(slot){
 const items=valorFashionItems(slot),equipped=valorFashionEquipped(slot);if(!items.length)return '<p class="vfw-empty-note">Henüz bu yuvaya uygun bir fashionın yok.</p>';
 return '<div class="vf-grid">'+items.map(it=>{const worn=String(equipped?.id)===String(it.id),aurora=valorAuroraSet(it.fashionSetId);
 if(!aurora){const w=valorWings.find(w=>w.id===it.wingId);if(!w)return '';return '<article class="vf-card"><button type="button" class="vf-art" onclick="'+valorWingClick(w.id,it)+'"><img src="'+valorWingArt(w)+'" alt="'+escapeAttr(it.name)+'"></button><h3>'+escapeAttr(it.name)+'</h3><span class="vf-level">Sv. '+valorWingLevel(it)+'</span><button type="button" onclick="'+valorWingClick(w.id,it)+'">'+(worn?'Takılı · İncele':'Kuşan')+'</button></article>'}
 return '<article class="vf-card vaf-piece"><button type="button" class="vf-art" onclick="valorAuroraPiecePreview(\''+escapeAttr(String(it.id))+'\')"><img src="'+valorFashionItemArt(it)+'" alt="'+escapeAttr(it.name)+'"></button><h3>'+escapeAttr(it.name)+'</h3><span class="vf-type">'+aurora.cls+(worn?' · TAKILI':'')+'</span><button type="button" onclick="'+(worn?"valorFashionRemovePiece('"+slot+"')":"valorFashionEquipPiece('"+slot+"','"+escapeAttr(String(it.id))+"')")+'">'+(worn?'Çıkar':'Kuşan')+'</button></article>';
 }).join('')+'</div>';
}
function valorAuroraPiecePreview(id){
 const it=(state.inventory||[]).find(it=>String(it.id)===String(id));const set=valorAuroraSet(it?.fashionSetId);if(!set)return;
 const worn=isEquipped(it),slot=it.fashionSlot;
 valorAuroraDialog('<h3 id="vaf-dialog-title">'+escapeAttr(it.name)+'</h3><img class="vaf-piece-preview" src="'+valorFashionItemArt(it)+'" alt="'+escapeAttr(it.name)+'"><p>Aurora · '+set.cls+' · '+(slot==='Silah'?set.weapon:slot)+'</p>'+(slot==='Kanat'?valorWingStatsHtml(valorWingLevel(it)):'')+'<p>Beş parça birlikte kuşanıldığında profil görünümün Aurora’ya dönüşür.</p><div class="vf-purchase-actions"><button type="button" onclick="'+(worn?"closeBagPopup();valorFashionRemovePiece('"+slot+"')":"closeBagPopup();valorFashionEquipPiece('"+slot+"','"+escapeAttr(String(it.id))+"')")+'">'+(worn?'Çıkar':'Kuşan')+'</button><button type="button" onclick="valorAuroraEquipSet(\''+set.id+'\')">Seti Kuşan</button></div>');
}
valorWingMarket=function(){
 return '<section class="vf-page vaf-market"><div class="vf-heading"><span>FASHION SETLERİ</span><h2>Aurora</h2><p>5 parça · Buz ve kuzey ışıkları</p></div><div class="vaf-set-market-grid">'+valorAuroraSets.map(set=>{const own=valorAuroraOwnedParts(set).every(Boolean),allowed=set.cls===state.class;return '<article class="vaf-set-card"><img class="vaf-set-portrait" src="'+valorAuroraPortrait(set)+'" alt="'+set.cls+' Aurora Seti" loading="lazy"><div class="vaf-set-card-info"><h3>Aurora · '+set.cls+'</h3>'+valorAuroraMiniParts(set)+'<p>'+set.weapon+' · Kıyafet · Taç · Çizme · Kanat</p><b class="vf-price">'+money(set.price)+' 💎</b><button type="button" '+(!allowed?'disabled':'')+' onclick="'+(own?"valorAuroraEquipSet('"+set.id+"')":"valorAuroraAskBuy('"+set.id+"')")+'">'+(!allowed?set.cls+' Sınıfı':own?'Seti Kuşan':'Seti Satın Al')+'</button></div></article>'}).join('')+'</div></section>';
};
const vafOldEquipPiece=valorFashionEquipPiece;
valorFashionEquipPiece=function(slot,id){
 const it=valorFashionItems(slot).find(it=>String(it.id)===String(id));if(!it)return;
 const set=valorAuroraSet(it.fashionSetId);if(!set){if(slot==='Kanat')return valorWingEquip(it.wingId,it.id);return vafOldEquipPiece(slot,id)}
 if(set.cls!==state.class||!valorAuroraValidPart(it,set,slot))return toast('Bu parça sınıfına uygun değil');
 if(slot==='Kanat'){state.equipped=state.equipped||{};state.equipped.Kanat=it}else{state.fashionEquipped=state.fashionEquipped||{};state.fashionEquipped[slot]=it}
 save();closeBagPopup();render();toast(it.name+' kuşanıldı');
};
const vafOldIcon=equipmentIcon;equipmentIcon=function(it){return it?.fashionSetId&&it.fashionArt?it.fashionArt:vafOldIcon(it)};
const vafOldPower=equipmentPower;equipmentPower=function(it){return it?.fashionSetId?0:vafOldPower(it)};
const vafOldIsEquipped=isEquipped;isEquipped=function(it){return vafOldIsEquipped(it)||!!it&&Object.values(state.fashionEquipped||{}).some(eq=>eq&&String(eq.id)===String(it.id))};
const vafOldBagSelect=bagCanSelect;bagCanSelect=function(it){return !it?.fashionSetId&&vafOldBagSelect(it)};
const vafOldPopup=showBagItemPopup;showBagItemPopup=function(n){const it=state.inventory[n];return it?.fashionSetId?valorAuroraPiecePreview(it.id):vafOldPopup(n)};
const vafOldEquip=equip;equip=function(n){const it=state.inventory[n];return it?.fashionSetId?valorFashionEquipPiece(it.fashionSlot,it.id):vafOldEquip(n)};
const vafOldUnequipById=unequipById;unequipById=function(id){const slot=Object.keys(state.fashionEquipped||{}).find(slot=>String(state.fashionEquipped[slot]?.id)===String(id));return slot?valorFashionRemovePiece(slot):vafOldUnequipById(id)};
const vafOldDelete=deleteInventoryItem;deleteInventoryItem=function(n){if(state.inventory[n]?.fashionSetId)return toast('Fashion parçalarını Fashion ekranından kuşanıp çıkarabilirsin');return vafOldDelete(n)};
/* Preserve old wing fusion while preventing costume pieces from being consumed as generic wings. */
const vafOldWingMerge=valorWingMerge;valorWingMerge=function(a,b){const ids=[a??valorWingMergeSelection[0],b??valorWingMergeSelection[1]];if(valorWingItems().some(it=>it.fashionSetId&&ids.some(id=>String(it.id)===String(id))))return toast('Set kanatları normal kanatlarla birleştirilmez');return vafOldWingMerge(a,b)};
const vafOldWingPreview=valorWingPreview;valorWingPreview=function(id,itemId){const it=itemId!=null?valorWingItem(id,itemId):null;return it?.fashionSetId?valorAuroraPiecePreview(it.id):vafOldWingPreview(id,itemId)};
const vafOldWingEquip=valorWingEquip;valorWingEquip=function(id,itemId){const it=valorWingItem(id,itemId);return it?.fashionSetId?valorFashionEquipPiece('Kanat',it.id):vafOldWingEquip(id,itemId)};
const vafOldRender=render;render=function(){document.body.classList.toggle('valor-aurora-equipped',!!valorAuroraFullSet());return vafOldRender.apply(this,arguments)};
render();
const vafOldBag=bag;bag=function(){return vafOldBag().replace(/<button class="bag-slot [\s\S]*?<\/button>/g,button=>{const match=button.match(/onclick="selectItem\((\d+)\)"/),it=match&&state.inventory[Number(match[1])];if(!it?.fashionSetId)return button;return button.replace(/<span class="slot-plus">[\s\S]*?<\/span>/g,'').replace('</button>','<span class="vaf-bag-label">FASHION</span></button>')})};
