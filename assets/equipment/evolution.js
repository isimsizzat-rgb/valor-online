/* Four-stage evolution for beginner equipment and approved warrior/mage scene sets. */
(function(){
 const names=['Normal','Epik','Ebedi','İlahi'],colors=['#b7bdc9','#d5b16b','#bda0ef','#f0db9e'];
 const oldPower=equipmentPower;let pending=null;
 function sceneSet(it){if(!it||it.starterSet)return null;const families=it.cls==='Savaşçı'?['varkhan','mordrak','lumeris']:it.cls==='Büyücü'?['oryndis','aeloria','zephyriel']:null;if(!families)return null;const level=Number(it.level);return level>75&&level<=100?families[2]:level>50&&level<=75?families[1]:level>25&&level<=50?families[0]:null}
 const eligible=it=>!!it&&(it.starterSet==='starter-v1'||sceneSet(it))&&VALOR_STARTER_SLOTS.includes(it.slot)&&!it.wingId&&!it.marketItemId;
 const artBanks={
  'Savaşçı':{starter:typeof VALOR_WARRIOR_EVOLUTION_ART!=='undefined'?VALOR_WARRIOR_EVOLUTION_ART:null,varkhan:typeof VALOR_WARRIOR_VARKHAN_ART!=='undefined'?VALOR_WARRIOR_VARKHAN_ART:null,mordrak:typeof VALOR_WARRIOR_MORDRAK_ART!=='undefined'?VALOR_WARRIOR_MORDRAK_ART:null,lumeris:typeof VALOR_WARRIOR_LUMERIS_ART!=='undefined'?VALOR_WARRIOR_LUMERIS_ART:null},
  'Okçu':{starter:VALOR_ARCHER_STARTER_ART,selthir:VALOR_ARCHER_SELTHIR_ART,vaelthorn:VALOR_ARCHER_VAELTHORN_ART,eryndor:VALOR_ARCHER_ERYNDOR_ART},
  'Büyücü':{starter:typeof VALOR_MAGE_STARTER_ART!=='undefined'?VALOR_MAGE_STARTER_ART:null,oryndis:typeof VALOR_MAGE_ORYNDIS_ART!=='undefined'?VALOR_MAGE_ORYNDIS_ART:null,aeloria:typeof VALOR_MAGE_AELORIA_ART!=='undefined'?VALOR_MAGE_AELORIA_ART:null,zephyriel:typeof VALOR_MAGE_ZEPHYRIEL_ART!=='undefined'?VALOR_MAGE_ZEPHYRIEL_ART:null}
 };
 function artFor(it){
  if(!it||!VALOR_STARTER_SLOTS.includes(it.slot)||it.wingId||it.marketItemId)return null;
  const level=Number(it.level);
  const family=it.starterSet==='starter-v1'||(level>=1&&level<=25)?'starter':it.cls==='Okçu'?(level>75&&level<=100?'eryndor':level>50&&level<=75?'vaelthorn':level>25&&level<=50?'selthir':null):sceneSet(it);
  return artBanks[it.cls]?.[family]||null;
 }
 function tier(it){if(!eligible(it))return it?.epic?1:0;const n=it.evolutionTier;return Number.isInteger(n)&&n>=0&&n<4?n:it.epic?1:0}
 function at(it,t,plus){
  if(t===0)return oldPower({...it,epic:false,plus});
  let cap=oldPower({...it,epic:false,plus:21}),base=0;
  for(let n=1;n<=t;n++){base=Math.ceil(cap*1.4);cap=Math.floor(base*(1+21*.13))}
  return Math.floor(base*(1+plus*.13));
 }
 window.valorEvolutionTier=tier;
 window.valorEvolutionPowerAt=function(it,t,plus){return eligible(it)&&Number.isInteger(t)&&t>=0&&t<=3&&Number.isInteger(plus)&&plus>=0&&plus<=21?at(it,t,plus):null};
 equipmentPower=function(it){return eligible(it)?at(it,tier(it),Math.max(0,Math.min(21,Math.trunc(Number(it.plus)||0)))):oldPower.apply(this,arguments)};
 const oldIcon=equipmentIcon;
 equipmentIcon=function(it){const art=artFor(it),visualTier=Number.isInteger(it?.evolutionTier)&&it.evolutionTier>=0&&it.evolutionTier<4?it.evolutionTier:tier(it);return art?art[visualTier]?.[it.slot]||oldIcon.apply(this,arguments):oldIcon.apply(this,arguments)};
 function label(it){return names[tier(it)]+' +'+(Number(it.plus)||0)}
 function find(id){return veFindItem(id)}
 function button(id){const b=document.createElement('button');b.type='button';b.className='evo-button';b.textContent='EVRİMLEŞTİR';b.onclick=()=>valorEvolutionAsk(id);return b}
 function panel(it,withButton=true){
  const t=tier(it),ready=it.plus===21&&t<3,p=equipmentPower(it),next=t<3?at(it,t+1,0):null;
  const el=document.createElement('section');el.className='evo-panel';el.style.setProperty('--evo-color',colors[t]);
  el.innerHTML='<b class="evo-current">'+label(it)+'</b><div class="evo-track">'+names.map((name,i)=>'<span class="'+(i===t?'active':'')+'">'+name+'</span>').join('')+'</div>'+(next!==null?'<p>'+names[t]+' +21 → '+names[t+1]+' +0</p><div class="evo-values"><span>Şimdi <strong>'+valorEquipmentStatsText(it,p)+'</strong></span><span>'+names[t+1]+' +0 <strong>'+valorEquipmentStatsText(it,next)+'</strong></span></div><small>'+(ready?'Evrime hazır. + seviyesi sıfırlanır; taşlar ve efsunlar korunur.':'+21’e ulaştığında sonraki aşamaya evrimleştirebilirsin.')+'</small>':'<small>'+(it.plus===21?'İlahi +21 · Son gelişim aşaması.':'Son evrim aşaması · +21’e kadar güçlendirebilirsin.')+'</small>');
  if(withButton&&ready)el.appendChild(button(it.id));return el;
 }
 function decoratePopup(it,id){
  if(!eligible(it))return;const root=document.getElementById(id),dialog=root?.querySelector('.valor-item-dialog');if(!dialog||dialog.querySelector('.evo-panel'))return;
  dialog.dataset.evolutionTier=String(tier(it));const rarity=dialog.querySelector('.detail-rarity');if(rarity)rarity.textContent=names[tier(it)]+' · '+it.slot;
  for(const p of dialog.querySelectorAll(':scope > p'))if(/^(✦ Epik|Normal) ·/.test(p.textContent))p.textContent=p.textContent.replace(/^(✦ Epik|Normal)/,names[tier(it)]);
  dialog.querySelector('h3')?.insertAdjacentElement('afterend',panel(it));
 }
 const oldBagPopup=showBagItemPopup;
 showBagItemPopup=function(n){const r=oldBagPopup.apply(this,arguments);decoratePopup(state.inventory[n],'valor-bag-popup');return r};
 const oldProfilePopup=showProfileDetails;
 showProfileDetails=function(slot){const r=oldProfilePopup.apply(this,arguments);decoratePopup(state.equipped[slot],'valor-item-overlay');return r};
 const oldBag=bag;
 bag=function(){const template=document.createElement('template');template.innerHTML=oldBag.apply(this,arguments);template.content.querySelectorAll('.bag-slot').forEach(el=>{const m=el.getAttribute('onclick')?.match(/selectItem\((\d+)\)/),it=m&&state.inventory[Number(m[1])];if(!eligible(it))return;el.dataset.evolutionTier=String(tier(it));el.title=it.name+' · '+label(it);const badge=document.createElement('span');badge.className='evo-badge';badge.textContent=names[tier(it)];badge.style.color=colors[tier(it)];el.append(badge)});return template.innerHTML};
 const oldWorkshop=workshop;
 workshop=function(){const template=document.createElement('template');template.innerHTML=oldWorkshop.apply(this,arguments);const root=template.content;root.querySelectorAll('.vw-item').forEach(el=>{const m=el.getAttribute('onclick')?.match(/vwChooseItem\('([^']+)'\)/),it=m&&find(m[1]);if(eligible(it)){el.dataset.evolutionTier=String(tier(it));el.title=it.name+' · '+label(it);const name=el.querySelector('.forge-item-name,div');if(name)name.textContent=it.name+' · '+names[tier(it)]}});
  {const nav=[...root.querySelectorAll('.forge-nav button')].find(b=>b.getAttribute('onclick')?.includes("workTab='epic'"));if(nav){nav.querySelector('span').textContent='Evrim';nav.querySelector('small').textContent='+21 ekipmanını sonraki aşamaya taşı'}if(workTab==='epic'){const box=root.querySelector('.vw-panel'),it=find(vwSelectedItemId);if(box){const h=box.querySelector('h2');if(h)h.textContent='Evrim';const intro=box.querySelector('.forge-panel-intro');if(intro)intro.textContent='Normal → Epik → Ebedi → İlahi.';if(eligible(it)){box.querySelector('.vw-action')?.remove();box.append(panel(it));}}}}
  return template.innerHTML;
 };
 // Template serialization drops DOM listeners, so bind evolution controls after render.
 const oldRender=render;
 render=function(){const r=oldRender.apply(this,arguments);document.querySelectorAll('#main .evo-button').forEach(b=>{b.onclick=()=>valorEvolutionAsk(vwSelectedItemId)});return r};
 const oldDraw=vwDrawEnhance;
 vwDrawEnhance=function(){const r=oldDraw.apply(this,arguments),it=vwEnhanceItem(),root=document.getElementById('vw-enhance-overlay');if(eligible(it)&&root){root.querySelector('h2')?.insertAdjacentElement('afterend',panel(it));root.querySelector('.vw-enhance-dialog').dataset.evolutionTier=String(tier(it))}return r};
 const oldEpic=epic;
 epic=function(id){const it=find(id);if(eligible(it)){if(it.plus!==21)return toast('Evrim için ekipmanı +21 yapmalısın.');return valorEvolutionAsk(id)}return oldEpic.apply(this,arguments)};
 window.valorEvolutionCancel=function(){pending=null;document.getElementById('valor-evolution-confirm')?.remove()};
 window.valorEvolutionAsk=function(id){
  const it=find(id);if(!eligible(it)||it.plus!==21||tier(it)>=3)return toast('Bu ekipman şu anda evrimleşemez.');
  valorEvolutionCancel();pending={owner:state,item:it,id:it.id,tier:tier(it),from:equipmentPower(it),enhance:!!document.getElementById('vw-enhance-overlay')};
  const root=document.createElement('div');root.id='valor-evolution-confirm';root.className='evo-overlay';
  root.innerHTML='<section class="evo-dialog" role="dialog" aria-modal="true" aria-labelledby="evo-title"><h2 id="evo-title">Ekipman Evrimi</h2><p>'+escapeAttr(it.name)+'</p><div class="evo-confirm-stages">'+label(it)+'<span>↓</span>'+names[tier(it)+1]+' +0</div><div class="evo-values"><span>Şimdi <strong>'+valorEquipmentStatsText(it)+'</strong></span><span>Evrim Sonrası <strong>'+valorEquipmentStatsText(it,at(it,tier(it)+1,0))+'</strong></span></div><p>Taşlar ve efsunlar korunur. Evrim başarı oranı %100.</p><div class="evo-confirm-actions"><button type="button" class="evo-cancel">Vazgeç</button><button type="button" class="evo-confirm">Evrimleştir</button></div></section>';
  root.querySelector('.evo-cancel').onclick=valorEvolutionCancel;root.querySelector('.evo-confirm').onclick=valorEvolutionConfirm;root.addEventListener('click',e=>{if(e.target===root)valorEvolutionCancel()});document.body.append(root);root.querySelector('.evo-confirm').focus();
 };
 window.valorEvolutionConfirm=function(){
  const p=pending;if(!p)return;const it=find(p.id);if(state!==p.owner||it!==p.item||!eligible(it)||it.plus!==21||tier(it)!==p.tier||equipmentPower(it)!==p.from){valorEvolutionCancel();return toast('Ekipman değişti. Evrimi yeniden aç.');}
  pending=null;document.getElementById('valor-evolution-confirm')?.remove();it.evolutionTier=p.tier+1;it.epic=true;it.plus=0;
  closeBagPopup();closeProfileDetails();if(p.enhance)vwCloseEnhance();save();render();
  window.dispatchEvent(new CustomEvent('valor-equipment-evolved',{detail:{name:it.name,tier:it.evolutionTier}}));
  if(p.enhance){vwSelectedItemId=it.id;vwDrawEnhance({success:true,message:names[it.evolutionTier]+' +0 · Evrim başarılı!'})}
  toast(it.name+' → '+names[it.evolutionTier]+' +0');
 };
 const oldGo=go;go=function(){valorEvolutionCancel();return oldGo.apply(this,arguments)};
 document.addEventListener('keydown',e=>{const root=document.getElementById('valor-evolution-confirm');if(!root)return;if(e.key==='Escape'){e.preventDefault();valorEvolutionCancel()}if(e.key==='Tab'){const a=[...root.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===a.at(-1)){e.preventDefault();a[0].focus()}}});
 const style=document.createElement('style');style.textContent=`
.evo-panel{padding:14px;margin:12px 0;border:1px solid var(--evo-color,#ac9063);border-radius:8px;background:#121016;color:#dcd0bd;text-align:left}.evo-current{display:block;color:var(--evo-color);font:700 19px Georgia}.evo-track{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.evo-track span{padding:4px 7px;color:#8d8580;border:1px solid #ffffff15;border-radius:4px;font:11px system-ui}.evo-track .active{color:var(--evo-color);border-color:var(--evo-color)}.evo-panel p,.evo-panel small{font:12px/1.7 system-ui;color:#c6bca9}.evo-panel small{display:block}.evo-values{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.evo-values span{display:block;font:11px/1.6 system-ui;color:#bfb19b}.evo-values strong{display:block;font:700 20px Georgia;color:#f0d8a1;margin-top:4px}.evo-button{width:100%;min-height:44px;margin-top:12px;background:#382b1d;color:#f1d79b;border:1px solid #b59961;border-radius:5px}.evo-badge{position:absolute;bottom:3px;left:3px;padding:2px 4px;background:#0a090ddd;border-radius:3px;font:9px Georgia;pointer-events:none}.bag-slot[data-evolution-tier="2"],.vw-item[data-evolution-tier="2"]{border-color:#bda0ef!important}.bag-slot[data-evolution-tier="3"],.vw-item[data-evolution-tier="3"]{border-color:#f0db9e!important;box-shadow:inset 0 0 8px #e7d4a133}.evo-overlay{position:fixed;inset:0;z-index:1000001;display:grid;place-items:center;padding:16px;background:#08070be8}.evo-dialog{width:min(100%,420px);max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;padding:22px;border:1px solid #b59961;border-radius:10px;background:#1d171b;color:#ead8b6}.evo-dialog h2{font:700 25px Georgia;color:#efd198}.evo-dialog p{font:13px/1.7 system-ui}.evo-confirm-stages{font:700 22px Georgia;text-align:center;color:#efd198;margin:20px 0}.evo-confirm-stages span{display:block;padding:9px;color:#9c8660}.evo-confirm-actions{display:flex;gap:10px}.evo-confirm-actions button{flex:1;min-height:44px;border:1px solid #9c8458;border-radius:5px;background:#34271d;color:#f1d79b}
`;document.head.append(style);
 if(state.class&&typeof valorAccountCanPlay==='function'&&valorAccountCanPlay())render();
})();
