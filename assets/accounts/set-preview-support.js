/* One test collection per character: own class, four sets, four art stages. */
(function(){
 const flag='valorSetPreview100V1';
 const slots=['Silah','Zırh','Kask','Ayakkabı','Kolye','Küpe'];
 const levels=[1,26,51,76];
 const stages=['Normal','Epik','Ebedi','İlahi'];
 const previousSave=save,previousRender=render;
 let applying=false,notify=false;

 function grant(character,persist){
  if(!character||!['Savaşçı','Büyücü','Okçu'].includes(character.class)||character[flag])return false;
  const gear=[];
  for(const level of levels)for(let tier=0;tier<4;tier++)for(const slot of slots){
   gear.push({...item(slot,character.class,level),plus:0,epic:tier>0,evolutionTier:tier,
    testSupport:'set-preview-100-v1'});
  }
  const before={level:character.level,xp:character.xp,inventory:character.inventory};
  character.level=100;character.xp=0;
  character.inventory=[...(Array.isArray(character.inventory)?character.inventory:[]),...gear];
  character[flag]=true;
  try{persist()}catch(error){Object.assign(character,before);delete character[flag];throw error}
  return true;
 }

 function applyActive(){
  if(applying||!state?.class||!valorAccountCanPlay())return false;
  applying=true;
  try{
   const changed=grant(state,()=>previousSave());
   if(changed)notify=true;
   return changed;
  }finally{applying=false}
 }

 // Update other saved accounts too, without replacing their active character.
 for(const account of valorAccountRegistry()){
  if(account.id===valorAccountActive?.id)continue;
  const storageKey=valorAccountStorageKey(account.id),snapshot=valorAccountRead(storageKey);
  if(!snapshot?.state)continue;
  try{grant(snapshot.state,()=>localStorage.setItem(storageKey,JSON.stringify(snapshot)))}
  catch(error){console.warn('Set test package could not be saved for an account.',error)}
 }
 save=function(){applyActive();return previousSave.apply(this,arguments)};
 render=function(){
  applyActive();const result=previousRender.apply(this,arguments);
  if(notify&&valorAccountCanPlay()){
   notify=false;toast('Test için Sv.100 oldun · 4 setin '+stages.join(' / ')+' halleri: 96 ekipman çantanda.');
  }
  return result;
 };
 render();
})();
