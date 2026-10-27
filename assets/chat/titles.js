/* Ranking titles: the #1 player of each ranking holds its title. A holder picks which one to wear
   in the profile; the worn title shows above the hero and before the nick in chat ("[En Güçlü Lord] Doom").
   Holding comes from my_titles on the server; chat_send checks it again (supabase/titles.sql). */
const VALOR_TITLES=[{kind:'power',name:'En Güçlü Lord'},{kind:'fame',name:'Savaş Tanrısı'},{kind:'spirit',name:'Binek Tanrısı'},{kind:'popularity',name:'En Popüler Lord'},{kind:'guild',name:'Birlik Tanrısı'}];
const VALOR_TITLE_TTL=60000;
const valorTitles={held:[],at:0,loading:false};
function valorTitlesOnline(){return !!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
async function valorTitlesLoad(force){
 if(!valorTitlesOnline()||!state.class||valorTitles.loading||(!force&&valorTitles.at&&Date.now()-valorTitles.at<VALOR_TITLE_TTL))return;
 valorTitles.loading=true;const before=valorTitles.held.join('|');
 try{
  if(typeof valorCloudFlush==='function')await valorCloudFlush().catch(()=>{});
  let held=null;
  try{const r=await valorCloudFetch('/rest/v1/rpc/my_titles',{method:'POST',body:'{}'});if(Array.isArray(r))held=r}
  catch(e){if(!(e.status===404||e.code==='PGRST202'))throw e}
  // Before supabase/titles.sql is run: player rankings only (no guild or popularity title).
  if(!held){const kinds=['power','fame','spirit'],ranks=await Promise.all(kinds.map(kind=>valorCloudFetch('/rest/v1/rpc/my_rank',{method:'POST',body:JSON.stringify({kind})}).catch(()=>null)));held=VALOR_TITLES.filter(t=>Number(ranks[kinds.indexOf(t.kind)])===1).map(t=>t.name)}
  valorTitles.held=VALOR_TITLES.map(t=>t.name).filter(n=>held.includes(n));
 }catch(e){}
 finally{valorTitles.at=Date.now();valorTitles.loading=false;if(valorTitles.held.join('|')!==before&&page==='Profil')render()}
}
/* No choice yet: wear the first title held. '' means the player chose to hide it. */
function valorTitleActive(){
 const held=valorTitles.held,choice=state.titleChoice;
 if(choice===undefined||choice===null)return held[0]||null;
 return held.includes(choice)?choice:null;
}
function valorTitleSelect(name){if(name!==''&&!valorTitles.held.includes(name))return;state.titleChoice=name;save();render()}
function valorTitlePicker(){
 const held=valorTitles.held;if(!held.length)return '';
 const active=valorTitleActive();
 return '<div class="vtl-picker" role="group" aria-label="Ünvan seç"><span>Ünvanın</span>'+held.map(n=>'<button type="button" aria-pressed="'+(active===n)+'" onclick="valorTitleSelect(\''+n+'\')">'+n+'</button>').join('')+'<button type="button" aria-pressed="'+(active===null)+'" onclick="valorTitleSelect(\'\')">Gizle</button></div>';
}
(function(){
 const prevProfile=profile;
 profile=function(){
  let html=prevProfile.apply(this,arguments);
  // The old sample-board preview could put a title on anyone; real titles replace it.
  html=html.replace('<span class="vm-tag">✦ [Binek Tanrısı] ✦</span> ','');
  if(!valorTitlesOnline())return html;
  valorTitlesLoad();
  const active=valorTitleActive();
  html=html.replace(/(<div class="vp-header">[\s\S]*?<\/div>)/,'$1'+valorTitlePicker());
  if(active)html=html.replace('<div class="vp-gear vp-left">','<div class="valor-profile-tag">✦ '+active+' ✦</div><div class="vp-gear vp-left">');
  return html;
 };
 const prevRow=valorChatRow;
 valorChatRow=function(m){
  const html=prevRow.apply(this,arguments);
  if(!html||!m.tag||!VALOR_TITLES.some(t=>t.name===m.tag))return html;
  return html.replace('<div class="vch-meta"><b','<div class="vch-meta"><span class="vch-tag">['+escapeAttr(m.tag)+']</span><b');
 };
})();
if(state.class)valorTitlesLoad();
if(state.class&&page==='Profil')render();
