/* New player guide: walks a fresh character through the main screens, one step at a time. */
const VALOR_GUIDE_STEPS=[
 {page:null,title:'Valor’a hoş geldin!',text:'Kısa bir turla oyunun temel ekranlarını birlikte gezelim. Turun sonunda seni küçük bir ödül bekliyor.',button:'Tura Başla'},
 {page:'Profil',label:'Profil',title:'Profil',text:'Kuşandığın ekipmanlar ve Savaş Gücün burada. Savaş Gücü arttıkça daha zor rakipleri yenersin.'},
 {page:'Çanta',label:'Çanta',title:'Çanta',text:'Düşen eşyalar ve satın aldıkların buraya gelir. Bir eşyaya dokunup kuşanabilir ya da açabilirsin.'},
 {page:'Macera',label:'Macera',via:'Harita',title:'Macera',text:'Enerji harcayarak canavar avla; altın ve EXP kazan. Enerjin zamanla kendiliğinden dolar.'},
 {page:'Sahneler',label:'Sahne',via:'Harita',title:'Sahneler',text:'Hikâyeli bölümler ve güçlü bosslar. Her gün giriş hakkın yenilenir; Kabus modunu geçenler elmas kazanır.'},
 {page:'Atölye',label:'Atölye',via:'Anasayfa',title:'Atölye',text:'Altınla ekipmanını +21’e kadar güçlendir. Güçlenmenin kalbi burası: altınını burada kullan, Şans Taşları başarı şansını artırır.'},
 {page:'Zindan',label:'Zindan',via:'Anasayfa',title:'Zindan',text:'Kat kat ilerle; her kat bir öncekinden zorlu. Takıldığında ekipmanını güçlendirip geri dön.'},
 {page:'Savaş',label:'Savaş',via:'Anasayfa',title:'Arena',text:'Rakiplerle dövüş, sıralamada yüksel. 12.00–13.00 ve 18.00–19.00 arası Takım Arenası da açılır.'},
 {page:'Görevler',label:'Görevler',via:'Anasayfa',title:'Görevler',text:'Her gün yan görevleri bitirip ödül paketini al. Seviye ve sahne görevleri elmas kazandırır.'},
 {page:'Anasayfa',label:'Anasayfa',title:'Hazırsın!',text:'Ana sayfadaki 7 Günlük Giriş Ödülünü ve 6 saatte bir açılan Elmas Sandığını unutma. İyi avlar, kahraman!',button:'Ödülü Al ve Bitir',final:true}
];
const VALOR_GUIDE_REWARD={diamonds:50,gold:100000};

function valorGuideActive(){return !!(state&&state.class&&state.guide&&!state.guide.done)}
function valorGuideStep(){return VALOR_GUIDE_STEPS[Math.max(0,Math.min(VALOR_GUIDE_STEPS.length-1,Number(state.guide.step)||0))]}
function valorGuideNext(){if(!valorGuideActive())return;const st=valorGuideStep();if(st.final)return valorGuideFinish();state.guide.step=(Number(state.guide.step)||0)+1;save();valorGuideDraw()}
function valorGuideFinish(){state.guide={done:true,finished:true};state.diamonds=(Number(state.diamonds)||0)+VALOR_GUIDE_REWARD.diamonds;state.gold=(Number(state.gold)||0)+VALOR_GUIDE_REWARD.gold;save();valorGuideRemove();render();toast('Rehber tamamlandı! +'+VALOR_GUIDE_REWARD.diamonds+' elmas, +'+money(VALOR_GUIDE_REWARD.gold)+' altın')}
function valorGuideSkip(){state.guide={done:true,skipped:true};save();valorGuideRemove();render()}
function valorGuideRemove(){document.getElementById('vg-card')?.remove();document.querySelectorAll('.vg-focus').forEach(e=>e.classList.remove('vg-focus'));document.body.classList.remove('vg-on')}
/* Where the player should tap next to reach the step's page. */
function valorGuideTarget(st){if(!st.page||page===st.page)return null;if(st.via==='Harita'){if(page==='Harita')return document.querySelector('.valor-map-choice[aria-label="'+st.label+'"]');return document.querySelector('#bottomNav [aria-label="Harita"]')}if(st.via==='Anasayfa'){if(page==='Anasayfa')return document.querySelector('.mmorpg-home-tile[aria-label="'+st.page+'"]');return document.querySelector('#bottomNav [aria-label="Anasayfa"]')}return document.querySelector('#bottomNav [aria-label="'+st.page+'"]')}
function valorGuideGo(){const st=valorGuideStep();if(st.page)go(st.page)}
function valorGuideDraw(){
 document.querySelectorAll('.vg-focus').forEach(e=>e.classList.remove('vg-focus'));
 if(!valorGuideActive()||document.body.classList.contains('character-selection')){valorGuideRemove();return}
 const st=valorGuideStep(),i=Number(state.guide.step)||0,total=VALOR_GUIDE_STEPS.length-1,here=!st.page||page===st.page;
 let card=document.getElementById('vg-card');if(!card){card=document.createElement('div');card.id='vg-card';card.setAttribute('role','dialog');card.setAttribute('aria-label','Rehber');document.body.appendChild(card)}
 document.body.classList.add('vg-on');
 const progress=i>0?'<div class="vg-progress"><i style="width:'+(i/total*100)+'%"></i></div>':'';
 card.innerHTML='<div class="vg-head"><span class="vg-badge">REHBER'+(i>0?' · '+i+' / '+total:'')+'</span><button type="button" class="vg-skip" onclick="valorGuideSkip()">Rehberi geç</button></div>'+progress+
  (here?'<h3>'+st.title+'</h3><p>'+st.text+'</p>'+(st.final?'<div class="vg-reward"><span>+'+VALOR_GUIDE_REWARD.diamonds+' Elmas</span><span>+'+money(VALOR_GUIDE_REWARD.gold)+' Altın</span></div>':'')+'<button type="button" class="vg-btn" onclick="valorGuideNext()">'+(st.button||'Anladım ›')+'</button>'
  :'<h3>Sıradaki: '+st.title+'</h3><p>'+(st.via&&page!==st.via?'Önce '+(st.via==='Harita'?'alttaki <b>Harita</b>':'alttaki <b>Anasayfa</b>')+' düğmesine, sonra <b>'+st.label+'</b> bölümüne dokun.':'Parlayan <b>'+st.label+'</b> düğmesine dokun.')+'</p><button type="button" class="vg-btn vg-ghost" onclick="valorGuideGo()">Beni Götür ›</button>');
 const nav=document.getElementById('bottomNav'),r=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect():null;card.style.bottom=r&&r.height?Math.round(window.innerHeight-r.top+8)+'px':'12px';
 const t=valorGuideTarget(st);if(t){t.classList.add('vg-focus');if(!t.closest('#bottomNav'))t.scrollIntoView({block:'center',behavior:'smooth'})}
}
(function(){
 if(state&&state.class&&!state.guide){state.guide={done:true,legacy:true};save()}
 const baseInit=initClass;
 // starter.js replaces the whole state object, so the guide flag is added after character creation.
 initClass=function(){const had=!!state.class,r=baseInit.apply(this,arguments);if(!had&&state.class&&!state.guide){state.guide={step:0};save();render()}return r};
 const baseRender=render;
 render=function(){const r=baseRender.apply(this,arguments);try{valorGuideDraw()}catch(e){}return r};
 if(state&&state.class)render();else valorGuideDraw();
})();
