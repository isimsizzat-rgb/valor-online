/* Daily rewards: 7-day login calendar + 6-hour diamond chest (shown on the home page). */
const VALOR_LOGIN_REWARDS=[
 [{k:'gold',n:100000}],
 [{k:'diamonds',n:20}],
 [{k:'petFood',n:5}],
 [{k:'luckBag',n:3}],
 [{k:'gold',n:250000},{k:'mountStone',n:10}],
 [{k:'mosaicStone',n:2},{k:'petFood',n:5}],
 [{k:'diamonds',n:100},{k:'anniversaryBox',n:1}]
];
const VALOR_CHEST_MS=6*60*60*1000;
const VALOR_CHEST_ROLLS=[[10,60],[20,25],[30,10],[50,5]]; // [diamonds, weight %]
const VALOR_GOLD_ICON='<img class="vr-res" src="assets/img/516a0f843e980d4f.webp" alt="">';
const VALOR_DIAMOND_ICON='<img class="vr-res" src="assets/img/491867083df2a72d.webp" alt="">';
let valorLoginPopupShown='';

function valorRewardDay(){return typeof marketTodayKey==='function'?marketTodayKey():new Date().toISOString().slice(0,10)}
function valorLoginData(){if(!state.loginReward||typeof state.loginReward!=='object')state.loginReward={day:0,last:''};return state.loginReward}
function valorLoginCanClaim(){return valorLoginData().last!==valorRewardDay()}
/* Days already claimed in the current 7-day cycle (0-7). A finished cycle starts over the next day. */
function valorLoginCycleDay(){const d=valorLoginData(),n=Math.max(0,Math.min(7,Number(d.day)||0));return n>=7&&valorLoginCanClaim()?0:n}
function valorRewardName(r){return {gold:'Altın',diamonds:'Elmas',petFood:'Pet Yemi',luckBag:'Şans Taşı Çantası',mountStone:'Binek Taşı',mosaicStone:'Mozaik Çantası',anniversaryBox:'Yıldönümü Kutusu'}[r.k]||r.k}
function valorRewardArt(r){try{if(r.k==='gold')return VALOR_GOLD_ICON;if(r.k==='diamonds')return VALOR_DIAMOND_ICON;if(r.k==='petFood'&&typeof valorPetFoodIcon!=='undefined')return valorPetFoodIcon;if(r.k==='luckBag')return luckStoneBagGraphic();if(r.k==='mountStone')return mountStoneGraphic();if(r.k==='mosaicStone')return mosaicStoneBagGraphic();if(r.k==='anniversaryBox')return anniversaryBoxGraphic()}catch(e){}return '🎁'}
function valorRewardAmount(r){return r.n>=1000?money(r.n):String(r.n)}
function valorGrantReward(r){if(r.k==='gold')state.gold=(Number(state.gold)||0)+r.n;else if(r.k==='diamonds')state.diamonds=(Number(state.diamonds)||0)+r.n;else addMarketStack(r.k,r.n)}

function valorLoginClaim(){if(!state.class||!valorLoginCanClaim())return;const d=valorLoginData(),idx=valorLoginCycleDay(),rewards=VALOR_LOGIN_REWARDS[idx];rewards.forEach(valorGrantReward);d.day=idx+1;d.last=valorRewardDay();save();render();valorLoginOpen();toast('Gün '+(idx+1)+' ödülü alındı: '+rewards.map(r=>valorRewardAmount(r)+' '+valorRewardName(r)).join(', '))}
function valorLoginClose(){const e=document.getElementById('vr-login');if(e)e.remove()}
function valorLoginOpen(){valorLoginClose();const cycle=valorLoginCycleDay(),can=valorLoginCanClaim(),o=document.createElement('div');o.id='vr-login';o.className='vr-overlay';o.innerHTML='<div class="vr-dialog" role="dialog" aria-modal="true" aria-label="7 Günlük Giriş Ödülü"><button class="vr-close" onclick="valorLoginClose()" aria-label="Kapat">×</button><span class="vr-eyebrow">HER GÜN GİRİŞ YAP</span><h2>7 Günlük Giriş Ödülü</h2><p class="vr-lead">Her gün bir ödül al. Bir gün kaçırırsan sıran bekler, kaldığın yerden devam edersin.</p><div class="vr-days">'+VALOR_LOGIN_REWARDS.map((rw,i)=>{const done=i<cycle,today=can&&i===cycle;return '<div class="vr-day'+(done?' vr-done':'')+(today?' vr-today':'')+(i===6?' vr-big':'')+'"><b>Gün '+(i+1)+'</b><div class="vr-day-items">'+rw.map(r=>'<span class="vr-item"><span class="vr-art">'+valorRewardArt(r)+'</span><small>'+valorRewardAmount(r)+'</small></span>').join('')+'</div>'+(done?'<i class="vr-check">✓</i>':'')+'</div>'}).join('')+'</div><button type="button" class="vr-claim" '+(can?'':'disabled')+' onclick="valorLoginClaim()">'+(can?'Gün '+(cycle+1)+' Ödülünü Al':'Yarın tekrar gel · 00.00’da yenilenir')+'</button></div>';o.addEventListener('click',e=>{if(e.target===o)valorLoginClose()});document.body.appendChild(o)}

