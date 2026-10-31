/* Genel Pazar: players sell unbound talismans to each other for diamonds (supabase/market.sql).
   Sales are anonymous: neither side sees the other's name. Fixed price by level; 10% tax comes out of the seller's share, which waits as "Kazanç" until
   collected. Every action first saves the game, then calls the server with the save revision and
   finally takes the server's inventory and diamonds, so nothing can be duplicated or lost. */
(function(){
 'use strict';
 const PAGE='Pazar',PRICES=[100,250,600,1400,3000,6000,12000,24000,48000,96000],TAX=.10;
 window.valorBazaarPrice=lvl=>PRICES[Math.max(1,Math.min(10,Number(lvl)||1))-1];
 const B={tab:'buy',list:null,mine:null,loading:false,error:'',busy:false,filter:{level:'',color:'',type:''},pending:null};
 const esc=v=>escapeAttr(String(v??''));
 const online=()=>!!(typeof valorAccountActive!=='undefined'&&valorAccountActive?.cloud&&typeof valorCloudFetch==='function');
 const rpc=(name,body={})=>valorCloudFetch('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body)});
 const errText=e=>{const m=String(e?.message||e||'');if(e?.status===404||e?.code==='PGRST202')return 'Pazar sunucuda henüz kurulmadı.';return m||'Bağlantı hatası'};
 async function refresh(){
  if(!online())return;B.loading=true;
  try{const [list,mine]=await Promise.all([rpc('market_browse'),rpc('market_mine')]);B.list=Array.isArray(list)?list:[];B.mine=mine||{proceeds:0,open:0,sold:[]};B.error=''}
  catch(e){B.error=errText(e)}
  finally{B.loading=false;if(page===PAGE)render()}
 }
 /* Save first, call the server with the current revision, then adopt the server's bag and diamonds. */
 async function act(name,args,done){
  if(B.busy)return;if(!online())return toast('Pazar için hesabınla giriş yap');
  const owner=valorAccountActive.id,before=state;B.busy=true;render();
  try{
   await valorCloudFlush();if(valorCloudBlocked||valorCloudStatus!=='saved')throw Error('Bulut kaydı tamamlanamadı. Tekrar dene.');
   if(state!==before||valorAccountActive?.id!==owner)throw Error('Aktif karakter değişti.');
   const result=await rpc(name,{...args,expected_rev:valorCloudRev(owner)});
   const latest=await valorCloudLoad(owner);if(!latest)throw Error('Güncel kayıt yüklenemedi.');
   if(state===before&&valorAccountActive?.id===owner){
    state.inventory=JSON.parse(JSON.stringify(latest.data.state.inventory||[]));state.diamonds=Number(latest.data.state.diamonds)||0;
    localStorage.setItem(valorCloudRevKey(owner),String(latest.rev));save();
   }
   closeBagPopup();if(done)done(result);
  }catch(e){toast(errText(e));if(/Kayıt değişti/.test(String(e?.message))&&typeof valorCloudConflict==='function')valorCloudConflict()}
  finally{B.busy=false;refresh()}
 }
 function dialog(html){closeBagPopup();const o=document.createElement('div');o.id='valor-bag-popup';o.className='valor-item-overlay';o.innerHTML='<section class="valor-item-dialog vt-dialog vbz-dialog" role="dialog" aria-modal="true" aria-label="Pazar"><button type="button" class="valor-item-close" onclick="closeBagPopup()" aria-label="Kapat">×</button>'+html+'</section>';o.addEventListener('click',e=>{if(e.target===o)closeBagPopup()});document.body.appendChild(o)}
 const colors=()=>window.valorTalismanColors||[],types=()=>window.valorTalismanTypes||[];
 function statsHtml(it){const n={atk:'Saldırı',def:'Defans',matk:'Sihirli Saldırı',mdef:'Sihirli Defans',hp:'Can'},L=Math.max(1,Math.min(10,Number(it.talismanLevel)||1));return Object.entries(it.talismanRolls||{}).map(([k,v])=>'<span><small>'+n[k]+'</small><b>+'+money(Math.round(v*L/10))+'</b></span>').join('')}
 function listingCard(l){
  const it=l.item,c=colors()[l.color]||{hex:'#999',name:''},art=typeof valorTalismanArt==='function'?valorTalismanArt(it):'';
  return '<article class="vbz-card" style="--vt-color:'+c.hex+'"><img src="'+art+'" alt=""><div class="vbz-copy"><b>'+esc(it.name)+'</b><small><i class="vt-dot"></i>'+c.name+' · Sv. '+l.level+(l.mine?' · <b class="vbz-mine">Senin ilanın</b>':'')+'</small><span class="vt-card-stats">'+statsHtml(it)+'</span></div><div class="vbz-buy">'+(l.mine?'<button type="button" onclick="valorBazaarCancelAsk('+l.id+')">Geri Çek</button>':'<button type="button" '+(B.busy?'disabled':'')+' onclick="valorBazaarBuyAsk('+l.id+')">'+money(l.price)+' 💎</button>')+'</div></article>';
 }
 function filters(){
  const f=B.filter,opt=(v,t,s)=>'<option value="'+esc(v)+'"'+(String(v)===String(s)?' selected':'')+'>'+esc(t)+'</option>';
  return '<div class="vbz-filters"><select onchange="valorBazaarFilter(\'level\',this.value)">'+opt('','Tüm seviyeler',f.level)+Array.from({length:10},(_,i)=>opt(i+1,'Sv. '+(i+1),f.level)).join('')+'</select><select onchange="valorBazaarFilter(\'color\',this.value)">'+opt('','Tüm renkler',f.color)+colors().map(c=>opt(c.id,c.name,f.color)).join('')+'</select><select onchange="valorBazaarFilter(\'type\',this.value)">'+opt('','Tüm türler',f.type)+types().map(t=>opt(t.id,t.name.replace(' Tılsımı',''),f.type)).join('')+'</select></div>';
 }
 function buyTab(){
  if(!B.list)return '<p class="vt-muted">İlanlar yükleniyor…</p>';
  const f=B.filter,list=B.list.filter(l=>(!f.level||l.level==f.level)&&(f.color===''||l.color==f.color)&&(!f.type||l.type===f.type));
  return filters()+'<p class="vbz-count">'+list.length+' ilan</p>'+(list.length?'<div class="vbz-list">'+list.map(listingCard).join('')+'</div>':'<p class="vt-muted">Bu filtrede satılık tılsım yok.</p>');
 }
 function sellTab(){
  const mine=B.mine||{proceeds:0,open:0,sold:[]},own=(B.list||[]).filter(l=>l.mine);
  const free=(typeof valorTalismanAll==='function'?valorTalismanAll():[]).filter(it=>!valorTalismanIsBound(it)&&valorTalismanEquippedIn(it)<0).sort((a,b)=>b.talismanLevel-a.talismanLevel);
  return '<div class="vbz-proceeds"><span><small>Toplanacak kazanç</small><b>'+money(mine.proceeds||0)+' 💎</b><i>Satıştan %10 pazar vergisi düşülür</i></span><button type="button" '+(!(mine.proceeds>0)||B.busy?'disabled':'')+' onclick="valorBazaarClaim()">Topla</button></div>'
   +'<h3 class="vt-h">İlanlarım <small>'+own.length+' / 20</small></h3>'+(own.length?'<div class="vbz-list">'+own.map(listingCard).join('')+'</div>':'<p class="vt-muted">Açık ilanın yok.</p>')
   +'<h3 class="vt-h">Satılabilir tılsımlar <small>'+free.length+'</small></h3><p class="vt-muted">Sadece hiç kuşanılmamış (bağdaştırılmamış) tılsımlar satılabilir. Fiyat seviyeye göre sabittir.</p>'
   +(free.length?'<div class="vt-list">'+free.map(it=>valorTalismanCard(it,'<span class="vt-card-pick" onclick="event.stopPropagation();valorBazaarSellAsk(\''+esc(it.id)+'\')">Sat · '+money(valorBazaarPrice(it.talismanLevel))+'</span>')).join('')+'</div>':'<p class="vt-muted">Satılabilir tılsımın yok.</p>')
   +(mine.sold?.length?'<h3 class="vt-h">Son satışlar</h3><div class="vbz-sold">'+mine.sold.map(s=>'<span><b>'+esc(s.item?.name)+' · Sv. '+esc(s.item?.talismanLevel)+'</b><small>+'+money(Math.floor(s.price*(1-TAX)))+' 💎</small></span>').join('')+'</div>':'');
 }
 function pageHtml(){
  const head='<header class="vt-heading"><small>OYUNCULAR ARASI</small><h1>Genel Pazar</h1><p>Bağdaştırılmamış tılsımlar elmasla alınıp satılır. Alıcı ve satıcı birbirini görmez.</p></header>';
  if(!online())return '<section class="vt-page vbz-page">'+head+'<p class="vt-muted">Pazar için hesabınla giriş yapmalısın.</p></section>';
  if(!B.list&&!B.loading&&!B.error)setTimeout(refresh,0);
  const prices='<details class="vbz-prices"><summary>Fiyat tablosu</summary><div>'+PRICES.map((p,i)=>'<span>Sv. '+(i+1)+' <b>'+money(p)+'</b></span>').join('')+'</div></details>';
  return '<section class="vt-page vbz-page">'+head+'<div class="vt-tabs" role="tablist"><button type="button" role="tab" aria-selected="'+(B.tab==='buy')+'" onclick="valorBazaarTab(\'buy\')">Satın Al</button><button type="button" role="tab" aria-selected="'+(B.tab==='sell')+'" onclick="valorBazaarTab(\'sell\')">Sat'+((B.mine?.proceeds||0)>0?' <i class="vbz-dot"></i>':'')+'</button></div>'+(B.error?'<p class="vch-error">'+esc(B.error)+'</p>':'')+prices+(B.tab==='buy'?buyTab():sellTab())+'</section>';
 }
 window.valorBazaarTab=t=>{B.tab=t==='sell'?'sell':'buy';render();refresh()};
 window.valorBazaarFilter=(k,v)=>{B.filter[k]=v;render()};
 window.valorBazaarSellAsk=function(id){
  const it=typeof valorTalismanFind==='function'&&valorTalismanFind(id);if(!it)return;
  if(valorTalismanIsBound(it)||valorTalismanEquippedIn(it)>=0)return toast('Bağdaştırılmış tılsım satılamaz');
  const price=valorBazaarPrice(it.talismanLevel);B.pending={kind:'sell',id:String(it.id)};
  dialog('<small class="vt-kicker">GENEL PAZAR · SAT</small><img class="vt-dialog-art" src="'+valorTalismanArt(it)+'" alt=""><h3>'+esc(it.name)+' · Sv. '+it.talismanLevel+'</h3><p>Satış fiyatı: <b>'+money(price)+' 💎</b><br>Eline geçecek: <b>'+money(Math.floor(price*(1-TAX)))+' 💎</b> (%10 vergi)</p><p class="vt-muted">Tılsım çantandan çıkar ve ilana konur. Satılana kadar ilanı geri çekebilirsin.</p><div class="vt-dialog-actions"><button type="button" onclick="closeBagPopup()">Vazgeç</button><button type="button" onclick="valorBazaarConfirm()">İlana Koy</button></div>');
 };
 window.valorBazaarBuyAsk=function(id){
  const l=(B.list||[]).find(x=>x.id===id);if(!l)return;B.pending={kind:'buy',id};
  const c=colors()[l.color]||{name:''};
  dialog('<small class="vt-kicker">GENEL PAZAR · SATIN AL</small><img class="vt-dialog-art" src="'+valorTalismanArt(l.item)+'" alt=""><h3>'+esc(l.item.name)+'</h3><p>'+c.name+' · Sv. '+l.level+'</p><div class="vt-dialog-stats">'+statsHtml(l.item)+'</div><p>Fiyat: <b>'+money(l.price)+' 💎</b><br>Elmasın: '+money(Number(state.diamonds)||0)+'</p><div class="vt-dialog-actions"><button type="button" onclick="closeBagPopup()">Vazgeç</button><button type="button" '+((Number(state.diamonds)||0)<l.price?'disabled':'')+' onclick="valorBazaarConfirm()">'+((Number(state.diamonds)||0)<l.price?'Elmasın yetersiz':'Satın Al')+'</button></div>');
 };
 window.valorBazaarCancelAsk=function(id){B.pending={kind:'cancel',id};dialog('<small class="vt-kicker">GENEL PAZAR</small><h3>İlan geri çekilsin mi?</h3><p class="vt-muted">Tılsım çantana geri döner.</p><div class="vt-dialog-actions"><button type="button" onclick="closeBagPopup()">Vazgeç</button><button type="button" onclick="valorBazaarConfirm()">Geri Çek</button></div>')};
 window.valorBazaarConfirm=function(){
  const p=B.pending;B.pending=null;if(!p)return;
  if(p.kind==='sell')act('market_list',{item_id:p.id},r=>{toast('Tılsım ilana kondu · '+money(r?.price||0)+' 💎');if(page!==PAGE){B.tab='sell';go(PAGE)}else render()});
  else if(p.kind==='buy')act('market_buy',{listing_id:p.id},()=>{toast('Tılsım çantana eklendi');render()});
  else act('market_cancel',{listing_id:p.id},()=>{toast('İlan geri çekildi · tılsım çantanda');render()});
 };
 window.valorBazaarClaim=()=>act('market_claim',{},r=>toast('+'+money(r?.claimed||0)+' 💎 kazanç toplandı'));
 const prevRender=render;
 render=function(){const r=prevRender.apply(this,arguments);if(page===PAGE&&state.class&&(typeof valorAccountCanPlay!=='function'||valorAccountCanPlay())){const m=document.getElementById('main');if(m)m.innerHTML=pageHtml()}return r};
 setInterval(()=>{if(page===PAGE&&!document.hidden&&online()&&!B.busy)refresh()},30000);
})();
