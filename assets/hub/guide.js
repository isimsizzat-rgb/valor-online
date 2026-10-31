/* Player-facing reference. Keep mechanics aligned with their owning game modules.
   text: a string is a paragraph, an array of strings is a bullet list. */
const VALOR_GUIDE_TOPICS=[
 {id:'baslangic',category:'Başlangıç',title:'İlk adımlar',tags:'yeni oyuncu seviye deneyim exp refah sıfırlama gece yarısı',text:[
  'Savaşçı, Büyücü veya Okçu seçerek başlarsın. Karakter seviyesi en fazla 100’dür; Sv.50’den sonra her seviye iki kat EXP ister.',
  'İlk günlerde izleyebileceğin sıra:',
  ['Enerjini Macera’da harca (her savaş 10 enerji).','5 günlük Sahne hakkını kullan.','Zindan’da takılana kadar kat çık.','Altınını Atölye’de güçlendirmeye yatır.','Görevler’deki günlük ödül paketini al.'],
  'Refah: Günün en yüksek seviyeli oyuncusunun 10 seviyeden fazla gerisindeysen, aradaki her seviye için %10 ek EXP alırsın (en fazla %100).',
  'Günlük haklar her gün Türkiye saatiyle 00.00’da yenilenir.'
 ],route:'Harita',link:'Haritayı Aç'},
 {id:'siniflar',category:'Başlangıç',title:'Sınıflar ve ekipman',tags:'savaşçı büyücü okçu silah asa yay kılıç kuşan seviye şartı slot',text:[
  'Savaşçı kılıç, Büyücü asa, Okçu yay kullanır. Savaşçı ve Okçu Saldırı ile, Büyücü Sihir ile hasar verir.',
  'Altı ekipman yuvası vardır: Silah, Zırh, Kask, Ayakkabı, Kolye ve Küpe. Bir eşyayı kuşanmak için sınıfının tutması ve seviyenin eşyanın seviyesine yetmesi gerekir.',
  'Profil’de kuşandığın ekipmanı ve toplam özelliklerini görürsün. Eşyaya tek dokunuş bilgisini açar, çift dokunuş ekipmanı çıkarır.'
 ],route:'Profil',link:'Profili Aç'},
 {id:'ozellik',category:'Başlangıç',title:'Savaş Gücü ve özellikler',tags:'saldırı sihir defans savunma can kritik bloke hasar formül sıra güç',text:[
  'Tüm savaşlar (Arena, Zindan, Sahneler) aynı kurallarla işler:',
  ['Saldırısı yüksek olan önce vurur.','Fiziksel vuruşu Defans, büyü vuruşunu Sihirli Defans azaltır.','1 Can puanı 10 can eder.','Kritik vuruş %25 fazla, bloklanan vuruş %25 az hasar verir.'],
  'Kritik ve Bloke şansı puanla artar: 1.000 puanda %25, 5.000 puanda %100 olur. Rakibin bloke şansı senin kritik şansınla ayrı ayrı hesaplanır.',
  'Karakterin Sv.1’de aşağıdaki değerlerin 20 katıyla başlar, sonra her seviyede bir katı daha kazanır:',
  ['Savaşçı: +15 Saldırı, +12 Defans, +8 Sihirli Defans, +40 Can, +3 Kritik, +6 Bloke','Büyücü: +15 Sihir, +8 Defans, +12 Sihirli Defans, +30 Can, +3 Kritik, +3 Bloke','Okçu: +18 Saldırı, +8 Defans, +8 Sihirli Defans, +30 Can, +6 Kritik, +3 Bloke'],
  'Diğer özelliklerin seviye, ekipman, mozaik taşları, binekler, muhafızlar, kanatlar, Teknoloji, Astroloji ve madalyondan gelir.'
 ],route:'Profil',link:'Profili Aç'},
 {id:'enerji',category:'Başlangıç',title:'Macera ve enerji',tags:'macera enerji şişe yenileme bölge altın exp binek taşı',text:[
  'Macera’daki her savaş 10 enerji harcar. Enerji en fazla 100 olur; her 30 dakikada 10 yenilenir, oyun kapalıyken de dolar. Her gece 00.00’da enerjin 100’e tamamlanır.',
  'Macerada seviyene göre açılan 10 bölge vardır (her 10 seviyede bir yenisi). Kazanınca:',
  ['Altın: 1. bölgede 2.500, her bölgede 2.500 artar (10. bölge 25.000).','EXP: 24.000’den başlar, her bölgede 12.000 artar.','Binek Taşı: %10 şans, her bölgede %1 artar.'],
  'Enerji Şişesi +50 enerji verir. Market’ten 50 elmasa (günde 5) veya Zindan Marketi’nden 20 zindan parasına (günde 2) alınır.'
 ],route:'Macera',link:'Maceraya Git'},
 {id:'canta',category:'Ekipman',title:'Çanta ve eşyalar',tags:'envanter eşya tak çıkar sat toplu çanta aç şans çantası mozaik çantası',text:[
  'Ekipman, tüketilebilir eşyalar ve malzemeler Çanta’da durur. Bir kutuya dokunarak açıklamasını ve yapabileceğin işlemleri gör.',
  'Aynı türden malzemeler tek kutuda birikir. Kullanma ve satış penceresinde adedi seçebilirsin; onaylamadan önce miktarı kontrol et.',
  'Açılabilen çantalar:',
  ['Şans Taşı Çantası: Sv.1–4 arası bir şans taşı.','Mozaik Taş Çantası: rastgele türde, Sv.1–4 arası bir mozaik taşı.','Yıldönümü Kutusu: binek ve taş ödülleri.']
 ],route:'Çanta',link:'Çantayı Aç'},
 {id:'guclendirme',category:'Ekipman',title:'Ekipman güçlendirme',tags:'atölye artı +21 şans taşı yükseltme başarı oranı altın bedeli',text:[
  'Atölye → Güçlendirme’de ekipmanı +21’e kadar yükseltirsin. Her + seviyesi eşyanın gücünü yaklaşık %13 artırır.',
  'Başarısız olursan eşya seviyesini kaybetmez, sadece harcanan altın ve şans taşı gider. Başarı oranı ve bedel yükseldikçe değişir:',
  ['+0 → +1: %100 · 1.000 altın','+5 → +6: %70 · 11.000 altın','+10 → +11: %25 · 120.000 altın','+15 → +16: %8 · 1,4 milyon altın','+20 → +21: %2 · 15 milyon altın'],
  'Şans Taşı her denemede bir tane harcanır ve seviyesinin 10 katı ekler: Sv.1 +%10, Sv.8 +%80. Yüksek seviyelerde taşsız deneme çok pahalıya gelir.',
  'Atölye’deki Şans Taşı sekmesinde aynı seviyeden 2 taşı altınla bir üst seviyeye birleştirirsin (Sv.1→2 2.500 altın, Sv.7→8 32.500 altın).'
 ],route:'Atölye',link:'Atölyeye Git'},
 {id:'evrim',category:'Ekipman',title:'Normal → Epik → Ebedi → İlahi',tags:'evrim epik taşı parçası evrim parçası dukat +21 +0 kabus çark',text:[
  'Evrim sırası Normal → Epik → Ebedi → İlahi’dir. Bir eşyayı evrimleştirmek için +21 olması ve yeterli Epik Taşı gerekir:',
  ['Normal → Epik: 10 Epik Taşı','Epik → Ebedi: 30 Epik Taşı + 5 Evrim Parçası','Ebedi → İlahi: 90 Epik Taşı + 15 Evrim Parçası'],
  'Evrimden sonra eşya +0’a döner ama yeni aşamanın +0’ı bile eski +21’den yaklaşık %40 güçlüdür. Takılı mozaik taşları ve efsunlar korunur.',
  'Epik Taşı her Kabus sahnesi zaferinde 1–5 adet düşer; Şans Çarkı’ndan da 1 adet çıkabilir.',
  'Evrim Parçası Market → Madalyonlar’da Dukat ile alınır (tanesi 20 Dukat). Dukat Kale Savaşı’ndan kazanılır.'
 ],route:'Atölye',link:'Atölyeye Git'},
 {id:'mozaik',category:'Ekipman',title:'Mozaik taşları',tags:'soket yuva mücevher birleştirme değişim taş türü seviye',text:[
  'Her ekipmanda 4 mozaik yuvası vardır. Aynı ekipmana aynı türden ikinci taş takılamaz. Atölye → Mozaik’te yuvaya dokunarak taş takıp çıkarırsın.',
  'Yedi tür vardır. Sv.1 ve Sv.10 değerleri:',
  ['Saldırı, Sihirli Saldırı, Defans, Sihirli Defans: +100 → +1.225','Can: +500 → +2.750','Kritik, Bloke: +50 → +500'],
  'Mozaik Birleştir: aynı tür ve seviyeden 4 taş, %100 başarıyla 1 üst seviye taş olur (en fazla Sv.10). Mozaik Değişim: bir taşı ücretsiz olarak aynı seviyede başka bir türe çevirir.',
  'Taş kaynakları: Market (Sv.1–3, 20/50/120 elmas), Mozaik Taş Çantası, Zindan boss katları ve Zindan Marketi.'
 ],route:'Atölye',link:'Atölyeyi Aç'},
 {id:'savas',category:'Savaşlar',title:'Arena ve Takım Arenası',tags:'savaş pvp düello rakip şöhret zafer öfke denk rakip takım oda',text:[
  'Arena’da günde 10 savaş hakkın var. Rakipler gücüne yakın oyunculardan seçilir. Savaş birinin canı bitene kadar sürer.',
  'Zafer ödülü: +500 altın, +5 şöhret ve %10 şansla Sv.1–3 şans taşı. Yenilginin cezası yoktur.',
  'Öfke: 6. turdan itibaren her vuruş tur başına %10 daha fazla hasar verir (6. tur +%10, 7. tur +%20…). Bu yüzden uzun savaşlar hızla biter.',
  'Denk Rakip ile kendi kopyana karşı sınırsız deneme yapabilirsin; hak harcamaz, ödül vermez.',
  'Takım Arenası her gün 12.00–13.00 ve 18.00–19.00 arası açılır. 3 kişilik odalara katılırsın, günde 15 hakkın vardır. Zafer: +1.000 altın, +5 şöhret.'
 ],route:'Savaş',link:'Savaşa Git'},
 {id:'sahneler',category:'Savaşlar',title:'Sahneler ve zorluklar',tags:'harita kolay zor kabus epik parçası bölge sefer kağıdı giriş hakkı',text:[
  'Dört bölge vardır: Kızıl Orman (Sv.1–25), Kızıl Çöl (26–50), Buzul Dağları (51–75) ve Cehennem Ovaları (76–100). Bölgeye seviyesi yetince girebilirsin.',
  'Her bölgede önce Kolay açıktır. Kolay’ı geçince Zor, Zor’u geçince Kabus açılır.',
  'Bir sahnede 7 düşmanla arka arkaya savaşırsın; sonuncusu bosstur. Canın düşmanlar arasında yenilenmez.',
  'Günde 5 giriş hakkın var; Sefer Kağıdı +1 hak verir. Sahneyi bitirince:',
  ['Altın: 8.000 + seviye × 100','Ekipman düşme şansı: Kolay %4, Zor %8, Kabus %12','Kabus: ayrıca 1–5 Epik Taşı'],
  'Düşen ekipman +0 gelir ve aşaması zorluğa göre belirlenir (Normal / Epik / Ebedi / İlahi):',
  ['Kolay: %90 / %8 / %2 / %0','Zor: %83 / %12 / %4,5 / %0,5','Kabus: %75 / %15 / %8,5 / %1,5'],
  'Her bölgenin Kabus modunu ilk kez geçmek, Görevler’den 500 elmas kazandırır.'
 ],route:'Sahneler',link:'Sahneleri Aç'},
 {id:'zindan',category:'Savaşlar',title:'Zindan',tags:'kule kat boss zindan parası baskın market külpençe',text:[
  'Zindan 100 kattır. Her kat bir öncekinden zordur; her 5. kat boss, her 10. kat büyük bosstur. Savaş hakkı sınırsızdır ve yenilginin cezası yoktur.',
  'Her kat EXP verir. Boss katları ayrıca bir mozaik taşı (1–30. kat Sv.1–2, 31–60. kat Sv.2–3, sonrası Sv.3–4) ve kat numarasının beşte biri kadar zindan parası verir.',
  'Katlar her gün 00.00’da sıfırlanır. Baskın (1.000.000 altın), daha önce ulaştığın en yüksek kata kadar bütün ödülleri toplayarak seni hızla çıkarır.',
  'Zindan Marketi’nde zindan parasıyla binek taşı, enerji şişesi, şans çantası, Sefer Kağıdı, Sv.3 mozaik, Sv.4 şans taşı ve kalıcı binek Külpençe (1.500) alınır.',
  'Görevler’de her 10 katta bir ödül vardır: 10. kat 50, 100. kat 150 Binek Taşı.'
 ],route:'Zindan',link:'Zindana Git'},
 {id:'etkinlik',category:'Savaşlar',title:'Dünya Bossu ve etkinlik takvimi',tags:'boss saat kale savaş takım arena türkiye takvim etkinlik',text:[
  'Saatler Türkiye saatine göredir:',
  ['Dünya Bossu: her gün 10.00 ve 20.00, 15 dakika','Takım Arenası: her gün 12.00–13.00 ve 18.00–19.00','Kale Savaşı: Pazartesi, Çarşamba, Cuma 21.00, 15 dakika'],
  'Dünya Bossu’nda Saldırıyı Başlat’a bas; ekran açık kaldığı sürece her saniye otomatik vurursun. Etkinlik bitince toplam hasarının %1’i kadar altın kazanırsın. Boss ekranından ayrılırsan saldırı durur.',
  'Etkinlikler ekranı açık olan etkinliği, bitiş saatini veya bir sonraki başlangıcı gösterir.'
 ],route:'Etkinlikler',link:'Takvimi Aç'},
 {id:'binek',category:'Gelişim',title:'Binekler ve binek gelişimi',tags:'güç zeka zırh beden binek taşı ruh koleksiyon eğitim kart parçala parça süreli birleştir',text:[
  'Sahip olduğun bütün bineklerin özellikleri toplanır; sadece birini seçmezsin. Market → Binekler’den altınla aldığın binek kart olarak çantana düşer; kartı çantadan kullanınca koleksiyonuna eklenir.',
  'Koleksiyonundaki bir bineğin fazla kartını çantada parçalayıp Binek Ruh Parçası alırsın (bineğin ruh değerinin beşte biri). Atölye → Binek Kartı bölümünde parçalarla süreli binek üretirsin: Kül Tayı 7 gün (100), Fırtına Kurdu 7 gün (250), Gölge Grifonu 15 gün (600), Ejder Ruhu 30 gün (1.500). Aynı süreli bineği tekrar kullanmak süresini uzatır.',
  'Binek özellikleri karakterine şöyle geçer:',
  ['Güç: puan başına 4 Saldırı','Zeka: puan başına 4 Sihir','Zırh: puan başına 4 Defans ve 4 Sihirli Defans','Beden: puan başına 40 Can'],
  'Binek Geliştirme’de bir satır seçip Binek Taşı kullanırsın: 1 taş 10 EXP verir, %10 şansla 50 EXP. Her seviye o özelliğe +5 ekler. Taşları 1’er ya da 50’şer kullanabilirsin.',
  'Binek Taşı kaynakları: Macera, günlük görev paketi, zindan kat görevleri, Market (10 elmas, günde 50) ve Zindan Marketi.'
 ],route:'Binek',link:'Binekleri Aç'},
 {id:'muhafiz',category:'Gelişim',title:'Muhafızlar ve yem',tags:'pet besle yıldız beyaz yeşil mavi mor altın kuşan özel güç közpençe ayazdiş şafakkanat gecegaga',text:[
  'Dört muhafızın da senindir ve dördünün özellikleri birlikte karakterine eklenir. Her biri Güç, Zeka, Zırh ve Beden verir.',
  'Yemle beslenen muhafız yıldız ve renk atlar: Beyaz → Yeşil → Mavi → Mor → Altın, her renkte 5 yıldız. Özellik 10’dan başlar, Altın 5★’da 255 olur. Bir muhafızı sonuna kadar büyütmek 13.000 yem ister; her yem %10 şansla 5 kat sayılır.',
  'Kuşandığın tek muhafızın özel gücü savaşta çalışır (değerler Beyaz 1★ → Altın 5★):',
  ['Közpençe: %10→%30 şansla rakibi 3 tur yakar.','Ayazdiş: rakibin kritik ve bloke şansını %5→%18 düşürür.','Şafakkanat: canı %25’in altındaki rakibe +%10→%50 hasar.','Gecegaga: %4→%20 şansla aynı turda ikinci vuruş.'],
  'Pet Yemi; günlük görev paketi, giriş ödülü ve Şans Çarkı’ndan gelir.'
 ],route:'Pet',link:'Muhafızları Aç'},
 {id:'kanat',category:'Gelişim',title:'Kanatlar',tags:'fashion kanat tak birleştir seviye seraf anka ayaz hiçlik yüzde',text:[
  'Dört kanat vardır: Seraf, Anka, Ayaz ve Hiçlik. Hepsi tüm sınıflara uyar ve Market → Kanatlar’da 999 elmastır.',
  'Kanat seviyesi başına yedi özelliğin hepsine +%2 verir: Sv.1 +%2, Sv.10 +%20.',
  'Kanat Birleştirme’de aynı seviyeden iki kanat bir üst seviye kanat olur. Başarı şansı seviyeye göre düşer: Sv.1→2 %100, Sv.2→3 %85, Sv.3→4 %70, Sv.4→5 %55, Sv.5→6 %40, Sv.6→7 %25, Sv.7’den sonra %10. Başarısız olursa kanatlardan biri yanar (takılı kanat korunur), diğeri aynı seviyede kalır. Market’ten alınan Şans Tüyü her biri %5 şans ekler; kutuyu işaretlersen gereken kadar tüy kullanılarak şans %100’e çıkar (örneğin Sv.2→3 için 3 tüy). İki kanat aynı türse aynı kanadı, farklıysa rastgele bir kanat alırsın. En yüksek seviye 10’dur.',
  'Kanatlarını Fashion ekranında görür, oradan kuşanırsın.'
 ],route:'Fashion',link:'Kanatları Aç'},
 {id:'kalici',category:'Gelişim',title:'Teknoloji ve Astroloji',tags:'kalıcı özellik altın kristal pasif üretim yetenek kızıl hiddet sonsuz direnç yaşam ışığı gece perdesi',text:[
  'Teknoloji kristalle gelişir; her satır en fazla Sv.100 olur ve bir sonraki seviye (seviye + 1) × 2.000 kristal tutar. Seviye başına bonus:',
  ['Saldırı, Sihirli Saldırı, Defans, Sihirli Defans: +200','Kritik, Bloke: +50','Can: +400','Altın Üretimi: dakikada +100 altın (oyun kapalıyken de üretir)'],
  'Astroloji altınla gelişen 8 kalıcı yetenektir; her biri en fazla Sv.20. Bir sonraki seviye 5.000 × (seviye)³ altın tutar: Sv.1 5.000, Sv.10 5 milyon, Sv.20 40 milyon.',
  ['Kızıl Hiddet, Astral Alev, Demir İrade, Yıldız Örtüsü: Saldırı, Sihir, Defans, Sihirli Defans seviye başına +%1','Kader Kıran: kritik hasarı seviye başına +%1','Gece Perdesi: aldığın hasar seviye başına −%1','Sonsuz Direnç: seviye başına %0,5 şansla vuruştan sadece 1 hasar alırsın','Yaşam Işığı: seviye başına %0,5 şansla canının %5’i yenilenir']
 ],route:'Astroloji',link:'Astrolojiyi Aç'},
 {id:'tilsim',category:'Gelişim',title:'Tılsımlar',tags:'tılsım tilsim yeşil sarı mor kırmızı birleştir yuva sahne',text:[
  'Tılsımlar sahne zaferlerinden %2 şansla Sv.1–3 olarak düşer. 8 tür ve 4 renk vardır: Yeşil, Sarı, Mor, Kırmızı; renk tamamen rastgeledir. Menü → Tılsım ekranından kuşanılır.',
  'Dört yuva vardır; Sv.25, 50, 75 ve 100’de açılır. Aynı türden dört tılsım bile takılabilir.',
  'Değerler Sv.10 içindir; Sv.1 bunun %10’unu, her seviye %10 daha fazlasını verir. İki efsunlu tılsım efsun başına daha yüksek değer alır; rengin toplam gücü efsunlara bölünür.',
  ['Yeşil: 2 efsun 3.500–5.000 · 4 efsun 2.000–2.500','Sarı: 2 efsun 5.000–7.500','Mor: 2 efsun 7.500–10.000','Kırmızı: 2 efsun 10.000–15.000'],
  'Aynı seviyeden herhangi iki tılsım birleşir: başarılı olursa rastgele bir tılsım bir üst seviyeye çıkar; başarısız olursa biri yanar, diğeri aynı seviyede farklı bir tılsıma dönüşür. Şanslar kanatla aynıdır ve Şans Tüyü kullanılabilir.'
 ],route:'Tılsım',link:'Tılsımlara Git'},
 {id:'madalyon',category:'Gelişim',title:'Şöhret ve madalyonlar',tags:'şöhret madalyon dukat zırh delme lord unvan market',text:[
  'Şöhret; Arena ve Takım Arenası zaferlerinden (+5) ve Kale Savaşı sıralamasından gelir. Şöhretin arttıkça daha güçlü madalyonların kilidi açılır.',
  'Madalyonlar Market → Madalyonlar’da Dukat ile alınır ve 7 gün kullanılır. Zırh delme verirler: rakibin Defansının bir kısmını yok sayarsın. Ayrıca can eklerler.',
  ['Zalim: şöhret şartı yok · %2 zırh delme · +1.000 can · 200 Dukat','Kudretli Lord: 1.500 şöhret · %6 · +3.000 can','Yüce Lord: 25.000 şöhret · %14 · +10.000 can','Lordların Efendisi: 100.000 şöhret · %20 · +20.000 can · 1.000 Dukat'],
  'Dukat yalnızca Kale Savaşı’ndan kazanılır.'
 ],route:'Market',link:'Markete Git'},
 {id:'kaynak',category:'Ekonomi ve Hesap',title:'Altın, elmas ve çiftlik',tags:'market alışveriş tohum hasat kristal para elmas sınırlı mağaza',text:[
  'Altın; güçlendirme, Astroloji, binek ve baskın için harcanır. Elmas; Market, kanatlar ve Şans Çarkı içindir. Kristal sadece Teknoloji’de kullanılır.',
  'Çiftlikte ekim ücretsizdir. Her arazi için kristal ya da altın seçersin:',
  ['Filiz Tohumu: 1 saat · 2.500 kristal veya 15.000 altın','Bereket Tohumu: 3 saat · 6.500 kristal veya 37.500 altın','Bolluk Tohumu: 6 saat · 11.000 kristal veya 70.000 altın'],
  '3 araziyle başlarsın. Her hasat 1 çiftlik deneyimi sayılır; çiftlik seviyen arttıkça yeni araziler açılır, en fazla 15.',
  'Market’in Sınırlı Mağaza bölümündeki günlük limitler her gece sıfırlanır: Binek Taşı 10 elmas (50/gün), Enerji Şişesi 50 (5/gün), Sefer Kağıdı 99 (3/gün), Yıldönümü Kutusu 25 (100/gün).'
 ],route:'Çiftlik',link:'Çiftliğe Git'},
 {id:'gunluk',category:'Ekonomi ve Hesap',title:'Günlük yapılacaklar',tags:'görev ödül ücretsiz çark giriş sandık yan görev ana görev elmas sandığı',text:[
  ['Giriş Ödülü: 7 günlük takvim. 7. gün 100 elmas ve Yıldönümü Kutusu. Bir gün kaçırırsan sıfırlanmaz, kaldığın yerden devam eder.','Elmas Sandığı: 6 saatte bir açılır, 10–50 elmas verir.','Şans Çarkı: günde 3 ücretsiz çevirme; sonrası 99 elmas ya da 10’lu çevirme 899 elmas. Ücretli çevirme günde en fazla 30 tur.'],
  'Yan Görevler: 100 enerji harca, 3 kez yükseltme yap, 5 sahne geç, Dünya Bossu’na katıl, çiftlikte 10 hasat yap. Beşi bitince paket: 500.000 altın, 15 Binek Taşı, 5 Şans Taşı Çantası, 2 Mozaik Taş Çantası ve 5 Pet Yemi.',
  'Ana Görevler kalıcıdır: her 10 seviyede elmas (Sv.10 100, Sv.100 1.000), her 10 zindan katında Binek Taşı ve her bölgenin Kabus modu için 500 elmas.'
 ],route:'Görevler',link:'Görevleri Aç'},
 {id:'birlik',category:'Ekonomi ve Hesap',title:'Birlik ve Kale Savaşı',tags:'klan lonca üye lider dukat bağış kale savaşı altın üretimi',text:[
  'Birlik kurmak 500.000 altındır. Bir birlikte en fazla 30 üye olur. Üyelerin altın bağışıyla birlik Sv.10’a kadar yükselir.',
  'Kale Savaşı Pazartesi, Çarşamba ve Cuma 21.00’de 15 dakika sürer. Birlik ekranı açık kaldığı sürece her saniye otomatik saldırırsın; vuruşun Saldırı (Büyücüde Sihir) değerinin yarısı kadardır.',
  'Birliklerin toplam hasarına göre üyeler ödül alır:',
  ['1. birlik: 500 Dukat · 125 şöhret','2. birlik: 400 Dukat · 100 şöhret','3. birlik: 300 Dukat · 75 şöhret','Diğerleri: 200 Dukat · 50 şöhret'],
  'Kazanan birliğin üyelerinin Altın Üretimi bir sonraki savaş bitene kadar %25 artar.'
 ],route:'Birlik',link:'Birliği Aç'},
 {id:'hesap',category:'Ekonomi ve Hesap',title:'Nick, cinsiyet ve hesap',tags:'isim kullanıcı şifre değişim kartı ayarlar kayıt kurtarma kodu şifremi unuttum',text:[
  'Kullanıcı adın ile karakterinin nicki farklıdır. Nick Değiştirme Kartı sadece karakter adını değiştirir; giriş yaptığın kullanıcı adı aynı kalır.',
  'Market → Sınırlı Mağaza → Kartlar’da nick, cinsiyet ve birlik ismi değiştirme kartları 149 elmastır. Kartı Çanta’dan kullanırsın; birlik ismi kartını sadece lider kullanabilir.',
  'Şifreni unutmaya karşı Profil’den bir Kurtarma Kodu oluştur ve güvenli bir yere yaz. Kod sadece bir kez gösterilir. Şifreni unutursan giriş ekranındaki Şifremi unuttum ile bu kodla yeni şifre belirlersin.'
 ],route:'Ayarlar',link:'Ayarları Aç'}
];
function valorGuideNormalize(value){return String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ı/g,'i')}
function valorGuideBlock(part){return Array.isArray(part)?'<ul>'+part.map(li=>'<li>'+li+'</li>').join('')+'</ul>':'<p>'+part+'</p>'}
function valorGuidePage(){
 const categories=['Tümü',...new Set(VALOR_GUIDE_TOPICS.map(t=>t.category))];
 return '<section class="vhub-page vwiki-page">'+valorHubHeader('Rehber','Aradığın bilgiyi bul, oyuna devam et.')+'<div class="vwiki-search"><label for="valor-guide-search">Rehberde ara</label><input id="valor-guide-search" type="search" placeholder="Evrim, enerji, kanat…" autocomplete="off" oninput="valorGuideFilter()"></div><div class="vwiki-categories" role="group" aria-label="Rehber konuları">'+categories.map((c,i)=>'<button type="button" data-guide-category="'+c+'" aria-pressed="'+(i===0)+'" onclick="valorGuideCategory(this)">'+c+'</button>').join('')+'</div><p id="valor-guide-count" class="vwiki-count" role="status" aria-live="polite">'+VALOR_GUIDE_TOPICS.length+' konu</p><div class="vwiki-topics">'+VALOR_GUIDE_TOPICS.map(t=>'<details class="vwiki-topic" data-guide-id="'+t.id+'" name="valor-guide-topics"><summary><span><small>'+t.category+'</small><b>'+t.title+'</b></span><i aria-hidden="true">+</i></summary><div class="vwiki-content">'+t.text.map(valorGuideBlock).join('')+'<button type="button" onclick="go(\''+t.route+'\')">'+t.link+' ›</button></div></details>').join('')+'</div><div id="valor-guide-empty" class="vhub-card vwiki-empty" hidden><h2>Konu bulunamadı</h2><p>Başka bir kelime dene veya tüm konuları aç.</p><button type="button" onclick="valorGuideReset()">Aramayı Temizle</button></div></section>';
}
function valorGuideCategory(button){for(const b of document.querySelectorAll('[data-guide-category]'))b.setAttribute('aria-pressed',String(b===button));valorGuideFilter()}
function valorGuideFilter(){
 const input=document.getElementById('valor-guide-search');if(!input)return;
 const words=valorGuideNormalize(input.value.trim()).split(/\s+/).filter(Boolean),category=document.querySelector('[data-guide-category][aria-pressed="true"]')?.dataset.guideCategory||'Tümü';let count=0;
 for(const topic of VALOR_GUIDE_TOPICS){const el=document.querySelector('[data-guide-id="'+topic.id+'"]');if(!el)continue;const text=valorGuideNormalize([topic.title,topic.tags,topic.category,...topic.text.flat()].join(' '));const visible=(category==='Tümü'||category===topic.category)&&words.every(w=>text.includes(w));el.hidden=!visible;if(visible)count++;else el.open=false}
 document.getElementById('valor-guide-count').textContent=count+' konu'+(words.length?' bulundu':'');document.getElementById('valor-guide-empty').hidden=count!==0;
}
function valorGuideReset(){const input=document.getElementById('valor-guide-search');if(input)input.value='';const all=document.querySelector('[data-guide-category="Tümü"]');if(all)valorGuideCategory(all);input?.focus()}
