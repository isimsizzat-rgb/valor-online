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
].map((z,i)=>({...z,gold:2500*(i+1),xp:30+i*15,stoneChance:.10+i*.01}));
let valorAdventureSelectedZone=0;
function valorAdventureChooseZone(i){
 if(!Number.isInteger(i)||!valorAdventureZones[i])return;
 valorAdventureSelectedZone=i;render();
}
function valorAdventurePage(){
 stageDailyReset();
 const zones=valorAdventureZones, chosen=zones[valorAdventureSelectedZone]||zones[0],unlocked=state.level>=chosen.min;
 const energy=Math.max(0,Number(state.adventureEnergy)||0),canEnter=unlocked&&energy>=10;
 const wins=state.adventureZoneWins||{};
 const cards=zones.map((z,i)=>{
  const open=state.level>=z.min;
  return '<button type="button" class="adventure-zone'+(valorAdventureSelectedZone===i?' is-selected':'')+(open?'':' is-locked')+'" style="--ad-accent:'+z.color+'" aria-pressed="'+(valorAdventureSelectedZone===i)+'" onclick="valorAdventureChooseZone('+i+')">'
   +'<span class="adventure-zone-icon" aria-hidden="true">'+z.icon+'</span><span class="adventure-zone-content"><strong>'+z.name+'</strong><small>Sv. '+z.min+'–'+z.max+'</small><em>'+(open?'⚔️ Açık':'🔒 Sv. '+z.min+' gerekli')+'</em></span>'
   +(wins[i]?'<span class="adventure-zone-wins">🏆 '+wins[i]+'</span>':'')+'</button>';
 }).join('');
 const history=(state.logs||[]).filter(x=>x.includes('Macera ·')).slice(0,4);
 return '<section class="adventure-v2"><header class="adventure-head"><div><span class="adventure-eyebrow">✦ KADİM KRALLIKLAR ✦</span><h1>🗺️ Macera Haritası</h1><p>10 bölgeyi keşfet, düşmanları yen ve ödüller kazan.</p></div>'
 +'<div class="adventure-energy"><span>⚡ MACERA ENERJİSİ</span><strong>'+energy+' <small>/ '+MAX_ADVENTURE_ENERGY+'</small></strong><div class="adventure-energy-track"><i style="width:'+Math.min(100,energy/MAX_ADVENTURE_ENERGY*100)+'%"></i></div></div></header>'
 +'<div class="adventure-zone-grid">'+cards+'</div>'
 +'<div class="adventure-detail" style="--ad-accent:'+chosen.color+'"><div class="adventure-detail-top"><span class="adventure-detail-icon" aria-hidden="true">'+chosen.icon+'</span><div><span class="adventure-eyebrow">SEÇİLİ BÖLGE · '+(valorAdventureSelectedZone+1)+'/10</span><h2>'+chosen.name+'</h2><p>Seviye '+chosen.min+'–'+chosen.max+'</p></div></div>'
 +'<div class="adventure-rewards"><span>⚡ Giriş <b>10 Enerji</b></span><span>🪙 Zafer <b>+'+money(chosen.gold)+' Altın</b></span><span>💎 Şans <b>Binek Taşı</b></span><span>✦ EXP <b>+'+chosen.xp+'</b></span></div>'
 +'<div class="adventure-gate '+(canEnter?'is-ready':'')+'">'+(!unlocked?'🔒 Bu bölgeye girmek için '+chosen.min+'. seviyeye ulaşmalısın.':energy<10?'⚡ Enerjin yetersiz: 10 enerji gerekli.':'⚔️ Bölgeye girmeye hazırsın!')+'</div>'
 +'<button type="button" class="adventure-enter" '+(canEnter?'':'disabled')+' onclick="valorAdventureFight('+valorAdventureSelectedZone+')">⚔️ MACERAYA GİR <small>−10 Enerji</small></button></div>'
 +(history.length?'<details class="adventure-log"><summary>Son Macera Savaşları</summary>'+history.map(x=>'<p>'+escapeAttr(x)+'</p>').join('')+'</details>':'')+'</section>';
}
function valorAdventureFight(i){
 if(page!=='Macera'||!state.class||!Number.isInteger(i))return;
 const zone=valorAdventureZones[i];if(!zone)return;
 stageDailyReset();
 if(state.level<zone.min)return toast('Bu alan için en az '+zone.min+'. seviye gerekli.');
 if((Number(state.adventureEnergy)||0)<10)return toast('Macera için en az 10 enerji gerekli.');
 state.adventureEnergy-=10;
 const heroPower=Math.max(1,combatPower()+state.level*14+40),enemyPower=65+zone.min*15+i*80;
 const win=Math.random()<Math.max(.25,Math.min(.94,.73+(heroPower-enemyPower)/650));
 let stone=0;
 if(win){
  state.gold+=zone.gold;earnXP(zone.xp);
  if(Math.random()<zone.stoneChance){
   const stack=(state.inventory||[]).find(it=>it.marketItemId==='mountStone');
   if(stack)stack.count=(Number(stack.count)||1)+1;
   else state.inventory.push({id:valorUniqueItemId(),slot:'Eşya',marketItemId:'mountStone',name:'Binek Taşı',count:1});
   stone=1;
  }
  state.adventureZoneWins=state.adventureZoneWins||{};
  state.adventureZoneWins[i]=(Number(state.adventureZoneWins[i])||0)+1;
 }
 const msg=(win?'🏆 Zafer':'💀 Yenilgi')+' — Macera · '+zone.name+': '+(win?'+'+money(zone.gold)+' Altın, +'+zone.xp+' EXP'+(stone?', +1 Binek Taşı':''):'Ödül yok')+' · −10 Enerji';
 state.logs=state.logs||[];state.logs.unshift(msg);state.logs=state.logs.slice(0,30);
 save();render();
 toast(win?'Zafer! +'+money(zone.gold)+' Altın'+(stone?' · +1 Binek Taşı':''):'Yenildin. 10 enerji harcandı.');
}
battle=valorAdventurePage;
