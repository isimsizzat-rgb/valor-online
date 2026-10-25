// Reference characters for balance measurement. Runs inside the game page.
window.VALOR_REFS=[
 {id:'R0',day:0,level:1,gear:'starter',gearLevel:1,tier:0,plus:0,pet:0,astro:0,mount:0,medal:null},
 {id:'R1',day:10,level:25,gear:'starter',gearLevel:1,tier:1,plus:6,pet:3,astro:2,mount:15,medal:null},
 {id:'R2',day:30,level:50,gear:'set',gearLevel:26,tier:1,plus:8,pet:7,astro:5,mount:35,medal:null},
 {id:'R3',day:60,level:75,gear:'set',gearLevel:51,tier:1,plus:10,pet:11,astro:8,mount:60,medal:'karanlik'},
 {id:'R4',day:90,level:100,gear:'set',gearLevel:76,tier:2,plus:8,pet:14,astro:11,mount:90,medal:'kudretli'},
 {id:'Zirve',day:180,level:100,gear:'set',gearLevel:76,tier:3,plus:15,pet:24,astro:20,mount:150,medal:'efendi'}
];
window.valorRefApply=function(r,cls='Savaşçı'){
 window.valorAccountCanPlay=()=>true;state.class=cls;state.name='Ref';state.level=r.level;state.xp=0;
 state.stats={Saldırı:0,Sihir:0,Savunma:0,'Sihir Savunma':0,Can:0,Kritik:0,Bloke:0};
 const pool=vaAffixPool;let k=0;state.inventory=[];state.equipped={};
 for(const slot of VALOR_STARTER_SLOTS){
  const it=r.gear==='starter'?valorStarterItem(slot,cls):item(slot,cls,r.gearLevel);
  it.plus=r.plus;it.evolutionTier=r.tier;it.epic=r.tier>0;it.gems=[];
  it.affixes=r.gear==='starter'&&r.tier===0&&r.plus===0?[]:Array.from({length:5},()=>({type:pool[(k++)%pool.length],stars:5}));
  state.inventory.push(it);state.equipped[slot]=it;
 }
 if(r.medal){const m={id:'ref-medal',slot:'Madalyon',name:'Madalyon',medallionId:r.medal,expiresAt:Date.now()+864e5,boughtAt:Date.now()};state.inventory.push(m);state.equipped.Madalyon=m}
 const d=valorPetData();for(const p of VALOR_PETS){d[p.id].stage=r.pet;d[p.id].owned=true;d[p.id].progress=0}d.equipped='kozpence';
 const a=valorAstrologyData();for(const t of VALOR_ASTROLOGY_TALENTS)a[t.id]=r.astro;
 const m=vmData();m.owned=[];m.temporary=[];m.training.forEach(t=>{t.level=r.mount;t.xp=0});
 const v=vsData();v.tech=v.tech.map(()=>0);
 state.fame=0;
 return {power:combatPower(),stats:valorArenaStats()};
};
