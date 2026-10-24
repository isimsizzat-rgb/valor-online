/* Four cumulative companions; each has 5 rarities × 5 stars. */
const VALOR_PETS=[
 {id:'kozpence',name:'Közpençe',kind:'Kor Yavrusu',movement:'Dört ayaklı',description:'Közlerin içinden gelen sadık muhafız.'},
 {id:'ayazdis',name:'Ayazdiş',kind:'Buz Yavrusu',movement:'Dört ayaklı',description:'Sessiz adımlarında kadim kışın gücü var.'},
 {id:'safakkanat',name:'Şafakkanat',kind:'Şafak Ruhu',movement:'Uçan',description:'Şafağın altın ışığını kanatlarında taşır.'},
 {id:'gecegaga',name:'Gecegaga',kind:'Gece Ruhu',movement:'Uçan',description:'Geceyi yaran kanatlar, sarsılmaz bir bağ.'}
];
const VALOR_PET_RARITIES=[{name:'Beyaz',color:'#ece7dc'},{name:'Yeşil',color:'#7ac98e'},{name:'Mavi',color:'#6ab5ef'},{name:'Mor',color:'#bf87e8'},{name:'Altın',color:'#efb94f'}];
const VALOR_PET_ATTRIBUTES=['Güç','Zeka','Zırh','Beden'];
const VALOR_PET_MAX_STAGE=24;
function valorPetStage(value){return Number.isFinite(Number(value))?Math.max(0,Math.min(24,Math.floor(Number(value)))):0}
function valorPetCost(stage){return stage>=VALOR_PET_MAX_STAGE?0:15*(valorPetStage(stage)+1)}
function valorPetInfo(stage){stage=valorPetStage(stage);return {stage,rarity:VALOR_PET_RARITIES[Math.floor(stage/5)],stars:stage%5+1,value:(stage+1)*10,cost:valorPetCost(stage)}}
function valorPetData(){
 let d=state.petsV1;
 if(!d||typeof d!=='object'||Array.isArray(d))d=state.petsV1={};
 for(const pet of VALOR_PETS){
  let p=d[pet.id];if(!p||typeof p!=='object'||Array.isArray(p))p=d[pet.id]={stage:0,progress:0,owned:true};
  p.stage=valorPetStage(p.stage);p.owned=p.owned!==false;
  p.progress=p.stage===24?0:Math.max(0,Math.min(valorPetCost(p.stage)-1,Math.floor(Number(p.progress)||0)));
 }
 return d;
}
function valorPetAttributeTotals(){const d=valorPetData();const value=VALOR_PETS.reduce((sum,pet)=>sum+(d[pet.id].owned?valorPetInfo(d[pet.id].stage).value:0),0);return {Güç:value,Zeka:value,Zırh:value,Beden:value}}
function valorPetCharacterAttributes(){const totals=valorPetAttributeTotals();return Object.fromEntries(VALOR_PET_ATTRIBUTES.map(key=>[key,totals[key]*.5]))}
function valorPetDerived(){
 const a=valorPetCharacterAttributes();
 // Same attribute conversion used by mount training; add before wing/astrology multipliers.
 return {Saldırı:a.Güç*4,Sihir:a.Zeka*4,Savunma:a.Zırh*4,'Sihir Savunma':a.Zırh*4,Can:a.Güç+a.Zeka+a.Beden*40};
}
function valorPetFoodCount(){return (state.inventory||[]).filter(it=>it.marketItemId==='petFood').reduce((sum,it)=>sum+Math.max(0,Math.floor(Number(it.count)||0)),0)}
function valorPetSpendFood(amount){
 if(!Number.isSafeInteger(amount)||amount<1||valorPetFoodCount()<amount)return false;
 for(let i=state.inventory.length-1;i>=0&&amount;i--){const it=state.inventory[i];if(it.marketItemId!=='petFood')continue;const count=Math.max(0,Math.floor(Number(it.count)||0)),take=Math.min(count,amount);amount-=take;if(count===take)state.inventory.splice(i,1);else it.count=count-take}
 return true;
}
/* Shared reward entry points for Pet Battle and event boxes; neither grants rewards by itself. */
function valorPetGrantFood(count){if(!state.class||!Number.isSafeInteger(count)||count<1||count>1000000000)return false;addMarketStack('petFood',count);save();return true}
function valorPetGrant(id){if(!state.class||!VALOR_PETS.some(p=>p.id===id))return false;const p=valorPetData()[id];if(p.owned)return false;p.owned=true;save();return true}
function valorPetFeed(id,single=false){
 if(page!=='Pet'||!state.class||!VALOR_PETS.some(p=>p.id===id))return;
 const p=valorPetData()[id],info=valorPetInfo(p.stage);if(!p.owned||!info.cost)return;
 const amount=Math.min(single?1:info.cost-p.progress,valorPetFoodCount());
 if(!amount)return toast('Pet yemin yok. Sınırlı Mağaza’dan alabilirsin.');
 if(!valorPetSpendFood(amount))return;
 p.progress+=amount;let advanced=false;
 if(p.progress>=info.cost){p.stage++;p.progress=0;advanced=true}
 save();render();
 const next=valorPetInfo(p.stage),name=VALOR_PETS.find(p=>p.id===id).name;
 toast(advanced?name+' · '+next.rarity.name+' '+next.stars+' yıldız! Dört özellik +10.':name+' · '+amount+' yem verildi.');
}
function valorPetOpenMarket(){closeBagPopup();go('Market');selectMarketCategory('limited');openMarketPurchase('petFood')}
function valorPetStars(count){return '<span class="vpet-stars" aria-label="'+count+' yıldız">'+Array.from({length:5},(_,i)=>'<span'+(i<count?' class="filled"':'')+' aria-hidden="true">★</span>').join('')+'</span>'}
function valorPetPage(){
 const d=valorPetData(),food=valorPetFoodCount(),totals=valorPetAttributeTotals(),bonus=valorPetCharacterAttributes();
 return '<section class="vpet-page"><header class="vpet-heading"><div><small>YOL ARKADAŞLARIN</small><h1>Pet Koleksiyonu</h1><p>Dört dost. Ortak güç. Kalıcı bağ.</p></div><button type="button" onclick="go(\'Anasayfa\')">‹ Anasayfa</button></header><div class="vpet-summary"><div><span>Pet Yemi</span><strong>'+money(food)+'</strong><small>Günlük market: 25 elmas · 15 adet</small></div><button type="button" onclick="valorPetOpenMarket()">Yem Satın Al</button></div><div class="vpet-bonus"><div><small>KARAKTERİNE AKTARILAN · %50</small><p>Dört petin özellikleri birlikte birikir.</p></div><div class="vpet-bonus-grid">'+VALOR_PET_ATTRIBUTES.map(key=>'<div><span>'+key+'</span><strong>+'+money(bonus[key])+'</strong><small>Pet toplamı '+money(totals[key])+'</small></div>').join('')+'</div></div><div class="vpet-grid">'+VALOR_PETS.map(pet=>{
  const p=d[pet.id],info=valorPetInfo(p.stage),next=valorPetInfo(p.stage+1),maxed=!info.cost,remaining=info.cost-p.progress;
  return '<article class="vpet-card '+(pet.movement==='Uçan'?'vpet-flying':'')+'" style="--pet-color:'+info.rarity.color+'"><div class="vpet-art"><img src="assets/pets/'+pet.id+'.webp" alt="'+pet.name+' · '+pet.kind+'" width="512" height="512" decoding="async"><span class="vpet-kind">'+pet.movement+'</span><span class="vpet-rarity">'+info.rarity.name+'</span></div><div class="vpet-copy"><div class="vpet-title"><h2>'+pet.name+'</h2><span>'+pet.kind+'</span></div>'+valorPetStars(info.stars)+'<p class="vpet-description">'+pet.description+'</p><div class="vpet-stats">'+VALOR_PET_ATTRIBUTES.map(key=>'<div><span>'+key+'</span><b>'+info.value+'</b><small>Karaktere +'+info.value*.5+'</small></div>').join('')+'</div><div class="vpet-growth"><div><strong>'+(maxed?'En yüksek aşama':next.rarity.name+' '+next.stars+' yıldıza')+'</strong><span>'+(maxed?'25 / 25':money(p.progress)+' / '+money(info.cost)+' yem')+'</span></div><div class="vpet-track" role="progressbar" aria-label="'+pet.name+' gelişimi" aria-valuemin="0" aria-valuemax="'+(info.cost||1)+'" aria-valuenow="'+(maxed?1:p.progress)+'"><i style="width:'+(maxed?100:p.progress/info.cost*100)+'%"></i></div><small>'+(maxed?'Dört özellik de 250 · karakterine +125.':'Sonraki aşamada dört özellik +10 · karakterine +5.')+'</small></div><div class="vpet-actions"><button type="button" '+(maxed||!food||!p.owned?'disabled':'')+' onclick="valorPetFeed(\''+pet.id+'\',true)">1 Yem Ver</button><button type="button" '+(maxed||!food||!p.owned?'disabled':'')+' onclick="valorPetFeed(\''+pet.id+'\')">'+(maxed?'Tamamlandı':'Besle · '+Math.min(food,remaining)+' Yem')+'</button></div></div></article>';
 }).join('')+'</div><footer class="vpet-guide"><h2>Gelişim Yolu</h2><div>'+VALOR_PET_RARITIES.map(r=>'<span style="color:'+r.color+'">'+r.name+' <small>1–5 ★</small></span>').join('<i aria-hidden="true">›</i>')+'</div><p>Her aşamada yem ihtiyacı 15 artar. Beyaz 5 yıldızdan yeşil 1 yıldıza geçiş 75 yemdir. Verdiğin yemler birikir; sayfayı kapatsan da ilerlemen korunur.</p></footer></section>';
}
const valorPetFoodIcon='<svg class="vpet-food-icon" viewBox="0 0 100 100" role="img" aria-label="Pet yemi"><defs><linearGradient id="vpet-bowl" x2="0" y2="1"><stop stop-color="#c7984c"/><stop offset="1" stop-color="#47301a"/></linearGradient></defs><ellipse cx="50" cy="43" rx="32" ry="11" fill="#372a1b" stroke="#d8b574" stroke-width="2"/><g fill="#ac7a43" stroke="#e4bd78"><path d="m24 40 7-8 9 4-1 10-10 1zM42 36l8-9 9 5-1 11-10 1zM61 39l9-7 8 7-4 9-10-1zM36 44l9-7 9 6-3 9-11 1zM56 46l8-7 9 7-4 9-10-1z"/></g><path d="M17 44h66L74 71Q50 84 26 71Z" fill="url(#vpet-bowl)" stroke="#e0bb76" stroke-width="2"/><path d="M22 52h56" stroke="#f5d59b" opacity=".5"/><circle cx="50" cy="66" r="7" fill="#d6b073"/><path d="M48 66l2-3 2 3-2 2z" fill="#4c321b"/></svg>';
if(!marketProducts.some(p=>p.id==='petFood'))marketProducts.push({id:'petFood',name:'Pet Yemi',price:25,limit:15,icon:valorPetFoodIcon,description:'Pet ekranında dostlarını beslemek için kullanılır. Dört pet için ortak yem stoğudur.'});
const valorPetPreviousMaterial=isDirectStoneMaterial;
isDirectStoneMaterial=function(id){return id==='petFood'||valorPetPreviousMaterial(id)};
const valorPetPreviousPopup=showBagItemPopup;
showBagItemPopup=function(index){if(state.inventory[index]?.marketItemId==='petFood'){closeBagPopup();go('Pet');return}return valorPetPreviousPopup.apply(this,arguments)};
const valorPetPreviousDerived=vmDerived;
vmDerived=function(){const out={...valorPetPreviousDerived()},bonus=valorPetDerived();for(const [key,value] of Object.entries(bonus))out[key]=(Number(out[key])||0)+value;return out};
const valorPetPreviousHome=home;
home=function(){return valorPetPreviousHome().replace('</div>','<button type="button" class="mmorpg-home-tile valor-vertical-tile vpet-home-tile" onclick="go(\'Pet\')" aria-label="Pet" title="Pet"><img src="assets/pets/kozpence.webp" alt="Pet" decoding="async" draggable="false"><span>Pet</span></button></div>')};
const valorPetPreviousRender=render;
render=function(){
 const ready=state.class&&(typeof valorAccountCanPlay!=='function'||valorAccountCanPlay());
 if(ready&&!state.petsV1){valorPetData();save()}
 const result=valorPetPreviousRender.apply(this,arguments);
 document.body.classList.toggle('valor-pet-page',!!ready&&page==='Pet');
 if(ready&&page==='Pet')document.getElementById('main').innerHTML=valorPetPage();
 return result;
};
render();
