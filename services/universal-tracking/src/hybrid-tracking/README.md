# Hibrit Tracking Sistemi

Bu modül, **CNAME + 1. Parti Çerez** ve **localStorage Fallback** sistemlerini birleştiren hibrit bir tracking çözümü sağlar.

## 🎯 **Sistem Özellikleri**

### **1. Hibrit Yaklaşım:**
- ✅ **Önce CNAME + 1. Parti Çerez** dener
- ✅ **Başarısız olursa localStorage** kullanır
- ✅ **Kesintisiz kullanıcı deneyimi**
- ✅ **Otomatik geçiş**

### **2. Tracking Yöntemleri:**

#### **A. CNAME + 1. Parti Çerez (İdeal):**
```
tracking.musteri.com → API'ye direkt bağlantı
1. parti çerezler (.musteri.com domain'inde)
Gerçek zamanlı veri
Tam performans
```

#### **B. localStorage Fallback:**
```
localStorage → API'ye senkronize
Offline destek
Gecikmeli veri
Güvenilir fallback
```

## 🚀 **Kullanım**

### **1. Basit Kullanım:**
```javascript
// Tracking başlat
const tracking = new UniversalTracking({
  customerId: 'musteri123',
  domain: 'musteri.com',
  debug: true
});

await tracking.init();
```

### **2. Event Tracking:**
```javascript
// Sayfa görüntüleme
tracking.trackPageView();

// Custom event
tracking.trackEvent({
  event_type: 'custom_action',
  metadata: { action: 'button_click' }
});

// E-ticaret
tracking.trackAddToCart('product123', 'Ürün Adı', 99.99);
tracking.trackPurchase('order456', 199.98, items);
```

### **3. Auto-Tracking:**
```javascript
// Otomatik link/button/form tracking
tracking.startAutoTracking();

// Scroll tracking
tracking.startScrollTracking();
```

## 📊 **Event Türleri**

### **Standart Events:**
- `page_view` - Sayfa görüntüleme
- `page_visible` - Sayfa görünür
- `page_hidden` - Sayfa gizli
- `page_unload` - Sayfa kapanıyor
- `scroll` - Scroll tracking
- `button_click` - Button tıklama
- `link_click` - Link tıklama
- `form_submit` - Form gönderimi

### **E-ticaret Events:**
- `product_view` - Ürün görüntüleme
- `add_to_cart` - Sepete ekleme
- `purchase` - Satın alma
- `checkout` - Ödeme

## 🔧 **Konfigürasyon**

```typescript
interface TrackingConfig {
  customerId: string;        // Müşteri ID'si
  domain: string;           // Müşteri domain'i
  apiEndpoint?: string;     // API endpoint (opsiyonel)
  debug?: boolean;          // Debug modu
}
```

## 🍪 **Çerez Yönetimi**

### **1. Parti Çerezler (CNAME modunda):**
```
ut_customer_id=musteri123; domain=.musteri.com; path=/; secure; samesite=lax
ut_session_id=sess_abc123; domain=.musteri.com; path=/; secure; samesite=lax
ut_tracking_method=cname_cookies; domain=.musteri.com; path=/; secure; samesite=lax
```

### **2. localStorage (Fallback modunda):**
```
ut_musteri123_customer_id: "musteri123"
ut_musteri123_session_id: "sess_abc123"
ut_musteri123_tracking_method: "localStorage_fallback"
ut_musteri123_events: [event1, event2, ...]
```

## 🔄 **Sistem Akışı**

### **1. Başlatma:**
```
1. CNAME bağlantısını test et
2. Başarılı ise → CNAME + 1. Parti Çerez
3. Başarısız ise → localStorage Fallback
4. Otomatik tracking başlat
```

### **2. Event Gönderimi:**
```
CNAME Modu:
Event → tracking.musteri.com/api/events → API

localStorage Modu:
Event → localStorage → api.lorventurkiye.com/api/events → API
```

### **3. Offline Senkronizasyon:**
```
1. Offline veriler localStorage'da saklanır
2. Online olduğunda otomatik senkronize edilir
3. Senkronize edilen veriler temizlenir
```

## 📈 **Avantajlar**

### **Kullanıcı Avantajları:**
- ✅ **Hiç kesinti yok** - Her durumda çalışır
- ✅ **Otomatik geçiş** - Kullanıcı fark etmez
- ✅ **Offline destek** - İnternet yokken de çalışır
- ✅ **Hızlı yükleme** - Optimize edilmiş kod

### **Teknik Avantajlar:**
- ✅ **Fallback mekanizması** - Güvenilir sistem
- ✅ **Veri kaybı yok** - Tüm eventler kaydedilir
- ✅ **Esnek yapı** - Kolay genişletilebilir
- ✅ **Debug desteği** - Kolay hata ayıklama

## 🧪 **Test**

### **1. CNAME Test:**
```javascript
// CNAME bağlantısını test et
const cnameWorking = await tracking.testCNAMEConnection();
console.log('CNAME çalışıyor:', cnameWorking);
```

### **2. Sistem Durumu:**
```javascript
// Mevcut tracking method'u al
const status = tracking.getStatus();
console.log('Tracking method:', status.trackingMethod);
```

### **3. Debug Modu:**
```javascript
// Debug modunu aç
tracking.setDebugMode(true);
```

## 🔒 **Güvenlik**

- ✅ **HTTPS zorunlu** - Güvenli bağlantı
- ✅ **SameSite cookies** - CSRF koruması
- ✅ **Secure cookies** - Güvenli çerezler
- ✅ **Domain validation** - Domain doğrulama

## 📝 **Notlar**

- **CNAME modu** en iyi performansı sağlar
- **localStorage modu** güvenilir fallback'tir
- **Otomatik geçiş** kullanıcı deneyimini korur
- **Offline senkronizasyon** veri kaybını önler
