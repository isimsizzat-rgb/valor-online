/* One-time gift for accounts that existed when this update was prepared. */
const VALOR_COMMUNITY_GIFT={amount:10000,cutoff:1792834354576,flag:'valorCommunityDiamonds20261024',receipt:'valor-community-diamonds-20261024:'};
let valorCommunityCreating=false,valorCommunityGiftMessage=false;
const valorCommunityPreviousSave=save;
function valorCommunityGiftEligible(character,account){
 if(!character?.class)return false;
 const created=Number(account?.createdAt??character.valorCharacterCreatedAt??0);
 return Number.isFinite(created)&&created<=VALOR_COMMUNITY_GIFT.cutoff;
}
function valorCommunityGrant(character,account,persist){
 if(!valorCommunityGiftEligible(character,account))return false;
 const receipt=VALOR_COMMUNITY_GIFT.receipt+(account?.id||'legacy-guest'),flag=VALOR_COMMUNITY_GIFT.flag;
 if(character[flag]){if(!localStorage.getItem(receipt))localStorage.setItem(receipt,'claimed');return false}
 if(localStorage.getItem(receipt)){character[flag]=true;persist();return false}
 const before=character.diamonds;
 character.diamonds=Math.max(0,Number(before)||0)+VALOR_COMMUNITY_GIFT.amount;character[flag]=true;
 try{persist();localStorage.setItem(receipt,'claimed')}catch(error){character.diamonds=before;delete character[flag];throw error}
 return true;
}
function valorCommunityApplyActive(){
 if(valorCommunityCreating||!state.class||!valorAccountCanPlay())return false;
 const granted=valorCommunityGrant(state,valorAccountActive,()=>valorCommunityPreviousSave());
 if(granted)valorCommunityGiftMessage=true;return granted;
}
// Credit inactive saves too, so choosing another existing account retains its gift.
for(const account of valorAccountRegistry()){
 if(account.id===valorAccountActive?.id)continue;
 const snapshot=valorAccountRead(valorAccountStorageKey(account.id));
 if(!snapshot?.state)continue;
 valorCommunityGrant(snapshot.state,account,()=>localStorage.setItem(valorAccountStorageKey(account.id),JSON.stringify(snapshot)));
}
const valorCommunityPreviousRender=render;
render=function(){
 valorCommunityApplyActive();const result=valorCommunityPreviousRender.apply(this,arguments);
 if(valorCommunityGiftMessage&&valorAccountCanPlay()){valorCommunityGiftMessage=false;toast('+10.000 elmas hediye hesabına eklendi!')}
 return result;
};
save=function(){valorCommunityApplyActive();return valorCommunityPreviousSave.apply(this,arguments)};
const valorCommunityPreviousInit=initClass;
initClass=function(){
 if(state.class)return valorCommunityPreviousInit.apply(this,arguments);
 valorCommunityCreating=true;let result;
 try{result=valorCommunityPreviousInit.apply(this,arguments)}finally{valorCommunityCreating=false}
 if(state.class){state.valorCharacterCreatedAt=Date.now();save();render()}
 return result;
};
render();
