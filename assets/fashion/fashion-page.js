/* Fashion is the second page of the profile: same header, scene, slot boxes and layout as the
   equipment page (top bar hidden). Left: Silah, Kıyafet, Kask + EKİPMAN (back); right: Ayakkabı, Kanat.
   The page is drawn through the profile pipeline so the profile layout code styles it identically. */
const VALOR_FASHION_CAPTIONS={Silah:'SİLAH',Kıyafet:'KIYAFET',Kask:'KASK',Ayakkabı:'AYAKKABI',Kanat:'KANAT'};
function valorFashionTile(slot){
 const it=valorFashionEquipped(slot),selected=valorFashionSelectedSlot===slot,empty={Silah:icons.Silah,Kıyafet:icons.Zırh,Kask:icons.Kask,Ayakkabı:icons.Ayakkabı,Kanat:'✧'};
 const badge=it?(slot==='Kanat'?'Sv. '+valorWingLevel(it):'✓'):'';
 return '<button type="button" class="vp-slot vfp-slot'+(selected?' vfp-selected':'')+'" aria-pressed="'+selected+'" title="'+slot+(it?' — '+escapeAttr(it.name):'')+'" onclick="valorFashionSelectSlot(\''+slot+'\')">'+(it?'<img src="'+valorFashionItemArt(it)+'" alt="'+escapeAttr(it.name)+'"><span class="vp-plus-badge">'+badge+'</span>':'<span class="vp-empty">'+empty[slot]+'</span><small class="vf-slot-caption">'+VALOR_FASHION_CAPTIONS[slot]+'</small>')+'</button>';
}
function valorFashionProfilePage(){
 const slot=valorFashionSlots.includes(valorFashionSelectedSlot)?valorFashionSelectedSlot:'Kanat',equipped=valorFashionEquipped(slot),items=valorFashionItems(slot);
 const collection=slot==='Kanat'?(items.length?valorWingCards(true):'<p class="vfw-empty-note">Henüz bir kanadın yok.</p>'):(items.length?'<div class="vf-grid">'+items.map(it=>{const worn=String(equipped?.id)===String(it.id);return '<article class="vf-card"><div class="vf-art"><img src="'+valorFashionItemArt(it)+'" alt="'+escapeAttr(it.name)+'"></div><h3>'+escapeAttr(it.name)+'</h3><button type="button" onclick="'+(worn?"valorFashionRemovePiece('"+slot+"')":"valorFashionEquipPiece('"+slot+"','"+escapeAttr(String(it.id))+"')")+'">'+(worn?'Çıkar':'Kuşan')+'</button></article>'}).join('')+'</div>':'<p class="vfw-empty-note">Henüz bir '+slot.toLocaleLowerCase('tr-TR')+' fashionın yok.</p>');
 const back='<button type="button" class="vp-slot vf-wing-equipment" title="Ekipman" aria-label="Ekipman sayfasına dön" onclick="go(\'Profil\')"><span class="vp-empty">⚔</span><small class="vf-slot-caption">EKİPMAN</small></button>';
 const spacer='<div class="vfp-spacer" aria-hidden="true"></div>';
 return '<div class="vp-wrap vfp-wrap"><div class="vp-header"><strong>'+escapeAttr(state.name)+'</strong><span>Fashion · '+escapeAttr(state.class)+'</span></div>'
  +'<div class="vp-scene vf-eight-slots"><div class="vp-hero valor-selected-profile-hero"><img src="'+valorCreationPortrait(state.class,state.gender)+'" alt="'+escapeAttr(state.class)+' karakteri"></div>'
  +'<div class="vp-gear vp-left">'+['Silah','Kıyafet','Kask'].map(valorFashionTile).join('')+back+'</div>'
  +'<div class="vp-gear vp-right">'+['Ayakkabı','Kanat'].map(valorFashionTile).join('')+spacer+spacer+'</div></div>'
  +'<section class="vfw-collection" aria-label="'+slot+' koleksiyonu"><div class="vfw-collection-heading"><h2>'+slot+'</h2><span>'+(equipped?'Takılı: '+escapeAttr(equipped.name):'Kuşanılmadı')+'</span></div>'+collection+'</section>'
  +'<div class="vfw-actions"><button type="button" onclick="valorOpenWingMarket()">Fashion Marketi</button>'+(slot==='Kanat'?'<button type="button" onclick="valorOpenWingWorkshop()">Kanat Birleştirme</button>':'')+'</div></div>';
}
(function(){
 const previousRender=render;
 render=function(){
  if(page!=='Fashion'||!state.class){document.body.classList.remove('valor-fashion-page');return previousRender.apply(this,arguments)}
  // Draw through the profile pipeline so the same layout code and styles apply.
  const realProfile=profile;profile=valorFashionProfilePage;page='Profil';
  try{return previousRender.apply(this,arguments)}finally{page='Fashion';profile=realProfile;document.body.classList.add('valor-fashion-page')}
 };
 if(state.class&&page==='Fashion')render();
})();
