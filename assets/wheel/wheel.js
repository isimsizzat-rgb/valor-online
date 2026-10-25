/* Equal geometry; reward weights are independent of sector size. */
(function(){
 const PRICE=99,DURATION=6200,NAME='Şans Çarkı';
 const prizes=[
  {id:'mosaic',name:'Mozaik Çantası',weight:1500},
  {id:'gold',name:'1M Altın',weight:1200},
  {id:'crystal',name:'250K Kristal',weight:1000},
  {id:'mountStone',name:'Binek Taşı ×50',weight:500},
  {id:'king',name:'Kral Bineği · +100',weight:20},
  {id:'luck',name:'Şans Taşı Çantası',weight:1600},
  {id:'epic',name:'Epik Taşı ×2',weight:1800},
  {id:'wing',name:'Rastgele Kanat',weight:200},
  {id:'energy',name:'Enerji Şişesi ×2',weight:1200},
  {id:'food',name:'Pet Yemi ×5',weight:670},
  {id:'health',name:'Sv.10 Can Taşı',weight:10},
  {id:'fashion',name:'Fashion Çantası',weight:300}
 ];
 const king={id:'wheelKing',name:'Kral Bineği',kind:'griffin',color:'#e8bf67',stats:[100,100,100,100],spirit:500,boxOnly:true};
 if(!valorMounts.some(m=>m.id===king.id))valorMounts.push(king);
 const oldMountArt=vmMountImage;
 vmMountImage=function(m){return oldMountArt(m.id===king.id?{...m,id:'yildonumu50'}:m)};
 const fashionBag={id:'wheelFashionBag',name:'Fashion Çantası',description:'İçinden dört kanat türünden rastgele bir Sv.1 kanat çıkar.',icon:mosaicStoneBagGraphic()};
 const oldProduct=marketProduct;
 marketProduct=function(id){return id===fashionBag.id?fashionBag:oldProduct.apply(this,arguments)};
 const oldUse=useInventoryStack;
 useInventoryStack=function(index,amount){
  const it=state.inventory[index];if(it?.marketItemId!==fashionBag.id)return oldUse.apply(this,arguments);
  const count=Math.max(1,Number(it.count)||1),qty=Math.min(count,Math.max(1,Math.floor(Number(amount)||1)));
  for(let n=0;n<qty;n++)grantWing();
  if(qty===count)state.inventory.splice(index,1);else it.count=count-qty;
  selected=null;closeBagPopup();save();render();toast(qty+' Fashion Çantası açıldı; kanatlar çantana eklendi');
 };
 const oldUseItem=useInventoryItem;
 useInventoryItem=function(index){return state.inventory[index]?.marketItemId===fashionBag.id?useInventoryStack(index,1):oldUseItem.apply(this,arguments)};
 function grantWing(){const w=valorWings[Math.floor(Math.random()*valorWings.length)];state.inventory.push({id:valorUniqueItemId(),wingId:w.id,slot:'Kanat',name:w.name,cls:'Tüm Sınıflar',level:1,wingLevel:1,plus:0,epic:false});return w.name}
 function grant(id){
  switch(id){
   case 'mosaic':addMarketStack('mosaicStone',1);break;
   case 'gold':state.gold=(Number(state.gold)||0)+1000000;break;
   case 'crystal':vsData().crystals=(Number(vsData().crystals)||0)+250000;break;
   case 'mountStone':addMarketStack('mountStone',50);break;
   case 'king':state.inventory.push({id:valorUniqueItemId(),slot:'Binek',mountId:king.id,name:king.name,cls:state.class,level:1,plus:0,epic:true});break;
   case 'luck':addMarketStack('luckBag',1);break;
   case 'epic':state.shards=(Number(state.shards)||0)+2;break;
   case 'wing':return grantWing();
   case 'energy':addMarketStack('energyBottle',2);break;
   case 'food':addMarketStack('petFood',5);break;
   case 'health':vwAddGem('Can',10,1);break;
   case 'fashion':addMarketStack(fashionBag.id,1);break;
   default:throw new Error('Unknown wheel prize');
  }
  return prizes.find(p=>p.id===id).name;
 }
 function pick(ticket){let cumulative=0;for(let i=0;i<prizes.length;i++){cumulative+=prizes[i].weight;if(ticket<cumulative)return i}return prizes.length-1}
 function art(id){
  switch(id){
   case 'mosaic':return mosaicStoneBagGraphic();
   case 'gold':return '<img src="'+valorFarmGoldArt[2]+'" alt="">';
   case 'crystal':return '<img src="'+valorFarmGrowthArt[2]+'" alt="">';
   case 'mountStone':return mountStoneGraphic();
   case 'king':return vmDrawing(king);
   case 'luck':return luckStoneBagGraphic();
   case 'epic':return epicStoneGraphic();
   case 'wing':return '<img src="'+valorWingArt(valorWings[0])+'" alt="">';
   case 'energy':return marketProduct('energyBottle').icon;
   case 'food':return '<img src="assets/pets/pet-food-bag.webp" alt="">';
   case 'health':return vgArt('Can',10);
   case 'fashion':return fashionBag.icon;
  }
 }
 function iconMarkup(id){return '<span class="vwf-icon" aria-hidden="true">'+art(id)+'</span>'}
 const wheelLabels={mosaic:'Mozaik Çantası',gold:'1M Altın',crystal:'250K Kristal',mountStone:'Binek Taşı ×50',king:'Kral Bineği +100',luck:'Şans Çantası',epic:'Epik Taşı ×2',wing:'Kanat',energy:'Enerji ×2',food:'Yem ×5',health:'Sv.10 Can',fashion:'Fashion Çantası'};
 function wheelFace(rotation=0){
  let paths='<defs><pattern id="vwf-worn-red" width="600" height="600" patternUnits="userSpaceOnUse"><rect width="600" height="600" fill="#4a0d1a"/><image href="assets/wheel/sector-texture.webp" width="600" height="600" opacity=".64" style="mix-blend-mode:soft-light"/></pattern><pattern id="vwf-worn-black" width="600" height="600" patternUnits="userSpaceOnUse"><rect width="600" height="600" fill="#17171b"/><image href="assets/wheel/sector-texture.webp" width="600" height="600" opacity=".38" style="mix-blend-mode:screen"/></pattern></defs>';
  for(let i=0;i<12;i++){
   const a=(i*30-105)*Math.PI/180,b=a+Math.PI/6;
   paths+='<path d="M300 300 L'+(300+300*Math.cos(a))+' '+(300+300*Math.sin(a))+' A300 300 0 0 1 '+(300+300*Math.cos(b))+' '+(300+300*Math.sin(b))+' Z" fill="'+(i%2?'url(#vwf-worn-black)':'url(#vwf-worn-red)')+'" stroke="#ba914e" stroke-width="2"/>';
  }
  return '<svg class="vwf-sectors" viewBox="0 0 600 600" aria-hidden="true">'+paths+'</svg><div class="vwf-prizes">'+prizes.map((p,i)=>{const angle=i*30-90,visible=((angle+rotation)%360+360)%360,flip=visible>90&&visible<=270?180:0;return '<div class="vwf-prize" data-prize="'+p.id+'" title="'+escapeAttr(p.name)+'" style="--angle:'+angle+'deg;--upright:'+(-(angle+rotation))+'deg;--label-flip:'+flip+'deg">'+iconMarkup(p.id)+'<span class="vwf-label">'+wheelLabels[p.id]+'</span></div>'}).join('')+'</div>';
 }
 let timer=null;
 function data(){return state.luckyWheelV1||{from:0,to:0,ends:0}}
 function spinning(){return (data().ends||0)>Date.now()}
 function currentRound(d,now=Date.now()){
  if(d.batchAnimation)return {...d,duration:d.duration,number:1,count:d.count};
  if(!d.rounds?.length)return {...d,duration:DURATION,number:1,count:1};
  const index=Math.max(0,Math.min(d.rounds.length-1,Math.floor((now-d.started)/d.roundDuration)));
  return {...d.rounds[index],ends:d.started+(index+1)*d.roundDuration,duration:d.roundDuration,number:index+1,count:d.rounds.length};
 }
 window.valorWheelShowSummary=function(){
  const d=data();if(spinning()||!d.outcomes)return;
  document.getElementById('valor-wheel-summary')?.remove();
  const overlay=document.createElement('div');overlay.id='valor-wheel-summary';overlay.className='vm-box-drop-overlay';
  overlay.innerHTML='<section class="vm-box-drop-dialog" role="dialog" aria-modal="true" aria-labelledby="valor-wheel-summary-title"><div class="vm-market-purchase-kicker">ŞANS ÇARKI</div><h2 id="valor-wheel-summary-title">'+d.count+' tur tamamlandı</h2><p class="vm-box-drop-note">'+d.totalPrice+' 💎 · Ödüllerin hesabına eklendi.</p><div class="vm-box-reward-list">'+Object.entries(d.outcomes).map(([name,amount])=>'<div class="vm-box-reward-result"><span>'+escapeAttr(name)+'</span><b>×'+amount+'</b></div>').join('')+'</div><button type="button" class="vm-box-drop-close" onclick="document.getElementById(\'valor-wheel-summary\').remove()">Tamam</button></section>';
  overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.remove()});document.body.appendChild(overlay);
 };
 function diamondHtml(){return '<span class="vwf-diamond"><span class="vwf-sr">💎</span>'+(document.querySelector('.valor-diamond-icon')?.innerHTML||'')+'</span>'}
 function pageHtml(){
  const d=data(),busy=spinning(),round=currentRound(d);
  const status=busy?'Çark dönüyor…':d.count===10?'10 tur tamamlandı.':d.last?'Kazandın: <strong>'+escapeAttr(d.last)+'</strong>':'On iki dilim, on iki farklı ödül.';
  return ('<section class="vwf-page"><header class="vwf-heading"><span>VALOR ONLINE</span><h1>Şans Çarkı</h1><p>Ortadaki mühre dokun, kader çarkını döndür.</p></header><div class="vwf-frame"><div class="vwf-disc" id="valorWheelDisc" style="transform:rotate('+round.to+'deg)">'+wheelFace(round.to||0)+'</div><img class="vwf-dragon-frame" src="assets/wheel/dragon-frame.webp?v=1" alt="" aria-hidden="true"><button id="valorWheelSpin" type="button" class="vwf-hub" onclick="valorWheelSpin()" aria-label="Şans çarkını 99 elmas karşılığında çevir" '+(busy?'disabled aria-busy="true"':'')+'><b>ÇEVİR</b></button></div><div class="vwf-caption">Tek tur <b>99 💎</b></div><div class="vwf-batch-controls"><button id="valorWheelSpinTen" type="button" onclick="valorWheelSpin(10)" '+(busy?'disabled':'')+'><b>10 TUR ÇEVİR</b><span>899 💎</span></button></div><div class="vwf-result" role="status" aria-live="polite">'+status+(!busy&&d.count===10?' <button type="button" class="vwf-summary-open" onclick="valorWheelShowSummary()">Ödülleri gör</button>':'')+'</div><details class="vwf-rewards"><summary>Ödülleri incele</summary><div>'+prizes.map(p=>'<article>'+iconMarkup(p.id)+'<span>'+p.name+'</span><small>%'+String(p.weight/100).replace('.',',')+'</small></article>').join('')+'</div></details></section>').replaceAll('💎',diamondHtml());
 }
 function animate(){
  clearTimeout(timer);const d=data(),round=currentRound(d),remaining=round.ends-Date.now(),disc=document.getElementById('valorWheelDisc');
  if(remaining<=0||!disc){
   if(d.count===10&&!d.summaryShown){d.summaryShown=true;save();valorWheelShowSummary()}
   return;
  }
  const progress=Math.max(0,Math.min(1,(Date.now()-(round.ends-round.duration))/round.duration)),ease=1-Math.pow(1-progress,4);
  disc.style.transition='none';disc.style.transform='rotate('+(round.from+(round.to-round.from)*ease)+'deg)';
  // Force the initial style so mobile browsers animate on the first click too.
  void disc.offsetWidth;
  disc.style.transition='transform '+remaining+'ms cubic-bezier(.12,.64,.16,1)';disc.style.transform='rotate('+round.to+'deg)';
  timer=setTimeout(()=>{if(page===NAME)render()},remaining+40);
 }
 window.valorWheelSpin=function(count=1){
  if(![1,10].includes(count)||page!==NAME||!state.class||!valorAccountCanPlay()||spinning())return;
  const price=count===10?899:PRICE;
  if((Number(state.diamonds)||0)<price)return toast('Yeterli elmasın yok · '+price+' 💎 gerekiyor');
  vsData();vwInit();vmData();
  const old=JSON.stringify(state),tickets=new Uint32Array(count);crypto.getRandomValues(tickets);
  const previous=data(),rounds=[],outcomes={};let from=previous.to||0;
  try{
   state.diamonds-=price;
   for(const ticket of tickets){
    const index=pick(ticket/4294967296*10000),target=(360-index*30)%360,to=from+(count===10?720:1800)+((target-from%360+360)%360),last=grant(prizes[index].id);
    rounds.push({from,to,last,prize:prizes[index].id});outcomes[last]=(outcomes[last]||0)+1;from=to;
   }
   const started=Date.now(),roundDuration=count===10?3000:DURATION,lastRound=rounds[rounds.length-1],initialFrom=rounds[0].from;
   const animationTo=count===10?initialFrom+1080+((lastRound.to%360-initialFrom%360+360)%360):lastRound.to;
   state.luckyWheelV1={...lastRound,from:initialFrom,to:animationTo,started,roundDuration,duration:roundDuration,batchAnimation:count===10,rounds,count,totalPrice:price,outcomes,ends:started+roundDuration,spins:(previous.spins||0)+count,summaryShown:false};
   // Payment and every reward are saved together before the animation.
   save();
  }catch(error){state=JSON.parse(old);toast('Çevirme tamamlanamadı. Elmasın harcanmadı.');console.error(error);return}
  render();
 };
 const oldHome=home;
 home=function(){const html=oldHome(),template=document.createElement('template');template.innerHTML=html;const grid=template.content.querySelector('.mmorpg-home-grid');if(!grid)return html;grid.insertAdjacentHTML('beforeend','<button type="button" class="mmorpg-home-tile valor-vertical-tile vwf-home-tile" onclick="go(\'Şans Çarkı\')" aria-label="Şans Çarkı"><span class="vwf-home-emblem" aria-hidden="true">✦</span><b>ŞANS ÇARKI</b></button>');return template.innerHTML};
 const oldRender=render;
 render=function(){oldRender.apply(this,arguments);if(page===NAME&&state.class&&valorAccountCanPlay()){document.body.classList.remove('valor-home','valor-market-page','valor-profile-page');document.getElementById('main').innerHTML=pageHtml();animate()}};
 // Expose pure reward geometry for automated checks without changing game state.
 window.valorWheelConfig={price:PRICE,batchPrice:899,batchCount:10,prizes:prizes.map(p=>({...p})),pick,sectorAngle:30};
 if(state.class&&valorAccountCanPlay()&&page==='Anasayfa')render();
})();
