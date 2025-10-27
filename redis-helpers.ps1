# Redis Helper Functions
# Source this file: . .\redis-helpers.ps1

function redis-keys {
    param([string]$pattern = "*")
    docker exec universal-tracking-redis redis-cli KEYS $pattern
}

function redis-get {
    param([string]$key)
    
    Write-Host "`nKey: $key" -ForegroundColor Cyan
    
    $ttl = docker exec universal-tracking-redis redis-cli TTL $key
    if ($ttl -eq "-1") {
        Write-Host "TTL: No expiration" -ForegroundColor Green
    } elseif ($ttl -eq "-2") {
        Write-Host "TTL: Key not found" -ForegroundColor Red
        return
    } else {
        $minutes = [math]::Floor($ttl / 60)
        $seconds = $ttl % 60
        Write-Host "TTL: ${minutes}m ${seconds}s ($ttl seconds)" -ForegroundColor Yellow
    }
    
    Write-Host "`nValue:" -ForegroundColor Magenta
    $value = docker exec universal-tracking-redis redis-cli GET $key
    if ($value) {
        try {
            $value | ConvertFrom-Json | ConvertTo-Json -Depth 10
        } catch {
            Write-Host $value
        }
    } else {
        Write-Host "(empty)" -ForegroundColor Gray
    }
}

function redis-all {
    param([string]$pattern = "*")
    
    $keys = redis-keys $pattern
    if ($keys) {
        $keyArray = $keys -split "`n" | Where-Object { $_ -ne "" }
        Write-Host "`nFound $($keyArray.Count) key(s)" -ForegroundColor Green
        
        foreach ($key in $keyArray) {
            Write-Host "`n========================================" -ForegroundColor Cyan
            redis-get $key.Trim()
        }
        Write-Host "`n========================================" -ForegroundColor Cyan
    } else {
        Write-Host "No keys found matching: $pattern" -ForegroundColor Yellow
    }
}

function redis-presence {
    redis-all "presence:*"
}

function redis-passive {
    redis-all "passive_active:*"
}

function redis-watch {
    param([string]$pattern = "*")
    
    Write-Host "Watch mode - Press Ctrl+C to stop" -ForegroundColor Yellow
    while ($true) {
        Clear-Host
        Write-Host "Watching: $pattern" -ForegroundColor Cyan
        Write-Host "Updated: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
        redis-all $pattern
        Start-Sleep -Seconds 2
    }
}

function redis-clear {
    $confirm = Read-Host "Are you sure you want to clear ALL Redis data? (yes/no)"
    if ($confirm -eq "yes") {
        docker exec universal-tracking-redis redis-cli FLUSHALL
        Write-Host "Redis cleared!" -ForegroundColor Green
    } else {
        Write-Host "Cancelled" -ForegroundColor Yellow
    }
}

function redis-info {
    Write-Host "`nRedis Information:" -ForegroundColor Cyan
    Write-Host "==================`n" -ForegroundColor Cyan
    
    $dbsize = docker exec universal-tracking-redis redis-cli DBSIZE
    Write-Host "Total Keys: $dbsize" -ForegroundColor Green
    
    $presence = (redis-keys "presence:*" | Measure-Object -Line).Lines
    Write-Host "Presence Keys: $presence" -ForegroundColor Yellow
    
    $passive = (redis-keys "passive_active:*" | Measure-Object -Line).Lines
    Write-Host "Passive-Active Keys: $passive" -ForegroundColor Magenta
    
    Write-Host ""
}

Write-Host "Redis Helper Functions Loaded!" -ForegroundColor Green
Write-Host "Commands: redis-keys, redis-get, redis-all, redis-presence, redis-passive, redis-watch, redis-clear, redis-info" -ForegroundColor Yellow


