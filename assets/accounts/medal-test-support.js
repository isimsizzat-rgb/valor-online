/* One-time fame and Castle War currency package for existing test accounts. */
const VALOR_MEDAL_TEST_SUPPORT={fame:100000,medallions:99999,cutoff:1792846500765,flag:'valorMedalTestSupport20261024',receipt:'valor-medal-test-support-20261024:'};
let valorMedalTestCreating=false,valorMedalTestMessage=false;
const valorMedalTestPreviousSave=save;
function valorMedalTestGrant(character,account,persist){
 if(!['Savaşçı','Büyücü','Okçu'].includes(character?.class))return false;
 if(!account||account.id!==valorAccountActive?.id||!valorTestMode())return false; // test mode only
 const flag=VALOR_MEDAL_TEST_SUPPORT.flag,receipt=VALOR_MEDAL_TEST_SUPPORT.receipt+(account?.id||'legacy-guest');
 if(character[flag]){if(!localStorage.getItem(receipt))localStorage.setItem(receipt,'claimed');return false}
 if(localStorage.getItem(receipt)){character[flag]=true;persist();return false}
 const before={fame:character.fame,castleV1:character.castleV1};
 const wallet=character.castleV1||{playerId:'castle-player-'+valorUniqueItemId(),medallions:0,sessions:{},memberships:[],lastAttack:0};
 character.fame=Math.max(0,Number(character.fame)||0)+VALOR_MEDAL_TEST_SUPPORT.fame;
 character.castleV1={...wallet,medallions:Math.max(0,Number(wallet.medallions)||0)+VALOR_MEDAL_TEST_SUPPORT.medallions};character[flag]=true;
 try{persist();localStorage.setItem(receipt,'claimed')}catch(error){Object.assign(character,before);delete character[flag];throw error}
 return true;
}
function valorMedalTestApplyActive(){
 if(valorMedalTestCreating||!state.class||!valorAccountCanPlay())return false;
 const granted=valorMedalTestGrant(state,valorAccountActive,()=>valorMedalTestPreviousSave());
 if(granted)valorMedalTestMessage=true;return granted;
}
for(const account of valorAccountRegistry()){
 if(account.id===valorAccountActive?.id)continue;
 const snapshot=valorAccountRead(valorAccountStorageKey(account.id));if(!snapshot?.state)continue;
 valorMedalTestGrant(snapshot.state,account,()=>localStorage.setItem(valorAccountStorageKey(account.id),JSON.stringify(snapshot)));
}
const valorMedalTestPreviousRender=render;
render=function(){
 valorMedalTestApplyActive();const result=valorMedalTestPreviousRender.apply(this,arguments);
 if(valorMedalTestMessage&&valorAccountCanPlay()){valorMedalTestMessage=false;toast('Test desteği: +100.000 Şöhret · +99.999 Dukat')}
 return result;
};
save=function(){valorMedalTestApplyActive();return valorMedalTestPreviousSave.apply(this,arguments)};
const valorMedalTestPreviousInit=initClass;
initClass=function(){
 if(state.class)return valorMedalTestPreviousInit.apply(this,arguments);
 valorMedalTestCreating=true;let result;
 try{result=valorMedalTestPreviousInit.apply(this,arguments)}finally{valorMedalTestCreating=false}
 if(state.class){save();render()}return result;
};
render();
