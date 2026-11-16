const assert=require('node:assert/strict'),D=require('../../assets/arena/duel-core.js');
const hero={name:'Hero',cls:'Savaşçı',stats:{Saldırı:9000,Can:10000,Savunma:100}},foe={name:'Wolf',cls:'Savaşçı',stats:{Saldırı:50,Can:1000}};
const regular=D.create(hero,foe,1000,()=>.99);assert.equal(D.view(regular).turn,'me');assert.equal(regular.log.length,0);
const ambush=D.create(hero,foe,1000,()=>.99,{ambush:true});assert.equal(ambush.log.length,1);assert.equal(ambush.log[0].side,'foe');assert.equal(ambush.log[0].skill,'normal');assert(ambush.me.hp<ambush.me.maxHp);assert.equal(D.view(ambush).turn,'me');assert.equal(ambush.foe.hp,ambush.foe.maxHp);
D.act(ambush,'normal',ambush.turnAt,()=>.99);assert(ambush.log.some(e=>e.side==='me'));
const dead=D.create({...hero,stats:{Can:0}}, {...foe,stats:{Saldırı:1e8,Can:1000}},1000,()=>.99,{ambush:true});assert.equal(dead.status,'done');assert.equal(dead.me.hp,0);assert.equal(dead.result.win,false);assert.equal(D.act(dead,'normal',5000),false);
console.log('PASS: only exploration ambush forces one enemy opening strike; regular initiative and KO handling preserved');
