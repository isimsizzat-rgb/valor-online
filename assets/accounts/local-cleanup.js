/* One-time cleanup (27 Oct 2026): removes old device-only accounts and characters that were never moved to
   the server. Cloud accounts and anything named DooM / DooM_2 (login or character name) are kept.
   Runs once per browser, before the account screen loads. */
(function(){
 const FLAG='valor-local-cleanup-20261027',KEY='kadim-kralliklar-web-v1',REG='valor-accounts-v1',SAVE='valor-account-save-',OWNER=KEY+'-account-owner',SESSION='valor-account-session-v1';
 const KEEP=['doom','doom_2'];
 try{if(localStorage.getItem(FLAG))return}catch{return}
 const read=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
 const norm=v=>String(v||'').trim().normalize('NFKC').toLocaleLowerCase('tr-TR');
 const kept=(...names)=>names.some(n=>KEEP.includes(norm(n)));
 let reload=false,removed=0;
 try{
  // Device-only accounts in the account list.
  const reg=Array.isArray(read(REG))?read(REG):[],next=[];
  for(const a of reg){
   const save=read(SAVE+a.id);
   if(a.cloud||kept(a.username,save?.state?.name)){next.push(a);continue}
   localStorage.removeItem(SAVE+a.id);removed++;
   if(localStorage.getItem(OWNER)===a.id){localStorage.removeItem(OWNER);localStorage.removeItem(KEY);localStorage.removeItem(KEY+'-stage-run');reload=true}
   try{if(sessionStorage.getItem(SESSION)===a.id)sessionStorage.removeItem(SESSION)}catch{}
  }
  if(next.length!==reg.length)localStorage.setItem(REG,JSON.stringify(next));
  // The old guest character (no account) and its backups.
  const owner=localStorage.getItem(OWNER),main=read(KEY);
  if(!owner&&main?.class&&!kept(main.name)){localStorage.removeItem(KEY);localStorage.removeItem(KEY+'-stage-run');removed++;reload=true;try{if(sessionStorage.getItem(SESSION)==='guest')sessionStorage.removeItem(SESSION)}catch{}}
  for(const k of [KEY+'-before-accounts-v1',KEY+'-guest-checkpoint-v1',KEY+'-before-legacy-restore-v1']){const b=read(k);if(b&&!kept(b?.state?.name)){localStorage.removeItem(k);removed++}}
  localStorage.removeItem(KEY+'-legacy-linked');
  localStorage.setItem(FLAG,String(Date.now()));
 }catch(e){console.warn('Local cleanup skipped',e);return}
 if(removed)console.info('Valor: removed '+removed+' old device-only records');
 // The character already loaded into memory must not be saved back before the page reloads.
 if(reload){try{state={class:null,name:'',level:1,xp:0,gold:50000,diamonds:150,hp:100,statPoints:0,stats:{},inventory:[],equipped:{},stones:{},shards:0,stageWins:{},guild:null,logs:[]}}catch{}location.reload()}
})();
