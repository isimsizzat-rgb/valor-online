/* Passive astrology effects. Saved with the character, shared by combat modes. */
const VALOR_DRAGON_BREATH_MAX = 20;
function valorAstrologyData() {
  const old = state.astrologyV1;
  const level = Math.max(0, Math.min(VALOR_DRAGON_BREATH_MAX, Math.floor(Number(old?.dragonBreath) || 0)));
  if (!old || typeof old !== 'object' || old.dragonBreath !== level) {
    state.astrologyV1 = {dragonBreath: level};
    save();
  }
  return state.astrologyV1;
}
function valorAstrologyReduction() { return valorAstrologyData().dragonBreath / 100; }
function valorAstrologyTakenDamage(damage, reduction = valorAstrologyReduction()) {
  const safeReduction = Math.max(0, Math.min(.20, Number(reduction) || 0));
  return Math.max(1, Math.round(Math.max(1, Number(damage) || 1) * (1 - safeReduction)));
}
function valorAstrologyEnemyThreat(power) { return Math.max(1, Number(power) * (1 - valorAstrologyReduction())); }
function valorAstrologyCost(level) { return 5000 * (level + 1) * (level + 1); }

function valorAstrologyUpgrade() {
  if (page !== 'Astroloji' || !state.class) return;
  const data = valorAstrologyData();
  if (data.dragonBreath >= VALOR_DRAGON_BREATH_MAX) return toast('Ejderha Nefesi en yüksek seviyede.');
  const cost = valorAstrologyCost(data.dragonBreath);
  if (state.gold < cost) return toast('Geliştirmek için yeterli altının yok.');
  state.gold -= cost;
  data.dragonBreath++;
  save();
  render();
  toast('Ejderha Nefesi Sv. ' + data.dragonBreath + ' · %' + data.dragonBreath + ' hasar azaltma');
}

function valorAstrologyPage() {
  const level = valorAstrologyData().dragonBreath;
  const maxed = level === VALOR_DRAGON_BREATH_MAX;
  const cost = valorAstrologyCost(level);
  return '<section class="astrology-page"><header class="astrology-header"><div><small>YILDIZLARIN KUDRETİ</small><h1>Astroloji</h1><p>Göksel güçlerini geliştir, savaşlarda üstünlük kazan.</p></div>' +
    '<button type="button" class="astrology-back" onclick="go(\'Anasayfa\')">‹ Anasayfa</button></header>' +
    '<div class="astrology-gold">Altının <b>' + money(state.gold) + '</b></div>' +
    '<article class="astrology-talent"><div class="astrology-talent-art"><div class="astrology-orbit"></div><img src="' + MOUNT_ART + '" alt="Ejderha Nefesi"></div>' +
    '<div class="astrology-talent-copy"><span class="astrology-passive">PASİF ÖZELLİK · KALICI</span><h2>Ejderha Nefesi</h2>' +
    '<p>Ejderhanın koruyucu nefesi, aldığın hasarı azaltır. Her seviye %1 hasar azaltma sağlar.</p>' +
    '<div class="astrology-level"><b>Seviye ' + level + '<small> / ' + VALOR_DRAGON_BREATH_MAX + '</small></b><span>%' + level + ' Hasar Azaltma</span></div>' +
    '<div class="astrology-progress"><i style="width:' + level / VALOR_DRAGON_BREATH_MAX * 100 + '%"></i></div>' +
    '<div class="astrology-stats"><div><small>ŞU ANDA</small><strong>%' + level + '</strong><span>Hasar azaltma</span></div><div><small>' + (maxed ? 'SINIRA ULAŞILDI' : 'SONRAKİ SEVİYE') + '</small><strong>%' + Math.min(20, level + 1) + '</strong><span>Hasar azaltma</span></div></div>' +
    '<p class="astrology-example">1.000 hasar aldığında <b>' + money(valorAstrologyTakenDamage(1000)) + '</b> hasar yersin.</p>' +
    '<button type="button" class="astrology-upgrade" ontouchend="event.stopPropagation()" ' + (maxed || state.gold < cost ? 'disabled' : '') + ' onclick="valorAstrologyUpgrade()">' +
    (maxed ? 'En Yüksek Seviye' : 'Geliştir <span>' + money(cost) + ' Altın</span>') + '</button>' +
    (!maxed && state.gold < cost ? '<p class="astrology-insufficient">Geliştirmek için ' + money(cost - state.gold) + ' altına daha ihtiyacın var.</p>' : '') +
    '<p class="astrology-note">Arena ve Sahne’de alınan hasarı azaltır. Macera ve Zindan savaşlarında da savunma avantajı sağlar.</p></div></article></section>';
}

/* Arena snapshots capture the defender’s passive; critical and block still apply. */
const valorAstrologyPreviousArenaStats = valorArenaStats;
valorArenaStats = function () {
  return {...valorAstrologyPreviousArenaStats(), astrologyDamageReduction: valorAstrologyReduction()};
};
const valorAstrologyPreviousArenaHit = valorArenaHit;
valorArenaHit = function (attacker, defender, rng = Math.random) {
  const hit = valorAstrologyPreviousArenaHit(attacker, defender, rng);
  if (defender.stats.astrologyDamageReduction > 0) hit.damage = valorAstrologyTakenDamage(hit.damage, defender.stats.astrologyDamageReduction);
  return hit;
};
/* Instant-result dungeon combat represents defense through effective enemy power. */
const valorAstrologyPreviousDungeonEnemy = vsEnemy;
vsEnemy = function (floor) { return Math.max(1, Math.round(valorAstrologyEnemyThreat(valorAstrologyPreviousDungeonEnemy(floor)))); };
