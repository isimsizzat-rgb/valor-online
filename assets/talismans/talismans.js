/* Tılsımlar: 8 types × 4 colours, Sv.1–10, up to four equipped (slots open at Sv.25/50/75/100), any mix of types.
   Rolled values are the Sv.10 value of each stat; Sv.N gives N/10 of it. A colour's total budget is
   split over the talisman's stats (2, 3 or 4), so two-stat talismans give more per stat.
   Drops: every stage win has a 2% chance to drop a Sv.1–3 talisman. Two talismans of the same level
   (any type) merge into a random Sv.N+1 talisman; on failure one burns and the other turns into a
   different random talisman of the same level. Şans Tüyü does not apply. */
(function(){
 'use strict';
 const PAGE='Tılsım',SLOT='Tılsım',SLOT_LEVELS=[25,50,75,100],DROP_CHANCE=.02;
 const STAT={atk:['Saldırı','Saldırı'],def:['Savunma','Defans'],matk:['Sihir','Sihirli Saldırı'],mdef:['Sihir Savunma','Sihirli Defans'],hp:['Can','Can']};
 const TYPES=[
  {id:'X',name:'Demir Pençe Tılsımı',rune:'claw',stats:['atk','def']},
  {id:'Y',name:'Kızıl Muhafız Tılsımı',rune:'shield',stats:['atk','mdef']},
  {id:'Z',name:'Ay Kâhini Tılsımı',rune:'moon',stats:['matk','mdef']},
  {id:'T',name:'Fırtına Mührü Tılsımı',rune:'bolt',stats:['matk','def']},
  {id:'K',name:'Ejder Yüreği Tılsımı',rune:'dragon',stats:['atk','def','mdef','hp']},
  {id:'L',name:'Yıldız Kalbi Tılsımı',rune:'star',stats:['matk','def','mdef','hp']},
  {id:'P',name:'Kurt Ruhu Tılsımı',rune:'wolf',stats:['atk','def','hp']},
  {id:'O',name:'Anka Gözü Tılsımı',rune:'eye',stats:['matk','mdef','hp']}
 ];
 // Per colour: [min,max] of one stat on a two-stat talisman at Sv.10. Max total = 2 × max.
 // Colours drop with equal chance (no rarity weighting).
 const COLORS=[
  {id:0,name:'Yeşil',hex:'#3fae5a',deep:'#1d6b31',two:[3500,5000],weight:1},
  {id:1,name:'Sarı',hex:'#e6b93a',deep:'#9a6f12',two:[5000,7500],weight:1},
  {id:2,name:'Mor',hex:'#9b5de5',deep:'#5a2d9a',two:[7500,10000],weight:1},
  {id:3,name:'Kırmızı',hex:'#d63c3c',deep:'#8a1a1a',two:[10000,15000],weight:1}
 ];
 const MERGE_CHANCE={1:90,2:85,3:70,4:55,5:40,6:25,7:10,8:10,9:10};
 const rnd=n=>Math.floor(Math.random()*n);
 function weighted(list,key='weight'){let t=list.reduce((s,x)=>s+x[key],0),r=Math.random()*t;for(const x of list){if((r-=x[key])<0)return x}return list[list.length-1]}
 function range(color,n){const max=Math.round(color.two[1]*2/n),min=n===2?color.two[0]:Math.round(max*(n===3?.75:.8));return [min,max]}
 function roll(type,color){const n=type.stats.length,[a,b]=range(color,n),out={};for(const s of type.stats)out[s]=a+rnd(b-a+1);return out}
 function make(level,typeId,colorId){
  const type=typeId?TYPES.find(t=>t.id===typeId):TYPES[rnd(TYPES.length)],color=colorId!=null?COLORS[colorId]:weighted(COLORS);
  return {id:valorUniqueItemId(),slot:SLOT,talismanType:type.id,talismanColor:color.id,talismanLevel:Math.max(1,Math.min(10,level)),talismanRolls:roll(type,color),name:type.name,cls:state.class,level:1,plus:0,epic:false};
 }
 const typeOf=it=>TYPES.find(t=>t.id===it?.talismanType),colorOf=it=>COLORS[it?.talismanColor]||COLORS[0],lvl=it=>Math.max(1,Math.min(10,Number(it?.talismanLevel)||1));
 const isTalisman=it=>!!it&&it.slot===SLOT&&!!typeOf(it);
 function statsOf(it){const out={},L=lvl(it);for(const [k,v] of Object.entries(it.talismanRolls||{}))if(STAT[k])out[k]=Math.round(v*L/10);return out}
 function all(){return (state.inventory||[]).filter(isTalisman)}
 function slots(){if(!Array.isArray(state.talismanSlots))state.talismanSlots=[null,null,null,null];const ids=new Set(all().map(it=>String(it.id)));state.talismanSlots=state.talismanSlots.slice(0,4).map((id,i)=>id!=null&&ids.has(String(id))&&state.level>=SLOT_LEVELS[i]?String(id):null);while(state.talismanSlots.length<4)state.talismanSlots.push(null);return state.talismanSlots}
 const find=id=>all().find(it=>String(it.id)===String(id));
 const equippedIn=it=>slots().indexOf(String(it.id));
 // ---------- Art: an amulet with a coloured gem and a rune per type ----------
 const RUNES={claw:'M-9 -10l4 18M0 -12v22M9 -10l-4 18',shield:'M0 -12l10 4v6c0 7-5 11-10 13-5-2-10-6-10-13v-6z',moon:'M4 -11a12 12 0 1 0 0 22a9 9 0 1 1 0-22z',bolt:'M3 -13l-10 14h7l-3 12 10-15h-7z',dragon:'M-10 6c4-12 16-14 20-4-6-3-9 0-10 4 5-1 8 2 7 6-5-4-12-4-17-6z',star:'M0 -12l3.5 7.5 8 1-6 5.5 1.5 8L0 6l-7 4 1.5-8-6-5.5 8-1z',wolf:'M-10 10l3-16 5 6h4l5-6 3 16-10 4z',eye:'M-12 0c6-9 18-9 24 0-6 9-18 9-24 0zM0 -4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z'};
 const artCache={};
 function art(it){
  const t=typeOf(it)||TYPES[0],c=colorOf(it),key=t.id+c.id;if(artCache[key])return artCache[key];
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".35" stop-color="'+c.hex+'"/><stop offset="1" stop-color="'+c.deep+'"/></radialGradient><linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".5" stop-color="#d9a648"/><stop offset="1" stop-color="#7a4c14"/></linearGradient><radialGradient id="h" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="'+c.hex+'" stop-opacity=".5"/><stop offset="1" stop-color="'+c.hex+'" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="55" r="46" fill="url(#h)"/><path d="M42 6h16l-3 9h-10z" fill="url(#r)" stroke="#5c3a10" stroke-width="1.5"/><circle cx="50" cy="56" r="36" fill="url(#r)" stroke="#5c3a10" stroke-width="2"/><circle cx="50" cy="56" r="29" fill="#1b130c"/>'+[0,45,90,135,180,225,270,315].map(a=>'<circle cx="'+(50+32.5*Math.cos(a*Math.PI/180)).toFixed(1)+'" cy="'+(56+32.5*Math.sin(a*Math.PI/180)).toFixed(1)+'" r="2.2" fill="#fff3cf"/>').join('')+'<circle cx="50" cy="56" r="25" fill="url(#g)" stroke="'+c.deep+'" stroke-width="1.5"/><g transform="translate(50 56)" fill="none" stroke="#fffaf0" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".92"><path d="'+RUNES[t.rune]+'"/></g><ellipse cx="42" cy="44" rx="8" ry="4" fill="#fff" opacity=".35" transform="rotate(-30 42 44)"/></svg>';
  return artCache[key]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 }
 window.valorTalismanArt=art;
 // ---------- Stats into every power / combat calculation ----------
 function bonus(){const out={};for(const id of slots()){const it=id&&find(id);if(!it)continue;for(const [k,v] of Object.entries(statsOf(it))){const key=STAT[k][0];out[key]=(out[key]||0)+v}}return out}
 window.valorTalismanBonus=bonus;
 const prevBonuses=equipmentBonuses;
 equipmentBonuses=function(){const out=prevBonuses.apply(this,arguments);for(const [k,v] of Object.entries(bonus()))out[k]=(Number(out[k])||0)+v;return out};
 // ---------- Bag integration ----------
 const prevIcon=equipmentIcon;equipmentIcon=function(it){return isTalisman(it)?art(it):prevIcon.apply(this,arguments)};
 const prevCanSelect=bagCanSelect;bagCanSelect=function(it){return isTalisman(it)?false:prevCanSelect.apply(this,arguments)};
 const prevBag=bag;
 bag=function(){
  const tpl=document.createElement('template');tpl.innerHTML=prevBag.apply(this,arguments);
  tpl.content.querySelectorAll('.bag-slot').forEach(el=>{const m=el.getAttribute('onclick')?.match(/selectItem\((\d+)\)/),it=m&&state.inventory[Number(m[1])];if(!isTalisman(it))return;el.classList.remove('other-class');el.classList.add('vt-bag-talisman');el.style.setProperty('--vt-color',colorOf(it).hex);const plus=el.querySelector('.slot-plus');if(plus){plus.className='mount-token-tag';plus.textContent='Sv. '+lvl(it)}if(equippedIn(it)>=0&&!el.querySelector('.equipped-mark'))el.insertAdjacentHTML('afterbegin','<span class="equipped-mark">TAKILI</span>');el.title=it.name+' · '+colorOf(it).name+' · Sv. '+lvl(it)});
  return tpl.innerHTML;
 };
 const prevPopup=showBagItemPopup;
 showBagItemPopup=function(n){const it=state.inventory[n];if(isTalisman(it))return valorTalismanShow(it.id);return prevPopup.apply(this,arguments)};
 // ---------- Drops from stage wins ----------
 const prevFinish=stageFinish;
 stageFinish=function(){
  const run=stageRun,before=run?.step;const r=prevFinish.apply(this,arguments);
  if(run&&before===13&&run.step===14&&Math.random()<DROP_CHANCE){const level=weighted([{l:1,weight:60},{l:2,weight:30},{l:3,weight:10}]).l,it=make(level);state.inventory.push(it);if(run.reward)run.reward.talisman=it.name+' · Sv. '+level;save();render();setTimeout(()=>valorTalismanShow(it.id,'Sahneden tılsım düştü!'),350)}
  return r;
 };
 // ---------- UI ----------
 let tab='equip',pick=['',''],pendingMerge=null;
 const esc=v=>escapeAttr(String(v??''));
 function statLines(it){return Object.entries(statsOf(it)).map(([k,v])=>'<span><small>'+STAT[k][1]+'</small><b>+'+money(v)+'</b></span>').join('')}
 function rollLines(it){const t=typeOf(it),[a,b]=range(colorOf(it),t.stats.length);return Object.entries(it.talismanRolls).map(([k,v])=>'<span><small>'+STAT[k][1]+' (Sv.10)</small><b>'+money(v)+'</b><i>'+money(a)+'–'+money(b)+'</i></span>').join('')}
 function card(it,extra=''){const c=colorOf(it),slot=equippedIn(it);return '<button type="button" class="vt-card" style="--vt-color:'+c.hex+'" onclick="valorTalismanShow(\''+esc(it.id)+'\')"><img src="'+art(it)+'" alt=""><span class="vt-card-copy"><b>'+esc(it.name)+'</b><small><i class="vt-dot"></i>'+c.name+' · Sv. '+lvl(it)+(slot>=0?' · Takılı':'')+'</small><span class="vt-card-stats">'+statLines(it)+'</span></span>'+extra+'</button>'}
 function slotsHtml(){return '<div class="vt-slots">'+slots().map((id,i)=>{const open=state.level>=SLOT_LEVELS[i],it=id&&find(id);if(!open)return '<div class="vt-slot vt-slot-locked"><span>🔒</span><small>Sv. '+SLOT_LEVELS[i]+'</small></div>';if(!it)return '<div class="vt-slot vt-slot-empty"><span>+</span><small>Boş yuva</small></div>';return '<button type="button" class="vt-slot" style="--vt-color:'+colorOf(it).hex+'" onclick="valorTalismanShow(\''+esc(it.id)+'\')"><img src="'+art(it)+'" alt=""><small>Sv. '+lvl(it)+'</small></button>'}).join('')+'</div>'}
 function totalsHtml(){const b=bonus(),keys=Object.keys(b);if(!keys.length)return '<p class="vt-muted">Henüz takılı tılsım yok.</p>';const label={Saldırı:'Saldırı',Savunma:'Defans',Sihir:'Sihirli Saldırı','Sihir Savunma':'Sihirli Defans',Can:'Can'};return '<div class="vt-totals">'+keys.map(k=>'<span><small>'+label[k]+'</small><b>+'+money(b[k])+'</b></span>').join('')+'</div>'}
 function sorted(){return all().sort((a,b)=>(equippedIn(b)>=0)-(equippedIn(a)>=0)||lvl(b)-lvl(a)||b.talismanColor-a.talismanColor)}
 function equipTab(){const list=sorted();return slotsHtml()+'<h3 class="vt-h">Toplam bonus</h3>'+totalsHtml()+'<h3 class="vt-h">Tılsımların <small>'+list.length+'</small></h3>'+(list.length?'<div class="vt-list">'+list.map(it=>card(it)).join('')+'</div>':'<p class="vt-muted">Henüz tılsımın yok. Sahneleri kazandıkça %2 şansla Sv.1–3 tılsım düşer.</p>')}
 // Talisman fusion is always a gamble: no Şans Tüyü, no guaranteed success.
 function featherPlan(level){const base=MERGE_CHANCE[level]??10;return {base,use:0,chance:base}}
 // A small diamond fee per attempt: Sv.N → N+1 costs 10 × N (10 … 90), paid whether it succeeds or not.
 function mergeCost(level){return 10*level}
 const diamonds=()=>Math.max(0,Number(state.diamonds)||0);
 function mergeTab(){
  const list=sorted().filter(it=>equippedIn(it)<0),a=find(pick[0]),b=find(pick[1]);
  if(a&&equippedIn(a)>=0)pick[0]='';if(b&&equippedIn(b)>=0)pick[1]='';
  const A=find(pick[0]),B=find(pick[1]),valid=A&&B&&A.id!==B.id&&lvl(A)===lvl(B)&&lvl(A)<10,plan=valid?featherPlan(lvl(A)):null;
  const slotBox=(i,it)=>'<div class="vt-pick" '+(it?'style="--vt-color:'+colorOf(it).hex+'"':'')+'>'+(it?'<img src="'+art(it)+'" alt=""><b>'+esc(it.name)+'</b><small>'+colorOf(it).name+' · Sv. '+lvl(it)+'</small><button type="button" onclick="valorTalismanPick('+i+',\'\')">Kaldır</button>':'<span class="vt-pick-empty">'+(i+1)+'. tılsım</span><small>Aşağıdan seç</small>')+'</div>';
  const choices=list.filter(it=>!A||!B?(!(A||B)||(String(it.id)!==String((A||B).id)&&lvl(it)===lvl(A||B))):false);
  return '<p class="vt-muted">Aynı seviyeden herhangi iki tılsım birleşir. Başarılı olursa <b>rastgele bir tılsım</b> bir üst seviyeye çıkar (tür ve renk yeniden belirlenir). Başarısız olursa biri yanar, diğeri aynı seviyede <b>farklı bir tılsıma</b> dönüşür. Takılı tılsımlar birleştirilemez.</p>'
   +'<div class="vt-picks">'+slotBox(0,A)+'<span class="vt-plus">+</span>'+slotBox(1,B)+'</div>'
   +(valid?'<div class="vt-merge-box"><p>Sonuç: <b>Rastgele tılsım · Sv. '+(lvl(A)+1)+'</b></p><p class="vt-chance">Başarı şansı: <b>%'+plan.chance+'</b> · Bedel: <b>'+mergeCost(lvl(A))+' 💎</b></p>'+'<button type="button" class="vt-merge-go" '+(diamonds()<mergeCost(lvl(A))?'disabled':'')+' onclick="valorTalismanAskMerge()">'+(diamonds()<mergeCost(lvl(A))?'Elmasın yetersiz · '+mergeCost(lvl(A))+' 💎':'Sv. '+(lvl(A)+1)+' için Birleştir · '+mergeCost(lvl(A))+' 💎')+'</button></div>':'')
   +'<h3 class="vt-h">Seçilebilir tılsımlar</h3>'+(choices.length&&!(A&&B)?'<div class="vt-list">'+choices.map(it=>card(it,'<span class="vt-card-pick" onclick="event.stopPropagation();valorTalismanPick(-1,\''+esc(it.id)+'\')">Seç</span>')).join('')+'</div>':'<p class="vt-muted">'+(A&&B?'İki tılsım seçildi.':'Birleştirilebilecek tılsım yok.')+'</p>');
 }
 function pageHtml(){return '<section class="vt-page"><header class="vt-heading"><small>KADİM MÜHÜRLER</small><h1>Tılsımlar</h1><p>Dört yuvaya istediğin tılsımları tak; renk ve seviye arttıkça güç artar.</p></header><div class="vt-tabs" role="tablist"><button type="button" role="tab" aria-selected="'+(tab==='equip')+'" onclick="valorTalismanTab(\'equip\')">Kuşan</button><button type="button" role="tab" aria-selected="'+(tab==='merge')+'" onclick="valorTalismanTab(\'merge\')">Birleştir</button></div>'+(tab==='equip'?equipTab():mergeTab())+'</section>'}
 window.valorTalismanTab=function(t){tab=t==='merge'?'merge':'equip';render()};
 window.valorTalismanPick=function(i,id){if(i===-1){i=pick[0]?1:0;if(pick[0]&&pick[1])return}pick[i]=id?String(id):'';tab='merge';render()};
 function dialog(html){closeBagPopup();const o=document.createElement('div');o.id='valor-bag-popup';o.className='valor-item-overlay';o.innerHTML='<section class="valor-item-dialog vt-dialog" role="dialog" aria-modal="true" aria-label="Tılsım"><button type="button" class="valor-item-close" onclick="closeBagPopup()" aria-label="Kapat">×</button>'+html+'</section>';o.addEventListener('click',e=>{if(e.target===o)closeBagPopup()});document.body.appendChild(o)}
 window.valorTalismanShow=function(id,title){
  const it=find(id);if(!it)return;const c=colorOf(it),slot=equippedIn(it),open=SLOT_LEVELS.filter(l=>state.level>=l).length;
  const actions=slot>=0?'<button type="button" onclick="valorTalismanUnequip(\''+esc(it.id)+'\')">Çıkar</button>':(open?'<button type="button" onclick="valorTalismanEquip(\''+esc(it.id)+'\')">Kuşan</button>':'<button type="button" disabled>İlk yuva Sv. 25’te açılır</button>')+'<button type="button" onclick="closeBagPopup();valorTalismanPick(-1,\''+esc(it.id)+'\');go(\''+PAGE+'\')">Birleştirmeye Seç</button>';
  dialog((title?'<div class="vt-drop-title">'+title+'</div>':'')+'<img class="vt-dialog-art" src="'+art(it)+'" alt="" style="--vt-color:'+c.hex+'"><small class="vt-kicker" style="color:'+c.hex+'">'+c.name.toLocaleUpperCase('tr-TR')+' · SV. '+lvl(it)+' / 10</small><h3>'+esc(it.name)+'</h3><div class="vt-dialog-stats">'+statLines(it)+'</div><details class="vt-rolls"><summary>Sv.10 değerleri</summary><div>'+rollLines(it)+'</div></details><div class="vt-dialog-actions">'+actions+'</div>'+(page!==PAGE?'<button type="button" class="vt-open-page" onclick="closeBagPopup();go(\''+PAGE+'\')">Tılsım ekranına git</button>':''));
 };
 window.valorTalismanEquip=function(id){
  const it=find(id);if(!it)return;const s=slots();if(s.includes(String(it.id)))return;
  const i=s.findIndex((sid,k)=>!sid&&state.level>=SLOT_LEVELS[k]);if(i<0)return toast(SLOT_LEVELS.filter(l=>state.level>=l).length?'Bütün açık yuvalar dolu · önce birini çıkar':'İlk tılsım yuvası Sv. 25’te açılır');
  s[i]=String(it.id);pick=pick.map(p=>p===String(it.id)?'':p);save();closeBagPopup();render();toast(it.name+' takıldı');
 };
 window.valorTalismanUnequip=function(id){const s=slots(),i=s.indexOf(String(id));if(i<0)return;s[i]=null;save();closeBagPopup();render();toast('Tılsım çıkarıldı')};
 window.valorTalismanAskMerge=function(){
  const A=find(pick[0]),B=find(pick[1]);if(!A||!B||A.id===B.id||lvl(A)!==lvl(B)||lvl(A)>=10||equippedIn(A)>=0||equippedIn(B)>=0)return toast('Aynı seviyede iki takılı olmayan tılsım seç');
  if(diamonds()<mergeCost(lvl(A)))return toast('Elmasın yetersiz · '+mergeCost(lvl(A))+' 💎 gerekiyor');
  const plan=featherPlan(lvl(A));pendingMerge={a:String(A.id),b:String(B.id),level:lvl(A)};
  dialog('<small class="vt-kicker">TILSIM BİRLEŞTİR</small><h3>Sv. '+(lvl(A)+1)+' Tılsım</h3><div class="vt-confirm-pair"><img src="'+art(A)+'" alt=""><span>+</span><img src="'+art(B)+'" alt=""></div><p>Başarı şansı: <b>%'+plan.chance+'</b><br>Bedel: <b>'+mergeCost(lvl(A))+' 💎</b> · Bakiyen: '+money(diamonds())+'</p>'+(plan.chance<100?'<p class="vt-muted">Başarısız olursa biri yanar, diğeri Sv. '+lvl(A)+' farklı bir tılsıma dönüşür.</p>':'')+'<div class="vt-dialog-actions"><button type="button" onclick="closeBagPopup()">Vazgeç</button><button type="button" onclick="valorTalismanMerge()">Birleştir</button></div>');
 };
 window.valorTalismanMerge=function(){
  const p=pendingMerge;pendingMerge=null;if(!p||!document.getElementById('valor-bag-popup'))return;closeBagPopup();
  const A=find(p.a),B=find(p.b);if(!A||!B||lvl(A)!==p.level||lvl(B)!==p.level||equippedIn(A)>=0||equippedIn(B)>=0)return toast('Tılsımlar değişti · yeniden seç');
  const cost=mergeCost(p.level);if(diamonds()<cost)return toast('Elmasın yetersiz · '+cost+' 💎 gerekiyor');state.diamonds=diamonds()-cost;
  const plan=featherPlan(p.level),ok=Math.random()*100<plan.chance;
  state.inventory=state.inventory.filter(it=>String(it.id)!==p.a&&String(it.id)!==p.b);
  let result;
  if(ok){result=make(p.level+1)}else{const others=TYPES.filter(x=>x.id!==A.talismanType&&x.id!==B.talismanType),pool=others.length?others:TYPES.filter(x=>x.id!==A.talismanType);result=make(p.level,pool[rnd(pool.length)].id)}
  state.inventory.push(result);pick=ok?['','']:[String(result.id),''];save();render();
  const c=colorOf(result);
  dialog('<div class="vt-drop-title '+(ok?'vt-ok':'vt-fail')+'">'+(ok?'Birleştirme Başarılı!':'Birleştirme Başarısız')+'</div><img class="vt-dialog-art" src="'+art(result)+'" alt="" style="--vt-color:'+c.hex+'"><small class="vt-kicker" style="color:'+c.hex+'">'+c.name.toLocaleUpperCase('tr-TR')+' · SV. '+lvl(result)+'</small><h3>'+esc(result.name)+'</h3><div class="vt-dialog-stats">'+statLines(result)+'</div><p class="vt-muted">'+(ok?'İki tılsım birleşti.':'Şans %'+plan.chance+' idi. Bir tılsım yandı, diğeri bu tılsıma dönüştü.')+' −'+cost+' 💎'+'</p><div class="vt-dialog-actions"><button type="button" onclick="closeBagPopup()">Tamam</button></div>');
 };
 // ---------- Page ----------
 const prevRender=render;
 render=function(){const r=prevRender.apply(this,arguments);if(page===PAGE&&state.class&&(typeof valorAccountCanPlay!=='function'||valorAccountCanPlay())){const m=document.getElementById('main');if(m){slots();m.innerHTML=pageHtml()}}return r};
 window.valorTalismanMake=make;window.valorTalismanTypes=TYPES;window.valorTalismanColors=COLORS;window.valorTalismanRange=range;
})();
