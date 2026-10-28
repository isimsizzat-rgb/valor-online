/* Shared, deterministic rules. No save writes or DOM dependencies.
   The server (supabase/valor-dungeon.sql) mirrors these rules for online rooms. */
(function(root){
 'use strict';
 const names=['Paslı Nöbetçi','Lağım Kralı','Mağara Trolü','Zümrüt Örümcek','Demir Gardiyan','Ayaz Hayaleti','Buz Şövalyesi','Ak Kurt','Kristal Dev','Ayaz Ejderhası','Gölge Celladı','Karanlık Büyücü','Uçurum Gözü','Kara Şövalye','Gölge Kralı','Kızıl Rahip','Kan Paladini','Taş Kanat','Lav Devi','Kor Ejderhası','Kadim Otomat','Dört Kollu Muhafız','Yıldırım Devi','Ölümsüz Kral','Gece Hükümdarı','Zümrüt Lich','Zincirli Şövalye','Uçurum Prensi','Düşmüş Melek','Valor Hükümdarı'];
 const chapters=['Demir Kapılar','Donmuş Dehliz','Gölge Salonu','Kızıl Ocak','Kadim Mühür','Valor Tahtı'];
 const magical=new Set([6,9,10,12,13,15,16,20,24,25,26,28,29,30]);
 /* Boss stats are calibrated against reference players (tools/valor-dungeon/balance.cjs). */
 const BOSS_STATS=[
  {"atk":1224,"def":1128,"can":9417,"crit":455,"block":456},
  {"atk":1818,"def":1223,"can":14227,"crit":468,"block":470},
  {"atk":2504,"def":1327,"can":19916,"crit":481,"block":484},
  {"atk":3291,"def":1440,"can":26613,"crit":494,"block":498},
  {"atk":4193,"def":1562,"can":34466,"crit":508,"block":513},
  {"atk":5222,"def":1694,"can":43638,"crit":522,"block":528},
  {"atk":5658,"def":1838,"can":48070,"crit":536,"block":544},
  {"atk":6131,"def":1994,"can":52951,"crit":551,"block":560},
  {"atk":6992,"def":2266,"can":57227,"crit":564,"block":599},
  {"atk":7973,"def":2576,"can":61848,"crit":578,"block":640},
  {"atk":9093,"def":2929,"can":66842,"crit":592,"block":684},
  {"atk":10369,"def":3329,"can":72240,"crit":606,"block":731},
  {"atk":11825,"def":3784,"can":78074,"crit":621,"block":782},
  {"atk":13485,"def":4302,"can":84378,"crit":636,"block":835},
  {"atk":15378,"def":4890,"can":91192,"crit":651,"block":893},
  {"atk":16655,"def":5295,"can":97140,"crit":664,"block":939},
  {"atk":18038,"def":5734,"can":103475,"crit":678,"block":986},
  {"atk":19535,"def":6210,"can":110224,"crit":692,"block":1037},
  {"atk":21157,"def":6725,"can":117413,"crit":706,"block":1090},
  {"atk":22914,"def":7282,"can":125071,"crit":721,"block":1145},
  {"atk":24816,"def":7886,"can":133228,"crit":736,"block":1204},
  {"atk":26877,"def":8540,"can":141917,"crit":751,"block":1265},
  {"atk":32212,"def":10188,"can":152372,"crit":763,"block":1476},
  {"atk":38606,"def":12155,"can":163597,"crit":775,"block":1722},
  {"atk":46270,"def":14501,"can":175648,"crit":787,"block":2009},
  {"atk":55455,"def":17299,"can":188588,"crit":799,"block":2344},
  {"atk":66463,"def":20638,"can":202481,"crit":812,"block":2735},
  {"atk":79656,"def":24622,"can":217397,"crit":825,"block":3192},
  {"atk":95469,"def":29374,"can":233412,"crit":838,"block":3724},
  {"atk":114420,"def":35043,"can":250607,"crit":851,"block":4345}
 ];
 const bosses=names.map((name,i)=>{const floor=i+1,magic=magical.has(floor),s=BOSS_STATS[i];return {floor,name,chapter:chapters[Math.floor(i/5)],cls:magic?'Büyücü':'Savaşçı',stats:{Saldırı:magic?10:s.atk,Sihir:magic?s.atk:10,Savunma:s.def,'Sihir Savunma':s.def,Can:s.can,Kritik:s.crit,Bloke:s.block}}});

 const TURN_MS=7000,SKILL_MS=60000,SKILL_SHARE=.25,AOE_EVERY=3,AOE_SHARE=1.5,PARTY_HP=[1,1,2,3];
 const skills={
  'Savaşçı':{id:'shield',name:'Kalkan Duvarı',icon:'🛡',text:'Takıma canının %25\'i kadar kalkan'},
  'Büyücü':{id:'heal',name:'Şifa Dalgası',icon:'✚',text:'Takıma canının %25\'i kadar can'},
  'Okçu':{id:'boost',name:'Av Ruhu',icon:'➶',text:'Takım hasarı bu kat boyunca %25 artar'}
 };
 function unit(p){const stats={...p.stats},attack=10+Math.max(0,Number(stats[p.cls==='Büyücü'?'Sihir':'Saldırı'])||0),maxHp=Math.max(1,Math.round(100+(Number(stats.Can)||0)*10));return {...p,stats,attack,maxHp,hp:maxHp,shield:0,cdUntil:0}}
 const chance=n=>Math.min(.75,Math.max(0,Number(n)||0)/(Math.max(0,Number(n)||0)+1000));
 function raw(a,b,mult,rng){const defense=Math.max(0,Number(b.stats[a.cls==='Büyücü'?'Sihir Savunma':'Savunma'])||0),critical=rng()<chance(a.stats.Kritik),blocked=rng()<chance(b.stats.Bloke);return {damage:Math.max(1,Math.round(a.attack*a.attack/(a.attack+defense)*mult*(1+(critical?.25:0)-(blocked?.25:0)))),critical,blocked}}
 function wound(p,dmg){const absorbed=Math.min(p.shield||0,dmg);p.shield=(p.shield||0)-absorbed;p.hp=Math.max(0,p.hp-(dmg-absorbed));return absorbed}
 const alive=room=>room.members.filter(p=>p.hp>0);
 function firstAlive(room){let i=0;while(i<room.members.length&&room.members[i].hp<=0)i++;return i}
 function log(room,entry){room.log=(room.log||[]).concat(entry).slice(-6)}

 /* Whose turn: room.turn indexes members; members act in join order, then the boss strikes. */
 function canSkill(room,who,now){const p=room.members[room.turn];return room.status==='battle'&&p&&p.uid===who&&p.hp>0&&!p.skillUsedTurn&&now>=(p.cdUntil||0)}
 function skill(room,now){const p=room.members[room.turn];if(!p||p.hp<=0||room.status!=='battle'||p.skillUsedTurn||now<(p.cdUntil||0))return false;const s=skills[p.cls]||skills['Savaşçı'];
  if(s.id==='shield')for(const m of alive(room))m.shield=Math.max(m.shield||0,Math.round(m.maxHp*SKILL_SHARE));
  else if(s.id==='heal')for(const m of alive(room))m.hp=Math.min(m.maxHp,m.hp+Math.round(m.maxHp*SKILL_SHARE));
  else room.boost=1;
  p.cdUntil=now+SKILL_MS;p.skillUsedTurn=true;log(room,{kind:'skill',name:p.name,skill:s.name});room.version++;return true}
 function attack(room,now,rng=Math.random,auto=false){if(room.status!=='battle')return false;const p=room.members[room.turn];if(!p||p.hp<=0)return false;
  const h=raw(p,room.boss,room.boost>0?1+SKILL_SHARE:1,rng);room.boss.hp=Math.max(0,room.boss.hp-h.damage);room.dealt=(room.dealt||0)+h.damage;log(room,{kind:'hit',name:p.name,target:room.boss.name,auto,...h});p.skillUsedTurn=false;
  if(room.boss.hp<=0){clearFloor(room,now);room.version++;return true}
  let i=room.turn+1;while(i<room.members.length&&room.members[i].hp<=0)i++;room.turn=i;
  if(i>=room.members.length)bossTurn(room,rng);
  room.turnAt=now;room.version++;return true}
 function bossTurn(room,rng){const b=room.boss,targets=alive(room);if(!targets.length){room.status='lost';return}
  if(room.round%AOE_EVERY===0){for(const t of targets){const h=raw(b,t,AOE_SHARE,rng),abs=wound(t,h.damage);room.taken=(room.taken||0)+h.damage-abs}log(room,{kind:'aoe',name:b.name})}
  else for(let k=0;k<targets.length;k++){const live=alive(room);if(!live.length)break;const t=live[Math.floor(rng()*live.length)],h=raw(b,t,1,rng),abs=wound(t,h.damage);room.taken=(room.taken||0)+h.damage-abs;log(room,{kind:'hit',name:b.name,target:t.name,...h,absorbed:abs})}
  room.round++;room.turn=firstAlive(room);if(room.turn>=room.members.length)room.status='lost'}
 function partyBoss(room,floor){const b=unit(bosses[floor-1]),k=PARTY_HP[room.members.length]||1;b.maxHp=b.hp=Math.round(b.maxHp*k);return b}
 function clearFloor(room,now){room.cleared=room.floor;room.last={floor:room.floor,name:room.boss.name,won:true,rounds:room.round};
  if(room.floor>=30){room.status='complete';return}
  room.floor++;room.boss=partyBoss(room,room.floor);room.boost=0;room.round=1;room.turn=firstAlive(room);room.turnAt=now;room.status='battle';
  log(room,{kind:'floor',floor:room.floor-1})}
 /* Called by anyone in the room: if the current player has idled for 7 seconds, they attack automatically. */
 function tick(room,now,rng=Math.random){if(room.status!=='battle'||now-(room.turnAt||0)<TURN_MS)return false;return attack(room,now,rng,true)}
 function start(room,now){room.boss=partyBoss(room,room.floor||1);room.status='battle';room.round=1;room.turn=firstAlive(room);room.turnAt=now;room.boost=0;room.log=[];room.version++}
 /* Legacy step for tools: one action by whoever is up (attack), used by older checks. */
 function step(room,rng=Math.random){return attack(room,Date.now(),rng)}

 /* Valor Sandığı: one prize per chest, rarer the more valuable (chance ∝ 1 / diamond value).
    Values: Sv.1 Şans Taşı ~10, 25 Elmas 25, Pet Yemi 25 (market), Epik Taşı ~40, Enerji Şişesi 50, Sefer Kağıdı 99 (market). */
 const CHEST=[{id:'luck',name:'Sv.1 Şans Taşı',amount:1,weight:42},{id:'diamonds',name:'Elmas',amount:25,weight:17},{id:'petFood',name:'Pet Yemi',amount:1,weight:17},{id:'epic',name:'Epik Taşı',amount:1,weight:11},{id:'energyBottle',name:'Enerji Şişesi',amount:1,weight:9},{id:'expeditionPaper',name:'Sefer Kağıdı',amount:1,weight:4}];
 function rollChests(n,rng=Math.random){const won={};for(let k=0;k<n;k++){let x=rng()*100,pick=CHEST[CHEST.length-1];for(const c of CHEST){if(x<c.weight){pick=c;break}x-=c.weight}won[pick.id]=(won[pick.id]||0)+pick.amount}return won}
 const api={CHEST,rollChests,bosses,chapters,skills,unit,partyBoss,raw,skill,canSkill,attack,tick,start,step,TURN_MS,SKILL_MS,AOE_EVERY,PARTY_HP};root.ValorDungeonCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
