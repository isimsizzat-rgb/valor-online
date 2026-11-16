/* Shared, deterministic walking geometry. No rewards or encounter mutation here. */
(function(root){
 'use strict';
 const TILE=40,COLS=36,ROWS=26;
 const stops=[{x:7,y:20},{x:14,y:20},{x:23,y:20},{x:29,y:17},{x:25,y:12},{x:17,y:12},{x:8,y:12},{x:6,y:6},{x:17,y:5},{x:29,y:5}];
 const center=p=>({x:(p.x+.5)*TILE,y:(p.y+.5)*TILE});
 function create(seed=0,count=10){
  const points=seed===0?stops.map((p,i)=>i===2?{x:23,y:19}:i===3?{x:29,y:16}:p):stops;
  const nodes=count===7?[points[0],points[1],points[3],points[4],points[6],points[7],points[9]]:points;
  const route=[{x:3,y:20},...points];
  const road=(x,y)=>route.some((p,i)=>{if(!i)return false;const a=route[i-1],dx=p.x-a.x,dy=p.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<1.8});
  const hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453;return v-Math.floor(v)};
  const cells=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>x>1&&y>1&&x<COLS-2&&y<ROWS-2&&(road(x,y)||(seed!==0&&hash(x,y)>.21))));
  const pass=(x,y)=>!!cells[y]?.[x];
  function path(from,to){
   const a={x:Math.floor(from.x/TILE),y:Math.floor(from.y/TILE)},b={x:Math.floor(to.x/TILE),y:Math.floor(to.y/TILE)};
   if(!pass(b.x,b.y)||!pass(a.x,a.y))return [];
   const key=p=>p.y*COLS+p.x,q=[a],prev=new Map([[key(a),null]]);let end=null;
   for(let i=0;i<q.length;i++){const p=q[i];if(key(p)===key(b)){end=p;break}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};if(pass(n.x,n.y)&&!prev.has(key(n))){prev.set(key(n),p);q.push(n)}}}
   if(!end)return [];const result=[];while(end){result.unshift(center(end));end=prev.get(key(end))}return result;
  }
  const walkable=(x,y)=>[[-10,-10],[10,-10],[-10,10],[10,10]].every(([dx,dy])=>pass(Math.floor((x+dx)/TILE),Math.floor((y+dy)/TILE)));
  return {seed,cells,road,hash,path,walkable,nodes:nodes.map(center),start:center(route[0]),width:COLS*TILE,height:ROWS*TILE};
 }
 const api={create,TILE,COLS,ROWS};root.ValorWalkCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
