const assert=require('node:assert/strict'),W=require('../../assets/exploration/walk-animation.js');
for(const cls of ['Savaşçı','Büyücü','Okçu'])for(const gender of ['male','female'])assert.match(W.key(cls,gender),/^(warrior|mage|archer)-(male|female)$/);
for(const [dx,dy,expected] of [[1,0,'right'],[-1,0,'left'],[0,1,'down'],[0,-1,'up']]){assert.equal(W.direction(dx,dy),expected);assert.equal(W.direction(0,0,expected),expected)}
assert.equal(W.direction(1,1,'up'),'down');assert.equal(W.direction(1,1,'right'),'right');
for(const d of Object.keys(W.ROWS)){const frames=new Set();for(let i=0;i<108;i++)frames.add(W.pose(i,true,d).frame);assert.equal(frames.size,6);assert.equal(W.pose(0,false,d).frame,W.pose(1e6,false,d).frame);assert.equal(W.pose(0,true,d).row,W.ROWS[d]);assert.equal(W.pose(108,true,d).frame,0)}
console.log('PASS: six character variants, four directions, diagonal stability, six-frame distance cycles, stopped pose');
