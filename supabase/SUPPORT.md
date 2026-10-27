# Destek talepleri

`support.sql`, mevcut `schema.sql` ve `admin.sql` kurulumundan sonra aynı Supabase projesinin SQL Editor bölümünde bir kez çalıştırılır. Yeniden çalıştırılabilir; mevcut talepleri silmez.

Ön yüz otomatik olarak `support_list`, `support_thread`, `support_create`, `support_reply` ve `support_set_status` RPC işlevlerini kullanır. Kurulum henüz yapılmadıysa talep gönderildiğini iddia etmez ve kullanıcıya hizmetin hazırlanmakta olduğunu gösterir.

- Oyuncu: Destek → Yeni Talep; kendi taleplerini ve yanıtlarını takip eder.
- Yönetici: Yönetim → Destek Talepleri veya Destek → Yönetici Gelen Kutusu; yanıt verir, kapatır, yeniden açar.
- Yetki, sahiplik, kategori ve metin sınırları sunucuda doğrulanır. Normal oyuncu başka oyuncunun talebini okuyamaz, yönetici yanıtı yazamaz veya talep durumunu değiştiremez.
- Doğrudan tablo yazımları kapalıdır. Tüm yazımlar kimlik doğrulamalı RPC üzerinden geçer. İstek kimliği tekrar gönderimlerde aynı kaydı döndürür.
- Hesap başına en fazla 5 açık talep; 24 saatte 10 yeni talep; yeni talepler arasında 60 saniye; mesajlar arasında 10 saniye; bir konuşmada en fazla 100 mesaj.

Canlı doğrulama için iki ayrı oyuncu hesabıyla talep açıp birbirlerinin talep kimliğini okuyamadıklarını; yönetici hesabıyla yanıt ve kapatma işlemlerini kontrol edin. Ön yüz akışı yerel taklit sunucuyla doğrulanmıştır; bu, canlı veritabanı yetki testinin yerine geçmez.
