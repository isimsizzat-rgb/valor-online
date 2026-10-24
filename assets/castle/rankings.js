/* Donation ledgers and rankings use available local character data. */
let valorGuildSection='castle',valorGuildContributionPeriod='total';
function valorGuildWeek(now=Date.now()){
 const d=new Date(now+3*3600000),weekday=(d.getUTCDay()+6)%7;
 return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-weekday)).toISOString().slice(0,10);
}
function valorGuildContributionData(){
 if(!state.guild)return null;
 const g=state.guild,player=valorCastleData().playerId;let changed=false;
 if(!g.contributionsV1){g.contributionsV1={members:{},since:Date.now()};changed=true}
 const ledger=g.contributionsV1;
 if(!ledger.members[player]){ledger.members[player]={id:player,name:state.name||'Oyuncu',total:Math.max(0,Number(g.donated)||0),weeks:{}};changed=true}
 const me=ledger.members[player],total=Math.max(0,Number(g.donated)||0);
 if(me.total!==total||me.name!==(state.name||'Oyuncu')){me.total=total;me.name=state.name||'Oyuncu';changed=true}
 if(changed)save();return ledger;
}
function valorGuildContributionRows(members,period='total',week=valorGuildWeek()){
 return Object.values(members||{}).map(row=>({...row,amount:Math.max(0,Number(period==='weekly'?row.weeks?.[week]:row.total)||0)})).sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name,'tr')||a.id.localeCompare(b.id));
}
function valorGuildSelectSection(section){
 if(!['castle','ranking','contributions'].includes(section))return;
 valorCastleStop();valorGuildSection=section;render();
}
function valorGuildSelectContributionPeriod(period){if(!['total','weekly'].includes(period))return;valorGuildContributionPeriod=period;render()}
const valorGuildRankingsPreviousDonate=donate;
donate=function(){
 if(!state.guild)return valorGuildRankingsPreviousDonate();
 const guild=state.guild,ledger=valorGuildContributionData(),player=valorCastleData().playerId,before=Number(guild.donated)||0;
 const result=valorGuildRankingsPreviousDonate(),delta=(Number(guild.donated)||0)-before;
 if(state.guild===guild&&delta>0){const me=ledger.members[player],week=valorGuildWeek();me.total=Number(guild.donated)||0;me.weeks[week]=(Number(me.weeks[week])||0)+delta;save();render()}
 return result;
};
function valorGuildRankingsPage(){
 const d=valorCastleData(),active=valorCastleCalendar().active,live=active?d.sessions[active.id]:null,last=Object.values(d.sessions).filter(w=>w.settled).sort((a,b)=>b.start-a.start)[0];
 const rows=active?valorCastleRank(Object.values(live?.guilds||{})):last?.rankings||[];
 return '<section class="vgr-page"><span class="vdg-eyebrow">KALE SAVAŞI · BİRLİK PUANLARI</span><h2>Birlik Sıralaması</h2><p>'+(active?'Devam eden savaşın puanları':last?'Son tamamlanan Kale Savaşı':'Henüz tamamlanan Kale Savaşı yok')+'</p><p class="vc-local">Yerel deneme: yalnızca bu karakterin kaydındaki birlik puanları gösterilir. Ortak oyuncu sıralaması sunucu bağlantısı gerektirir.</p><div class="vc-board">'+valorCastleRows(rows)+'</div><p class="vgr-note">Sıralama verilen toplam hasara göre belirlenir. Eşit puanda son toplamına önce ulaşan birlik öne geçer.</p><div class="vgr-tier-list">'+[['1. birlik',125],['2. birlik',100],['3. birlik',75],['Diğer katılan birlikler',50]].map(([name,fame])=>'<div><span>'+name+'</span><b>+'+fame+' Şöhret / üye</b></div>').join('')+'</div></section>';
}
function valorGuildContributionsPage(){
 const ledger=valorGuildContributionData();
 if(!ledger)return '<section class="vgr-page"><h2>Katkı Sıralaması</h2><p>Katkı sıralamasını görmek için önce bir birlik kurmalısın.</p>'+valorCastlePreviousGuild()+'</section>';
 const period=valorGuildContributionPeriod,rows=valorGuildContributionRows(ledger.members,period),myId=valorCastleData().playerId,week=valorGuildWeek();
 return '<section class="vgr-page"><span class="vdg-eyebrow">'+escapeAttr(state.guild.name)+'</span><h2>Katkı Sıralaması</h2><p>Üyelerin birliğe bağışladığı altın miktarına göre sıralanır.</p><div class="vgr-period"><button type="button" aria-pressed="'+(period==='total')+'" onclick="valorGuildSelectContributionPeriod(\'total\')">Toplam Katkı</button><button type="button" aria-pressed="'+(period==='weekly')+'" onclick="valorGuildSelectContributionPeriod(\'weekly\')">Bu Hafta</button></div><div class="vgr-table"><div class="vgr-table-head"><span>Üye</span><span>Bağışlanan Altın</span></div>'+rows.map((row,index)=>'<div class="vgr-member '+(row.id===myId?'vgr-me':'')+'"><b>'+(index+1)+'.</b><span>'+escapeAttr(row.name)+(row.id===myId?' <small>(Sen)</small>':'')+'</span><strong>'+money(row.amount)+'</strong></div>').join('')+'</div><p class="vgr-note">'+(period==='weekly'?'Hafta başlangıcı: '+week+' · Pazartesi 00.00, Türkiye saati.':'Önceki toplam bağışların korunur.')+' Haftalık katkılar bu güncellemeden sonraki bağışlardan hesaplanır.</p><p class="vc-local">Yerel kayıtta bulunan üyeler gösterilir. Diğer oyuncuların katkılarının ortak görünmesi sunucu bağlantısı gerektirir.</p><div class="vc-management">'+valorCastlePreviousGuild()+'</div></section>';
}
const valorGuildRankingsPreviousGuild=guild;
guild=function(){
 if(valorCastleSettle())save();
 const tabs=[['castle','Kale Savaşı'],['ranking','Birlik Sıralaması'],['contributions','Katkı Sıralaması']];
 return '<div class="vgr-hub"><nav class="vgr-tabs" aria-label="Birlik bölümleri">'+tabs.map(([id,name])=>'<button type="button" aria-pressed="'+(valorGuildSection===id)+'" onclick="valorGuildSelectSection(\''+id+'\')">'+name+'</button>').join('')+'</nav><p class="vgr-fame">Şöhretin: <b id="vgr-fame-value">'+money(Number(state.fame)||0)+'</b></p>'+(valorGuildSection==='ranking'?'<div id="vgr-ranking-content">'+valorGuildRankingsPage()+'</div>':valorGuildSection==='contributions'?valorGuildContributionsPage():valorGuildRankingsPreviousGuild())+'</div>';
};
const valorGuildRankingsPreviousRefresh=valorCastleRefresh;
valorCastleRefresh=function(){
 valorGuildRankingsPreviousRefresh();
 const fame=document.getElementById('vgr-fame-value');if(fame)fame.textContent=money(Number(state.fame)||0);
 if(page!=='Birlik'||valorGuildSection!=='ranking')return;
 const box=document.getElementById('vgr-ranking-content');if(!box)return;
 const html=valorGuildRankingsPage();if(box.dataset.snapshot!==html){box.innerHTML=html;box.dataset.snapshot=html}
};
