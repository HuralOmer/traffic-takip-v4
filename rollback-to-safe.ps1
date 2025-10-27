# ========================================
# GÜVENLİ DURUMA GERİ DÖNME SCRIPTİ
# ========================================
# Bu script, main branch'e güvenle geri döner

param(
    [switch]$Force = $false
)

Write-Host "===================================" -ForegroundColor Red
Write-Host "⚠️  GÜVENLİ DURUMA GERİ DÖNÜLÜYOR" -ForegroundColor Red
Write-Host "===================================" -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    Write-Host "Bu işlem:" -ForegroundColor Yellow
    Write-Host "  1. Tüm mevcut değişiklikleri SİLECEK" -ForegroundColor Red
    Write-Host "  2. Main branch'e geri dönecek" -ForegroundColor Yellow
    Write-Host "  3. Remote'tan son hâli alacak" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "DEVAM ETMEK İSTEDİĞİNİZE EMİN MİSİNİZ?" -ForegroundColor Red
    $confirm = Read-Host "Devam etmek için 'YES' yazın"
    
    if ($confirm -ne "YES") {
        Write-Host "İptal edildi." -ForegroundColor Yellow
        exit
    }
}

# 1. Mevcut branch'i göster
Write-Host ""
Write-Host "[1/4] Mevcut durum:" -ForegroundColor Yellow
$currentBranch = git branch --show-current
Write-Host "   Branch: $currentBranch" -ForegroundColor Cyan
git log --oneline -5

# 2. Tüm değişiklikleri temizle
Write-Host ""
Write-Host "[2/4] Değişiklikler temizleniyor..." -ForegroundColor Yellow
git reset --hard HEAD
git clean -fd

# 3. Main branch'e dön
Write-Host ""
Write-Host "[3/4] Main branch'e geçiliyor..." -ForegroundColor Yellow
git checkout main

# 4. Remote'tan son hâli al
Write-Host ""
Write-Host "[4/4] Remote'tan güncelleniyor..." -ForegroundColor Yellow
git fetch origin
git reset --hard origin/main

Write-Host ""
Write-Host "===================================" -ForegroundColor Green
Write-Host "✅ Güvenli duruma geri dönüldü!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
Write-Host "Branch: $(git branch --show-current)" -ForegroundColor Cyan
Write-Host "Commit: $(git log --oneline -1)" -ForegroundColor Cyan
Write-Host ""

