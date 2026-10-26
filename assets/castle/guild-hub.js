/* Guild hub: four tabs in this order — Members, Guild Power Ranking, Contributions, Castle War.
   Guild power = sum of members' combat power. The game is local, so the only real member is this
   character; other guilds in the ranking are sample guilds built from the sample leaderboard players. */
const VALOR_GUILD_HUB_TABS=[['members','Üyeler'],['power','Birlik Sıralaması'],['contributions','Katkı Sıralaması'],['castle','Kale Savaşı']];
const VALOR_GUILD_SAMPLE_GUILDS=[
 {name:'Ayaz Birliği',members:['KuzeyHan','AyazLord','BuzPençesi','Fırtına']},
 {name:'Kül Muhafızları',members:['Arveth','GölgeHan','KızılKurt','DemirYürek']},
 {name:'Zümrüt Yemin',members:['KaraOk','Vaelrin','KadimOk','GeceKılıcı']},
 {name:'Mor Sancak',members:['Eldoria','Zephyriel','AteşYeli']}
];
valorGuildSection='members';

function valorGuildMyMembers(){
 if(!state.guild)return [];
 return [{name:state.name||'Oyuncu',cls:state.class,level:state.level,power:combatPower(),role:'Lider',me:true}];
}
function valorGuildPower(members){return members.reduce((sum,m)=>sum+(Number(m.power)||0),0)}
function valorGuildPowerRows(){
 const demo=new Map(valorDemoPlayers.map(p=>[p[0],{name:p[0],level:p[1],power:p[2]}]));
 const rows=VALOR_GUILD_SAMPLE_GUILDS.map(g=>{const members=g.members.map(n=>demo.get(n)).filter(Boolean).map((m,i)=>({...m,role:i===0?'Lider':'Üye'}));return {name:g.name,level:Math.min(10,3+members.length),members,power:valorGuildPower(members)}});
 if(state.guild){const members=valorGuildMyMembers();rows.push({name:state.guild.name,level:state.guild.level,members,power:valorGuildPower(members),me:true})}
 return rows.sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name,'tr'));
}
function valorGuildMemberRow(m,index){
 return '<div class="vgh-member '+(m.me?'vgr-me':'')+'"><b>'+(index+1)+'.</b><div class="vgh-member-name"><span>'+escapeAttr(m.name)+(m.me?' <small>(Sen)</small>':'')+'</span><small>'+(m.role==='Lider'?'👑 Lider':'Üye')+(m.cls?' · '+escapeAttr(m.cls):'')+' · Sv. '+m.level+'</small></div><strong>'+money(m.power)+'</strong></div>';
}

function valorGuildMembersPage(){
 if(!state.guild)return '<section class="vgr-page"><p>Henüz bir birliğin yok. Birlik kurduğunda üyelerin burada görünür.</p>'+valorCastlePreviousGuild()+'</section>';
 const g=state.guild,members=valorGuildMyMembers(),max=g.level>=10,need=max?0:guildCosts[g.level];
 return '<section class="vgr-page"><div class="vgh-summary"><div><span class="vdg-eyebrow">BİRLİK · SV. '+g.level+' / 10</span><h2>'+escapeAttr(g.name)+'</h2></div><div class="vgh-stats"><div><span>Birlik Gücü</span><b>'+money(valorGuildPower(members))+'</b></div><div><span>Üyeler</span><b>'+members.length+' / 30</b></div></div></div>'
  +'<div class="vgr-table"><div class="vgr-table-head"><span>Üye</span><span>Savaş Gücü</span></div>'+members.sort((a,b)=>b.power-a.power).map(valorGuildMemberRow).join('')+'</div>'
  +'<p class="vc-local">Yerel deneme: birlikte yalnızca bu karakter bulunur. Diğer oyuncuların birliğe katılması sunucu bağlantısı gerektirir.</p>'
  +'<div class="vgh-card"><h3>Birlik Seviyesi</h3><p>'+(max?'Birlik maksimum seviyede.':'Sonraki seviye için '+money(need-g.progress)+' altın gerekli.')+'</p><div class="bar"><div style="width:'+(max?100:Math.min(100,g.progress/need*100))+'%"></div></div>'
  +(max?'':'<div class="vgh-donate"><input type="number" id="donate" min="1" inputmode="numeric" placeholder="Bağış miktarı"><button type="button" onclick="donate()">Altın Bağışla</button></div>')
  +'<p class="vgr-note">Toplam bağışın: '+money(g.donated||0)+' altın</p></div></section>';
}

