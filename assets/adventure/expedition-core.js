/* Valor Online · Macera seferi (10 adım). Each entry is a short journey: a story line, then either a
   foe to fight with the four arena skills or a mysterious chest. Step 10 is always the zone's boss.
   Foe strength follows the reference players (tools/valor-dungeon/refstats.json) at the zone's entry
   level; calibrated with tools/adventure/balance.cjs.
   Rewards add up to about the old single-fight win: 6 foes x 6% + boss 40% of the zone's gold/EXP,
   3 chests with 1-3 Kalp (server, signed-in players) plus gold (10-20%) or a Sv.1 Şans Taşı; the boss also rolls the zone's
   Binek Taşı chance as before. */
(function (root) {
  'use strict';
  const STEPS = 10, CHESTS = 3;
  // Keep in sync with VALOR_XP_REWARD_SCALE in index.html (EXP is counted in millions).
  const XP_REWARD_SCALE = 800;
  // Same zones as assets/adventure/adventure.js (names, level range, rewards).
  const LORE = [
    { foes: ['Yaban Kurdu', 'Patika Haydudu', 'Dikenli Sarmaşık'], boss: 'Yaşlı Ayı Grimtaş', places: ['eski bir kilometre taşının', 'yosunlu bir köprünün', 'terk edilmiş bir kamp ateşinin', 'kadim bir meşenin'] },
    { foes: ['Kızıl Tilki', 'Koru Eşkıyası', 'Kan Böceği'], boss: 'Kızıl Orman Bekçisi', places: ['kızıl yapraklı bir açıklığın', 'devrilmiş bir ağacın', 'kurumuş bir derenin', 'avcı kulübesinin'] },
    { foes: ['Bataklık Sülüğü', 'Sis Hayaleti', 'Çamur Golemi'], boss: 'Bataklık Cadısı Morra', places: ['batık bir kayığın', 'sisli bir gölcüğün', 'çürümüş bir iskelenin', 'fısıldayan sazlıkların'] },
    { foes: ['Harabe Muhafızı', 'Taş Örümcek', 'Lanetli Rahip'], boss: 'Unutulmuş Kral Arvel', places: ['yıkık bir sütunun', 'çökmüş bir tapınağın', 'yazıtlı bir duvarın', 'kırık bir heykelin'] },
    { foes: ['Gölge Avcısı', 'Karanlık Yarasa', 'Boşluk Kedisi'], boss: 'Gölgelerin Efendisi Nyx', places: ['ay ışığı vurmayan bir kayanın', 'kara bir çeşmenin', 'gölge kaplı bir mağaranın', 'sessiz bir mezarlığın'] },
    { foes: ['Fırtına Kartalı', 'Şimşek Ruhu', 'Geçit Yağmacısı'], boss: 'Gök Gürültüsü Devi Thoran', places: ['rüzgârın uğuldadığı bir kayalığın', 'yıldırım çarpmış bir kulenin', 'dar bir geçidin', 'çatırdayan bir köprünün'] },
    { foes: ['Buz Kurdu', 'Kar Trolü', 'Ayaz Perisi'], boss: 'Buzul Ejderi Frostvyrn', places: ['donmuş bir şelalenin', 'buz mağarasının', 'kar fırtınasının ortasında bir kayanın', 'buz tutmuş bir sunağın'] },
    { foes: ['Lav Semenderi', 'Kül Golemi', 'Alev İblisi'], boss: 'Ateş Lordu Ignar', places: ['kaynayan bir lav gölünün', 'kül kaplı bir yıkıntının', 'duman tüten bir yarığın', 'erimiş bir kalenin'] },
    { foes: ['Uçurum Sürüngeni', 'Lanetli Şövalye', 'Ruh Emici'], boss: 'Uçurumun Sesi Malgor', places: ['dipsiz bir yarığın', 'zincirli bir kapının', 'kemiklerle dolu bir çukurun', 'kırık bir mührün'] },
    { foes: ['Ejderha Muhafızı', 'Pul Zırhlı Şövalye', 'Ejderha Yavrusu'], boss: 'Kadim Ejderha Valdrak', places: ['devasa bir pulun', 'altın yığınlarının', 'tahta çıkan basamakların', 'yanık bir sancağın'] }
  ];
  const zones = ['Kadim Patika', 'Kızıl Koruluk', 'Sisli Bataklık', 'Unutulmuş Harabeler', 'Gölge Vadisi', 'Fırtına Geçidi', 'Buzul Zirvesi', 'Alev Çorakları', 'Lanetli Uçurum', 'Ejderha Tahtı']
    .map((name, i) => ({ name, min: i * 10 + 1, max: i * 10 + 10, gold: 2500 * (i + 1), xp: (30 + i * 15) * XP_REWARD_SCALE, stoneChance: .10 + i * .01, ...LORE[i] }));

  // Reference player power by level (R0 Sv.1, R1 Sv.25, R2 Sv.50, R3 Sv.75, R4 Sv.100).
  const POWER = [[1, 63000], [25, 113000], [50, 235000], [75, 390000], [100, 1285000]];
  function power(level) {
    const x = Math.max(1, Math.min(100, level));
    for (let i = 1; i < POWER.length; i++) { const [x0, y0] = POWER[i - 1], [x1, y1] = POWER[i]; if (x <= x1) return Math.exp(Math.log(y0) + (Math.log(y1) - Math.log(y0)) * (x - x0) / (x1 - x0)); }
    return POWER[POWER.length - 1][1];
  }
  // Same proportions as valorBalanceEnemyStats (assets/balance/balance.js).
  function enemyStats(P, magic) {
    const s = {}; P = Math.max(1, P);
    s[magic ? 'Sihir' : 'Saldırı'] = Math.max(1, Math.round(P * .28 / 10));
    s[magic ? 'Saldırı' : 'Sihir'] = Math.max(1, Math.round(P * .06 / 3));
    s.Savunma = s['Sihir Savunma'] = Math.max(0, Math.round(P * .12 / 10));
    s.Can = Math.max(1, Math.round(P * .34 / 3));
    s.Kritik = s.Bloke = Math.min(2000, Math.max(0, Math.round(P * .04 / 4)));
    return s;
  }
  // Foes grow along the way; the boss is a real test for a player at the zone's entry level.
  /* power: share of the reference power; hp / atk: health and main attack against a player-like build
     (low health keeps fights short, higher attack keeps them dangerous). */
  const TUNE = { foe: .55, step: .04, boss: .9, foeHp: .13, bossHp: .25, foeAtk: 1.3, bossAtk: 1.8 };
  const pick = (a, rng) => a[Math.floor(rng() * a.length)];

  /* The journey: which steps hold a chest (never the first or the last), and the story for each step. */
  function plan(zi, rng = Math.random) {
    const z = zones[zi], spots = [2, 3, 4, 5, 6, 7, 8, 9], chests = new Set();
    while (chests.size < CHESTS) chests.add(spots.splice(Math.floor(rng() * spots.length), 1)[0]);
    let fightNo = 0; const steps = [];
    for (let n = 1; n <= STEPS; n++) {
      const place = pick(z.places, rng);
      if (n === STEPS) steps.push({ n, kind: 'fight', boss: true, foe: z.boss, fightNo: fightNo++, story: 'Yolun sonuna geldin. ' + cap(place) + ' ardında ' + z.boss + ' belirdi. ' + z.name + ' bölgesinin efendisi seni bekliyor!' });
      else if (chests.has(n)) steps.push({ n, kind: 'chest', story: cap(place) + ' yanında, yarı toprağa gömülü gizemli bir sandık buldun. Kilidi paslanmış, kapağı yavaşça açılıyor…' });
      else { const foe = pick(z.foes, rng); steps.push({ n, kind: 'fight', boss: false, foe, fightNo: fightNo++, story: (n === 1 ? z.name + ' bölgesine adım attın. ' : 'Yoluna devam ediyorsun. ') + cap(place) + ' yakınında bir ' + foe + ' yolunu kesti!' }); }
    }
    return { zone: zi, steps };
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function enemy(zi, step) {
    const z = zones[zi], T = TUNE, mult = step.boss ? T.boss : T.foe + T.step * step.fightNo, magic = (zi + step.fightNo) % 3 === 1, st = enemyStats(power(z.min) * mult, magic);
    const main = magic ? 'Sihir' : 'Saldırı';
    st.Can = Math.max(1, Math.round(st.Can * (step.boss ? T.bossHp : T.foeHp))); st[main] = Math.max(1, Math.round(st[main] * (step.boss ? T.bossAtk : T.foeAtk)));
    return { name: step.foe, cls: magic ? 'Büyücü' : 'Savaşçı', level: z.min + Math.min(9, step.n - 1), stats: st };
  }
  /* Rewards for a beaten foe (gold, xp, and for the boss whether the Binek Taşı chance hit). */
  function fightReward(zi, boss, rng = Math.random) {
    const z = zones[zi], k = boss ? .40 : .06;
    return { gold: Math.round(z.gold * k), xp: Math.max(1, Math.round(z.xp * k)), stone: boss && rng() < z.stoneChance ? 1 : 0 };
  }
  /* A chest holds gold (70%, 10-20% of the zone's gold) or a Sv.1 Şans Taşı (30%). The 1-3 Kalp come
     from the server (heart_adventure_chest in supabase/hearts-adventure.sql). */
  function chest(zi, rng = Math.random) {
    const z = zones[zi];
    if (rng() < .70) return { gold: Math.round(z.gold * (.10 + rng() * .10) / 10) * 10 };
    return { luck: 1 };
  }
  const api = { TUNE, STEPS, CHESTS, zones, power, enemyStats, plan, enemy, fightReward, chest };
  root.ValorExpedition = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
