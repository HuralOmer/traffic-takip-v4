# ========================================
# ÇALIŞAN KOD SNAPSHOT'U ALMA SCRIPTİ
# ========================================
# Bu script, çalışan kodunuzun tam bir snapshot'ını alır
# Böylece bozduğunuzda kolayca geri dönebilirsiniz

param(
    [string]$Description = "backup-$(Get-Date -Format 'yyyy-MM-dd-HHmm')"
)

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Çalışan Kod Snapshot Alınıyor" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# 1. Git durumunu kontrol et
Write-Host "[1/4] Git durumu kontrol ediliyor..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "   ⚠️  Uncommitted değişiklikler var!" -ForegroundColor Red
    Write-Host "   📝 Değişiklikler:" -ForegroundColor Yellow
    git status --short
} else {
    Write-Host "   ✅ Working tree temiz" -ForegroundColor Green
}

# 2. Stash olarak kaydet
Write-Host ""
Write-Host "[2/4] Stash olarak kaydediliyor..." -ForegroundColor Yellow
git stash push -m "$Description"
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Kayıt tamamlandı" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Stash oluşturulamadı (zaten boş olabilir)" -ForegroundColor Yellow
}

# 3. Stash listesini göster
Write-Host ""
Write-Host "[3/4] Kaydedilmiş snapshot'lar:" -ForegroundColor Yellow
git stash list --date=local --pretty=format:"%gd: %s (%cr)" | Select-Object -First 5

# 4. Mevcut branch ve commit'i göster
Write-Host ""
Write-Host "[4/4] Şu anki konum:" -ForegroundColor Yellow
git log --oneline -1
Write-Host ""
Write-Host "Branch: $(git branch --show-current)" -ForegroundColor Cyan
Write-Host ""

Write-Host "===================================" -ForegroundColor Green
Write-Host "✅ Backup Tamamlandı!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
Write-Host "GERİ ALMAK İÇİN:" -ForegroundColor Yellow
Write-Host "  git stash list" -ForegroundColor White
Write-Host "  git stash apply stash@{0}" -ForegroundColor White
Write-Host ""

