# Git Workflow - Yeni Modül Ekleme

## AKIŞ ŞEMASI

```
[Main Branch] -> [Feature Branch] -> [Test] -> [Merge to Main]
   ✅ Çalışan    ->   🔨 Geliştirme -> ✅ Test  -> ✅ Deploy
```

## ADIM ADIM

### 1. BACKUP - Güvenli Başlangıç
```powershell
# Mevcut çalışan sistemi yedekle
.\backup-working-state.ps1
```

### 2. FEATURE BRANCH - Yeni Modül İçin Branch
```powershell
# Main'den ayrıl
git checkout main
git pull origin main

# Yeni modül için branch aç
git checkout -b feature/yeni-modul-adi
```

### 3. DEVELOPMENT - Kod Yazma
```powershell
# Yeni modülü geliştir
# Örnek: services/universal-tracking/src/modules/yeni_modul/
```

### 4. COMMIT - Yerel Kayıt
```powershell
# Değişiklikleri commit et
git add .
git commit -m "feat: yeni modül eklendi"

# GitHub'a gönder (test için)
git push origin feature/yeni-modul-adi
```

### 5. TEST - Çalışıyor mu Kontrol
```powershell
# Local'de test et
# - Eski sistem çalışıyor mu?
# - Yeni modül çalışıyor mu?
# - Hiçbir şey bozulmadı mı?
```

### 6A. BAŞARILI - Main'e Merge
```powershell
# Test geçti, main'e ekle
git checkout main
git merge feature/yeni-modul-adi

# GitHub'a gönder
git push origin main
```

### 6B. BAŞARISIZ - Geri Dön
```powershell
# Test başarısız, main'e geri dön
.\rollback-to-safe.ps1

# veya
git checkout main
git reset --hard origin/main
```

## ÖRNEKLER

### Örnek 1: Session Tracking Modülü Ekleniyor

```powershell
# 1. Backup
.\backup-working-state.ps1

# 2. Branch
git checkout -b feature/session-tracking

# 3. Geliştir
# - services/universal-tracking/src/modules/session_tracking/

# 4. Commit
git add .
git commit -m "feat: session tracking modülü eklendi"
git push origin feature/session-tracking

# 5. Test
pnpm run dev
# Kontrol et: active users çalışıyor mu?
# Kontrol et: session tracking çalışıyor mu?

# 6A. Başarılı -> Main'e merge
git checkout main
git merge feature/session-tracking
git push origin main

# 6B. Başarısız -> Geri dön
.\rollback-to-safe.ps1
```

### Örnek 2: Hata Durumunda

```powershell
# Bir şeyler yanlış gitti
# Acil durum!

# Seçenek 1: Sadece branch'i iptal et
git checkout main
git branch -D feature/bozuk-modul

# Seçenek 2: Tamamen temizle
.\rollback-to-safe.ps1
```

## KURALLAR

### ✅ YAPILACAKLAR

1. **Main'e dokunmadan önce backup al**
   ```powershell
   .\backup-working-state.ps1
   ```

2. **Her yeni modül için ayrı branch aç**
   ```powershell
   git checkout -b feature/modul-adi
   ```

3. **Test etmeden merge etme**
   - Local'de çalıştır
   - Eski sistemin çalıştığını kontrol et
   - Yeni modülün çalıştığını kontrol et

4. **Başarılı testten sonra main'e ekle**
   ```powershell
   git checkout main
   git merge feature/modul-adi
   ```

### ❌ YAPILMAYACAKLAR

1. **Main'e doğrudan yazma**
   ```powershell
   # ASLA
   git checkout main
   # kod yazmak
   git commit
   ```

2. **Test etmeden merge**
   ```powershell
   # ASLA
   git merge feature/modul
   # test etmeden
   ```

3. **Force push main'e**
   ```powershell
   # ASLA
   git push origin main --force
   ```

## ACIl DURUM KOMUTLARı

### Sistem Bozuldu, Ne Yapmalı?

```powershell
# Tek komut: Her şeyi temizle ve main'e dön
.\rollback-to-safe.ps1

# Karşılık vermesini bekle, "YES" yaz
```

### Stash'ten Geri Al

```powershell
# Kaydedilen snapshot'ları listele
git stash list

# Son snapshot'u geri al
.\restore-working-state.ps1
```

## CHECKLIST

Her yeni modül eklemeden önce:

- [ ] Backup alındı mı? (`.\backup-working-state.ps1`)
- [ ] Branch açıldı mı? (`git checkout -b feature/modul`)
- [ ] Kod yazıldı mı?
- [ ] GitHub'a push edildi mi?
- [ ] Local'de test edildi mi?
- [ ] Eski sistem çalışıyor mu?
- [ ] Yeni modül çalışıyor mu?
- [ ] Merge yapıldı mı? (sadece test başarılıysa)

## BAŞARI KURALLARI

### Main'e Merge Etmeden Önce Kontrol Et:

1. ✅ Active users modülü çalışıyor mu?
2. ✅ Eski websocket bağlantıları çalışıyor mu?
3. ✅ Yeni modül çalışıyor mu?
4. ✅ Hiçbir error yok mu?
5. ✅ Her şey integrate olmuş mu?

**HEPSİ EVET İSE** → Merge et
**BİR TANESİ HAYIR İSE** → Rollback yap

