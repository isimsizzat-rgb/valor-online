const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const code=fs.readFileSync('assets/hearts/hearts.js','utf8');
const elements={'vheart-buy-error':{},vmMarketPurchaseConfirm:{},'vheart-name':{value:'Arkadas'},'vheart-amount':{value:'99'},'vheart-send-error':{}};
let calls=[],notifications=[],blocked=false,closed=0;
const ctx={console,crypto:require('node:crypto').webcrypto,marketProducts:[],marketProduct:()=>null,openMarketPurchase(){},buyMarketProduct(){},bulkInventoryControls(){return 'old'},useInventoryItem(){},useInventoryStack(){},valorOpenRankProfile(){},go(){},page:'Anasayfa',state:{diamonds:1000,inventory:[],name:'Ahmet'},money:String,render(){},save(){},closeMarketPurchase(){closed++},toast:m=>notifications.push(m),valorCloudBlocked:false,valorCloudStatus:'saved',valorCloudDirty:false,valorCloudBusy:null,valorAccountActive:{id:'me',cloud:true},valorCloudFlush:async()=>{},valorCloudRev:()=>4,valorCloudRevKey:()=>'',valorCloudSchedule(){},valorCloudLoad:async()=>({rev:5,data:{state:{diamonds:951}}}),valorCloudConflict(){blocked=true;ctx.valorCloudBlocked=true},localStorage:{setItem(){}},document:{getElementById:id=>elements[id]||null,querySelector:()=>null,querySelectorAll:()=>[]},valorRankOnline:{},valorCloudFetch:async(path,opt)=>{calls.push({path,body:JSON.parse(opt.body)});if(path.endsWith('heart_balance'))return 99;if(path.endsWith('heart_buy'))return {balance:99,diamonds:951,rev:5};if(path.endsWith('heart_send'))return {balance:0,recipient:'Arkadas',amount:99,popularity:99}},escapeAttr:String,marketPurchaseId:'heart99'};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
(async()=>{
 assert.deepEqual(Array.from(ctx.marketProducts,p=>[p.amount,p.price]),[[99,49],[999,499],[9999,4999]]);
 await ctx.buyMarketProduct();assert.equal(ctx.state.diamonds,951);assert.equal(ctx.state.inventory[0].count,99);assert.equal(closed,1);assert.equal(calls.filter(c=>c.path.endsWith('heart_buy')).length,1);
 assert.match(ctx.bulkInventoryControls(0,ctx.state.inventory[0]),/Kalp Gönder/);
 elements['vheart-amount'].value='0';await ctx.valorHeartSend({preventDefault(){}});assert.equal(calls.filter(c=>c.path.endsWith('heart_send')).length,0);
 elements['vheart-amount'].value='100';await ctx.valorHeartSend({preventDefault(){}});assert.equal(calls.filter(c=>c.path.endsWith('heart_send')).length,0);
 elements['vheart-amount'].value='99';elements['vheart-name'].value='Ahmet';await ctx.valorHeartSend({preventDefault(){}});assert.equal(calls.filter(c=>c.path.endsWith('heart_send')).length,0);
 elements['vheart-name'].value='Arkadas';await ctx.valorHeartSend({preventDefault(){}});assert.equal(ctx.state.inventory.length,0);assert.equal(calls.filter(c=>c.path.endsWith('heart_send')).length,1);assert.match(notifications.at(-1),/99 kalp/);
 ctx.valorCloudFetch=async()=>{throw Object.assign(Error('missing'),{status:404,code:'PGRST202'})};await ctx.buyMarketProduct();assert.equal(ctx.state.diamonds,951);assert.match(elements['vheart-buy-error'].textContent,/henüz etkinleştirilmedi/);assert.equal(blocked,false);
 ctx.valorCloudFetch=async()=>{throw Error('Network error')};await ctx.buyMarketProduct();assert.equal(ctx.state.diamonds,951);assert.equal(blocked,true);
 console.log('PASS: package prices, server purchase, bag action, gift debit, invalid amounts/self-gift, unavailable backend and uncertain network result');
})().catch(e=>{console.error(e);process.exitCode=1});
