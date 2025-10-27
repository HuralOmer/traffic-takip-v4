# 🔄 Browser Cache Temizleme Talimatları

## ⚠️ ÖNEMLİ

Gördüğünüz loglar **ESKİ BUNDLE'DAN** geliyor! Yeni merkezi log sistemi için **cache temizlenmeli**.

---

## 🧹 Cache Temizleme Yöntemleri

### Yöntem 1: Hard Refresh (En Kolay) ⭐
```
Chrome/Edge: Ctrl + Shift + R
veya
Ctrl + F5
```

### Yöntem 2: DevTools Cache Temizle
```
1. F12 (Console aç)
2. Network sekmesine git
3. "Disable cache" checkbox'ını işaretle
4. Sayfayı yenile (F5)
```

### Yöntem 3: Manuel Cache Temizle
```
Chrome/Edge:
1. Ctrl + Shift + Delete
2. "Cached images and files" seç
3. "Clear data" tıkla
4. Sayfayı yenile
```

### Yöntem 4: Incognito Mode (Test için)
```
Ctrl + Shift + N (Incognito)
URL'yi aç
```

---

## ✅ Cache Temizlendiğini Nasıl Anlarım?

### ESKİ Bundle (Cache):
```javascript
active-users-sdk.js?...:301 [Visibility] State changed
active-users-sdk.js?...:931 [ActiveUsers] Visibility changed
active-users-sdk.js?...:765 [HybridConnection] App state changed
active-users-sdk.js?...:704 [HybridConnection] Switching to...
```
→ Çok fazla log, karmaşık ❌

### YENİ Bundle (Cache Temiz):
```javascript
🚀 Initializing Active Users SDK...
[PassiveActive] Tracker initialized
✅ Active Users SDK initialized successfully

📊 STATUS: Session active | Connection: websocket | Visibility: foreground | Leader: 👑 YES | User: sess_xxx | Heartbeat: 30000ms

💓 HEARTBEAT: sess_xxx | Interval: 30000ms | Time: 03:20:15
```
→ Temiz, renkli, tek satır ✅

---

## 🎯 Test Adımları

1. **Hard refresh yapın:** Ctrl + Shift + R
2. **Console'u temizleyin:** Console'da sağ tık → Clear console
3. **Sayfayı yenileyin:** F5
4. **Logları kontrol edin**

**Eğer hala eski loglar görüyorsanız:**
- Incognito mode deneyin
- Veya DevTools'ta "Disable cache" açıp test edin

---

## 📦 Bundle Versiyonu Kontrolü

Console'da çalıştırın:
```javascript
// Yeni bundle bu değişkeni içerir
console.log(window.ActiveUsersSDK ? 'Yeni Bundle ✅' : 'Eski Bundle ❌');
```

YENİ bundle'da `window.ActiveUsersSDK` tanımlı olmalı.

---

## 🚀 Sonraki Adım

**Hard refresh yapın ve sonuçları bildirin!** 🎯

