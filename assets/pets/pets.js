/* Four cumulative companions; each has 5 rarities × 5 stars. */
const VALOR_PETS=[
 {id:'kozpence',name:'Közpençe',kind:'Kor Ruhu',movement:'Dört ayaklı',description:'Közlerin içinden gelen sadık muhafız.'},
 {id:'ayazdis',name:'Ayazdiş',kind:'Buz Ruhu',movement:'Dört ayaklı',description:'Sessiz adımlarında kadim kışın gücü var.'},
 {id:'safakkanat',name:'Şafakkanat',kind:'Şafak Ruhu',movement:'Uçan',description:'Şafağın altın ışığını kanatlarında taşır.'},
 {id:'gecegaga',name:'Gecegaga',kind:'Gece Ruhu',movement:'Uçan',description:'Geceyi yaran kanatlar, sarsılmaz bir bağ.'}
];
const VALOR_PET_RARITIES=[{name:'Beyaz',color:'#ece7dc'},{name:'Yeşil',color:'#7ac98e'},{name:'Mavi',color:'#6ab5ef'},{name:'Mor',color:'#bf87e8'},{name:'Altın',color:'#efb94f'}];
const VALOR_PET_ATTRIBUTES=['Güç','Zeka','Zırh','Beden'];
const VALOR_PET_MAX_STAGE=24;
function valorPetStage(value){return Number.isFinite(Number(value))?Math.max(0,Math.min(24,Math.floor(Number(value)))):0}
/* Food to finish each rarity (to the next rarity's 1 star; gold: 1 to 5 stars), split evenly across its star steps. */
const VALOR_PET_RARITY_FOOD=[250,750,1500,3000,7500];
/* Attribute gain for reaching a star: White/Green +5, Blue/Purple +10, Gold +20. Base value 10. */
function valorPetStarGain(stage){stage=valorPetStage(stage);if(stage<1)return 0;const tier=Math.floor(stage/5);return tier>=4?20:tier>=2?10:5}
function valorPetValue(stage){stage=valorPetStage(stage);let v=10;for(let s=1;s<=stage;s++)v+=valorPetStarGain(s);return v}
const VALOR_PET_LUCKY_FOOD_CHANCE=.10,VALOR_PET_LUCKY_FOOD_XP=5;
function valorPetCost(stage){if(stage>=VALOR_PET_MAX_STAGE)return 0;const tier=Math.floor(valorPetStage(stage)/5);return VALOR_PET_RARITY_FOOD[tier]/(tier===4?4:5)}
function valorPetInfo(stage){stage=valorPetStage(stage);return {stage,rarity:VALOR_PET_RARITIES[Math.floor(stage/5)],stars:stage%5+1,value:valorPetValue(stage),cost:valorPetCost(stage)}}
const VALOR_PET_EVOLUTION_FILES=['','-green','-blue','-purple','-gold'];
const VALOR_PET_EVOLUTION_NAMES=['Yavru','Genç','Yetişkin','Kadim','Efsanevi'];
function valorPetArt(id,stage){if(!VALOR_PETS.some(p=>p.id===id))return '';const tier=Math.floor(valorPetStage(stage)/5);return 'assets/pets/'+id+VALOR_PET_EVOLUTION_FILES[tier]+'.webp?v='+(tier===4?'20261025-gold-feral':'20261025-evolutions')}
function valorPetPreviewStage(id,tier){
 const pet=VALOR_PETS.find(p=>p.id===id),dialog=document.getElementById('valor-pet-evolution');
 if(!pet||!dialog||!Number.isInteger(tier)||tier<0||tier>4)return;
 const rarity=VALOR_PET_RARITIES[tier],img=dialog.querySelector('.vpet-evolution-art img');
 img.src=valorPetArt(id,tier*5);img.alt=pet.name+' · '+rarity.name+' · '+VALOR_PET_EVOLUTION_NAMES[tier];
 dialog.style.setProperty('--pet-color',rarity.color);
 dialog.querySelector('.vpet-evolution-caption').textContent=rarity.name+' · '+VALOR_PET_EVOLUTION_NAMES[tier];
 dialog.querySelectorAll('[data-pet-tier]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.petTier)===tier)));
}
function valorPetPreview(id){
 const pet=VALOR_PETS.find(p=>p.id===id);if(!pet||page!=='Pet')return;
 document.getElementById('valor-pet-evolution')?.remove();
 const dialog=document.createElement('dialog');dialog.id='valor-pet-evolution';dialog.className='vpet-evolution-dialog';dialog.setAttribute('aria-labelledby','vpet-evolution-title');
 dialog.innerHTML='<div class="vpet-evolution-header"><div><small>EVRİM YOLU</small><h2 id="vpet-evolution-title">'+pet.name+'</h2></div><button type="button" aria-label="Evrim görünümünü kapat" onclick="this.closest(\'dialog\').close()">×</button></div><div class="vpet-evolution-art"><img width="640" height="640" alt=""></div><p class="vpet-evolution-caption" aria-live="polite"></p><div class="vpet-evolution-tabs" aria-label="Evrim görünüşleri">'+VALOR_PET_RARITIES.map((r,i)=>'<button type="button" data-pet-tier="'+i+'" aria-pressed="false" onclick="valorPetPreviewStage(\''+id+'\','+i+')">'+r.name+'</button>').join('')+'</div><p class="vpet-evolution-note">Her renk değişiminde yeni görünüşe evrilir.</p>';
 document.body.appendChild(dialog);valorPetPreviewStage(id,Math.floor(valorPetData()[id].stage/5));
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close()}});
 dialog.showModal();
}
function valorPetData(){
 let d=state.petsV1;
 if(!d||typeof d!=='object'||Array.isArray(d))d=state.petsV1={};
 for(const pet of VALOR_PETS){
  let p=d[pet.id];if(!p||typeof p!=='object'||Array.isArray(p))p=d[pet.id]={stage:0,progress:0,owned:true};
  p.stage=valorPetStage(p.stage);p.owned=p.owned!==false;
  p.progress=p.stage===24?0:Math.max(0,Math.min(valorPetCost(p.stage)-1,Math.floor(Number(p.progress)||0)));
 }
 // One guardian is equipped: it gives 100% to the character, the others 50%. Default: highest-stage owned guardian.
 if(!VALOR_PETS.some(pet=>pet.id===d.equipped&&d[pet.id].owned)){const best=VALOR_PETS.filter(pet=>d[pet.id].owned).sort((a,b)=>d[b.id].stage-d[a.id].stage)[0];d.equipped=best?best.id:null}
 return d;
}
function valorPetShare(id){return 1}
function valorPetEquip(id){
 if(page!=='Pet'||!state.class)return;const d=valorPetData();
 if(!VALOR_PETS.some(pet=>pet.id===id)||!d[id].owned||d.equipped===id)return;
 d.equipped=id;save();render();toast(VALOR_PETS.find(p=>p.id===id).name+' kuşanıldı · '+VALOR_PET_BUFFS[id].name+' aktif.');
}
function valorPetAttributeTotals(){const d=valorPetData();const value=VALOR_PETS.reduce((sum,pet)=>sum+(d[pet.id].owned?valorPetInfo(d[pet.id].stage).value:0),0);return {Güç:value,Zeka:value,Zırh:value,Beden:value}}
function valorPetCharacterAttributes(){const d=valorPetData();const value=VALOR_PETS.reduce((sum,pet)=>sum+(d[pet.id].owned?valorPetInfo(d[pet.id].stage).value*valorPetShare(pet.id):0),0);return Object.fromEntries(VALOR_PET_ATTRIBUTES.map(key=>[key,value]))}
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
 const available=valorPetFoodCount();
 if(!available)return toast('Pet yemin yok. Sınırlı Mağaza’dan alabilirsin.');
 // Each food gives 1 EXP, or 5 EXP with a 10% chance; feeding stops once this star is full.
 let amount=0,lucky=0,gained=0;
 while(amount<available&&p.progress+gained<info.cost&&(!single||amount<1)){amount++;if(Math.random()<VALOR_PET_LUCKY_FOOD_CHANCE){lucky++;gained+=VALOR_PET_LUCKY_FOOD_XP}else gained++}
 if(!amount||!valorPetSpendFood(amount))return;
 p.progress+=gained;let advanced=false;
 if(p.progress>=info.cost){const extra=p.progress-info.cost;p.stage++;p.progress=Math.max(0,Math.min(extra,valorPetCost(p.stage)-1));advanced=true}
 save();render();
 const next=valorPetInfo(p.stage),name=VALOR_PETS.find(p=>p.id===id).name,luckText=lucky?' · '+lucky+' şanslı yem (5 EXP)!':'';
 toast(advanced?name+' · '+next.rarity.name+' '+next.stars+' yıldız! Dört özellik +'+valorPetStarGain(p.stage)+'.'+luckText:name+' · '+amount+' yem verildi: +'+gained+' EXP'+luckText);
}
function valorPetOpenMarket(){closeBagPopup();go('Market');selectMarketCategory('limited');openMarketPurchase('petFood')}
function valorPetNumber(value){return Number(value).toLocaleString('tr-TR',{maximumFractionDigits:1})}
function valorPetStars(count){return '<span class="vpet-stars" aria-label="'+count+' yıldız">'+Array.from({length:5},(_,i)=>'<span'+(i<count?' class="filled"':'')+' aria-hidden="true">★</span>').join('')+'</span>'}
function valorPetPage(){
 const d=valorPetData(),food=valorPetFoodCount(),totals=valorPetAttributeTotals(),bonus=valorPetCharacterAttributes();
 return '<section class="vpet-page"><header class="vpet-heading"><div><small>YOL ARKADAŞLARIN</small><h1>Muhafız Koleksiyonu</h1><p>Dört dost. Ortak güç. Kalıcı bağ.</p></div><button type="button" onclick="go(\'Anasayfa\')">‹ Anasayfa</button></header><div class="vpet-summary"><img class="vpet-food-stock-art" src="assets/pets/pet-food-bag.webp?v=20261025-food" alt="Yem Çantası" width="80" height="80"><div><span>Pet Yemi</span><strong>'+money(food)+'</strong><small>Günlük market: 25 elmas · 15 adet</small></div><button type="button" onclick="valorPetOpenMarket()">Yem Satın Al</button></div><div class="vpet-bonus"><div><small>KARAKTERİNE AKTARILAN · %100</small><p>Dört muhafızın özellikleri tamamen aktarılır. Kuşandığın muhafız ayrıca kendi özel gücünü savaşa taşır.</p></div><div class="vpet-bonus-grid">'+VALOR_PET_ATTRIBUTES.map(key=>'<div><span>'+key+'</span><strong>+'+valorPetNumber(bonus[key])+'</strong><small>Pet toplamı '+money(totals[key])+'</small></div>').join('')+'</div></div><div class="vpet-grid">'+VALOR_PETS.map(pet=>{
  const p=d[pet.id],info=valorPetInfo(p.stage),next=valorPetInfo(p.stage+1),maxed=!info.cost,remaining=info.cost-p.progress,equipped=d.equipped===pet.id,share=valorPetShare(pet.id);
  return '<article class="vpet-card '+(pet.movement==='Uçan'?'vpet-flying':'')+(equipped?' vpet-equipped':'')+'" style="--pet-color:'+info.rarity.color+'"><button type="button" class="vpet-art vpet-art-button" onclick="valorPetPreview(\''+pet.id+'\')" aria-label="'+pet.name+' evrimlerini incele"><img src="'+valorPetArt(pet.id,p.stage)+'" alt="'+pet.name+' · '+pet.kind+'" width="512" height="512" decoding="async"><span class="vpet-kind">'+pet.movement+'</span><span class="vpet-rarity">'+info.rarity.name+'</span>'+(equipped?'<span class="vpet-equipped-badge">KUŞANILDI</span>':'')+'</button><div class="vpet-copy"><div class="vpet-title"><h2>'+pet.name+'</h2><span>'+pet.kind+'</span></div>'+valorPetStars(info.stars)+'<p class="vpet-description">'+pet.description+'</p><div class="vpet-stats">'+VALOR_PET_ATTRIBUTES.map(key=>'<div><span>'+key+'</span><b>'+info.value+'</b><small>Karaktere +'+valorPetNumber(info.value*share)+'</small></div>').join('')+'</div><div class="vpet-growth"><div><strong>'+(maxed?'En yüksek aşama':next.rarity.name+' '+next.stars+' yıldıza')+'</strong><span>'+(maxed?'25 / 25':money(p.progress)+' / '+money(info.cost)+' yem')+'</span></div><div class="vpet-track" role="progressbar" aria-label="'+pet.name+' gelişimi" aria-valuemin="0" aria-valuemax="'+(info.cost||1)+'" aria-valuenow="'+(maxed?1:p.progress)+'"><i style="width:'+(maxed?100:p.progress/info.cost*100)+'%"></i></div><small>'+(maxed?'Dört özellik de '+valorPetValue(VALOR_PET_MAX_STAGE)+' · karakterine +'+valorPetNumber(valorPetValue(VALOR_PET_MAX_STAGE)*share)+'.':'Sonraki aşamada dört özellik +'+valorPetStarGain(p.stage+1)+' · karakterine +'+valorPetNumber(valorPetStarGain(p.stage+1)*share)+'.')+'</small></div>'+valorPetBuffCard(pet.id,p.stage,equipped)+'<button type="button" class="vpet-equip" '+(equipped||!p.owned?'disabled':'')+' onclick="valorPetEquip(\''+pet.id+'\')">'+(equipped?'Kuşanıldı':'Kuşan')+'</button><div class="vpet-actions"><button type="button" '+(maxed||!food||!p.owned?'disabled':'')+' onclick="valorPetFeed(\''+pet.id+'\',true)">1 Yem Ver</button><button type="button" '+(maxed||!food||!p.owned?'disabled':'')+' onclick="valorPetFeed(\''+pet.id+'\')">'+(maxed?'Tamamlandı':'Besle · '+Math.min(food,remaining)+' Yem')+'</button></div></div></article>';
 }).join('')+'</div><footer class="vpet-guide"><h2>Gelişim Yolu</h2><div>'+VALOR_PET_RARITIES.map(r=>'<span style="color:'+r.color+'">'+r.name+' <small>1–5 ★</small></span>').join('<i aria-hidden="true">›</i>')+'</div><p>Her renk bir sonrakine kadar sırasıyla 250, 750, 1.500 ve 3.000 yem ister; Altın 1’den 5 yıldıza 7.500 yem. Her yem 1 EXP, %10 şansla 5 EXP verir. Yıldız başına özellik: Beyaz ve Yeşil +5, Mavi ve Mor +10, Altın +20. Verdiğin yemler birikir; sayfayı kapatsan da ilerlemen korunur.</p></footer></section>';
}
const valorPetFoodIcon='<img class="vpet-food-icon" src="assets/pets/pet-food.webp?v=20261025-food" alt="Pet Yemi" width="512" height="512">';
if(!marketProducts.some(p=>p.id==='petFood'))marketProducts.push({id:'petFood',name:'Pet Yemi',price:25,limit:15,icon:valorPetFoodIcon,description:'Pet ekranında dostlarını beslemek için kullanılır. Dört pet için ortak yem stoğudur.'});
const valorPetPreviousMaterial=isDirectStoneMaterial;
isDirectStoneMaterial=function(id){return id==='petFood'||valorPetPreviousMaterial(id)};
const valorPetPreviousPopup=showBagItemPopup;
showBagItemPopup=function(index){if(state.inventory[index]?.marketItemId==='petFood'){closeBagPopup();go('Pet');return}return valorPetPreviousPopup.apply(this,arguments)};
/* Equipped guardian battle buffs (Arena and Dungeon). Values grow linearly from White 1★ (stage 0) to Gold 5★ (stage 24). */
const VALOR_PET_BUFFS={
 kozpence:{name:'Tutuşturma',text:v=>'Vuruşların %'+valorPetNumber(v.chance*100)+' şansla rakibi tutuşturur. Tutuşan rakip 3 tur boyunca her tur maksimum canının %'+valorPetNumber(v.burn*100)+' oranında yanık hasarı alır.',values:t=>({chance:.10+.20*t,burn:.004+.002*t})},
 ayazdis:{name:'Don Nefesi',text:v=>'Rakibin kritik ve bloke şansı %'+valorPetNumber(v.reduce*100)+' azalır.',values:t=>({reduce:.05+.13*t})},
 safakkanat:{name:'Şafak İnfazı',text:v=>'Canı %25’in altındaki rakibe verdiğin hasar +%'+valorPetNumber(v.bonus*100)+'.',values:t=>({bonus:.10+.40*t})},
 gecegaga:{name:'Gölge Darbesi',text:v=>'%'+valorPetNumber(v.chance*100)+' şansla aynı turda gölgeden ikinci bir saldırı yapar.',values:t=>({chance:.04+.16*t})}
};
function valorPetBuffValues(id,stage){const b=VALOR_PET_BUFFS[id];if(!b)return null;const v=b.values(valorPetStage(stage)/VALOR_PET_MAX_STAGE);for(const k of Object.keys(v))v[k]=Math.round(v[k]*10000)/10000;return v}
function valorPetBuffCard(id,stage,equipped){const b=VALOR_PET_BUFFS[id],now=valorPetBuffValues(id,stage),maxed=valorPetStage(stage)>=VALOR_PET_MAX_STAGE;return '<div class="vpet-buff'+(equipped?' active':'')+'"><div><small>'+(equipped?'ÖZEL GÜÇ · AKTİF':'ÖZEL GÜÇ · KUŞANINCA')+'</small><b>'+b.name+'</b></div><p>'+b.text(now)+'</p>'+(maxed?'':'<small class="vpet-buff-next">Altın 5★: '+b.text(valorPetBuffValues(id,VALOR_PET_MAX_STAGE))+'</small>')+'</div>'}
function valorPetActiveBuff(){const d=valorPetData(),id=d.equipped;if(!id||!d[id]?.owned)return null;return {id,...valorPetBuffValues(id,d[id].stage)}}
const valorPetPreviousArenaStats=valorArenaStats;
valorArenaStats=function(){const stats=valorPetPreviousArenaStats(),buff=valorPetActiveBuff();return buff?{...stats,petBuff:buff}:stats};
/* Don Nefesi: lowers the opponent's crit chance when they attack and block chance when you attack. The base hit rolls crit first, then block. */
const valorPetPreviousArenaHit=valorArenaHit;
valorArenaHit=function(a,b,rng=Math.random){
 const critCut=b?.stats?.petBuff?.id==='ayazdis'?b.stats.petBuff.reduce:0,blockCut=a?.stats?.petBuff?.id==='ayazdis'?a.stats.petBuff.reduce:0;
 if(!critCut&&!blockCut)return valorPetPreviousArenaHit(a,b,rng);
 let n=0;const roll=()=>{const v=rng();n++;return n===1?v+critCut:n===2?v+blockCut:v};
 const hit=valorPetPreviousArenaHit(a,b,roll);if(critCut||blockCut)hit.frost=true;return hit;
};
/* Sample arena rivals never inherit the player's guardian buff. */
const valorPetPreviousArenaPlayers=valorArenaPlayers;
valorArenaPlayers=function(){const players=valorPetPreviousArenaPlayers();let changed=false;for(const p of players)if(p.combatStats&&'petBuff' in p.combatStats){delete p.combatStats.petBuff;changed=true}if(changed)save();return players};
const valorPetPreviousDerived=vmDerived;
vmDerived=function(){const out={...valorPetPreviousDerived()},bonus=valorPetDerived();for(const [key,value] of Object.entries(bonus))out[key]=(Number(out[key])||0)+value;return out};
const valorPetPreviousHome=home;
home=function(){return valorPetPreviousHome().replace('</div>','<button type="button" class="mmorpg-home-tile valor-vertical-tile vpet-home-tile" onclick="go(\'Pet\')" aria-label="Muhafız" title="Muhafız"><img src="assets/home-fantasy/muhafiz.webp?v=20261025-guardians" alt="Muhafız" decoding="async" draggable="false"></button></div>')};
const valorPetPreviousRender=render;
/* A single existing active character on this browser receives the requested test food. */
const VALOR_PET_FOOD_GIFT={amount:99999,cutoff:1792881752810,flag:'valorPetFoodGift20261025',receipt:'valor-pet-food-gift-20261025'};
let valorPetFoodGiftCreating=false,valorPetFoodGiftMessage=false;
const valorPetFoodGiftPreviousSave=save;
function valorPetFoodGiftGrant(character,account,persist,storage=localStorage){
 if(!['Savaşçı','Büyücü','Okçu'].includes(character?.class))return false;
 const gift=VALOR_PET_FOOD_GIFT,created=Number(account?.createdAt??character.valorCharacterCreatedAt??0);
 if(!Number.isFinite(created)||created>gift.cutoff)return false;
 const owner=account?.id||'legacy-guest';
 if(character[gift.flag]){if(!storage.getItem(gift.receipt))storage.setItem(gift.receipt,owner);return false}
 if(storage.getItem(gift.receipt))return false;
 const before=character.inventory;
 character.inventory=(Array.isArray(before)?before:[]).map(it=>({...it}));
 const stack=character.inventory.find(it=>it.marketItemId==='petFood');
 if(stack)stack.count=Math.max(0,Math.floor(Number(stack.count)||0))+gift.amount;
 else character.inventory.push({id:valorUniqueItemId(),slot:'Eşya',marketItemId:'petFood',name:'Pet Yemi',count:gift.amount,description:'Pet ekranında dostlarını beslemek için kullanılır.'});
 character[gift.flag]=true;
 try{persist();storage.setItem(gift.receipt,owner)}catch(error){character.inventory=before;delete character[gift.flag];throw error}
 return true;
}
function valorPetFoodGiftApplyActive(){
 if(valorPetFoodGiftCreating||!state.class||typeof valorAccountCanPlay!=='function'||!valorAccountCanPlay())return false;
 const granted=valorPetFoodGiftGrant(state,valorAccountActive,()=>valorPetFoodGiftPreviousSave());
 if(granted)valorPetFoodGiftMessage=true;return granted;
}
const valorPetFoodGiftPreviousInit=initClass;
initClass=function(){
 const creating=!state.class,previous=valorPetFoodGiftCreating;if(creating)valorPetFoodGiftCreating=true;
 try{return valorPetFoodGiftPreviousInit.apply(this,arguments)}finally{valorPetFoodGiftCreating=previous}
};
render=function(){
 const ready=state.class&&(typeof valorAccountCanPlay!=='function'||valorAccountCanPlay());
 if(ready&&!state.petsV1){valorPetData();save()}
 if(ready)valorPetFoodGiftApplyActive();
 const result=valorPetPreviousRender.apply(this,arguments);
 document.body.classList.toggle('valor-pet-page',!!ready&&page==='Pet');
 if(ready&&page==='Pet')document.getElementById('main').innerHTML=valorPetPage();
 if(ready&&valorPetFoodGiftMessage){valorPetFoodGiftMessage=false;toast('+99.999 pet yemi karakterine eklendi!')}
 return result;
};
render();
