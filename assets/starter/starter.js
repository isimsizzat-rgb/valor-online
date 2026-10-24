/* Beginner loadout for newly created characters only. */
const VALOR_STARTER_CLASS_IDS={'Savaşçı':'warrior','Büyücü':'mage','Okçu':'archer'};
const VALOR_STARTER_SLOTS=['Silah','Zırh','Kask','Ayakkabı','Kolye','Küpe'];
const VALOR_STARTER_NAMES={
 'Savaşçı':['Acemi Kılıcı','Yıpranmış Deri Zırh','Eski Demir Miğfer','Yıpranmış Çizmeler','Demir Uçlu Kolye','Bakır Halkalar'],
 'Büyücü':['Acemi Asası','Yamalı Çırak Cübbesi','Soluk Kumaş Başlık','Yıpranmış Çizmeler','Kuvars Uçlu Kolye','Bakır Küpeler'],
 'Okçu':['Acemi Yayı','Yıpranmış Avcı Yeleği','Eski Deri Başlık','Yıpranmış Çizmeler','Ahşap Boncuklu Kolye','Bakır Halkalar']
};
function valorStarterItem(slot,cls){const i=VALOR_STARTER_SLOTS.indexOf(slot);return {id:valorUniqueItemId(),slot,cls,name:VALOR_STARTER_NAMES[cls][i],level:1,plus:0,epic:false,affixes:[],starterSet:'starter-v1'};}
function valorStarterHero(){return state.equipped?.Zırh?.starterSet==='starter-v1'&&!state.equipped?.Kanat?.wingId?VALOR_STARTER_ART[VALOR_STARTER_CLASS_IDS[state.class]]?.hero:null;}
const valorStarterPreviousIcon=equipmentIcon;
equipmentIcon=function(it){const art=VALOR_STARTER_ART[VALOR_STARTER_CLASS_IDS[it?.cls]],slot=VALOR_STARTER_SLOTS.indexOf(it?.slot);return it?.starterSet==='starter-v1'&&art&&slot>=0?art.icons[slot]:valorStarterPreviousIcon(it);};
const valorStarterPreviousPower=equipmentPower;
equipmentPower=function(it){const power=valorStarterPreviousPower(it);return it?.starterSet==='starter-v1'?Math.max(1,Math.round(power*.35)):power;};
const valorStarterPreviousAffixes=vaEnsureAffixes;
vaEnsureAffixes=function(it){return it?.starterSet==='starter-v1'&&(!Array.isArray(it.affixes)||it.affixes.length===0)?[]:valorStarterPreviousAffixes(it);};
const valorStarterPreviousAffixMarkup=vaAffixMarkup;
vaAffixMarkup=function(it){return it?.starterSet==='starter-v1'&&vaEnsureAffixes(it).length===0?'<p class="small">Sade başlangıç ekipmanı · Efsun yok</p>':valorStarterPreviousAffixMarkup(it);};
const valorStarterPreviousProfile=profile;
profile=function(){const html=valorStarterPreviousProfile(),hero=valorStarterHero();return hero?html.replace(/<div class="vp-hero"><img[^>]*><\/div>/,'<div class="vp-hero valor-starter-hero" style="inset:2% 20% 0!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important"><img src="'+hero+'" alt="'+state.class+' başlangıç seti" style="width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center bottom!important;transform:none!important"></div>'):html;};
initClass=function(cls,nick){
  if(state.class||!VALOR_STARTER_CLASS_IDS[cls])return;
  const name=String(nick||'').trim();if(name.length<3||name.length>20)return;
  const fresh=valorAccountFreshState();
  state={...fresh,class:cls,name,stones:{},shards:0,papers:0,starterCharacterV1:true,
    valorDiamondGrant20261022:true,valorAllSetsTestV1:true,testStone8Gift20261022:true,gemInventory:[],gemVisualTest70v1:true,mountSpiritFragments:0,mountCraftCards:[],
    mountsV1:{owned:[],cards:[],souls:0,temporary:[],training:Array.from({length:4},()=>({level:0,xp:0})),stones:0,bonus200v1:true,bonus99999v1:true},
    astrologyV1:{crimsonFury:0,ironWill:0,astralFlame:0,starVeil:0,fateBreaker:0,nightVeil:0,endlessResistance:0,lifeLight:0}};
  state.inventory=VALOR_STARTER_SLOTS.map(slot=>valorStarterItem(slot,cls));
  state.equipped=Object.fromEntries(state.inventory.map(it=>[it.slot,it]));
  creationNick='';page='Anasayfa';selected=null;
  save();render();
};
const valorStarterPreviousRender=render;
render=function(){const result=valorStarterPreviousRender.apply(this,arguments),hero=valorStarterHero(),portrait=document.getElementById('valor-hud-portrait');if(hero&&portrait)portrait.src=hero;return result;};
render();
