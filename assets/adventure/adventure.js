const valorAdventureThumbnails=["assets/img/e1331201c9a39d9e.webp","assets/img/8dc595b867946a59.webp","assets/img/08e48a54dfe06577.webp","assets/img/2eca89d618511991.webp","assets/img/653dbf2177b70e48.webp","assets/img/46d1b4d1264bb03d.webp","assets/img/0a9611bf4138a65f.webp","assets/img/d774289544d5b3fc.webp","assets/img/0d4bd89e83cc8e21.webp","assets/img/1ae2d27e98f5ec00.webp"];
/* Valor Online: Macera 10 bolge sistemi */
const valorAdventureZones=[
{name:'Kadim Patika',icon:'🌿',min:1,max:10,color:'#4e9f6c'},
{name:'Kızıl Koruluk',icon:'🌲',min:11,max:20,color:'#c16b49'},
{name:'Sisli Bataklık',icon:'🌫️',min:21,max:30,color:'#6c9f91'},
{name:'Unutulmuş Harabeler',icon:'🏛️',min:31,max:40,color:'#b39a70'},
{name:'Gölge Vadisi',icon:'🌘',min:41,max:50,color:'#8d77bd'},
{name:'Fırtına Geçidi',icon:'⛈️',min:51,max:60,color:'#638fba'},
{name:'Buzul Zirvesi',icon:'❄️',min:61,max:70,color:'#74bad2'},
{name:'Alev Çorakları',icon:'🌋',min:71,max:80,color:'#d0784f'},
{name:'Lanetli Uçurum',icon:'🕳️',min:81,max:90,color:'#a060aa'},
{name:'Ejderha Tahtı',icon:'🐉',min:91,max:100,color:'#d1a05c'}
].map((z,i)=>({...z,thumbnail:valorAdventureThumbnails[i],image:'assets/adventure/region-'+(i+1)+'.webp?v=20261023-visible',gold:2500*(i+1),xp:(30+i*15)*(typeof VALOR_XP_REWARD_SCALE==='number'?VALOR_XP_REWARD_SCALE:1),stoneChance:.10+i*.01}));

