# 🔍 Redis Verilerini Güzel Görüntüleme Komutları

## 📋 Temel Komutlar

### 1️⃣ Tüm Key'leri Listele
```powershell
docker exec universal-tracking-redis redis-cli KEYS "*"
```

### 2️⃣ Belirli Pattern'e Göre Key'leri Listele
```powershell
docker exec universal-tracking-redis redis-cli KEYS "presence:*"
docker exec universal-tracking-redis redis-cli KEYS "passive:*"
```

### 3️⃣ Bir Key'in Değerini Güzel Formatta Göster (PowerShell)
```powershell
docker exec universal-tracking-redis redis-cli GET "KEY_BURAYA" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Örnek:**
```powershell
docker exec universal-tracking-redis redis-cli GET "presence:hural-software:sess_mgohmlzr_tx0t5t2" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### 4️⃣ Bir Key'in TTL'ini Göster
```powershell
docker exec universal-tracking-redis redis-cli TTL "KEY_BURAYA"
```

**Sonuç:**
- `-1` = Süresi dolmayacak
- `-2` = Key yok
- `Sayı` = Kalan süre (saniye)

### 5️⃣ Bir Key'i Sil
```powershell
docker exec universal-tracking-redis redis-cli DEL "KEY_BURAYA"
```

---

## 🚀 Hızlı Kullanım Fonksiyonları

PowerShell profilinde bunları tanımlayabilirsiniz:

### Profil Konumu Öğrenme:
```powershell
$PROFILE
```

### Fonksiyonları Ekleme:
```powershell
notepad $PROFILE
```

Aşağıdaki fonksiyonları ekleyin:

```powershell
# Redis key'lerini listele
function redis-keys {
    param([string]$pattern = "*")
    docker exec universal-tracking-redis redis-cli KEYS $pattern
}

# Redis değerini güzel formatta göster
function redis-get {
    param([string]$key)
    
    Write-Host "Key: $key" -ForegroundColor Cyan
    Write-Host ""
    
    # TTL göster
    $ttl = docker exec universal-tracking-redis redis-cli TTL $key
    if ($ttl -eq "-1") {
        Write-Host "TTL: No expiration" -ForegroundColor Green
    } elseif ($ttl -eq "-2") {
        Write-Host "TTL: Key not found" -ForegroundColor Red
        return
    } else {
        $minutes = [math]::Floor($ttl / 60)
        $seconds = $ttl % 60
        Write-Host "TTL: ${minutes}m ${seconds}s" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Value:" -ForegroundColor Cyan
    
    $value = docker exec universal-tracking-redis redis-cli GET $key
    if ($value) {
        $value | ConvertFrom-Json | ConvertTo-Json -Depth 10
    } else {
        Write-Host "(empty)" -ForegroundColor Gray
    }
}

# Tüm presence key'lerini göster
function redis-presence {
    $keys = redis-keys "presence:*"
    if ($keys) {
        $keys | ForEach-Object {
            Write-Host "`n========================================" -ForegroundColor Cyan
            redis-get $_
        }
    } else {
        Write-Host "No presence keys found" -ForegroundColor Yellow
    }
}

# Tüm passive-active key'lerini göster
function redis-passive {
    $keys = redis-keys "passive_active:*"
    if ($keys) {
        $keys | ForEach-Object {
            Write-Host "`n========================================" -ForegroundColor Cyan
            redis-get $_
        }
    } else {
        Write-Host "No passive-active keys found" -ForegroundColor Yellow
    }
}

# Redis'i temizle
function redis-clear {
    docker exec universal-tracking-redis redis-cli FLUSHALL
    Write-Host "Redis cleared!" -ForegroundColor Green
}

