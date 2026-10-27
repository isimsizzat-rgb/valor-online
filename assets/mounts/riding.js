/* Riding selects a cosmetic mount. All bonuses still come from the collection and training. */
function valorRiddenMount(){const id=state.mountsV1?.riddenId;return id?vmActive().find(m=>m.id===id)||null:null}
function valorRideSummary(){
 const total=vmTotals(),training=vmData().training,ridden=valorRiddenMount();
 return {riddenId:ridden?.id||null,stats:total.stats.map((n,i)=>Number(n)+(Number(training[i]?.level)||0)*5),spirit:total.spirit};
}
function valorRideSelect(id){
 if(!state.class)return;
 const current=valorRiddenMount();
 if(id!==null&&!vmActive().some(m=>m.id===id))return toast('Yalnızca sahip olduğun bineğe binebilirsin.');
 if((current?.id||null)===id)return;
 vmData().riddenId=id;save();render();toast(id?valorMounts.find(m=>m.id===id).name+' seçildi.':'Binekten indin.');
}
function valorRideTile(summary,open){
 const mount=valorMounts.find(m=>m.id===summary?.riddenId);
 return '<button type="button" class="vp-slot vride-slot" aria-label="Binek bilgilerini aç" title="'+escapeAttr(mount?.name||'Binek seçilmedi')+'" '+(open?'onclick="valorRideOpen()"':'')+'>'+(mount?'<img src="'+vmMountImage(mount)+'" alt="'+escapeAttr(mount.name)+'">':'<span class="vp-empty vride-empty">♞</span>')+'<small class="vf-slot-caption">BİNEK</small></button>';
}
let valorRideReturnFocus=null;
function valorRideClose(){const dialog=document.getElementById('valor-ride-dialog');if(dialog){dialog.close();dialog.remove()}if(valorRideReturnFocus?.isConnected)valorRideReturnFocus.focus();valorRideReturnFocus=null}
function valorRideOpen(summary,owner){
 const own=!summary;if(own)summary=valorRideSummary();
 document.getElementById('valor-ride-dialog')?.remove();valorRideReturnFocus=document.activeElement;
 const mount=valorMounts.find(m=>m.id===summary.riddenId),dialog=document.createElement('dialog');dialog.id='valor-ride-dialog';dialog.className='vride-dialog';
 const safeNumber=n=>Math.max(0,Math.floor(Number(n)||0));
 dialog.innerHTML='<header><div><small>'+(own?'BİNEKLERİM':escapeAttr(owner||'Oyuncu'))+'</small><h2>Binek Bilgileri</h2></div><button type="button" aria-label="Binek penceresini kapat" onclick="valorRideClose()">×</button></header>'+(mount?'<div class="vride-preview"><img src="'+vmMountImage(mount)+'" alt="'+escapeAttr(mount.name)+'"></div><p class="vride-current">BİNİLEN BİNEK</p><h3>'+escapeAttr(mount.name)+'</h3>':'<div class="vride-none"><span aria-hidden="true">♞</span><p>Şu an bir bineğe binilmiyor.</p></div>')+'<section><h4>Toplam Binek Özellikleri</h4><p class="vride-note">Koleksiyon + binek gelişimi</p><div class="vride-totals">'+['Güç','Zeka','Zırh','Beden'].map((name,i)=>'<div><span>'+name+'</span><b>+'+money(safeNumber(summary.stats?.[i]))+'</b></div>').join('')+'</div><div class="vride-spirit"><span>Binek Ruhu</span><b>'+money(safeNumber(summary.spirit))+'</b></div></section>'+(own?'<p class="vride-note">Bin seçimi yalnızca görünümü değiştirir. Koleksiyon bonusların her zaman geçerlidir.</p><footer><button type="button" onclick="valorRideClose();go(\'Binek\')">Bineklerim</button>'+(mount?'<button type="button" onclick="valorRideClose();valorRideSelect(null)">İn</button>':'')+'</footer>':'');
 dialog.addEventListener('cancel',event=>{event.preventDefault();valorRideClose()});dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)valorRideClose()}});
 dialog.setAttribute('aria-label','Binek Bilgileri');document.body.appendChild(dialog);dialog.showModal();
}
(function(){
 const previousMountPage=vmMountPage;
 vmMountPage=function(){
  const template=document.createElement('template');template.innerHTML=previousMountPage.apply(this,arguments);
  const active=new Set(vmActive().map(m=>m.id)),ridden=valorRiddenMount();
  template.content.querySelectorAll('.vm-cards>.vm-card').forEach((card,i)=>{
   const mount=valorMounts[i],content=card.querySelector('.vm-card-content');if(!mount||!content)return;
   const button=document.createElement('button');button.type='button';button.className='vride-action';button.disabled=!active.has(mount.id);const selected=ridden?.id===mount.id;
   button.textContent=selected?'İn':button.disabled?'Kilitli':'Bin';button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',mount.name+(selected?' bineğinden in':' bineğine bin'));button.setAttribute('onclick',selected?'valorRideSelect(null)':'valorRideSelect('+JSON.stringify(mount.id)+')');
   if(selected){card.classList.add('vride-selected');const badge=document.createElement('span');badge.className='vride-badge';badge.textContent='BİNİLİYOR';card.querySelector('.vm-art')?.appendChild(badge)}
   content.appendChild(button);
  });
  const title=template.content.querySelector('.vm-section-title');if(title)title.insertAdjacentHTML('afterend','<p class="vride-collection-note">Görünüm için bir binek seç. Tüm koleksiyon bonusların korunur.</p>');
  return template.innerHTML;
 };
 const previousProfile=profile;
 profile=function(){
  const template=document.createElement('template');template.innerHTML=previousProfile.apply(this,arguments);
  const wing=template.content.querySelector('.vp-scene .vf-wing-equipment');if(wing){const pair=document.createElement('div');pair.className='vride-profile-pair';wing.replaceWith(pair);pair.appendChild(wing);pair.insertAdjacentHTML('beforeend',valorRideTile(valorRideSummary(),true))}
  return template.innerHTML;
 };
 if(typeof valorCloudProfile==='function'){
  const previousCloudProfile=valorCloudProfile;
  valorCloudProfile=function(){const base=previousCloudProfile.apply(this,arguments),wing=state.equipped?.Kanat;return {...base,mount:valorRideSummary(),wing:wing?{wingId:wing.wingId,level:valorWingLevel(wing)}:null}};
 }
 if(typeof valorOpenRankProfile==='function'){
  const previousOpenProfile=valorOpenRankProfile;
  valorOpenRankProfile=function(index){
   const result=previousOpenProfile.apply(this,arguments),row=(window.valorRankShown||[])[index],scene=document.querySelector('#valor-rank-modal .vp-scene');
   if(!scene||typeof valorRankIsOnline!=='function'||!valorRankIsOnline()||!row?.profile?.mount||scene.querySelector('.vride-slot'))return result;
   const wing=valorWings.find(w=>w.id===row.profile.wing?.wingId),pair=document.createElement('div');pair.className='vride-profile-pair';
   pair.innerHTML='<div class="vp-slot vf-wing-equipment" title="Kanat">'+(wing?'<img src="'+valorWingArt(wing)+'" alt="'+escapeAttr(wing.name)+'">':'<span class="vp-empty">✧</span>')+'<small class="vf-slot-caption">KANAT</small></div>'+valorRideTile(row.profile.mount,false);
   pair.querySelector('.vride-slot').addEventListener('click',()=>valorRideOpen(row.profile.mount,row.name));scene.querySelector('.vp-left')?.appendChild(pair);const spacer=document.createElement('div');spacer.className='vride-remote-spacer';scene.querySelector('.vp-right')?.appendChild(spacer);scene.classList.add('vride-remote');return result;
  };
 }
 if(state.class&&typeof valorAccountCanPlay==='function'&&valorAccountCanPlay())render();
})();
