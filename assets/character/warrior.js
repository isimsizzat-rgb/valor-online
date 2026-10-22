/* Paper-doll warrior: independent equipment layers, derived from saved loadout. */
const valorDollParts={Silah:'weapon',Zırh:'armor',Kask:'helmet',Ayakkabı:'boots'};
function valorDollTier(it){return Math.max(1,Math.min(4,Math.ceil((Number(it?.level)||1)/25)))}
const valorDollSets=['veyrak','varkhan','mordrak','lumeris'];
function valorDollLayer(part,it){const tier=valorDollTier(it),set=valorDollSets[tier-1],epic=!!it?.epic,pose=it&&valorDollPoses[set]?.[part],transform=pose?';transform:translate('+pose[2]+'%,'+pose[3]+'%) rotate('+(pose[4]||0)+'deg) scale('+pose[0]+','+pose[1]+')':'';return '<div class="vd-layer vd-'+part+(it?' vd-set-'+set:'')+(epic?' vd-epic':'')+'" role="img" aria-label="'+escapeAttr(it?it.name:'Temel kıyafetli savaşçı')+'" data-doll-part="'+part+'"'+(it?' data-doll-set="'+set+'"':'')+' style="background-image:url(assets/character/'+(it?set+'/'+part:'warrior-base')+'.webp?v=2)'+transform+'"></div>'}
function valorWarriorDoll(){const eq=state.equipped||{},wing=typeof valorWings!=='undefined'?valorWings.find(w=>w.id===eq.Kanat?.wingId):null;return '<div class="vp-hero vd-hero"><div class="vd-backdrop"></div>'+(wing?'<div class="vd-wings" role="img" aria-label="'+escapeAttr(wing.name)+'" style="background-image:url('+valorWingArt(wing)+')"></div>':'')+'<div class="vd-stack">'+valorDollLayer('base')+(eq.Silah?valorDollLayer('weapon',eq.Silah):'')+(eq.Zırh?valorDollLayer('leggings',eq.Zırh):'')+['Zırh','Ayakkabı','Kask'].map(slot=>eq[slot]?valorDollLayer(valorDollParts[slot],eq[slot]):'').join('')+'</div></div>'}
/* Layered preview disabled until all equipment shares one coherent character rig. */
/* Cohesive illustration for the warrior wearing Ayaz wings. */
const valorIllustratedProfile=profile;
profile=function(){
  const html=valorIllustratedProfile();
  if(state.class!=='Savaşçı'||state.equipped?.Kanat?.wingId!=='ayaz')return html;
  return html.replace(/<div class="vp-hero"><img[^>]*><\/div>/,'<div class="vp-hero vc-ayaz-hero"><img src="assets/character/warrior-ayaz.webp?v=1" alt="Ayaz Kanatları kuşanmış savaşçı"></div>');
};
const valorIllustratedRender=render;
render=function(){
  const result=valorIllustratedRender.apply(this,arguments);
  const hero=document.querySelector('#main .vc-ayaz-hero');
  if(!hero)return result;
  const scene=hero.closest('.vp-scene'),image=hero.querySelector('img');
  scene.style.setProperty('background','radial-gradient(ellipse at 50% 45%,#33231d 0%,#17110f 65%,#0d0b0a 100%)','important');
  for(const [property,value] of Object.entries({inset:'6px 1%',width:'98%',height:'calc(100% - 12px)',display:'block'}))hero.style.setProperty(property,value,'important');
  for(const [property,value] of Object.entries({left:'0',top:'0',width:'100%',height:'100%','object-fit':'contain','object-position':'center',transform:'scale(.93)','transform-origin':'center center',filter:'drop-shadow(0 4px 8px #0008)'}))image.style.setProperty(property,value,'important');
  return result;
};
/* Items remain in the bag while equipped, so removing them must not duplicate them. */
unequip=function(slot){const it=state.equipped?.[slot];if(!it)return;if(!(state.inventory||[]).some(i=>String(i.id)===String(it.id)))state.inventory.push(it);delete state.equipped[slot];save();render();toast(it.name+' çıkarıldı')};