function valorGuildPowerPage(){
 const rows=valorGuildPowerRows();
 return '<section class="vgr-page"><span class="vdg-eyebrow">SAVAŞ GÜCÜ</span><h2>Birlik Sıralaması</h2><p>Birlik gücü, üyelerin savaş güçlerinin toplamıdır. Üyeleri görmek için birliğe dokun.</p>'
  +'<div class="vgr-table"><div class="vgr-table-head"><span>Birlik</span><span>Birlik Gücü</span></div>'
  +rows.map((g,i)=>'<details class="vgh-guild '+(g.me?'vgr-me':'')+'"><summary><b>'+(i+1)+'.</b><div class="vgh-member-name"><span>'+escapeAttr(g.name)+(g.me?' <small>(Birliğin)</small>':'')+'</span><small>Sv. '+g.level+' · '+g.members.length+' üye</small></div><strong>'+money(g.power)+'</strong></summary><div class="vgh-guild-members">'+g.members.slice().sort((a,b)=>b.power-a.power).map(valorGuildMemberRow).join('')+'</div></details>').join('')
  +'</div>'+(state.guild?'':'<p class="vgr-note">Birlik kurduğunda birliğin de bu sıralamaya girer.</p>')
  +'<p class="vc-local">Örnek birlikler, oyuncu sıralamasındaki örnek oyunculardan oluşur. Gerçek birlikler arası sıralama sunucu bağlantısı gerektirir.</p></section>';
}

function valorGuildHubContributions(){
 let html=valorGuildContributionsPage();
 if(!state.guild)return '<section class="vgr-page"><h2>Katkı Sıralaması</h2><p>Katkı sıralamasını görmek için önce bir birlik kurmalısın.</p></section>';
 // Donation controls live on the Members tab now.
 return html.replace('<div class="vc-management">'+valorCastlePreviousGuild()+'</div>','');
}

function valorGuildCastlePage(){
 return '<div class="vgh-castle-links">'+(valorTestMode()?'<button type="button" onclick="valorCastleTestOpen()">Kale Savaşı Testi · 5 Birlik ›</button>':'')+'<button type="button" onclick="valorMedallionOpenMarket()">Madalyon Pazarı ›</button></div>'
  +'<p class="vgr-fame">Şöhretin: <b id="vgr-fame-value">'+money(Number(state.fame)||0)+'</b></p>'
  +'<section class="valor-castle"><div id="valor-castle-panel">'+valorCastlePanel()+'</div></section>';
}

valorGuildSelectSection=function(section){
 if(!VALOR_GUILD_HUB_TABS.some(([id])=>id===section))return;
 valorCastleStop();valorGuildSection=section;render();
};
guild=function(){
 if(valorCastleSettle())save();
 if(!VALOR_GUILD_HUB_TABS.some(([id])=>id===valorGuildSection))valorGuildSection='members';
 const s=valorGuildSection;
 const body=s==='power'?valorGuildPowerPage():s==='contributions'?valorGuildHubContributions():s==='castle'?valorGuildCastlePage():valorGuildMembersPage();
 return '<div class="vgr-hub vgh-hub"><nav class="vgr-tabs vgh-tabs" aria-label="Birlik bölümleri">'+VALOR_GUILD_HUB_TABS.map(([id,name])=>'<button type="button" aria-pressed="'+(s===id)+'" onclick="valorGuildSelectSection(\''+id+'\')">'+name+'</button>').join('')+'</nav>'+body+'</div>';
};
if(state.class&&page==='Birlik')render();
