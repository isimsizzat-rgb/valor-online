/* Ranking titles: the #1 player of each ranking holds its title. A holder picks which one to wear
   in the profile; the worn title shows above the hero and before the nick in chat ("[En Güçlü Lord] Doom").
   Holding is read from the server rankings; chat_send checks it again (supabase/chat-tags.sql). */
const VALOR_TITLES=[{kind:'power',name:'En Güçlü Lord'},{kind:'xp',name:'Savaş Tanrısı'},{kind:'spirit',name:'Binek Tanrısı'},{kind:'fame',name:'Krallığın Şöhreti'}];
const VALOR_TITLE_TTL=60000;
const valorTitles={held:[],at:0,loading:false};
function valorTitlesOnline(){return !!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
async function valorTitlesLoad(force){
 if(!valorTitlesOnline()||!state.class||valorTitles.loading||(!force&&valorTitles.at&&Date.now()-valorTitles.at<VALOR_TITLE_TTL))return;
 valorTitles.loading=true;const before=valorTitles.held.join('|');
 try{
  if(typeof valorCloudFlush==='function')await valorCloudFlush().catch(()=>{});
  const ranks=await Promise.all(VALOR_TITLES.map(t=>valorCloudFetch('/rest/v1/rpc/my_rank',{method:'POST',body:JSON.stringify({kind:t.kind})}).catch(()=>null)));
  valorTitles.held=VALOR_TITLES.filter((t,i)=>Number(ranks[i])===1).map(t=>t.name);
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
