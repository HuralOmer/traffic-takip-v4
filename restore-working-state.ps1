# ========================================
# ÇALIŞAN KOD SNAPSHOT'UNU GERİ ALMA SCRIPTİ
# ========================================

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Kaydedilmiş Snapshot'lar" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Stash listesini göster
$stashes = git stash list
if ($stashes) {
    git stash list --pretty=format:"%C(yellow)%gd%Creset: %s %C(cyan)(%cr)%Creset"
    
    Write-Host ""
    Write-Host "Hangi snapshot'u geri almak istersiniz?" -ForegroundColor Yellow
    Write-Host "  - Liste başındaki: 'stash@{0}' yazın" -ForegroundColor White
    Write-Host "  - Özel seçim için: stash numarasını yazın" -ForegroundColor White
    Write-Host "  - İptal için: 'exit' yazın" -ForegroundColor White
    Write-Host ""
    
    $selection = Read-Host "Seçiminiz"
    
    if ($selection -eq "exit") {
        Write-Host "İptal edildi." -ForegroundColor Yellow
        exit
    }
    
    if ($selection -match "^stash@\{\d+\}$" -or $selection -match "^\d+$") {
        # Tam index ile eşleşme
        Write-Host ""
        Write-Host "Snapshot geri alınıyor: $selection" -ForegroundColor Yellow
        
        # Stash içeriğini göster
        Write-Host ""
        git stash show -p stash@{$selection}
        
        Write-Host ""
        Write-Host "Bu snapshot'u GERİ ALMAK İSTEDİĞİNİZE EMİN MİSİNİZ?" -ForegroundColor Red
        Write-Host "  - Mevcut değişiklikler kaybolabilir!" -ForegroundColor Red
        $confirm = Read-Host "Devam etmek için 'YES' yazın"
        
        if ($confirm -eq "YES") {
            git reset --hard HEAD
            git stash apply stash@{$selection}
            Write-Host ""
            Write-Host "✅ Snapshot geri alındı!" -ForegroundColor Green
        } else {
            Write-Host "İptal edildi." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Geçersiz seçim." -ForegroundColor Red
    }
} else {
    Write-Host "❌ Kaydedilmiş snapshot yok!" -ForegroundColor Red
}

