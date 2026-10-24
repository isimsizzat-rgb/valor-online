/* Farm progression belongs to each character's valorSystems save. */
const valorFarmRequirements=[10,40,75,115,160,210,265,325,390,460,535,615,700,790,885];
const valorFarmSeeds={
 quick:{name:'Filiz Tohumu',hours:1,yield:1},
 fertile:{name:'Bereket Tohumu',hours:3,yield:3},
 abundant:{name:'Bolluk Tohumu',hours:6,yield:6}
};
function valorFarmProgress(){
 const d=vsData();let changed=false;
 if(!d.farmV2){d.farmV2={harvests:0};changed=true}
 if(!Array.isArray(d.plots)){d.plots=[];changed=true}
 while(d.plots.length<15){d.plots.push(0);changed=true}
 if(!Array.isArray(d.plotSeeds)){d.plotSeeds=[];changed=true}
 if(!Array.isArray(d.plotCrops)){d.plotCrops=[];changed=true}
 if(changed)save();
 const total=Math.max(0,Math.floor(Number(d.farmV2.harvests)||0));
 let level=0,remaining=total;
 while(level<15&&remaining>=valorFarmRequirements[level]){remaining-=valorFarmRequirements[level];level++}
 return {d,total,level,progress:remaining,needed:valorFarmRequirements[level]||0,open:Math.max(3,level)};
}
function valorFarmCrop(i){
 const d=vsData(),crop=d.plotCrops?.[i],seed=crop&&valorFarmSeeds[crop.seed];
 if(seed&&['gold','crystal'].includes(crop.resource))return {...seed,resource:crop.resource,duration:seed.hours*3600000};
 // Existing planted crops retain their original ten-minute timer and reward.
 return {name:'Önceki Ekim',hours:1/6,yield:1,resource:d.plotSeeds?.[i]==='gold'?'gold':'crystal',duration:600000};
}
function valorFarmCanAccess(i,p){return Number.isInteger(i)&&i>=0&&i<15&&(i<p.open||!!p.d.plots[i])}
valorFarmSeedType=function(i){return valorFarmCrop(i).resource};
valorFarmTime=function(ms){const seconds=Math.ceil(Math.max(0,ms)/1000),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0')};
function valorFarmStatus(g){return !g.stage?'Ekim bekliyor':g.ready?'Hasada hazır':valorFarmTime(g.remaining)+' kaldı'}
function valorFarmReward(c){return c.resource==='gold'?money(c.yield*1000)+' Altın':c.yield+' Kristal'}
valorFarmUpdate=function(){
 if(!state.class||page!=='Çiftlik'||document.hidden)return;
 const p=valorFarmProgress(),now=Date.now();
 document.querySelectorAll('.farm-growth-plot[data-plot]').forEach(card=>{
  const i=Number(card.dataset.plot),g=valorFarmGrowth(p.d.plots[i],now,valorFarmCrop(i).duration),img=card.querySelector('img');
  card.classList.toggle('farm-ready',g.ready);
  if(img){const stage=Math.max(1,g.stage);if(img.dataset.stage!==String(stage)){img.src=valorFarmSeedArt(i,stage);img.dataset.stage=String(stage)}img.classList.toggle('farm-unplanted',!g.stage);img.alt=g.ready?'Hasada hazır ürün':g.stage?'Büyüyen ürün':'Boş arazi'}
  const label=card.querySelector('.farm-growth-status'),button=card.querySelector('button'),bar=card.querySelector('.farm-growth-progress i');
  if(label)label.textContent=valorFarmStatus(g);
  if(button){button.disabled=!!g.stage&&!g.ready;button.textContent=!g.stage?'Tohum Ek':g.ready?'Hasat Et':'Büyüyor'}
  if(bar)bar.style.width=g.progress*100+'%';
 });
};
valorOpenSeedPicker=function(i){
 const p=valorFarmProgress();if(!valorFarmCanAccess(i,p)||i>=p.open||p.d.plots[i])return;
 valorCloseSeedPicker();const overlay=document.createElement('div');overlay.id='valor-farm-seed-picker';overlay.className='valor-item-overlay';
 overlay.innerHTML=`<section class="valor-item-dialog farm-seed-dialog vf-seed-dialog" role="dialog" aria-modal="true" aria-labelledby="farm-seed-title"><h3 id="farm-seed-title">Tohumunu seç</h3><p>Arazi ${i+1} · Ücretsiz ekim · Her hasat +1 çiftlik deneyimi</p><label class="vf-resource">Yetiştirilecek ürün <select id="vf-resource" onchange="valorFarmPickerRewards()"><option value="crystal">Kristal</option><option value="gold">Altın</option></select></label><div class="farm-seed-choices">${Object.entries(valorFarmSeeds).map(([id,c])=>`<button type="button" onclick="valorPlantSeed(${i},'${id}',document.getElementById('vf-resource').value)"><img src="${valorFarmGrowthArt[1]}" alt=""><b>${c.name}</b><span>${c.hours} saat</span><strong data-yield="${c.yield}">${c.yield} Kristal</strong></button>`).join('')}</div><p>Uzun süreli tohumlar süreleriyle orantılı ürün verir. Seviye için her arazi 1 hasat sayılır.</p><button type="button" class="farm-seed-cancel" onclick="valorCloseSeedPicker()">Vazgeç</button></section>`;
 overlay.addEventListener('click',e=>{if(e.target===overlay)valorCloseSeedPicker()});document.body.appendChild(overlay);
};
function valorFarmPickerRewards(){const gold=document.getElementById('vf-resource').value==='gold';document.querySelectorAll('#valor-farm-seed-picker [data-yield]').forEach(el=>el.textContent=gold?money(Number(el.dataset.yield)*1000)+' Altın':el.dataset.yield+' Kristal');document.querySelectorAll('#valor-farm-seed-picker img').forEach(img=>img.src=(gold?valorFarmGoldArt:valorFarmGrowthArt)[1])}
valorPlantSeed=function(i,seed,resource='crystal'){
 const p=valorFarmProgress();if(!valorFarmSeeds[seed]||!['gold','crystal'].includes(resource)||!valorFarmCanAccess(i,p)||i>=p.open||p.d.plots[i])return;
 p.d.plotCrops[i]={seed,resource};p.d.plotSeeds[i]=resource;p.d.plots[i]=Date.now();valorCloseSeedPicker();save();render();toast(valorFarmSeeds[seed].name+' ekildi');
};
vsHarvest=function(i){
 const p=valorFarmProgress();if(!valorFarmCanAccess(i,p))return;
 const t=p.d.plots[i];if(!t)return valorOpenSeedPicker(i);
 const crop=valorFarmCrop(i);if(!valorFarmGrowth(t,Date.now(),crop.duration).ready)return;
 p.d.plots[i]=0;p.d.plotSeeds[i]=null;p.d.plotCrops[i]=null;
 if(crop.resource==='gold')state.gold=(Number(state.gold)||0)+crop.yield*1000;else p.d.crystals=(Number(p.d.crystals)||0)+crop.yield;
 p.d.farmV2.harvests=p.total+1;
 if(typeof valorQuestRecord==='function')valorQuestRecord('harvest');
 save();const next=valorFarmProgress();render();toast('+'+valorFarmReward(crop)+' · '+(next.level>p.level?'Çiftlik Sv. '+next.level+(next.open>p.open?' · Yeni arazi açıldı!':''):'+1 hasat'));
};
vsFarm=function(){
 const p=valorFarmProgress(),now=Date.now(),next=p.level<4?4:p.level+1;
 return `<section class="vsys valor-farm-growth vf-page"><h2>Kristal Çiftliği</h2><div class="vf-summary"><div><span>Çiftlik Seviyesi</span><b>${p.level}<small> / 15</small></b></div><div><span>Açık Arazi</span><b>${p.open}<small> / 15</small></b></div><div><span>Kristal</span><b>${money(p.d.crystals)}</b></div></div><div class="vf-level"><b>${p.level===15?'Çiftliğin en yüksek seviyede':`Sv. ${p.level} → ${p.level+1}`}</b><span>${p.level===15?money(p.total)+' toplam hasat':p.progress+' / '+p.needed+' hasat'}</span><div class="vsys-bar"><span style="width:${p.level===15?100:p.progress/p.needed*100}%"></span></div><p>${p.level===15?'15 arazinin tamamı açık.':`${p.needed-p.progress} hasat sonra seviye atlarsın. Sıradaki arazi çiftlik Sv. ${next} seviyesinde açılır.`}</p></div><p class="vsys-muted">1, 3 veya 6 saatlik tohum seç. Her arazi hasadı +1 deneyim kazandırır. Çiftlik seviyesi karakter seviyesinden bağımsızdır.</p><div class="vsys-plots">${Array.from({length:15},(_,i)=>{
  const t=p.d.plots[i],legacy=i>=p.open&&!!t,locked=i>=p.open&&!t,c=valorFarmCrop(i),g=valorFarmGrowth(t,now,c.duration);
  return `<article class="vsys-card farm-growth-plot ${locked?'farm-locked':''} ${g.ready?'farm-ready':''} ${t&&c.resource==='gold'?'farm-gold':''}" ${!locked?'data-plot="'+i+'"':''}><h3>Arazi ${i+1}</h3><span class="farm-seed-label">${locked?'Kilitli':t?c.name:'Boş Arazi'}</span><div class="farm-growth-art">${locked?'<span class="farm-growth-lock">🔒</span>':`<img src="${valorFarmSeedArt(i,Math.max(1,g.stage))}" data-stage="${Math.max(1,g.stage)}" class="${!t?'farm-unplanted':''}" alt="${g.ready?'Hasada hazır ürün':t?'Büyüyen ürün':'Boş arazi'}">`}</div><p class="farm-growth-status">${locked?'Çiftlik Sv. '+(i+1):valorFarmStatus(g)}</p>${!locked?`<small class="vf-crop-reward">${t?valorFarmReward(c):'1 · 3 · 6 saat'}</small><div class="farm-growth-progress"><i style="width:${g.progress*100}%"></i></div><button type="button" ${t&&!g.ready?'disabled':''} onclick="vsHarvest(${i})">${!t?'Tohum Ek':g.ready?'Hasat Et':'Büyüyor'}</button>${legacy?'<small class="vf-legacy">Önceki ekimin korunuyor</small>':''}`:''}</article>`;
 }).join('')}</div><details class="vf-level-table"><summary>Seviye ve arazi şartları</summary><p>Her satır o yükseltme için gereken ek hasat sayısıdır. Her ürün, miktarı ne olursa olsun 1 hasat sayılır.</p><table><thead><tr><th>Yükseltme</th><th>Hasat</th><th>Açık arazi</th></tr></thead><tbody>${valorFarmRequirements.map((n,i)=>`<tr><td>${i} → ${i+1}</td><td>${n}</td><td>${Math.max(3,i+1)}</td></tr>`).join('')}</tbody></table></details></section>`;
};
