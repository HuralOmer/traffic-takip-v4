# Active Users Modülü

Gerçek zamanlı aktif kullanıcı takibi için tam özellikli, production-ready modül.

---

## 🎯 Özellikler

✅ **Hibrit Tracking:** WebSocket + Polling + HTTP  
✅ **Leader Tab Sistem:** Çoklu sekmede tek kullanıcı sayımı  
✅ **EMA Smoothing:** Sunucu-kanonik yumuşatılmış metrikler  
✅ **Rate Limiting:** IP + Customer bazlı koruma  
✅ **Graceful Degradation:** WebSocket yoksa otomatik polling  
✅ **Visibility API:** Foreground/Background optimizasyonu  
✅ **Production Ready:** Docker, health checks, monitoring  

---

## 📁 Klasör Yapısı

```
active_users/
├─ client/              # Browser-side kod
│  ├─ index.ts          # Ana client sınıfı
│  ├─ config.ts         # Client konfigürasyonu
│  ├─ lifecycle/        # Yaşam döngüsü yönetimi
│  │  ├─ leader-tab.ts  # Leader sekme seçimi
│  │  ├─ visibility.ts  # Foreground/background
│  │  ├─ unload.ts      # Sayfa kapanış
│  │  └─ heartbeat.ts   # Heartbeat tracker
│  ├─ transport/        # İletişim katmanları
│  │  ├─ websocket.ts   # WebSocket client
│  │  ├─ polling.ts     # Polling fallback
│  │  └─ http.ts        # HTTP istekleri
│  ├─ metrics/          # Metrik hesaplama
│  │  ├─ ema.ts         # EMA calculator
│  │  └─ sampler.ts     # UI render throttle
│  ├─ state/            # State yönetimi
│  │  ├─ session.ts     # Session/tab ID
│  │  └─ store.ts       # Client state store
│  ├─ connection/       # Bağlantı yönetimi
│  │  └─ HybridConnectionManager.ts
│  └─ utils/            # Yardımcı fonksiyonlar
│
├─ server/              # Server-side kod
│  ├─ index.ts          # Ana server sınıfı
│  ├─ config.ts         # Server konfigürasyonu
│  ├─ adapters/         # Harici servis adaptörleri
│  │  └─ redis.ts       # Redis adapter
│  ├─ services/         # İş mantığı
│  │  ├─ presence.service.ts   # Join/beat/leave
│  │  ├─ ema.service.ts        # EMA hesaplama
│  │  └─ broadcast.service.ts  # Metrics broadcast
│  ├─ transports/       # API katmanları
│  │  ├─ rest.ts        # REST endpoints
│  │  └─ websocket.ts   # WebSocket server
│  └─ utils/            # Yardımcı fonksiyonlar
│     ├─ rate-limit.ts  # Rate limiter
│     ├─ time.ts        # Time utilities
│     └─ RATE_LIMIT_GUIDE.md
│
└─ types/               # TypeScript tipler
   ├─ index.ts
   ├─ ActiveUser.ts
   ├─ Config.ts
   └─ Messages.ts
```

---

## 🚀 Hızlı Başlangıç

### Server-Side (Node.js)

```typescript
import { ActiveUsersServer } from './modules/active_users/server';
import { redisClient } from './redis';

// Initialize server
const activeUsers = new ActiveUsersServer(redisClient, {
  presenceTTL: 180,             // 180 saniye (3 dakika)
  emaAlpha: 0.2,                // EMA smoothing
  emaUpdateInterval: 30000,     // 30 saniye
  maxRequestsPerMinute: 5000,   // Rate limit
});

// Register REST endpoints
activeUsers.registerRESTEndpoints(fastify);

// Register WebSocket server
import { Server } from 'ws';
const wss = new Server({ port: 3003 });
activeUsers.registerWebSocketServer(wss);

// Start EMA calculation
activeUsers.startEMACalculation('customer-id');
```

### Client-Side (Browser)

