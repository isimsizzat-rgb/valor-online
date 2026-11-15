const assert=require('node:assert/strict');
const C=require('../../assets/exploration/map-core.js');
for(let seed=0;seed<10;seed++)for(const count of [7,10]){
 const m=C.create(seed,count);let p=m.start;
 assert(m.walkable(p.x,p.y));assert(!m.walkable(0,0));
 for(const target of m.nodes){const path=m.path(p,target);assert(path.length,'Encounter must be reachable');for(const q of path)assert(m.walkable(q.x,q.y),'Route crosses solid terrain');p=target}
 assert.deepEqual(m.path(m.start,{x:0,y:0}),[]);
 assert.deepEqual(m.cells,C.create(seed,count).cells);
}
console.log('PASS: all encounters reachable, safe routes, solid boundaries, deterministic maps (20 variants)');
