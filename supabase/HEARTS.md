# Kalp hediyesi kurulumu

Önce mevcut `titles.sql`, ardından aynı Supabase projesinin SQL Editor bölümünde `hearts.sql` çalıştırılır. İşlem mevcut popülerlik puanlarını ve hesapları korur. `guard2.sql` / `admin.sql` içindeki `is_banned` işlevi gereklidir.

- Sınırlı Mağaza: 99 kalp 49 elmas, 999 kalp 499 elmas, 9.999 kalp 4.999 elmas. Kullanıcı günlük adet sınırı belirtmediği için kalp paketlerine günlük satın alma sınırı uygulanmaz.
- Çanta → Kalp → Kalp Gönder veya Sıralama → Oyuncu profili → Kalp Gönder.
- Alan oyuncunun her kalp için popülerliği 1 artar. Kalp yeniden hediye edilebilir envantere aktarılmaz; doğrudan popülerlik olarak sayılır. Mevcut popülerlik sıralaması ve En Popüler Lord ünvanı kullanılır.
- Bakiye ayrı sunucu tablosunda korunur. Çantadaki kopya yalnızca gösterimdir. Elmas ve kalp alışverişi tek işlem; gönderimde kalp düşümü ve popülerlik artışı tek işlem. İstek kimliği yeniden denemelerde çift harcamayı önler. Normal kayıt yüklemesi popülerliği değiştiremez.
- Kurulum yoksa ön yüz işlem başarılı demeden hata gösterir, yerel elmas harcamaz.

Yerel ön yüz kontrolü: `node tools/hearts/check.cjs`. Canlı SQL kurulumu ve iki ayrı hesapla bakiye, gönderme, sıralama, yetki ve tekrar gönderim doğrulaması ayrıca gerekir; ön yüz testi canlı sunucu doğrulaması değildir.
