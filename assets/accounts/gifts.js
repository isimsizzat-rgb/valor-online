/* Server gifts (supabase/gifts.sql): each active gift (diamonds and/or gold) is given once per account, to existing and new players.
   The server adds the diamonds and bumps the save revision; the game adds the same amount locally and adopts
   the new revision, so the next upload is neither cut by the save guard nor seen as a conflict. */
const valorGifts={busy:false,checkedAt:0,off:false};
function valorGiftsOnline(){return !!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
async function valorGiftsCheck(force){
 if(valorGifts.off||valorGifts.busy||!state?.class||!valorGiftsOnline()||typeof valorCloudBlocked!=='undefined'&&valorCloudBlocked)return;
 if(!force&&Date.now()-valorGifts.checkedAt<120000)return;
 valorGifts.busy=true;valorGifts.checkedAt=Date.now();
 const owner=valorAccountActive.id,before=state;
 try{
  const pending=await valorCloudFetch('/rest/v1/rpc/gift_pending',{method:'POST',body:'{}'});
  if(!Array.isArray(pending)||!pending.length)return;
  // The character must be on the server first (new players: right after creation).
  await valorCloudFlush();if(valorCloudBlocked||state!==before||valorAccountActive?.id!==owner)return;
  for(const gift of pending){
   let result;
   const op=valorCloudFetch('/rest/v1/rpc/gift_claim',{method:'POST',body:JSON.stringify({gift:gift.id})});
   valorCloudBusy=op;   // no upload may slip in between the server change and adopting its revision
   try{result=await op}finally{if(valorCloudBusy===op)valorCloudBusy=null}
   if(result?.status!=='ok')continue;
   if(state!==before||valorAccountActive?.id!==owner){valorCloudConflict();return}
   state.diamonds=Math.max(0,Number(state.diamonds)||0)+Number(result.diamonds||0);
   state.gold=Math.max(0,Number(state.gold)||0)+Number(result.gold||0);
   localStorage.setItem(valorCloudRevKey(owner),String(result.rev));
   save();render();toast('🎁 '+[result.diamonds?'+'+money(result.diamonds)+' elmas':'',result.gold?'+'+money(result.gold)+' altın':''].filter(Boolean).join(', ')+' hediye hesabına eklendi!');
  }
 }catch(e){if(e.status===404||e.code==='PGRST202')valorGifts.off=true}
 finally{valorGifts.busy=false;if(typeof valorCloudDirty!=='undefined'&&valorCloudDirty&&!valorCloudBlocked)valorCloudSchedule()}
}
(function(){
 const prevInit=initClass;
 initClass=function(){const had=!!state.class,r=prevInit.apply(this,arguments);if(!had&&state.class)setTimeout(()=>valorGiftsCheck(true),4000);return r};
 setInterval(()=>{if(!document.hidden)valorGiftsCheck()},30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)valorGiftsCheck()});
 setTimeout(()=>valorGiftsCheck(true),5000);
})();
