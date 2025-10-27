# Rate Limiting Kılavuzu

## 📊 Genel Bakış

Active Users modülü, sunucu güvenliği ve performansı için **çok katmanlı rate limiting** sistemi kullanır.

---

## 🎯 Mevcut Limitler

### 1. **IP Bazlı Limit**
- **Limit:** 100 istek/dakika
- **Amaç:** Tek bir cihazdan gelen aşırı istekleri engeller
- **Kullanım:** DDoS koruması ve kötü niyetli trafik önleme

### 2. **Customer Bazlı Limit**
- **Limit:** 5,000 istek/dakika (config'den ayarlanabilir)
- **Amaç:** Müşteri başına adil kullanım sağlar
- **Kullanım:** Büyük müşteriler bile sistem kaynaklarını tüketemez

---

## ⚙️ Nasıl Çalışır?

### Otomatik Kontrol
Her API isteği otomatik olarak rate limit kontrolünden geçer:

```typescript
// Her endpoint'te:
POST /presence/join   → Rate limit check
POST /presence/beat   → Rate limit check
POST /presence/leave  → Rate limit check
GET  /metrics         → Rate limit check
```

### Response Headers
Her yanıtta limit bilgileri header'da döner:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 5000           # Maksimum limit
X-RateLimit-Remaining: 4850       # Kalan istek hakkı
X-RateLimit-Reset: 2024-01-15T10:35:00Z  # Limit sıfırlanma zamanı
```

### Limit Aşıldığında
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-15T10:35:00Z
Retry-After: 45                   # Kaç saniye sonra tekrar deneyebilir

{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded (customer). Try again in 45 seconds.",
  "blockedBy": "customer"
}
```

---

## 🔧 Konfigürasyon

### Varsayılan Ayarlar

```typescript
// server/config.ts
{
  maxRequestsPerMinute: 5000  // Customer bazlı limit
}
```

### Özel Limitler Ayarlama

```typescript
import { ActiveUsersServer } from './modules/active_users/server';

const server = new ActiveUsersServer(redisClient, {
  maxRequestsPerMinute: 10000  // Daha yüksek limit
});

// Veya runtime'da değiştir
const rateLimiter = server.getRateLimiter();

// IP limitini artır
rateLimiter.addLimiter('ip', {
  windowMs: 60000,
  maxRequests: 200,  // 100 → 200
  keyGenerator: (req) => req.ip || 'unknown',
});
```

### Endpoint Bazlı Özel Limitler

```typescript
// Örneğin: /metrics endpoint'ine daha düşük limit
rateLimiter.addLimiter('metrics', {
  windowMs: 60000,
  maxRequests: 500,
  keyGenerator: (req) => `${req.body?.customerId || 'anon'}:metrics`,
});
```

---

## 📈 Normal Kullanım Örnekleri

### Tek Kullanıcı (1 Tab)
```
Foreground heartbeat: 6 istek/dakika (10s interval)
Metrics polling:      2 istek/dakika (30s interval)
Join/Leave:           2 istek/dakika
─────────────────────────────────────────────────
Toplam:              ~10 istek/dakika ✅
```

### 100 Aktif Kullanıcı (Bir Müşteri)
```
100 kullanıcı × 10 istek/dakika = 1,000 istek/dakika ✅
Limit: 5,000 → %20 kullanım
```

### 500 Aktif Kullanıcı
```
500 kullanıcı × 10 istek/dakika = 5,000 istek/dakika ✅
Limit: 5,000 → %100 kullanım (tam kapasite)
```

### 600 Aktif Kullanıcı
```
600 kullanıcı × 10 istek/dakika = 6,000 istek/dakika ❌
Limit: 5,000 → Aşıldı!

Çözüm: maxRequestsPerMinute'ı artırın veya premium plan
```

---

## 🛡️ Güvenlik Senaryoları

### Senaryo 1: DDoS Saldırısı
```
Saldırgan → 1 saniyede 10,000 istek gönderdi
IP Limit  → 100 istek/dakika
Sonuç     → 100. istekten sonra TÜM istekler reddedildi ✅
```

### Senaryo 2: Hatalı Kod
```
Müşteri sitesinde bug → Her 100ms'de heartbeat gönderiyor
Normal    → 6 istek/dakika
Buggy     → 600 istek/dakika
Limit     → 5,000 (customer limit hala OK)
          → ANCAK IP limit (100) aşıldı ❌
Sonuç     → Sistem korundu, müşteriye uyarı ✅
```

### Senaryo 3: Fair Usage
```
Küçük Müşteri (50 user)   → 500 istek/dakika  ✅
Büyük Müşteri (400 user)  → 4,000 istek/dakika ✅
Dev Müşteri (600 user)    → 6,000 istek/dakika ❌

Sonuç: Büyük müşteri bile küçük müşteriyi etkilemez
```

---

## 🔍 Monitoring ve Debug

### Rate Limit İstatistikleri

```typescript
const rateLimiter = server.getRateLimiter();

// IP limiter stats
const ipLimiter = rateLimiter.getLimiter('ip');
const stats = ipLimiter?.getStats();

console.log('Aktif IP sayısı:', stats.activeKeys);
console.log('Toplam istek:', stats.totalRequests);
```

### Manuel Reset

```typescript
// Belirli bir IP'yi resetle
const ipLimiter = rateLimiter.getLimiter('ip');
ipLimiter?.reset('192.168.1.1');

// Belirli bir customer'ı resetle
const customerLimiter = rateLimiter.getLimiter('customer');
customerLimiter?.reset('shop123');

// Tüm limitleri resetle
ipLimiter?.resetAll();
```

---

## 🚀 Production Önerileri

### 1. Redis Tabanlı Rate Limiting (Çoklu Sunucu İçin)

```typescript
import { RedisRateLimiter } from './utils/rate-limit';

// Memory yerine Redis kullan
const redisLimiter = new RedisRateLimiter(redisClient, {
  windowMs: 60000,
  maxRequests: 5000,
  keyGenerator: (req) => req.body?.customerId || 'anon',
});
```

### 2. Dinamik Limitler (Premium Plan)

```typescript
// Müşteri planına göre limit
function getCustomerLimit(customerId: string): number {
  const plan = await db.getCustomerPlan(customerId);
  
  switch (plan) {
    case 'free':      return 1000;
    case 'basic':     return 5000;
    case 'premium':   return 20000;
    case 'enterprise': return 100000;
    default:          return 1000;
  }
}
```

### 3. Alert Sistemi

```typescript
// Limit aşımlarını logla
if (!rateLimitResult.allowed) {
  await sendAlert({
    type: 'rate_limit_exceeded',
    customerId: request.body.customerId,
    blockedBy: rateLimitResult.blockedBy,
    timestamp: Date.now(),
  });
}
```

---

## 🧪 Test Senaryoları

### Test 1: Normal Kullanım
```bash
# 50 istek gönder (hepsi başarılı olmalı)
for i in {1..50}; do
  curl -X POST http://localhost:8080/presence/beat \
    -H "Content-Type: application/json" \
    -d '{"customerId":"shop123","sessionId":"sess1","tabId":"tab1","timestamp":1234567890}'
done
```

### Test 2: Rate Limit Aşımı
```bash
# 150 istek gönder (100'den sonra 429 hatası almalı)
for i in {1..150}; do
  curl -X POST http://localhost:8080/presence/beat \
    -H "Content-Type: application/json" \
    -d '{"customerId":"shop123","sessionId":"sess1","tabId":"tab1","timestamp":1234567890}' \
    -w "\nStatus: %{http_code}\n"
done
```

---

## 📝 Özet

✅ **İki katmanlı koruma:** IP + Customer bazlı
✅ **Otomatik cleanup:** Eski kayıtlar her 5 dakikada temizlenir
✅ **HTTP standartları:** 429 hatası + Retry-After header
✅ **Kolay konfigürasyon:** Runtime'da değiştirilebilir
✅ **Production ready:** Redis desteği mevcut

Rate limiting sisteminiz artık aktif! 🎉