```typescript
import { ActiveUsersClient } from './modules/active_users/client';

// Initialize client
const activeUsers = new ActiveUsersClient({
  customerId: 'shop123',
  apiUrl: 'http://localhost:3001',
  websocketUrl: 'ws://localhost:3003/ws/active-users',
  debug: true,
});

// Start tracking
await activeUsers.init();

// Subscribe to metrics updates
activeUsers.onMetrics((metrics) => {
  console.log('Active users:', metrics.count);
  console.log('EMA:', metrics.ema);
  
  // Update UI
  document.getElementById('active-count').textContent = metrics.count;
});

// Get current metrics
const metrics = activeUsers.getMetrics();

// Check connection status
const status = activeUsers.getConnectionStatus();
console.log('Connection mode:', status.mode); // 'websocket' | 'polling'
console.log('Is leader:', status.isLeader);
```

---

## 🔌 API Endpoints

### REST API

#### `POST /presence/join`
Yeni kullanıcı katıldı.

**Request:**
```json
{
  "customerId": "shop123",
  "sessionId": "sess-abc",
  "tabId": "tab-xyz",
  "timestamp": 1234567890,
  "platform": "desktop",
  "userAgent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "success": true
}
```

#### `POST /presence/beat`
Heartbeat sinyali.

**Request:**
```json
{
  "customerId": "shop123",
  "sessionId": "sess-abc",
  "tabId": "tab-xyz",
  "timestamp": 1234567890
}
```

#### `POST /presence/leave`
Kullanıcı ayrıldı.

**Request:**
```json
{
  "customerId": "shop123",
  "sessionId": "sess-abc",
  "tabId": "tab-xyz",
  "timestamp": 1234567890
}
```

#### `GET /metrics?customerId=shop123`
Aktif kullanıcı metrikleri.

**Response:**
```json
{
  "timestamp": 1234567890,
  "count": 42,
  "ema": 38.5,
  "customerId": "shop123"
}
```

### WebSocket API

#### Client → Server

**Auth:**
```json
{
  "type": "auth",
  "customerId": "shop123",
  "sessionId": "sess-abc",
  "tabId": "tab-xyz"
}
```

**Ping:**
```json
{
  "type": "ping",
  "timestamp": 1234567890
}
```

#### Server → Client

**Hello:**
```json
{
  "type": "hello",
  "timestamp": 1234567890,
  "sessionId": "sess-abc"
}
```

**Metrics Update:**
```json
{
  "type": "metrics:update",
  "data": {
    "customerId": "shop123",
    "timestamp": 1234567890,
    "count": 42,
    "ema": 38.5
  }
}
```

**Pong:**
```json
{
  "type": "pong",
  "timestamp": 1234567890
}
```

---

## ⚙️ Konfigürasyon

### Client Config

```typescript
interface ClientConfig {
  customerId: string;                      // Müşteri ID
  apiUrl: string;                          // API base URL
  websocketUrl?: string;                   // WebSocket URL (opsiyonel)
  debug?: boolean;                         // Debug mode
  
  // Heartbeat
  foregroundHeartbeatInterval?: number;    // 30000ms (default)
  backgroundHeartbeatInterval?: number;    // 60000ms (default)
  heartbeatTimeout?: number;               // 180000ms (default)
  
  // EMA (client-side smoothing)
  emaAlpha?: number;                       // 0.2 (default)
  emaWindowSize?: number;                  // 20 (default)
  
  // Connection
  pollingInterval?: number;                // 30000ms (default)
  enableWebSocket?: boolean;               // true (default)
  enablePolling?: boolean;                 // true (default)
}
```

### Server Config

```typescript
interface ServerConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  
  presenceTTL?: number;                    // 180s (default)
  emaAlpha?: number;                       // 0.2 (default)
  emaUpdateInterval?: number;              // 30000ms (default)
  websocketPort?: number;                  // 8080 (default)
  enableWebSocket?: boolean;               // true (default)
  maxRequestsPerMinute?: number;           // 1000 (default)
}
```

---

## 📊 Redis Veri Modeli

### Keys

```
presence:{customerId}:{sessionId}  → JSON (TTL: 180s)
ema:{customerId}                   → Float
metrics:{customerId}               → Pub/Sub channel
```

### Presence Data

```json
{
  "customerId": "shop123",
  "sessionId": "sess-abc",
  "tabId": "tab-xyz",
  "timestamp": 1234567890,
  "isLeader": true,
  "platform": "desktop",
  "userAgent": "Mozilla/5.0...",
  "updatedAt": 1234567890
}
```

---

