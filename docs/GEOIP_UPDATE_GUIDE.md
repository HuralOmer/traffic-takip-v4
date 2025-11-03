## GeoLite2 IP Veritabanı Güncelleme Kılavuzu

- **MaxMind hesabı ve lisans anahtarı**
  - GeoLite2 verilerini indirirken MaxMind hesabına ihtiyacın var.
  - Portalda “My License Key” bölümünden yeni anahtar üret; bu anahtar hem yerelde hem container içinde kullanılacak.

- **İndirilecek paketler**
  - MaxMind’in “Download Databases” sayfasından özellikle şu CSV paketlerini indiriyoruz:
    - `GeoLite2-City-CSV`
    - `GeoLite2-Country-CSV`
  - Dilersen ASN veya MMDB paketlerini de aynı yöntemle indirebilirsin; projede `geoip-lite` kütüphanesi CSV’leri `.dat` formatına dönüştürüyor.

- **Yerel klasör yapısı**
  - Önerilen örnek: `C:\Users\Esra\Desktop\traffic-takip\GeoLite2-City-CSV_YYYYMMDD`
  - Zip’i açtıktan sonra `GeoLite2-City-Blocks-IPv4.csv`, `GeoLite2-City-Locations-en.csv` vb. dosyaları bu klasörde tut.
  - Tarihi klasör adına ekleyerek hangi dump’ın güncel olduğunu takip edebilirsin.

- **Projede `geoip-lite` verisini güncelleme (yerel)**
  1. Service dizinine geç:
     ```powershell
     cd C:\Users\Esra\Desktop\traffic-takip\traffic-tracking-system\services\universal-tracking
     ```
  2. Güncelleme script’ini lisans anahtarıyla çalıştır:
     ```powershell
     pnpm exec node node_modules/geoip-lite/scripts/updatedb.js license_key=YOUR_LICENSE_KEY
     ```
  3. Script yeni `.dat` dosyalarını `node_modules/geoip-lite/data` içine yazacak.
  4. Ardından derlemeyi doğrula:
     ```powershell
     pnpm --filter @universal-tracking/service run build
     ```

- **Container içinde güncelleme**
  1. Proje kökünde çalıştır:
     ```powershell
     cd C:\Users\Esra\Desktop\traffic-takip\traffic-tracking-system
     ```
  2. Çalışan container’da script’i çalıştır:
     ```powershell
     docker-compose exec universal-tracking pnpm --filter "@universal-tracking/service" exec node node_modules/geoip-lite/scripts/updatedb.js license_key=YOUR_LICENSE_KEY
     ```
  3. Güncelleme bitince servisi yeniden başlat:
     ```powershell
     docker-compose restart universal-tracking
     ```
  4. İsteğe bağlı: yeni imaj istiyorsan `docker-compose build --no-cache universal-tracking && docker-compose up -d universal-tracking` komutunu çalıştır.

- **Doğrulama adımları**
  - CLI üzerinden kontrol: `node -e "const geoip=require('geoip-lite');console.log(geoip.lookup('146.59.32.113'));"`
  - REST test: `POST /presence/join` isteğine `x-forwarded-for` header’ı ile test IP’si ver, ardından Redis’te `presence:*` kaydını kontrol et.
  - CSV doğrulaması: `Select-String -Path GeoLite2-City-Blocks-IPv4.csv -Pattern "146\.59\.32\.112/30"`

- **Otomasyon ipucu**
  - Aşağıdaki PowerShell script’i ile hem yerel hem container güncellemesini tek komutla yapabilirsin:
    ```powershell
    param([string]$LicenseKey)
    cd "C:\Users\Esra\Desktop\traffic-takip\traffic-tracking-system\services\universal-tracking"
    pnpm exec node node_modules/geoip-lite/scripts/updatedb.js license_key=$LicenseKey
    cd ..
    docker-compose exec universal-tracking pnpm --filter "@universal-tracking/service" exec node node_modules/geoip-lite/scripts/updatedb.js license_key=$LicenseKey
    docker-compose restart universal-tracking
    ```

- **Sık karşılaşılan sorunlar**
  - `license key invalid`: Key’i MaxMind’den tekrar kopyala; boşluk veya satır sonu olmasın.
  - `ENOENT`: `geoip-lite` paketi kurulu değilse `pnpm install` çalıştır.
  - `Out of memory`: Düşük RAM’li makinede script takılabilir; daha güçlü ortamda güncelleyip `node_modules/geoip-lite/data` klasörünü kopyalamak mümkün.
  - Container içinde script bulunamıyorsa imajı yeniden build et (`docker-compose build universal-tracking`).

- **Versiyon takibi / geri dönüş**
  - Güncellemeden önce `node_modules/geoip-lite/data` klasörünün tarihlerini not al.
  - Gerekirse eski CSV dump klasörlerini saklayarak geri dönüş yapabilirsin.


