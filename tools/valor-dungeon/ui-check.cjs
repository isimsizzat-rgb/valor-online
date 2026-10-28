/* Run from repository root. Optional: CHROMIUM_EXECUTABLE=/path/to/chromium. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));const p=fs.existsSync(file)&&fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;fs.readFile(p,(e,b)=>{if(e){res.writeHead(404);res.end();return}const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.jpg':'image/jpeg'};res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.end(b)})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
 try{for(const width of [360,390,768]){
  const p=await browser.newPage({viewport:{width,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port);await p.evaluate(()=>{state.class='Savaşçı';state.name='Testci';state.level=10;valorAccountActive=null;valorAccountGate=false;sessionStorage.setItem(VALOR_ACCOUNT_SESSION,'guest');go('Harita');valorZindan.open()});
  assert.equal(await p.locator('.vzd-floor').count(),30);await p.getByRole('button',{name:'30. kat, Valor Hükümdarı',exact:true}).click();assert.match(await p.locator('#vzd-title').innerText(),/Valor Hükümdarı/);await p.evaluate(()=>valorZindan.back());
  await p.evaluate(()=>{valorZindan.create();valorZindan.start()});assert.equal(await p.locator('.vzd-player').count(),1);assert.equal(await p.locator('.vzd-empty').count(),2);assert.match(await p.locator('.vzd-player img').getAttribute('src'),/assets\/img\//);
  const check=await p.evaluate(()=>{const d=document.querySelector('.vzd-dialog');return {overflow:d.scrollWidth>d.clientWidth,badImages:Array.from(d.querySelectorAll('img')).filter(i=>i.complete&&!i.naturalWidth).length}});assert.equal(check.overflow,false);assert.equal(check.badImages,0);
  // Deterministic player fixtures keep test battles short and avoid changing global progression.
  await p.evaluate(()=>{state.valorDungeonV1.room.members[0].attack=1e9;state.valorDungeonV1.room.members[0].hp=1e9;state.valorDungeonV1.room.members[0].maxHp=1e9});
  for(let f=1;f<=7;f++){await p.evaluate(()=>valorZindan.fight());assert.match(await p.locator('#vzd-overlay').innerText(),new RegExp(f+'\\. kat geçildi'))}
  await p.evaluate(()=>{const r=state.valorDungeonV1.room;r.boss.attack=1e12;r.members[0].attack=1;r.members[0].hp=1;valorZindan.fight()});
  assert.match(await p.locator('#vzd-title').innerText(),/Takım Yenildi/);assert.equal(await p.evaluate(()=>state.valorDungeonV1.chests),7);
  const before=await p.evaluate(()=>({diamonds:state.diamonds,shards:state.shards,stones:state.stones[1]||0,stock:Object.fromEntries(['energyBottle','expeditionPaper','petFood'].map(id=>[id,state.inventory.filter(x=>x.marketItemId===id).reduce((s,x)=>s+(x.count||1),0)]))}));
  await p.evaluate(()=>valorZindan.chests());assert.equal(await p.locator('.vzd-reward').count(),6);await p.evaluate(()=>valorZindan.openChests(true));
  const after=await p.evaluate(()=>({diamonds:state.diamonds,shards:state.shards,stones:state.stones[1]||0,chests:state.valorDungeonV1.chests,stock:Object.fromEntries(['energyBottle','expeditionPaper','petFood'].map(id=>[id,state.inventory.filter(x=>x.marketItemId===id).reduce((s,x)=>s+(x.count||1),0)]))}));assert.equal(after.chests,0);assert.equal(after.diamonds-before.diamonds,175);assert.equal(after.shards-before.shards,7);assert.equal(after.stones-before.stones,7);for(const id of Object.keys(after.stock))assert.equal(after.stock[id]-before.stock[id],7);
  await p.evaluate(()=>valorZindan.openChests(true));assert.equal(await p.evaluate(()=>state.diamonds),after.diamonds);await p.keyboard.press('Escape');assert.equal(await p.locator('#vzd-overlay').count(),0);
  // Valid chat markers render as buttons; arbitrary HTML stays escaped.
  const chat=await p.evaluate(()=>{valorAccountActive={id:'x',cloud:true};return valorChatRow({name:'Testci',user_id:'x',class:'Savaşçı',body:'<script>alert(1)</script> [VALOR-ZINDANI:00000000-0000-0000-0000-000000000001]',created_at:new Date().toISOString()})});assert(chat.includes('valorZindan.join'));assert(!chat.includes('<script>'));
  assert.deepEqual(errors,[]);await p.close();console.log('PASS: '+width+'px mobile/tablet UI, all 30 boss previews, battle, 7-floor loss, chest contents, duplicate-open protection and safe chat invite.');
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
