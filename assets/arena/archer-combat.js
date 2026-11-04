/* Final archer skill artwork and cosmetic animation. */
(function(){'use strict';
const archerAssets = {};let gender='male',skill=1;
let archerReady = false;
const archerNames = {1:'Işık Oku',2:'İkili Işık Oku',3:'Zümrüt Patlaması',4:'Avcı İçgüdüsü'};
const archerDurations = {1:2.55,2:2.55,3:4.1,4:3.15};
const archerLaunches = {1:[1.10],2:[1.10,1.18],3:[2.35],4:[]};
const archerTravel = k => k===3?.62:.48;
const archerClamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const archerMix = (a,b,q)=>a+(b-a)*q;
// Filled from the generated atlases; coordinates are normalized per cell.
const archerMeta = {"male-shoot":[{"rect":[0,0,512,400],"foot":[253,385],"height":367},{"rect":[512,0,512,400],"foot":[243,386],"height":368},{"rect":[0,400,512,378],"foot":[244,375],"height":345},{"rect":[512,400,512,378],"foot":[237,374],"height":344},{"rect":[0,784,512,384],"foot":[245,375],"height":345},{"rect":[512,784,512,384],"foot":[236,375],"height":345},{"rect":[0,1168,512,368],"foot":[253,354],"height":344},{"rect":[512,1168,512,368],"foot":[240,355],"height":345}],"male-turn":[{"rect":[0,0,384,512],"foot":[190,506],"height":484},{"rect":[384,0,384,512],"foot":[204,503],"height":481},{"rect":[768,0,384,512],"foot":[205,504],"height":482},{"rect":[1152,0,384,512],"foot":[221,502],"height":480},{"rect":[0,512,384,512],"foot":[175,483],"height":465},{"rect":[384,512,384,512],"foot":[181,483],"height":465},{"rect":[768,512,384,512],"foot":[172,485],"height":467},{"rect":[1152,512,384,512],"foot":[184,485],"height":467}],"female-turn":[{"rect":[0,0,384,512],"foot":[194,505],"height":493},{"rect":[384,0,384,512],"foot":[201,506],"height":494},{"rect":[768,0,384,512],"foot":[214,505],"height":493},{"rect":[1152,0,384,512],"foot":[205,505],"height":493},{"rect":[0,512,384,512],"foot":[194,485],"height":471},{"rect":[384,512,384,512],"foot":[199,485],"height":471},{"rect":[768,512,384,512],"foot":[211,485],"height":471},{"rect":[1152,512,384,512],"foot":[202,485],"height":471}],"female-shoot":[{"rect":[0,0,512,392],"foot":[278,381],"height":368},{"rect":[512,0,512,392],"foot":[216,381],"height":357},{"rect":[0,392,512,378],"foot":[266,376],"height":357},{"rect":[512,392,512,378],"foot":[214,376],"height":357},{"rect":[0,774,512,374],"foot":[271,365],"height":355},{"rect":[512,774,512,374],"foot":[217,365],"height":355},{"rect":[0,1148,512,388],"foot":[274,351],"height":342},{"rect":[512,1148,512,388],"foot":[222,353],"height":344}],"male-jump":[{"rect":[0,0,512,410],"foot":[252,407],"height":399},{"rect":[512,0,512,410],"foot":[250,407],"height":399},{"rect":[0,410,512,370],"foot":[251,397],"height":399},{"rect":[512,410,512,370],"foot":[254,397],"height":399},{"rect":[0,780,512,354],"foot":[251,390],"height":399},{"rect":[512,780,512,354],"foot":[251,390],"height":399},{"rect":[0,1134,512,402],"foot":[250,392],"height":399},{"rect":[512,1134,512,402],"foot":[253,392],"height":399}],"female-jump":[{"rect":[0,0,512,400],"foot":[278,397],"height":386},{"rect":[512,0,512,400],"foot":[240,397],"height":386},{"rect":[0,400,512,380],"foot":[279,394],"height":386},{"rect":[512,400,512,380],"foot":[240,394],"height":386},{"rect":[0,780,512,346],"foot":[280,392],"height":386},{"rect":[512,780,512,346],"foot":[241,392],"height":386},{"rect":[0,1126,512,410],"foot":[278,384],"height":386},{"rect":[512,1126,512,410],"foot":[240,396],"height":386}]};
function archerPhase(t) {
 if(skill===4)return t<.32?'Dizlerini kırıyor':t<.95?'Hafifçe zıplıyor':t<1.42?'Yere iniyor · yeşil alevler':t<2.6?'Saldırı artışı etkin':'Hazır duruş';
 if(skill===3)return t<.65?'Yayı hazırlıyor':t<2.35?'Yoğunlaşıyor · güç biriktiriyor':t<2.97?'Büyük kristal enerjisi ilerliyor':t<3.5?'Zümrüt çarpması':'Hazır duruş';
 if(skill===2)return t<1.1?'Yayı geriyor':t<1.18?'İlk ışık oku':t<1.58?'İki ok birlikte ilerliyor':t<1.66?'Peş peşe isabet':t<2.05?'İkili isabet':'Yayı indiriyor';
 return t<.55?'Yayı kaldırıyor':t<1.1?'Oku geriyor':t<1.58?'Uzun ışık oku ilerliyor':t<1.95?'İsabet':'Yayı indiriyor';
}
function archerPose(k,t) {
 if(k===4)return t<.12?0:t<.32?1:t<.48?2:t<.68?3:t<.90?4:t<1.12?5:t<1.42?6:7;
 if(k===3)return t<.24?0:t<.45?1:t<.65?2:t<2.35?3:t<2.52?4:t<2.9?5:t<3.3?6:7;
 if(t<.24)return 0;if(t<.47)return 1;if(t<.76)return 2;if(t<1.1)return 3;
 const release=k===2&&t>=1.18?1.18:1.1,age=t-release;
 return age<.16?4:age<.46?5:age<.82?6:7;
}
function archerSprite(c,frame,x,y,size,mode=skill===4?'jump':'shoot') {
 const key=gender+'-'+mode,source=archerAssets[key];if(!source?.naturalWidth)return;
 const cw=source.naturalWidth/4,ch=source.naturalHeight/2;
 const meta=archerMeta[key]?.[frame];
 const rect=meta?.rect||[frame%4*cw,Math.floor(frame/4)*ch,cw,ch];
 const foot=meta?.foot||[cw*.5,ch*.92],body=meta?.height||ch*.8,scale=size/body;
 c.drawImage(source,...rect,x-foot[0]*scale,y-foot[1]*scale,rect[2]*scale,rect[3]*scale);
}
function archerMaxScale(progress){const p=archerClamp(progress);return .18+.82*Math.pow(p,1.15);}
function archerJumpLift(t,size){if(t<=.38||t>=1.26)return 0;const p=(t-.38)/.88;return size*.30*4*p*(1-p);}
function archerPassiveFlames(c,x,floor,size,t){
 const source=archerAssets['passive-flames'];if(!source?.naturalWidth||t<.22||t>2.95)return;
 const rise=archerClamp((t-.22)/.48),fade=Math.min(rise,archerClamp((2.95-t)/.55)),pulse=1+Math.sin(t*13)*.035;
 const h=size*(.85+.80*rise)*pulse,w=h*source.naturalWidth/source.naturalHeight;
 c.save();c.globalAlpha=fade*.9;c.drawImage(source,x-w*.5,floor-h*.96,w,h);
 c.globalCompositeOperation='screen';for(let i=0;i<18;i++){const p=(t*.55+i*.618)%1,a=i*2.399,px=x+Math.sin(a+t*2)*size*(.2+p*.18),py=floor-size*p*1.2;c.globalAlpha=(1-p)*fade*.7;c.fillStyle=i%4?'#6dffb2':'#f0ffc6';c.shadowColor='#40ed98';c.shadowBlur=8;c.beginPath();c.arc(px,py,size*(.003+.004*(1-p)),0,Math.PI*2);c.fill();}c.restore();
}
const archerBurstFrames=[];
function archerBurstFrame(frame){
 if(archerBurstFrames[frame])return archerBurstFrames[frame];
 const source=archerAssets['max-impact'],cw=source.naturalWidth/4,ch=source.naturalHeight/2,layer=document.createElement('canvas');layer.width=cw;layer.height=ch;const b=layer.getContext('2d');
 b.drawImage(source,frame%4*cw,Math.floor(frame/4)*ch,cw,ch,0,0,cw,ch);b.globalCompositeOperation='destination-in';
 const horizontal=b.createLinearGradient(0,0,cw,0);horizontal.addColorStop(0,'#fff0');horizontal.addColorStop(.15,'#ffff');horizontal.addColorStop(.85,'#ffff');horizontal.addColorStop(1,'#fff0');b.fillStyle=horizontal;b.fillRect(0,0,cw,ch);
 const vertical=b.createLinearGradient(0,0,0,ch);vertical.addColorStop(0,'#fff0');vertical.addColorStop(.12,'#ffff');vertical.addColorStop(.88,'#ffff');vertical.addColorStop(1,'#fff0');b.fillStyle=vertical;b.fillRect(0,0,cw,ch);
 archerBurstFrames[frame]=layer;return layer;
}
function archerMaxBurst(c,x,y,size,age){
 const source=archerAssets['max-impact'],life=.8;if(!source?.naturalWidth||age<0||age>=life)return;
 const p=age/life,frame=Math.min(7,Math.floor(p*8)),cw=source.naturalWidth/4,ch=source.naturalHeight/2,extent=size*(1.10+.25*p),height=extent*ch/cw;
 const anchors=[[170,287],[150,286],[135,286],[155,285],[206,260],[204,258],[201,253],[198,256]],anchor=anchors[frame];c.save();c.globalAlpha=p<.7?1:archerClamp((1-p)/.3);c.drawImage(archerBurstFrame(frame),x-extent*anchor[0]/cw,y-height*anchor[1]/ch,extent,height);c.restore();
}
function archerAura(c,x,floor,size,t,front=false,charged=false) {
 if(skill===4){if(!front)archerPassiveFlames(c,x,floor,size,t);else if(t>.7&&t<2.95){c.save();c.globalAlpha=Math.min(archerClamp((t-.7)/.25),archerClamp((2.95-t)/.4));c.fillStyle='#b9ffd0';c.font='700 16px system-ui';c.textAlign='center';c.fillText('↑ SALDIRI ARTIŞI',x,floor-size*1.18);c.restore();}return;}
 c.save();c.globalCompositeOperation='screen';
 const activation=skill===4?archerClamp((t-1.38)/.42):0;
 if(!front){const g=c.createRadialGradient(x,floor-size*.46,0,x,floor-size*.46,size*.7);g.addColorStop(0,charged?'#87ffd83a':'#4fe0a414');g.addColorStop(1,'#20d68700');c.fillStyle=g;c.fillRect(x-size*.7,floor-size*1.16,size*1.4,size*1.4);}
 for(let band=0;band<3;band++){
  const cy=floor-size*(.12+band*.29),rx=size*(.32+activation*.16),ry=size*.085;
  c.beginPath();let open=false;
  for(let i=0;i<=70;i++){const a=i/70*Math.PI*2+t*(charged?5:1.4)+band*1.6;const visible=(Math.sin(a)>0)===front;
   if(!visible){open=false;continue}const px=x+Math.cos(a)*rx,py=cy+Math.sin(a)*ry;if(open)c.lineTo(px,py);else c.moveTo(px,py);open=true;
  }
  c.strokeStyle=band===1?'#e3ffb1':'#56f5ac';c.lineWidth=charged?2.5:1.4;c.globalAlpha=(charged?.6:.22)+activation*.3;c.shadowColor='#42ee97';c.shadowBlur=10;c.stroke();
 }
 if(front&&activation>0){c.globalAlpha=activation;c.shadowBlur=12;c.fillStyle='#b9ffd0';c.font='700 16px system-ui';c.textAlign='center';c.fillText('↑ SALDIRI ARTIŞI',x,floor-size*1.12);}
 c.restore();
}
function archerCharge(c,x,y,size,t) {
 if(t<.65||t>=2.35)return;const q=archerClamp((t-.65)/1.7),r=size*(.04+.07*q);
 c.save();c.globalCompositeOperation='screen';const g=c.createRadialGradient(x,y,0,x,y,r*1.7);g.addColorStop(0,'#ffffdf');g.addColorStop(.15,'#baffcfbb');g.addColorStop(.5,'#28df9a44');g.addColorStop(1,'#15c98b00');c.fillStyle=g;c.fillRect(x-r*1.7,y-r*1.7,r*3.4,r*3.4);c.restore();
 // The ultimate's painted body materializes at the bow as power accumulates.
 archerProjectile(c,x,y,size,true,archerClamp(q*1.8)*.85,t,.05+.13*q);
 c.save();c.globalCompositeOperation='screen';for(let i=0;i<26;i++){const p=(i*.618+t*.85)%1,a=i*2.399+t*1.5,d=size*.6*(1-p);c.globalAlpha=p*q;c.fillStyle=i%4?'#95ffce':'#fff2ac';c.shadowColor='#67ffc0';c.shadowBlur=7;c.beginPath();c.arc(x+Math.cos(a)*d,y+Math.sin(a)*d*.75,1+p*2,0,Math.PI*2);c.fill();}c.restore();
}
function archerProjectile(c,x,y,size,large=false,alpha=1,phase=0,scale=1) {
 const source=archerAssets[large?'energy-max-v2':'energy-arrow'];if(!source?.naturalWidth)return;
 const pulse=large?1:1+Math.sin(phase*23)*.025,w=size*(large?1.80:1.45)*scale*pulse,h=w*source.naturalHeight/source.naturalWidth;
 c.save();c.globalAlpha=alpha;c.translate(x,y);
 // Core anchors keep the leading light on the exact flight/impact path.
 c.drawImage(source,-w*(large?.97:.95),-h*(large?.58:.50),w,h);
 c.restore();
}
function archerImpact(c,x,y,size,age,large=false,index=0) {
 if(large){archerMaxBurst(c,x,y,size,age);return;}
 const life=large?.76:.42;if(age<0||age>life)return;const q=age/life,fade=Math.pow(1-q,.8),r=size*(large?.75:.24);
 c.save();c.globalCompositeOperation='screen';c.globalAlpha=fade;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#ffffe5');g.addColorStop(.14,'#d5ffb9cc');g.addColorStop(.4,'#4aeab45c');g.addColorStop(1,'#25d69300');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
 archerProjectile(c,x,y,size,large,fade*.85,age,.7+q*.5);
 c.save();c.globalCompositeOperation='screen';for(let i=0;i<(large?28:10);i++){const a=i*2.399+index*.6,d=r*q*(.5+(i%5)/5);c.globalAlpha=fade;c.fillStyle=i%3?'#9dffd3':'#fff1ae';c.shadowColor='#5affb3';c.shadowBlur=7;c.save();c.translate(x+Math.cos(a)*d,y+Math.sin(a)*d);c.rotate(a+q);const z=(large?3.5:2)*(1-q*.6);c.beginPath();c.moveTo(0,-z*2);c.lineTo(z,0);c.lineTo(0,z*2);c.lineTo(-z,0);c.closePath();c.fill();c.restore();}c.restore();
}
function archerShotLayout(k,start,floor,size){const emitX=start+size*.5,emitY=floor-size*.77;return {emitX,emitY,hitY:emitY};}
function archerEffects(c,start,target,floor,size,t) {
 const {emitX,emitY,hitY}=archerShotLayout(skill,start,floor,size);
 if(skill===3)archerCharge(c,emitX,emitY,size,t);
 for(const [i,at] of archerLaunches[skill].entries()){
  const travel=archerTravel(skill),p=(t-at)/travel;
  if(p>=0&&p<1){const x=archerMix(emitX,target,p),y=archerMix(emitY,hitY,p);c.save();c.translate(x,y);archerProjectile(c,0,0,size,skill===3,1,t,skill===3?archerMaxScale(p):1);c.restore();}
  archerImpact(c,target,hitY,size,t-at-travel,skill===3,i);
 }
}

const keys=['male-shoot','female-shoot','male-jump','female-jump','energy-arrow','energy-max-v2','passive-flames','max-impact'];
const ready=Promise.all(keys.map(key=>new Promise(resolve=>{const im=new Image();archerAssets[key]=im;im.onload=()=>resolve(true);im.onerror=()=>resolve(false);im.src='assets/arena/motion/archer-'+key+'.webp';}))).then(ok=>{archerReady=ok.every(Boolean);if(archerReady&&typeof createImageBitmap==='function')for(const im of Object.values(archerAssets))createImageBitmap(im,{resizeWidth:Math.round(im.naturalWidth*.6),resizeHeight:Math.round(im.naturalHeight*.6),resizeQuality:'high'}).then(b=>{im._bmp=b;im._s=b.width/im.naturalWidth}).catch(()=>{});return archerReady;});
const number=k=>({normal:1,strong:2,max:3,passive:4})[k]||1;
const configure=(fighter,k)=>{gender=fighter.gender==='female'?'female':'male';skill=number(k);};
window.ValorArcherCombat={ready,isReady:()=>archerReady,
 pose:(k,t)=>archerPose(number(k),t),duration:k=>archerDurations[number(k)],hitAt:k=>k==='max'?2.97:1.58,title:k=>archerNames[number(k)],
 behind(c,f,x,y,size,k,t,active){configure(f,active?k:'normal');archerAura(c,x,y,size,active?t:0,false,active&&k==='max'&&t<2.35);},
 sprite(c,f,frame,x,y,size,k,t,active){configure(f,active?k:'normal');archerSprite(c,active?frame:0,x,y-(active&&k==='passive'?archerJumpLift(t,size):0),size);},
 front(c,f,x,y,size,k,t,active){configure(f,active?k:'normal');archerAura(c,x,y,size,active?t:0,true,active&&k==='max'&&t<2.35);},
 effects(c,f,start,target,floor,size,k,t){configure(f,k);archerEffects(c,start,target,floor,size,t);}
};
})();
