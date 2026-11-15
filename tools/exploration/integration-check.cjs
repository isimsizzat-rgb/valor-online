const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createCanvas}=require('@napi-rs/canvas');
for(const width of [390,800])for(const kind of ['adventure','stage']){
 const frames=[],events={},keys={},button={disabled:true},hint={textContent:''};let saved=0,stageSaved=0,advanced=0;
 const canvas=createCanvas(width,410);canvas.style={};canvas.getBoundingClientRect=()=>({left:0,top:0,width,height:410});canvas.addEventListener=(k,f)=>events[k]=f;canvas.focus=()=>{};
 const el={dataset:{walk:kind},isConnected:true,parentElement:{querySelectorAll:()=>[button]},querySelector:q=>q==='canvas'?canvas:hint,querySelectorAll:()=>[],addEventListener:(k,f)=>keys[k]=f,contains:()=>false};
 const doc={body:{},hidden:false,createElement:()=>createCanvas(1,1),querySelectorAll:()=>[el],addEventListener(){},getElementById:()=>null};
 const sandbox={console,Math,Number,Map,Set,Date,AbortController,performance:{now:()=>0},document:doc,requestAnimationFrame:f=>(frames.push(f),frames.length),cancelAnimationFrame(){},ResizeObserver:class{observe(){}disconnect(){}},MutationObserver:class{observe(){}},state:{class:'Savaşçı',adventureRun:{zone:0,i:0,phase:'story'}},stageRun:{area:0,step:0},valorAdventureZones:[{name:'Kadim Patika'}],stageAreas:[{name:'Karanlık Orman'}],escapeAttr:s=>s,save:()=>saved++,stageRunSave:()=>stageSaved++,stageAdventurePage:()=>'<img class="stage-adventure-art" src="x"><button onclick="stageNext()">Devam</button>',stageNext:()=>advanced++,toast(){},addEventListener(){}};sandbox.window=sandbox;
 vm.createContext(sandbox);for(const name of ['map-core','map'])vm.runInContext(fs.readFileSync('assets/exploration/'+name+'.js','utf8'),sandbox);
 let time=0;function pump(n){for(let i=0;i<n;i++){time+=16;const f=frames.shift();if(f)f(time);if(i%15===0)canvas.getContext('2d').getImageData(0,0,1,1)}}pump(2);
 const run=kind==='adventure'?sandbox.state.adventureRun:sandbox.stageRun;
 assert(!sandbox.ValorWalk.near(kind));assert(button.disabled);
 if(kind==='stage'){sandbox.stageNext();assert.equal(advanced,0);assert(sandbox.stageAdventurePage().includes('data-walk="stage"'))}
 keys.keydown({key:'ArrowRight',preventDefault(){}});pump(60);keys.keyup({key:'ArrowRight',preventDefault(){}});pump(2);
 assert(run.walkPosition.x>280);assert(sandbox.ValorWalk.near(kind));assert.equal(button.disabled,false);assert(kind==='adventure'?saved>0:stageSaved>0);
 if(kind==='stage'){sandbox.stageNext();assert.equal(advanced,1)}
 if(kind==='adventure')fs.writeFileSync('/tmp/valor-walk-'+width+'.png',canvas.toBuffer('image/png'));
 // Walking into the outer boundary remains on passable terrain.
 keys.keydown({key:'ArrowLeft',preventDefault(){}});pump(300);keys.keyup({key:'ArrowLeft',preventDefault(){}});pump(2);assert(sandbox.ValorWalkCore.create(0,kind==='stage'?7:10).walkable(run.walkPosition.x,run.walkPosition.y));assert(run.walkPosition.x>=90);
 el.isConnected=false;pump(1);assert.equal(frames.length,0);
 console.log('PASS: '+kind+' '+width+'px: movement, proximity, collision, persistence, cleanup');
}