## 🎯 Nasıl Çalışır?

### 1. İlk Bağlantı

```
Browser                Server              Redis
   │                      │                   │
   │──── POST /join ─────>│                   │
   │                      │─── SETEX ────────>│
   │                      │<──── OK ──────────│
   │<──── 200 OK ─────────│                   │
   │                      │                   │
   │──── WS auth ────────>│                   │
   │<──── hello ──────────│                   │
```

### 2. Leader Tab Seçimi

```
Tab 1 (Leader)    Tab 2 (Follower)    BroadcastChannel
    │                    │                     │
    │──── claim leader ──┼────────────────────>│
    │                    │<─── follower msg ───│
    │                    │                     │
    │ ✅ Heartbeat       │ ❌ No heartbeat     │
```

### 3. Heartbeat Cycle

```
Tab (Leader)           Server              Redis
    │                     │                   │
    │── POST /beat ───────>│                  │
    │                      │─ SET KEEPTTL ───>│
    │<─── 200 OK ──────────│                  │
    │                      │                  │
   30s                     │                  │
    │                      │                  │
    │── POST /beat ───────>│                  │
    │                      │─ SET KEEPTTL ───>│
    │<─── 200 OK ──────────│                  │
```

### 4. EMA Calculation

```
Server Timer         Redis                Broadcast
    │                  │                      │
   5s interval         │                      │
    │─── GET keys ────>│                      │
    │<─── count=42 ────│                      │
    │                  │                      │
    │ EMA = 0.2×42 + 0.8×40 = 40.4           │
    │                  │                      │
    │─ SET ema:shop ──>│                      │
    │─── PUBLISH ──────┼─────────────────────>│
    │                  │                  All WS clients
```

---

## 🔐 Rate Limiting

### Limitler

- **IP:** 100 istek/dakika
- **Customer:** 5,000 istek/dakika

### Response Headers

```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4999
X-RateLimit-Reset: 2024-01-15T10:35:00Z
```

### Limit Aşımı

```
HTTP/1.1 429 Too Many Requests
Retry-After: 45

{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded (customer). Try again in 45 seconds.",
  "blockedBy": "customer"
}
```

Detaylar: `server/utils/RATE_LIMIT_GUIDE.md`

---

## 🧪 Test

### Manual Test

```bash
# Join
curl -X POST http://localhost:3001/presence/join \
  -H "Content-Type: application/json" \
  -d '{"customerId":"shop123","sessionId":"s1","tabId":"t1","timestamp":1234567890}'

# Beat
curl -X POST http://localhost:3001/presence/beat \
  -H "Content-Type: application/json" \
  -d '{"customerId":"shop123","sessionId":"s1","tabId":"t1","timestamp":1234567890}'

# Metrics
curl "http://localhost:3001/metrics?customerId=shop123"

# Leave
curl -X POST http://localhost:3001/presence/leave \
  -H "Content-Type: application/json" \
  -d '{"customerId":"shop123","sessionId":"s1","tabId":"t1","timestamp":1234567890}'
```

### WebSocket Test

```javascript
const ws = new WebSocket('ws://localhost:3003/ws/active-users');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    customerId: 'shop123',
    sessionId: 's1',
    tabId: 't1'
  }));
};

ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

## 📈 Monitoring

### Metrics

- Aktif kullanıcı sayısı (raw)
- EMA yumuşatılmış sayı
- Bağlantı modu (WebSocket/Polling)
- Leader tab durumu
- Rate limit istatistikleri

### Health Check

```bash
curl http://localhost:3001/health
```

---

## 🚀 Production Checklist

- [x] Rate limiting aktif
- [x] Graceful shutdown
- [x] Health checks
- [x] Redis connection pooling
- [x] Error handling
- [x] Logging
- [x] Docker support
- [ ] Monitoring/Alerting (opsiyonel)
- [ ] Load testing
- [ ] Documentation

---

## 📚 Daha Fazla Bilgi

- [Docker Deployment Kılavuzu](../../../DOCKER_DEPLOYMENT.md)
- [Rate Limiting Kılavuzu](./server/utils/RATE_LIMIT_GUIDE.md)
- [Şartname Belgesi](../../../../../proje yapi dosyaları/)

---

Modül tam production-ready! 🎉

