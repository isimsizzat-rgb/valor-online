/* Rendering must not stall event playback when RAF timestamps precede performance.now,
   and closing a fight must drain pending cosmetic events without altering combat data. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const frames=[],draws=[];let time=100;
const gradient={addColorStop(){}};
const ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,drawImage(...a){assert(a.slice(1).every(Number.isFinite));draws.push(a)}},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const canvas={width:1000,height:480,getContext:()=>ctx};
const root={isConnected:true},parent={};const status={textContent:''};
const before={parentNode:parent,before(w){w.parentNode=parent;w.nextSibling=before}};
root.querySelector=()=>before;
class Image{constructor(){this.width=1774;this.height=887;this.complete=true;this.naturalWidth=1774}set src(v){this.url=v;queueMicrotask(()=>this.onload?.())}}
const document={head:{appendChild(){}},createElement(tag){return tag==='div'?{querySelector:s=>s==='canvas'?canvas:status,remove(){this.parentNode=null}}:{}}};
const window={};vm.runInNewContext(fs.readFileSync('assets/arena/combat-motion.js','utf8'),{window,document,Image,console,performance:{now:()=>time},requestAnimationFrame:f=>(frames.push(f),frames.length),WeakMap,Map,Promise,Math,Number});
const M=window.ValorCombatMotion,players=[{name:'A',cls:'Savaşçı',gender:'female'},{name:'B',cls:'Savaşçı',gender:'male'}];
async function pump(p){let done=false;p.then(()=>done=true);for(let i=0;i<1000&&!done;i++){await new Promise(setImmediate);const batch=frames.splice(0);for(const f of batch)f(time-1);time+=16}assert(done,'Cosmetic queue did not finish')}
(async()=>{M.mount(root,players);const event={side:'me',skill:'strong',damage:123,hit:{}};const snapshot=JSON.stringify(event);await pump(M.play(root,event,...players));assert.equal(JSON.stringify(event),snapshot);assert(draws.length>30);const n=draws.length;await pump(M.play(root,{side:'foe',skill:'max',damage:222},players[1],players[0]));assert(draws.length>n);const pending=M.play(root,{side:'me',skill:'max'},...players);M.close(root);await pump(pending);console.log('PASS: first-frame timing, strong/max playback, immutable damage event, close drains queue');})().catch(e=>{console.error(e);process.exitCode=1});
