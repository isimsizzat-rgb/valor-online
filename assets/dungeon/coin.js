/* The bag stack mirrors the dungeon wallet; it is never a second balance. */
function valorDungeonCoinSync(){
 if(!state.class||!Array.isArray(state.inventory))return false;
 const amount=Math.max(0,Math.floor(Number(state.valorSystems?.dungeon?.coins)||0));
 const entries=state.inventory.filter(it=>it.marketItemId==='dungeonCoin');
 if(!amount){if(!entries.length)return false;state.inventory=state.inventory.filter(it=>it.marketItemId!=='dungeonCoin');return true}
 if(entries.length===1&&entries[0].count===amount&&entries[0].name==='Zindan Parası'&&entries[0].dungeonCoinMirror===true)return false;
 const entry={...(entries[0]||{id:valorUniqueItemId()}),slot:'Eşya',marketItemId:'dungeonCoin',name:'Zindan Parası',count:amount,dungeonCoinMirror:true};
 let inserted=false;state.inventory=state.inventory.flatMap(it=>{if(it.marketItemId!=='dungeonCoin')return [it];if(inserted)return [];inserted=true;return [entry]});
 if(!inserted)state.inventory.push(entry);return true;
}
function valorDungeonCoinGraphic(){return '<img class="valor-dungeon-coin-art" src="'+VALOR_DUNGEON_COIN_ART+'" alt="Zindan Parası" style="width:100%;height:100%;object-fit:contain;display:block">'}
const valorDungeonCoinPreviousSave=save;
save=function(){valorDungeonCoinSync();return valorDungeonCoinPreviousSave.apply(this,arguments)};
const valorDungeonCoinPreviousBag=bag;
bag=function(){if(valorDungeonCoinSync())save();return valorDungeonCoinPreviousBag()};
const valorDungeonCoinPreviousEmoji=marketItemEmoji;
marketItemEmoji=function(id,it){return id==='dungeonCoin'?valorDungeonCoinGraphic():valorDungeonCoinPreviousEmoji(id,it)};
const valorDungeonCoinPreviousDescription=marketItemDescription;
marketItemDescription=function(id){return id==='dungeonCoin'?'Zindan katlarından kazanılır ve Zindan Marketinde harcanır. Çantadaki miktar mevcut bakiyendir.':valorDungeonCoinPreviousDescription(id)};
const valorDungeonCoinPreviousMaterial=isDirectStoneMaterial;
isDirectStoneMaterial=function(id){return id==='dungeonCoin'||valorDungeonCoinPreviousMaterial(id)};
const valorDungeonCoinPreviousDelete=deleteInventoryItem;
deleteInventoryItem=function(n){if(state.inventory[n]?.marketItemId==='dungeonCoin')return toast('Zindan Parası yalnızca Zindan Marketinde harcanır');return valorDungeonCoinPreviousDelete(n)};
const valorDungeonCoinPreviousConsume=consumeMarketStack;
consumeMarketStack=function(n){if(state.inventory[n]?.marketItemId==='dungeonCoin')return null;return valorDungeonCoinPreviousConsume(n)};
const valorDungeonCoinPreviousPopup=showBagItemPopup;
showBagItemPopup=function(n){
 const it=state.inventory[n];if(it?.marketItemId!=='dungeonCoin')return valorDungeonCoinPreviousPopup(n);
 closeBagPopup();const amount=Math.max(0,Math.floor(Number(state.valorSystems?.dungeon?.coins)||0)),overlay=document.createElement('div');
 overlay.id='valor-bag-popup';overlay.className='valor-item-overlay';
 overlay.innerHTML='<section class="valor-item-dialog bag-popup-dialog" role="dialog" aria-modal="true" aria-labelledby="valor-dungeon-coin-title"><button class="valor-item-close" onclick="closeBagPopup()" aria-label="Kapat">×</button><div class="valor-item-art market-item-detail"><span>'+valorDungeonCoinGraphic()+'</span></div><div class="detail-rarity">PARA BİRİMİ</div><h3 id="valor-dungeon-coin-title">Zindan Parası</h3><p>'+marketItemDescription('dungeonCoin')+'</p><div class="detail-stats"><div><span>Mevcut bakiye</span><strong>'+money(amount)+'</strong></div><div><span>Kullanım</span><strong>Zindan Marketi</strong></div></div><div class="detail-buttons popup-actions"><button type="button" onclick="closeBagPopup();go(\'Zindan\');valorDungeonOpenShop()">Zindan Marketine Git</button></div></section>';
 overlay.addEventListener('click',e=>{if(e.target===overlay)closeBagPopup()});document.body.appendChild(overlay);
};
if(state.class&&valorDungeonCoinSync())save();
if(state.class&&page==='Çanta')render();
