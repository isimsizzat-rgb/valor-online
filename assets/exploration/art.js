/* Reuse the game's actual class/gender sprites; enemy atlas is painted for exploration. */
(function(){
 'use strict';
 const images=new Map();let version=0;
 function load(src){if(images.has(src))return images.get(src);const im=new Image();images.set(src,im);im.onload=()=>{version++};im.src=src;return im}
 function usable(im){return im.complete&&im.naturalWidth>0}
 const enemyNames=['wolf','bandit','vine','fox','beetle','leech','ghost','golem','treant','bat','panther','eagle','lightning','fairy','salamander','demon','reptile','hatchling','knight','skeleton','spider','troll','priest','wraith','bear','witch','ice-dragon','fire-lord','void-lord','dragon'];
 const ids={'Yaban Kurdu':0,'Patika Haydudu':1,'Dikenli Sarmaşık':2,'Yaşlı Ayı Grimtaş':24,'Kızıl Tilki':3,'Koru Eşkıyası':1,'Kan Böceği':4,'Kızıl Orman Bekçisi':8,'Bataklık Sülüğü':5,'Sis Hayaleti':6,'Çamur Golemi':7,'Bataklık Cadısı Morra':25,'Harabe Muhafızı':19,'Taş Örümcek':20,'Lanetli Rahip':22,'Unutulmuş Kral Arvel':18,'Gölge Avcısı':18,'Karanlık Yarasa':9,'Boşluk Kedisi':10,'Gölgelerin Efendisi Nyx':28,'Fırtına Kartalı':11,'Şimşek Ruhu':12,'Geçit Yağmacısı':1,'Gök Gürültüsü Devi Thoran':7,'Buz Kurdu':0,'Kar Trolü':21,'Ayaz Perisi':13,'Buzul Ejderi Frostvyrn':26,'Lav Semenderi':14,'Kül Golemi':7,'Alev İblisi':15,'Ateş Lordu Ignar':27,'Uçurum Sürüngeni':16,'Lanetli Şövalye':18,'Ruh Emici':23,'Uçurumun Sesi Malgor':28,'Ejderha Muhafızı':18,'Pul Zırhlı Şövalye':18,'Ejderha Yavrusu':17,'Kadim Ejderha Valdrak':29};
 const stageIds=[[1,18,0,19,18,8,24],[23,19,20,18,22,7,28],[0,18,21,19,13,7,26],[15,18,14,19,27,16,29]];
 function info(kind,r,index){if(kind==='adventure'){const s=r.steps[index];return {id:ids[s.foe]??18,name:s.foe||'Gizemli Sandık',chest:s.kind==='chest',boss:!!s.boss}}return {id:stageIds[r.area][index],name:stageFoes[index],boss:index===6,chest:false}}
 function shadow(c,x,y,w){c.fillStyle='#0006';c.beginPath();c.ellipse(x,y,w,w*.24,0,0,Math.PI*2);c.fill()}
 function enemy(c,info,x,y,size,t=0,flip=false){
  shadow(c,x,y,size*.32);const src=info.chest?'assets/valor-dungeon/valor-chest.webp':'assets/exploration/enemies.webp',im=load(src);if(!usable(im))return false;
  c.save();c.translate(x,y);c.scale(flip?-1:1,1);const bob=info.chest?0:Math.sin(t/650+info.id)*2;
  if(info.chest)c.drawImage(im,-size*.45,-size*.8,size*.9,size*.8);
  else {const sw=im.naturalWidth/6,sh=im.naturalHeight/5;c.drawImage(im,info.id%6*sw,Math.floor(info.id/6)*sh,sw,sh,-size*.6,-size+bob,size*1.2,size)}c.restore();return true;
 }
 function hero(c,cls,gender,x,y,size,t,moving,facing){
  const female=gender==='female',frame=moving?Math.floor(t/95)%8:0;let src,rect,foot;
  if(cls==='Savaşçı'){src='assets/arena/motion/'+(moving?(female?'warrior-female-run':'warrior-run-v2'):(female?'warrior-female-attack':'warrior-attack-v2'))+'.webp';const f=moving?frame:0;rect=[f%2*543,Math.floor(f/2)*362,moving?543:female?575:543,moving?362:354];foot=[moving?370:300,moving?357:350]}
  else if(cls==='Büyücü'){src='assets/arena/motion/mage-'+(female?'female':'male')+'-raise.webp';rect=[0,0,543,354];foot=[300,350]}
  else {src='assets/arena/motion/archer-'+(female?'female':'male')+'-shoot.webp';rect=[0,0,512,female?392:400];foot=[female?278:253,female?381:385]}
  const im=load(src);if(!usable(im))return false;shadow(c,x,y,size*.22);const scale=size/(cls==='Okçu'?370:350),bob=moving&&cls!=='Savaşçı'?Math.sin(t/85)*3:0;
  c.save();c.translate(x,y+bob);c.scale(facing,1);c.drawImage(im,...rect,-foot[0]*scale,-foot[1]*scale,rect[2]*scale,rect[3]*scale);
  if(cls==='Büyücü'){const staff=load('assets/arena/motion/mage-staff.webp');if(usable(staff)){const height=size*.95,width=height*staff.naturalWidth/staff.naturalHeight;c.drawImage(staff,-size*.22-width/2,-size*.93,width,height)}}c.restore();return true;
 }
 function backdrop(c,seed,w,h){if(seed!==0)return false;const im=load('assets/exploration/forest-map.webp');if(!usable(im))return false;c.drawImage(im,0,0,w,h);return true}
 function scenery(c,id,x,y,size){const im=load('assets/exploration/scenery.webp');if(!usable(im))return;const sw=im.naturalWidth/4,sh=im.naturalHeight/2;c.drawImage(im,id%4*sw,Math.floor(id/4)*sh,sw,sh,x-size/2,y-size,size,size)}
 function preload(cls,gender){hero({save(){},restore(){},translate(){},scale(){},drawImage(){},beginPath(){},ellipse(){},fill(){}},cls,gender,0,0,100,0,true,1);load('assets/exploration/scenery.webp');load('assets/exploration/enemies.webp');load('assets/valor-dungeon/valor-chest.webp')}
 function enemyHtml(info){return info.chest?'<img src="assets/valor-dungeon/valor-chest.webp" alt="Sandık">':'<span class="walk-enemy-art" role="img" aria-label="'+escapeAttr(info.name)+'" style="background-position:'+(info.id%6*20)+'% '+(Math.floor(info.id/6)*25)+'%"></span>'}
 window.ValorWalkArt={hero,enemy,info,preload,enemyHtml,enemyNames,scenery,backdrop,get version(){return version}};
})();