/* Her bolge yatay tek satir; sagdaki oka dokununca onay acilir. */
function valorAdventurePage(){
 stageDailyReset();
 const energy=Math.max(0,Number(state.adventureEnergy)||0);
 const wins=state.adventureZoneWins||{};
 const rows=valorAdventureZones.map((zone,i)=>{
  const locked=state.level<zone.min;
  return '<article class="adventure-zone adventure-zone-banner '+(locked?'is-locked':'')+'" style="--ad-accent:'+zone.color+';background-image:url('+zone.thumbnail+')" aria-label="'+zone.name+'">'
   +'<img class="adventure-zone-art" src="'+zone.image+'" alt="" loading="eager" decoding="async" onerror="this.hidden=true">'
   +'<span class="adventure-zone-shade" aria-hidden="true"></span>'
   +'<div class="adventure-zone-copy"><span class="adventure-zone-name">'+zone.name+'</span>'
   +'<span class="adventure-zone-level">Sv. '+zone.min+'–'+zone.max+(locked?' · 🔒 Kilitli':'')+'</span></div>'
   +(wins[i]?'<span class="adventure-zone-wins">🏆 '+wins[i]+'</span>':'')
   +'<button type="button" class="adventure-zone-arrow" onclick="valorAdventureConfirm('+i+')" ontouchend="event.stopPropagation()" aria-label="'+zone.name+' macerasını aç">❯</button>'
   +'</article>';
 }).join('');
 return '<section class="adventure-v2">'
 +'<header class="adventure-head"><div><span class="adventure-eyebrow">✦ KADİM KRALLIKLAR ✦</span><h1>🗺️ Macera</h1><p>Bölgeyi seç, savaş ve ödül kazan. Her giriş 10 enerji.</p></div>'
 +'<div class="adventure-energy"><span>⚡ ENERJİ</span><strong>'+energy+' <small>/ '+MAX_ADVENTURE_ENERGY+'</small></strong><div class="adventure-energy-track"><i style="width:'+Math.min(100,energy/MAX_ADVENTURE_ENERGY*100)+'%"></i></div></div></header>'
 +'<div class="adventure-zone-grid">'+rows+'</div>'
 +'</section>';
}
function valorAdventureDismiss(){
 const modal=document.getElementById('valor-adventure-dialog');
 if(modal)modal.remove();
}
function valorAdventureDialog(inner){
 valorAdventureDismiss();
 const modal=document.createElement('div');
 modal.id='valor-adventure-dialog';
 modal.className='adventure-modal-backdrop';
 modal.setAttribute('role','presentation');
 modal.innerHTML='<section class="adventure-modal" role="dialog" aria-modal="true" aria-labelledby="adventure-dialog-heading">'+inner+'</section>';
 document.body.appendChild(modal);
 modal.addEventListener('click',e=>{if(e.target===modal)valorAdventureDismiss()});
 modal.addEventListener('touchend',e=>e.stopPropagation(),{passive:true});
 const first=modal.querySelector('button');if(first)first.focus();
}
function valorAdventureConfirm(i){
 if(page!=='Macera'||!state.class||!Number.isInteger(i))return;
 const zone=valorAdventureZones[i];if(!zone)return;
 stageDailyReset();
 if(state.level<zone.min||(Number(state.adventureEnergy)||0)<10){
  valorAdventureDialog('<img class="adventure-modal-art" src="'+zone.image+'" alt="'+zone.name+'"><h2 id="adventure-dialog-heading">'+zone.name+'</h2><p>'+(state.level<zone.min?'🔒 Bu bölge için '+zone.min+'. seviyeye ulaşmalısın.':'⚡ Maceraya girmek için 10 enerji gerekiyor.')+'</p><button type="button" class="adventure-result-close" onclick="valorAdventureDismiss()">Tamam</button>');
  return;
 }
 valorAdventureDialog(
  '<img class="adventure-modal-art" src="'+zone.image+'" alt="'+zone.name+'">'
  +'<h2 id="adventure-dialog-heading">'+zone.name+'</h2>'
  +'<p><b>Sv. '+zone.min+'–'+zone.max+'</b> bölgesine girilsin mi?</p>'
  +'<p class="adventure-modal-cost">⚡ 10 enerji harcanacak.</p>'
  +'<div class="adventure-modal-actions">'
  +'<button type="button" class="adventure-no" onclick="valorAdventureDismiss()">Hayır</button>'
  +'<button type="button" class="adventure-yes" onclick="valorAdventureAccept('+i+')">Evet</button>'
  +'</div>'
 );
}
function valorAdventureAccept(i){
 if(!document.getElementById('valor-adventure-dialog'))return;
 valorAdventureDismiss();
 valorAdventureFight(i);
}
function valorAdventureShowResult(zone,won,gold,xp,stone){
 const reward=won?
   '<div class="adventure-result-rewards"><div><span>🪙 Altın</span><strong>+'+money(gold)+'</strong></div>'
   +'<div><span>✦ EXP</span><strong>+'+money(xp)+'</strong></div>'
   +(stone?'<div><span>💎 Binek Taşı</span><strong>+1</strong></div>':'')
   +'</div>'
   +(stone?'<p class="adventure-stone-note">Şansına Binek Taşı kazandın!</p>':''):
   '<p class="adventure-result-loss">Bu savaşta ödül kazanamadın.</p>';
 valorAdventureDialog(
  '<img class="adventure-modal-art" src="'+zone.image+'" alt="'+zone.name+'">'
  +'<span class="adventure-result-emblem">'+(won?'🏆':'💀')+'</span>'
  +'<h2 id="adventure-dialog-heading" class="'+(won?'adventure-victory':'adventure-defeat')+'">'+(won?'ZAFER':'YENİLGİ')+'</h2>'
  +'<p>'+zone.icon+' '+zone.name+'</p>'
  +reward
  +'<p class="adventure-modal-cost">⚡ 10 enerji harcandı.</p>'
  +'<button type="button" class="adventure-result-close" onclick="valorAdventureDismiss()">Tamam</button>'
 );
}
function valorAdventureFight(i){
 if(page!=='Macera'||!state.class||!Number.isInteger(i))return;
 const zone=valorAdventureZones[i];if(!zone)return;
 stageDailyReset();
 if(state.level<zone.min)return toast('Bu alan için en az '+zone.min+'. seviye gerekli.');
 if((Number(state.adventureEnergy)||0)<10)return toast('Macera için en az 10 enerji gerekli.');
 state.adventureEnergy-=10;
 if(typeof valorQuestRecord==='function')valorQuestRecord('energy',10);
 const heroPower=Math.max(1,combatPower()+state.level*14+40);
 const enemyPower=valorAstrologyEnemyThreat(65+zone.min*15+i*80);
 const won=Math.random()<Math.max(.25,Math.min(.94,.73+(heroPower-enemyPower)/650));
 let stone=0;
 if(won){
  state.gold+=zone.gold;
  earnXP(zone.xp);
  if(Math.random()<zone.stoneChance){
   const stack=(state.inventory||[]).find(it=>it.marketItemId==='mountStone');
   if(stack)stack.count=(Number(stack.count)||1)+1;
   else state.inventory.push({id:valorUniqueItemId(),slot:'Eşya',marketItemId:'mountStone',name:'Binek Taşı',count:1});
   stone=1;
  }
  state.adventureZoneWins=state.adventureZoneWins||{};
  state.adventureZoneWins[i]=(Number(state.adventureZoneWins[i])||0)+1;
 }
 const msg=(won?'🏆 Zafer':'💀 Yenilgi')+' — Macera · '+zone.name+': '+(won?'+'+money(zone.gold)+' Altın, +'+money(window.valorLastXpGain||zone.xp)+' EXP'+(stone?', +1 Binek Taşı':''):'Ödül yok')+' · −10 Enerji';
 state.logs=state.logs||[];
 state.logs.unshift(msg);
 state.logs=state.logs.slice(0,30);
 save();
 render();
 valorAdventureShowResult(zone,won,won?zone.gold:0,won?(window.valorLastXpGain||zone.xp):0,stone);
}
battle=valorAdventurePage;