# Watch mode - sürekli güncelle
function redis-watch {
    param([string]$pattern = "*")
    while ($true) {
        Clear-Host
        Write-Host "Watching Redis keys: $pattern" -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Gray
        
        $keys = redis-keys $pattern
        if ($keys) {
            $keys | ForEach-Object {
                redis-get $_
                Write-Host "`n" -NoNewline
            }
        } else {
            Write-Host "No keys found" -ForegroundColor Yellow
        }
        
        Start-Sleep -Seconds 2
    }
}
```

---

## 📝 Kullanım Örnekleri

### Fonksiyonlar Yüklendikten Sonra:

```powershell
# Tüm key'leri listele
redis-keys

# Presence key'lerini listele
redis-keys "presence:*"

# Belirli bir key'i göster
redis-get "presence:hural-software:sess_mgohmlzr_tx0t5t2"

# Tüm presence verilerini güzel formatta göster
redis-presence

# Tüm passive-active verilerini göster
redis-passive

# Sürekli izle (watch mode)
redis-watch "presence:*"

# Redis'i temizle
redis-clear
```

---

## 🎨 Renklendirme ve Format

### TTL Renkleri:
- 🟢 **Yeşil**: Süresi dolmayacak (-1)
- 🟡 **Sarı**: Kalan süre
- 🔴 **Kırmızı**: Key bulunamadı (-2)

### JSON Format:
```json
{
    "customerId": "hural-software",
    "sessionId": "sess_mgohmlzr_tx0t5t2",
    "tabId": "tab_mgoj4w61_zcra5ij",
    "timestamp": 1760323456743,
    "isLeader": true,
    "platform": "linux",
    "userAgent": "Mozilla/5.0...",
    "updatedAt": 1760323456261
}
```

---

## 🔧 Gelişmiş Kullanım

### Redis CLI'ye Direkt Bağlan:
```powershell
docker exec -it universal-tracking-redis redis-cli
```

**CLI içinde:**
```redis
KEYS *
GET "presence:hural-software:sess_xxx"
TTL "presence:hural-software:sess_xxx"
DEL "presence:hural-software:sess_xxx"
FLUSHALL
```

### Tüm Key'leri Count Et:
```powershell
docker exec universal-tracking-redis redis-cli DBSIZE
```

### Redis Info:
```powershell
docker exec universal-tracking-redis redis-cli INFO
```

### Memory Kullanımı:
```powershell
docker exec universal-tracking-redis redis-cli INFO memory
```

---

## 📊 Monitoring

### Real-time Monitoring:
```powershell
docker exec -it universal-tracking-redis redis-cli MONITOR
```

Bu komut Redis'e gelen tüm komutları real-time gösterir.

---

## 💡 İpuçları

1. **Hızlı Test**: `redis-presence` komutu ile tüm aktif kullanıcıları anında görebilirsiniz
2. **Watch Mode**: `redis-watch "presence:*"` ile değişiklikleri sürekli izleyebilirsiniz
3. **TTL Kontrolü**: Key'lerin ne zaman expire olacağını görmek için TTL önemlidir
4. **Temizlik**: Test sonrası `redis-clear` ile tüm veriyi silebilirsiniz

---

## 🎯 Hızlı Başlangıç

1. PowerShell açın
2. Şu komutu çalıştırın:
   ```powershell
   docker exec universal-tracking-redis redis-cli GET "KEY" | ConvertFrom-Json | ConvertTo-Json -Depth 10
   ```
3. Daha rahat kullanım için yukarıdaki fonksiyonları `$PROFILE` dosyanıza ekleyin
4. PowerShell'i yeniden başlatın veya `. $PROFILE` komutu ile yenileyin

---

## 📞 Sorun Giderme

### "Key not found" hatası:
- Key'in doğru yazıldığından emin olun
- `redis-keys "*"` ile tüm key'leri listeleyin

### JSON parse hatası:
- Key'in değeri JSON formatında olmayabilir
- `redis-cli GET` komutunu direkt kullanın

### Docker hatası:
- Container'ın çalıştığından emin olun: `docker ps`
- Container adının doğru olduğunu kontrol edin

---

✅ **Artık Redis verilerinizi çok daha kolay ve güzel bir şekilde görebilirsiniz!**


