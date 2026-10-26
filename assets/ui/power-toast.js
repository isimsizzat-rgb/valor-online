/* Shows "⚔ Savaş Gücü +X / -X" in the bottom notification area whenever combat power changes
   (equip, enhance, astrology, guardians, mounts, technology, gems ...). Changes within the display
   time add up. The baseline resets on page load and when the active character changes. */
(function(){
 let lastState=null,lastPower=null,pending=null,shown=0,hideTimer=null,measuring=false;
 function el(){let e=document.getElementById('valor-power-toast');if(!e){e=document.createElement('div');e.id='valor-power-toast';e.setAttribute('role','status');document.body.appendChild(e)}return e}
 function place(e){
  const nav=document.getElementById('bottomNav'),r=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect():null;
  let bottom=r&&r.height?Math.round(innerHeight-r.top+12):20;
  const t=document.getElementById('toast');if(t&&t.style.display==='block')bottom+=t.getBoundingClientRect().height+8;
  e.style.bottom=bottom+'px';
 }
 function show(delta){
  shown+=delta;const e=el();e.className=shown>=0?'up':'down';e.textContent='⚔ Savaş Gücü '+(shown>=0?'+':'-')+money(Math.abs(shown));
  place(e);e.style.display='block';e.style.animation='none';void e.offsetWidth;e.style.animation='';
  clearTimeout(hideTimer);hideTimer=setTimeout(()=>{e.style.display='none';shown=0},2800);
 }
 function measure(){
  pending=null;if(measuring||!state?.class||typeof valorAccountCanPlay==='function'&&!valorAccountCanPlay())return;
  measuring=true;let power;try{power=combatPower()}catch(err){power=null}finally{measuring=false}
  if(!Number.isFinite(power))return;
  if(lastState!==state||lastPower===null){lastState=state;lastPower=power;return}
  const delta=Math.round(power-lastPower);lastPower=power;if(delta)show(delta);
 }
 const previousSave=save;
 save=function(){const result=previousSave.apply(this,arguments);if(!measuring&&!pending)pending=setTimeout(measure,60);return result};
 const previousToast=toast;
 toast=function(){const result=previousToast.apply(this,arguments);const e=document.getElementById('valor-power-toast');if(e&&e.style.display==='block')place(e);return result};
 setTimeout(measure,0);
})();