function valorChestData(){if(!state.diamondChest||typeof state.diamondChest!=='object')state.diamondChest={next:0,opened:0};return state.diamondChest}
function valorChestLeft(){return Math.max(0,(Number(valorChestData().next)||0)-Date.now())}
function valorClock(ms){const t=Math.ceil(ms/1000),h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')}
function valorChestRoll(){let r=Math.random()*100;for(const [n,w] of VALOR_CHEST_ROLLS){if((r-=w)<0)return n}return VALOR_CHEST_ROLLS[0][0]}
function valorChestOpen(){if(!state.class)return;const left=valorChestLeft();if(left>0)return toast('Elmas Sandığı '+valorClock(left)+' sonra açılır');const c=valorChestData(),n=valorChestRoll();state.diamonds=(Number(state.diamonds)||0)+n;c.next=Date.now()+VALOR_CHEST_MS;c.opened=(Number(c.opened)||0)+1;save();render();valorChestReveal(n)}
function valorChestReveal(n){const old=document.getElementById('vr-chest');if(old)old.remove();const o=document.createElement('div');o.id='vr-chest';o.className='vr-overlay';o.innerHTML='<div class="vr-dialog vr-reveal'+(n>=30?' vr-jackpot':'')+'" role="dialog" aria-modal="true"><span class="vr-eyebrow">ELMAS SANDIĞI</span><div class="vr-reveal-art">'+VALOR_DIAMOND_ICON+'</div><h2>+'+n+' Elmas</h2><p class="vr-lead">'+(n>=50?'Büyük ödül! ':n>=30?'Şanslı gün! ':'')+'Sıradaki sandık 6 saat sonra hazır.</p><button type="button" class="vr-claim" onclick="this.closest(\'.vr-overlay\').remove()">Harika</button></div>';o.addEventListener('click',e=>{if(e.target===o)o.remove()});document.body.appendChild(o)}

function valorRewardsStrip(){if(!state.class)return '';const can=valorLoginCanClaim(),cycle=valorLoginCycleDay(),left=valorChestLeft();return '<div class="vr-strip"><button type="button" class="vr-card'+(can?' vr-ready':'')+'" onclick="valorLoginOpen()"><span class="vr-card-art vr-cal"><b>'+(can?cycle+1:Math.max(1,cycle))+'</b><small>GÜN</small></span><span class="vr-card-text"><b>Giriş Ödülü</b><small>'+(can?'Gün '+(cycle+1)+' hazır!':'Alındı · yarın Gün '+(cycle%7+1))+'</small></span></button><button type="button" class="vr-card'+(left?'':' vr-ready')+'" onclick="valorChestOpen()"><span class="vr-card-art">'+VALOR_DIAMOND_ICON+'</span><span class="vr-card-text"><b>Elmas Sandığı</b><small id="vr-chest-time">'+(left?valorClock(left):'Açmaya hazır!')+'</small></span></button></div>'}

(function(){
 const baseHome=home;
 home=function(){return valorRewardsStrip()+baseHome.apply(this,arguments)};
 const baseRender=render;
 render=function(){const r=baseRender.apply(this,arguments);try{valorRewardsAfterRender()}catch(e){}return r};
 function valorRewardsAfterRender(){if(!state.class||page!=='Anasayfa')return;const day=valorRewardDay();if(valorLoginPopupShown===day||!valorLoginCanClaim())return;if(!state.guide||!state.guide.done)return;valorLoginPopupShown=day;setTimeout(()=>{if(page==='Anasayfa'&&valorLoginCanClaim()&&state.guide&&state.guide.done&&!document.querySelector('.vr-overlay'))valorLoginOpen()},400)}
 let wasReady=null;
 setInterval(function(){const el=document.getElementById('vr-chest-time');if(!el||!state.class)return;const left=valorChestLeft(),ready=!left;el.textContent=ready?'Açmaya hazır!':valorClock(left);if(wasReady!==null&&ready!==wasReady)el.closest('.vr-card')?.classList.toggle('vr-ready',ready);wasReady=ready},1000);
})();
