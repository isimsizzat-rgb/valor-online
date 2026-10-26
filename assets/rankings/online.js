/* Real rankings from the server (signed-in cloud accounts). Guests keep the old sample list. */
const VALOR_RANK_LIMIT=50,VALOR_RANK_TTL=60000;
const valorRankOnline={};   // kind -> {rows, myRank, at, error, loading}
function valorRankIsOnline(){return !!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function')}
function valorRankMine(){return {name:state.name||'Oyuncu',class:state.class,level:state.level,power:combatPower(),xp:Math.max(0,valorXpTotal(state.level)+(state.xp||0)),spirit:vmTotals().spirit,fame:Math.max(0,Number(state.fame)||0),me:true,profile:typeof valorCloudProfile==='function'?valorCloudProfile():null}}
async function valorRankLoad(kind,force){
 const cur=valorRankOnline[kind]||(valorRankOnline[kind]={});
 if(cur.loading||(!force&&cur.at&&Date.now()-cur.at<VALOR_RANK_TTL))return;
 cur.loading=true;cur.error='';
 try{
  if(typeof valorCloudFlush==='function')await valorCloudFlush().catch(()=>{}); // my latest values first
  const [rows,my]=await Promise.all([
   valorCloudFetch('/rest/v1/rpc/leaderboard',{method:'POST',body:JSON.stringify({kind,lim:VALOR_RANK_LIMIT})}),
   valorCloudFetch('/rest/v1/rpc/my_rank',{method:'POST',body:JSON.stringify({kind})}).catch(()=>null)
  ]);
  cur.rows=Array.isArray(rows)?rows:[];cur.myRank=typeof my==='number'?my:null;cur.at=Date.now();
 }catch(e){cur.at=Date.now();cur.error=(e.status===404||e.code==='PGRST202')?'Sıralama sunucuda henüz kurulmadı.':e.message}
 finally{cur.loading=false;if(page==='Sıralama')render()}
}
/* Rows shown for a tab: server list with my live values, plus my own row below it when I am not in the top list. */
function valorRankOnlineRows(kind){
 const cur=valorRankOnline[kind];if(!cur?.rows)return null;
 const mine=valorRankMine();let found=false;
 const rows=cur.rows.map(r=>{const row={name:r.name,class:r.class,level:r.level,power:Number(r.power)||0,xp:Number(r.xp)||0,spirit:Number(r.spirit)||0,fame:Number(r.fame)||0,profile:r.profile,rank:Number(r.rank)};if(r.is_me){found=true;return {...row,...mine,rank:row.rank}}return row});
 if(!found&&cur.myRank)rows.push({...mine,rank:cur.myRank,outside:true});
 return rows;
}
const valorRankOfflinePage=valorLeaderboardPage;
valorLeaderboardPage=function(){
 if(!valorRankIsOnline())return valorRankOfflinePage.apply(this,arguments);
 const tab=valorRankTab,labels={power:'Savaş Gücü',xp:'EXP',spirit:'Binek Ruhu',fame:'Şöhret'},cur=valorRankOnline[tab]||{};
 valorRankLoad(tab);
 const rows=valorRankOnlineRows(tab);window.valorRankShown=rows||[];
 let body;
 if(rows&&rows.length)body=rows.map((p,i)=>{const title=valorRankFameTitle(p.fame);return (p.outside?'<div class="vro-gap">· · ·</div>':'')+'<div class="valor-rank-row '+(p.me?'mine':'')+'"><span class="valor-rank-position">'+p.rank+'.</span><div class="valor-rank-player"><b>'+(p.rank===1?'<span class="valor-rank-crown">✦ </span>':'')+escapeAttr(p.name)+(p.me?' (Sen)':'')+'</b><small>'+escapeAttr(p.class||'')+' · Sv. '+p.level+(tab==='spirit'&&p.rank===1?' · Binek Tanrısı':'')+'</small></div>'+(tab==='fame'?'<span class="vr-fame-title" style="--rank-color:'+title.color+'">'+escapeAttr(title.name)+'</span>':'')+'<strong>'+money(Math.floor(p[tab]))+'</strong><button type="button" class="valor-rank-profile-arrow" aria-label="'+escapeAttr(p.name)+' profilini görüntüle" onclick="valorOpenRankProfile('+i+')">'+valorRankOrnateArrow()+'</button></div>'}).join('');
 else if(cur.error)body='<div class="vro-state"><p>'+escapeAttr(cur.error)+'</p><button type="button" onclick="valorRankLoad(\''+tab+'\',true)">Tekrar Dene</button></div>';
 else if(rows)body='<div class="vro-state"><p>Henüz sıralamada oyuncu yok.</p></div>';
 else body='<div class="vro-state"><p>Sıralama yükleniyor…</p></div>';
 const when=cur.at?Math.max(0,Math.round((Date.now()-cur.at)/60000)):null;
 return '<section class="valor-leaderboard '+(tab==='fame'?'vr-fame-board':'')+'"><h1>🏆 Sıralama</h1><p class="valor-rank-notice">Tüm oyuncular · ilk '+VALOR_RANK_LIMIT+(when===null?'':' · '+(when?when+' dk önce güncellendi':'az önce güncellendi'))+' <button type="button" class="vro-refresh" onclick="valorRankLoad(\''+tab+'\',true)" aria-label="Yenile">↻</button></p><div class="valor-rank-tabs">'+Object.entries(labels).map(([k,v])=>'<button type="button" class="'+(tab===k?'active':'')+'" onclick="valorRankSelect(\''+k+'\')">'+v+'</button>').join('')+'</div><div class="valor-rank-heading"><span>Oyuncu</span>'+(tab==='fame'?'<span>Ünvan</span>':'')+'<span>'+labels[tab]+'</span><span></span></div>'+body+'</section>';
};
const valorRankOfflineProfile=valorOpenRankProfile;
valorOpenRankProfile=function(index){
 if(!valorRankIsOnline())return valorRankOfflineProfile.apply(this,arguments);
 const p=(window.valorRankShown||[])[index];if(!p)return;if(p.me){go('Profil');return}
 const cls=classes.includes(p.class)?p.class:classes[0],gender=p.profile?.gender==='female'?'female':'male';
 const hero=typeof valorCreationPortrait==='function'?valorCreationPortrait(cls,gender):heroImages[classes.indexOf(cls)];
 const slots=['Silah','Zırh','Kask','Ayakkabı','Kolye','Küpe'],eq=p.profile?.equipped||{};
 const tag=p.rank===1?({spirit:'Binek Tanrısı',power:'En Güçlü Lord',xp:'Savaş Tanrısı',fame:'Krallığın Şöhreti'}[valorRankTab]||''):'';
 const gear=slots.map(slot=>{const it=eq[slot];let img='';if(it){try{img='<img src="'+equipmentIcon({...it,cls:it.cls||cls})+'" alt="'+escapeAttr(it.name||slot)+'">'}catch{}}return '<div class="vp-slot '+(it&&it.epic?'is-epic':'')+'" title="'+escapeAttr(it?it.name+' +'+(it.plus||0):slot)+'">'+(img||'<span class="vp-empty">'+(icons[slot]||'✦')+'</span>')+(it?'<span class="vp-plus-badge">+'+(it.plus||0)+'</span>':'')+'</div>'});
 const stats=[['Savaş Gücü',money(p.power)],['Seviye',p.level+' / 100'],['Toplam EXP',money(p.xp)],['Binek Ruhu',money(p.spirit)],['Şöhret',money(p.fame)],['Sıra',p.rank+'.']];
 document.getElementById('valor-rank-modal')?.remove();
 const modal=document.createElement('div');modal.className='valor-rank-modal valor-rank-fullscreen';modal.id='valor-rank-modal';
 modal.innerHTML='<div class="valor-rank-full-profile" role="dialog" aria-modal="true" aria-label="'+escapeAttr(p.name)+' profili"><div class="valor-rank-profile-toolbar"><button type="button" class="valor-rank-back">‹ Sıralamaya Dön</button><span>OYUNCU PROFİLİ</span></div><div class="vp-wrap"><div class="vp-header"><strong>'+escapeAttr(p.name)+'</strong><span>'+cls+' · Sv. '+p.level+'</span></div><div class="vp-scene"><div class="vp-hero"><img src="'+hero+'" alt="'+cls+' karakteri"></div>'+(tag?'<div class="valor-profile-tag">✦ '+tag+' ✦</div>':'<div class="valor-profile-tag valor-tag-reserved"></div>')+'<div class="vp-gear vp-left">'+gear.slice(0,3).join('')+'</div><div class="vp-gear vp-right">'+gear.slice(3).join('')+'</div></div><div class="vp-stats"><h2>Karakter İstatistikleri</h2><div class="vp-statgrid">'+stats.map(([k,v])=>'<div class="vp-stat"><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</div></div></div></div>';
 modal.querySelector('.valor-rank-back').addEventListener('click',()=>modal.remove());modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});document.body.appendChild(modal);
};
