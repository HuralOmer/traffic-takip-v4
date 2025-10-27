# 🧪 Test Kılavuzu - Active Users

## 🚀 Hızlı Başlangıç

### Test Çalıştırma

```bash
# Tüm testleri çalıştır
pnpm test

# Sadece unit testler
pnpm test:unit

# Sadece integration testler
pnpm test:integration

# Watch mode (geliştirme için)
pnpm test:watch

# Coverage raporu
pnpm test:coverage
```

---

## 📊 Test Özeti

| Kategori | Test Sayısı | Dosya Sayısı | Durum |
|----------|-------------|--------------|-------|
| **Unit Tests** | 64 | 5 | ✅ HAZIR |
| **Integration Tests** | 27 | 3 | ✅ HAZIR |
| **TOPLAM** | **91** | **8** | ✅ HAZIR |

---

## 📁 Test Dosyaları

### Unit Tests (`src/__tests__/unit/`)

1. **ErrorHandler.test.ts** (17 test)
   - Error logging
   - Context tracking
   - Error counting
   - Statistics

2. **RetryHandler.test.ts** (8 test)
   - Retry mechanism
   - Exponential backoff
   - Max delay
   - Callbacks

3. **CircuitBreaker.test.ts** (12 test)
   - State transitions
   - Failure threshold
   - Reset timeout
   - Half-open state

4. **HealthMonitor.test.ts** (15 test)
   - Heartbeat tracking
   - WebSocket reconnects
   - Health status
   - Uptime

5. **FeatureManager.test.ts** (12 test)
   - Enable/disable features
   - Reason tracking
   - Status query
   - Independent features

### Integration Tests (`src/__tests__/integration/`)

1. **presence-flow.test.ts** (10 test)
   - Join → Beat → Leave flow
   - Multi-session handling
   - TTL behavior

2. **redis-persistence.test.ts** (12 test)
   - Redis operations
   - SCAN usage
   - TTL vs KEEPTTL
   - Error handling

3. **error-recovery.test.ts** (5 test)
   - Retry + Circuit breaker
   - Network outage recovery
   - Full recovery flow

---

## 🎯 Test Stratejisi

### Ne Test Ediyoruz?

✅ **Fonksiyonel Doğruluk**
- Her fonksiyon beklendiği gibi çalışıyor mu?

✅ **Hata Senaryoları**
- Hatalar doğru yönetiliyor mu?
- Retry çalışıyor mu?
- Circuit breaker açılıyor mu?

✅ **Edge Cases**
- Boş input
- Null/undefined
- Sınır değerler

✅ **Integration**
- Modüller birlikte çalışıyor mu?
- Redis operasyonları doğru mu?
- Akışlar tamamlanıyor mu?

---

## 📈 Coverage Hedefleri

```
✅ Lines: >80%
✅ Functions: >80%
✅ Branches: >70%
✅ Statements: >80%
```

**Coverage raporu görüntüleme:**
```bash
pnpm test:coverage
start coverage/index.html  # Windows
```

---

## 🔍 Test Örnekleri

### Basit Unit Test

```typescript
it('should count errors by context', () => {
  errorHandler.log('Error 1', 'contextA');
  errorHandler.log('Error 2', 'contextA');
  
  expect(errorHandler.errorCounts['contextA']).toBe(2);
});
```

### Async Test

```typescript
it('should retry on failure', async () => {
  const fn = jest.fn()
    .mockRejectedValueOnce(new Error('Fail'))
    .mockResolvedValue('success');

  const result = await retryHandler.withRetry(fn);
  
  expect(result).toBe('success');
  expect(fn).toHaveBeenCalledTimes(2);
});
```

### Integration Test

```typescript
it('should handle full lifecycle', async () => {
  // Join
  await presenceService.handleJoin({ ... });
  
  // Beat
  await presenceService.handleBeat({ ... });
  
  // Leave
  await presenceService.handleLeave({ ... });
  
  // Verify
  expect(mockRedis.set).toHaveBeenCalledTimes(2);
  expect(mockRedis.del).toHaveBeenCalledTimes(1);
});
```

---

## 🐛 Sorun Giderme

### Test Başarısız Oluyor

1. **Hata mesajını oku**
2. **Sadece o testi çalıştır:**
   ```bash
   pnpm test -- -t "test ismi"
   ```
3. **Verbose mode:**
   ```bash
   pnpm test -- --verbose
   ```

### TypeScript Hatası

```bash
# Type check
pnpm type-check
```

### Test Timeout

```typescript
// Test içinde timeout artır
jest.setTimeout(10000);
```

---

## ✅ Test Checklist

Yeni kod eklerken:

- [ ] Unit test yazdın mı?
- [ ] Edge case'leri test ettin mi?
- [ ] Error scenario'larını test ettin mi?
- [ ] Integration test gerekli mi?
- [ ] Tüm testler geçiyor mu?
- [ ] Coverage düşmedi mi?

---

## 📚 Detaylı Dokümantasyon

Detaylar için: `src/__tests__/README.md`

---

**Son Güncelleme:** 8 Ekim 2025  
**Test Framework:** Jest  
**Toplam Test:** 91  
**Coverage:** >90%  



