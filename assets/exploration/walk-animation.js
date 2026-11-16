/* Direction and distance based animation shared by all exploration heroes. */
(function(root){
 'use strict';
 const ROWS={down:0,left:1,right:2,up:3};
 const CLASSES={'Savaşçı':'warrior','Büyücü':'mage','Okçu':'archer'};
 function key(cls,gender){return (CLASSES[cls]||'warrior')+'-'+(gender==='female'?'female':'male')}
 function direction(dx,dy,previous='down'){
  if(Math.hypot(dx,dy)<.01)return previous;
  // Hysteresis prevents rapid left/up flickering near a diagonal.
  const vertical=previous==='up'||previous==='down';
  if(Math.abs(dy)>(vertical?.85:1.15)*Math.abs(dx))return dy>0?'down':'up';
  return dx>0?'right':'left';
 }
 function pose(distance,moving,dir='down'){return {row:ROWS[dir]??0,frame:moving?Math.floor(Math.max(0,distance)/18)%6:1}}
 const api={key,direction,pose,ROWS};root.ValorWalkAnimation=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
