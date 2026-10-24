/* Start at Home and prevent browser scroll restoration across game pages. */
(function(){
 if('scrollRestoration' in history)history.scrollRestoration='manual';
 let startupTouched=false;
 for(const event of ['touchstart','wheel','pointerdown','keydown'])window.addEventListener(event,()=>{startupTouched=true},{passive:true,once:true});
 function top(){const root=document.scrollingElement||document.documentElement;root.scrollTop=0;root.scrollLeft=0;window.scrollTo({top:0,left:0,behavior:'instant'});}
 function reset(){top();requestAnimationFrame(top);}
 const previousGo=go;
 go=function(destination){const result=previousGo.apply(this,arguments);reset();return result;};
 function start(){
  if(typeof valorAccountCanPlay==='function'&&valorAccountCanPlay()&&state.class){
   const castleTest=new URLSearchParams(location.search).get('castleTest')==='1';
   page=castleTest?'Kale Testi':'Anasayfa';selected=null;
  }
  render();reset();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.addEventListener('load',()=>{if(!startupTouched)reset();},{once:true});
 window.addEventListener('pageshow',event=>{if(event.persisted){startupTouched=false;start();}else if(!startupTouched)reset();});
})();
