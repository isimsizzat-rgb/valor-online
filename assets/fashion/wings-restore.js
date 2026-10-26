/* Return to classic wings without losing purchased wings or the cancelled set records. */
function valorRestoreClassicWings(){
 if(!state.class||state.classicWingsRestoredV1)return;
 const isAurora=it=>!!it&&String(it.fashionSetId||'').startsWith('aurora-');
 const inventory=(state.inventory||[]),fashion=state.fashionEquipped||{},wing=state.equipped?.Kanat;
 const archived=inventory.filter(isAurora),equipped=Object.fromEntries(Object.entries(fashion).filter(([,it])=>isAurora(it)));
 if(archived.length||Object.keys(equipped).length||isAurora(wing))state.cancelledAuroraFashionV1={inventory:JSON.parse(JSON.stringify(archived)),equipped:JSON.parse(JSON.stringify(equipped)),wing:isAurora(wing)?JSON.parse(JSON.stringify(wing)):null};
 function classic(it){const w=valorWings.find(w=>w.id===it.wingId)||valorWings.find(w=>w.id==='ayaz');const result={...it,slot:'Kanat',wingId:w.id,name:w.name,cls:'Tüm Sınıflar',level:valorWingLevel(it),wingLevel:valorWingLevel(it)};delete result.fashionSetId;delete result.fashionSlot;delete result.fashionArt;return result}
 state.inventory=inventory.filter(it=>!isAurora(it)||!!it.wingId).map(it=>isAurora(it)?classic(it):it);
 if(isAurora(wing)){const restored=state.inventory.find(it=>String(it.id)===String(wing.id))||classic(wing);if(!state.inventory.some(it=>String(it.id)===String(restored.id)))state.inventory.push(restored);state.equipped.Kanat=restored}
 for(const [slot,it] of Object.entries(fashion))if(isAurora(it))delete fashion[slot];
 state.classicWingsRestoredV1=true;save();
}
const valorClassicWingsPreviousRender=render;
render=function(){valorRestoreClassicWings();return valorClassicWingsPreviousRender.apply(this,arguments)};
render();
