# Redis Pretty View Helper
# Usage: .\redis-pretty-view.ps1 [pattern]
# Example: .\redis-pretty-view.ps1 "presence:*"

param(
    [string]$Pattern = "*",
    [switch]$Watch
)

function Show-RedisData {
    param([string]$Pattern)
    
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host "🔍 Redis Keys Matching: $Pattern" -ForegroundColor Yellow
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Get all keys matching pattern
    $keys = docker exec universal-tracking-redis redis-cli KEYS $Pattern
    
    if (!$keys) {
        Write-Host "❌ No keys found matching pattern: $Pattern" -ForegroundColor Red
        return
    }
    
    # Split keys by newline if multiple
    $keyList = $keys -split "`n" | Where-Object { $_ -ne "" }
    
    Write-Host "📊 Found $($keyList.Count) key(s)" -ForegroundColor Green
    Write-Host ""
    
    foreach ($key in $keyList) {
        $key = $key.Trim()
        if ($key -eq "") { continue }
        
        Write-Host "───────────────────────────────────────────" -ForegroundColor DarkGray
        Write-Host "🔑 Key: " -NoNewline -ForegroundColor Magenta
        Write-Host $key -ForegroundColor White
        Write-Host ""
        
        # Get key type
        $type = docker exec universal-tracking-redis redis-cli TYPE $key
        Write-Host "   Type: $type" -ForegroundColor DarkYellow
        
        # Get TTL
        $ttl = docker exec universal-tracking-redis redis-cli TTL $key
        if ($ttl -eq "-1") {
            Write-Host "   TTL: No expiration" -ForegroundColor DarkGreen
        } elseif ($ttl -eq "-2") {
            Write-Host "   TTL: Key doesn't exist" -ForegroundColor Red
        } else {
            $ttlSeconds = [int]$ttl
            $ttlMinutes = [math]::Floor($ttlSeconds / 60)
            $ttlRemaining = $ttlSeconds % 60
            Write-Host "   TTL: ${ttlMinutes}m ${ttlRemaining}s ($ttlSeconds seconds)" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "   📄 Value:" -ForegroundColor Cyan
        
        # Get value based on type
        $value = docker exec universal-tracking-redis redis-cli GET $key
        
        if ($value) {
            try {
                # Try to parse as JSON
                $jsonObject = $value | ConvertFrom-Json
                $prettyJson = $jsonObject | ConvertTo-Json -Depth 10
                
                # Add indentation
                $prettyJson -split "`n" | ForEach-Object {
                    Write-Host "   $_" -ForegroundColor White
                }
            }
            catch {
                # Not JSON, print as-is
                Write-Host "   $value" -ForegroundColor White
            }
        }
        else {
            Write-Host "   (empty)" -ForegroundColor DarkGray
        }
        
        Write-Host ""
    }
    
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host "✅ Total: $($keyList.Count) key(s) displayed" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Cyan
}

if ($Watch) {
    Write-Host "👀 Watch mode enabled - Refreshing every 2 seconds..." -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""
    
    while ($true) {
        Clear-Host
        Show-RedisData -Pattern $Pattern
        Start-Sleep -Seconds 2
    }
}
else {
    Show-RedisData -Pattern $Pattern
}


