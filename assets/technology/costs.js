/* Crystal cost is shared by the UI and all eight upgrade actions. */
function valorTechnologyCost(level){return (Math.max(0,Math.floor(Number(level)||0))+1)*2000}
vsUpgrade=function(i){
 const d=vsData();if(!Number.isInteger(i)||i<0||i>=vsNames.length||d.tech[i]>=100)return;
 const cost=valorTechnologyCost(d.tech[i]);if(d.crystals<cost)return toast('Kristal yetersiz · '+money(cost)+' kristal gerekiyor');
 d.crystals-=cost;d.tech[i]++;save();render();toast(vsNames[i]+' geliştirildi');
};
vaGoldUpgrade=function(){
 const d=vsData(),g=vaGoldData();if(g.level>=100)return toast('Altın Üretimi maksimum seviyede');
 const cost=valorTechnologyCost(g.level);if(d.crystals<cost)return toast('Kristal yetersiz · '+money(cost)+' kristal gerekiyor');
 vaGoldCollect();d.crystals-=cost;g.level++;save();render();toast('Altın Üretimi Sv. '+g.level+' · +'+money(g.level*100)+' altın/dk');
};
vsTechnology=function(){
 const d=vsData(),g=vaGoldData();
 const items=[{name:'Altın Üretimi',level:g.level,bonus:money(g.level*100)+' altın/dk',action:'vaGoldUpgrade()'}].concat(vsNames.map((name,i)=>({name,level:d.tech[i],bonus:'+'+money(d.tech[i]*vsSteps[i]),action:'vsUpgrade('+i+')'})));
 return '<div class="vsys tech-v3"><h2>Teknoloji</h2><p class="tech-v3-meta">💠 Kristal: '+money(d.crystals)+'</p><div class="vsys-grid">'+items.map((it,i)=>{const max=it.level>=100,cost=valorTechnologyCost(it.level);return '<div class="vsys-card"><div class="tech-v3-title">'+vt3Icon(i)+'<h3>'+it.name+'</h3></div><div class="tech-v3-info">Seviye: '+it.level+' / 100<br>'+(i===0?'Üretim: ':'Bonus: ')+it.bonus+'</div><button '+(max||d.crystals<cost?'disabled':'')+' onclick="'+it.action+'">'+(max?'Maksimum Seviye':'⬆ Geliştir · '+money(cost)+' Kristal')+'</button></div>'}).join('')+'</div></div>';
};
