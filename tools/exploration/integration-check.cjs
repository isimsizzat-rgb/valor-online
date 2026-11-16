const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createCanvas,Image:NativeImage}=require('@napi-rs/canvas');
(async()=>{for(const width of [390,800])for(const kind of ['adventure','stage']){
 const frames=[],timers=[],events={},keys={},button={disabled:true},hint={textContent:''};let saved=0,stageSaved=0,advanced=0;
 const canvas=createCanvas(width,700);canvas.style={};canvas.getBoundingClientRect=()=>({left:0,top:0,width,height:700});canvas.addEventListener=(k,f)=>events[k]=f;canvas.focus=()=>{};
 const el={dataset:{walk:kind},isConnected:true,parentElement:{querySelectorAll:()=>[button]},querySelector:q=>q==='canvas'?canvas:q==='.walk-hint'?hint:null,querySelectorAll:()=>[],addEventListener:(k,f)=>keys[k]=f,contains:()=>false};
 const doc={body:{},hidden:false,createElement:()=>createCanvas(1,1),querySelectorAll:()=>[el],addEventListener(){},getElementById:()=>null};
 class Image extends NativeImage{set src(p){super.src=fs.readFileSync(p)}}
 const sandbox={console,Math,Number,Map,Set,Date,Image,AbortController,performance:{now:()=>0},document:doc,requestAnimationFrame:f=>(frames.push(f),frames.length),cancelAnimationFrame(){},setTimeout:f=>(timers.push(f),timers.length),clearTimeout:id=>{if(id)timers[id-1]=null},ResizeObserver:class{observe(){}disconnect(){}},MutationObserver:class{observe(){}},state:{class:'Savaşçı',gender:'male',adventureRun:{zone:0,i:0,phase:'story',steps:Array.from({length:10},()=>({foe:'Yaban Kurdu',kind:'fight'}))}},stageRun:{area:0,step:0,hp:1000},stageFoes:Array(7).fill('Lanetli Muhafız'),valorAdventureZones:[{name:'Kadim Patika'}],stageAreas:[{name:'Karanlık Orman'}],escapeAttr:s=>s,money:s=>s,save:()=>saved++,stageRunSave:()=>stageSaved++,stageAdventurePage:()=>'<div class="stage-adventure"><img class="stage-adventure-art" src="x"><button onclick="stageNext()">Devam</button></div>',stageNext:()=>{advanced++;sandbox.stageRun.step=1;sandbox.stageRun.enemy={name:'Kurt'}},valorStageUnits:()=>({me:{},foe:{}}),valorArenaStats:()=>({}),valorArenaHit:()=>({damage:80}),render(){},toast(){},addEventListener(){},valorExpedition:{ambush(){advanced++;sandbox.state.adventureRun.phase='fight'}}};sandbox.window=sandbox;
 vm.createContext(sandbox);for(const name of ['map-core','art','map'])vm.runInContext(fs.readFileSync('assets/exploration/'+name+'.js','utf8'),sandbox);
 let time=0;function pump(n){for(let i=0;i<n;i++){time+=16;const f=frames.shift();if(f)f(time);if(i%15===0)canvas.getContext('2d').getImageData(0,0,1,1)}}
 await new Promise(r=>setTimeout(r,100));pump(2);await new Promise(r=>setTimeout(r,100));pump(2);
 const run=kind==='adventure'?sandbox.state.adventureRun:sandbox.stageRun;
 assert(!sandbox.ValorWalk.near(kind));assert(button.disabled);assert.equal(sandbox.ValorWalk.engage(kind),false);
 keys.keydown({key:'ArrowLeft',preventDefault(){}});pump(120);keys.keyup({key:'ArrowLeft',preventDefault(){}});pump(2);assert(run.walkPosition.x>=90);assert(sandbox.ValorWalkCore.create(0,kind==='stage'?7:10).walkable(run.walkPosition.x,run.walkPosition.y));
 keys.keydown({key:'ArrowRight',preventDefault(){}});pump(80);keys.keyup({key:'ArrowRight',preventDefault(){}});pump(2);
 assert(sandbox.ValorWalk.near(kind));assert.equal(button.disabled,false);assert.equal(timers.filter(Boolean).length,1);assert(kind==='adventure'?saved>0:stageSaved>0);
 if(kind==='adventure')fs.writeFileSync('/tmp/valor-walk-art-'+width+'.png',canvas.toBuffer('image/png'));
 const trigger=timers.find(Boolean);trigger();assert.equal(advanced,1);assert.equal(sandbox.ValorWalk.engage(kind),false);assert.equal(advanced,1);
 if(kind==='stage')assert.equal(run.hp,920);
 el.isConnected=false;pump(1);assert.equal(frames.length,0);
 console.log('PASS: '+kind+' '+width+'px: sprites, movement, collision, one-shot ambush, first damage, persistence, cleanup');
}})().catch(e=>{console.error(e);process.exitCode=1});
