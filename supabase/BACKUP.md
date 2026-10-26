# Veritabanı yedekleri

`.github/workflows/backup.yml` her pazartesi 04:17'de (Türkiye) veritabanının şifreli yedeğini alır.
İstediğin an GitHub → **Actions → Database backup → Run workflow** ile de çalıştırabilirsin.

## Kurulum (bir kez)
GitHub deposunda **Settings → Secrets and variables → Actions → New repository secret** ile iki değer ekle:

| Ad | Değer |
|---|---|
| `SUPABASE_DB_URL` | Supabase → üstteki **Connect** → **Session pooler** bağlantı adresi. `[YOUR-PASSWORD]` yerine veritabanı şifreni yaz. |
| `BACKUP_PASSPHRASE` | Yedekleri açmak için kendi belirlediğin uzun bir parola. Unutma; parola olmadan yedek açılamaz. |

## Yedeği indirme ve açma
1. GitHub → **Actions → Database backup** → bir çalışmayı aç → **Artifacts** bölümünden dosyayı indir (zip içinde `.gpg`).
2. Bilgisayarında aç: `gpg -d valor-backup-TARİH.tgz.gpg > yedek.tgz` (parolayı sorar), sonra `tar xzf yedek.tgz`.
3. İçinden `backup/public.sql` (oyun tabloları) ve `backup/auth.sql` (hesaplar) çıkar.

## Geri yükleme (yeni ya da boş bir Supabase projesine)
```
psql "BAĞLANTI_ADRESİ" -f backup/auth.sql
psql "BAĞLANTI_ADRESİ" -f backup/public.sql
```
Önce `auth.sql`, sonra `public.sql`. Gerekirse bu adımı birlikte yaparız.
