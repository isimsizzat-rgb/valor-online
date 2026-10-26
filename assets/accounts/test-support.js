/* One-time endgame test package for existing accounts and legacy characters. */
const VALOR_ENDGAME_SUPPORT={gold:999000000,cutoff:1792834842176,flag:'valorEndgameSupport20261024',receipt:'valor-endgame-support-20261024:'};
const VALOR_ENDGAME_SLOTS=['Silah','Zırh','Kask','Ayakkabı','Kolye','Küpe'];
let valorEndgameCreating=false,valorEndgameMessage=false;
const valorEndgamePreviousSave=save;
/* Test mode only: the active tester's character, once. */
function valorEndgameEligible(character,account){
 if(!['Savaşçı','Büyücü','Okçu'].includes(character?.class))return false;
 return !!account&&account.id===valorAccountActive?.id&&valorTestMode();
}
function valorEndgameGrant(character,account,persist){
 if(!valorEndgameEligible(character,account))return false;
 const flag=VALOR_ENDGAME_SUPPORT.flag,receipt=VALOR_ENDGAME_SUPPORT.receipt+(account?.id||'legacy-guest');
 if(character[flag]){if(!localStorage.getItem(receipt))localStorage.setItem(receipt,'claimed');return false}
 if(localStorage.getItem(receipt)){character[flag]=true;persist();return false}
 const gear=VALOR_ENDGAME_SLOTS.map(slot=>({...item(slot,character.class,100),epic:true,plus:0,testSupport:'endgame-20261024'}));
 const before={level:character.level,xp:character.xp,gold:character.gold,inventory:character.inventory};
 character.level=100;character.xp=0;character.gold=Math.max(0,Number(character.gold)||0)+VALOR_ENDGAME_SUPPORT.gold;
 character.inventory=[...(character.inventory||[]),...gear];character[flag]=true;
 try{persist();localStorage.setItem(receipt,'claimed')}catch(error){Object.assign(character,before);delete character[flag];throw error}
 return true;
}
function valorEndgameApplyActive(){
 if(valorEndgameCreating||!state.class||!valorAccountCanPlay())return false;
 const granted=valorEndgameGrant(state,valorAccountActive,()=>valorEndgamePreviousSave());
 if(granted)valorEndgameMessage=true;return granted;
}
for(const account of valorAccountRegistry()){
 if(account.id===valorAccountActive?.id)continue;
 const snapshot=valorAccountRead(valorAccountStorageKey(account.id));if(!snapshot?.state)continue;
 valorEndgameGrant(snapshot.state,account,()=>localStorage.setItem(valorAccountStorageKey(account.id),JSON.stringify(snapshot)));
}
const valorEndgamePreviousRender=render;
render=function(){
 valorEndgameApplyActive();const result=valorEndgamePreviousRender.apply(this,arguments);
 if(valorEndgameMessage&&valorAccountCanPlay()){valorEndgameMessage=false;toast('Test desteği: Sv.100 · 6 epik ekipman çantanda · +999.000.000 altın')}
 return result;
};
save=function(){valorEndgameApplyActive();return valorEndgamePreviousSave.apply(this,arguments)};
const valorEndgamePreviousInit=initClass;
initClass=function(){
 if(state.class)return valorEndgamePreviousInit.apply(this,arguments);
 valorEndgameCreating=true;let result;
 try{result=valorEndgamePreviousInit.apply(this,arguments)}finally{valorEndgameCreating=false}
 if(state.class){save();render()}
 return result;
};
render();
