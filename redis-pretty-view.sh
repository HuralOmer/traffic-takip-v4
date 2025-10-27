#!/bin/bash

# Redis Pretty View Helper
# Usage: ./redis-pretty-view.sh [pattern]
# Example: ./redis-pretty-view.sh "presence:*"

PATTERN="${1:-*}"
WATCH_MODE=false

# Check for --watch flag
if [[ "$2" == "--watch" ]] || [[ "$1" == "--watch" ]]; then
    WATCH_MODE=true
    if [[ "$1" == "--watch" ]]; then
        PATTERN="*"
    fi
fi

show_redis_data() {
    local pattern=$1
    
    echo -e "\033[36m===========================================\033[0m"
    echo -e "\033[33m🔍 Redis Keys Matching: $pattern\033[0m"
    echo -e "\033[36m===========================================\033[0m"
    echo ""
    
    # Get all keys matching pattern
    keys=$(docker exec universal-tracking-redis redis-cli KEYS "$pattern")
    
    if [ -z "$keys" ]; then
        echo -e "\033[31m❌ No keys found matching pattern: $pattern\033[0m"
        return
    fi
    
    # Count keys
    key_count=$(echo "$keys" | wc -l)
    echo -e "\033[32m📊 Found $key_count key(s)\033[0m"
    echo ""
    
    # Process each key
    while IFS= read -r key; do
        [ -z "$key" ] && continue
        
        echo -e "\033[90m───────────────────────────────────────────\033[0m"
        echo -e "\033[35m🔑 Key: \033[37m$key\033[0m"
        echo ""
        
        # Get key type
        type=$(docker exec universal-tracking-redis redis-cli TYPE "$key")
        echo -e "   Type: \033[33m$type\033[0m"
        
        # Get TTL
        ttl=$(docker exec universal-tracking-redis redis-cli TTL "$key")
        if [ "$ttl" == "-1" ]; then
            echo -e "   TTL: \033[32mNo expiration\033[0m"
        elif [ "$ttl" == "-2" ]; then
            echo -e "   TTL: \033[31mKey doesn't exist\033[0m"
        else
            ttl_minutes=$((ttl / 60))
            ttl_remaining=$((ttl % 60))
            echo -e "   TTL: \033[33m${ttl_minutes}m ${ttl_remaining}s ($ttl seconds)\033[0m"
        fi
        
        echo ""
        echo -e "   \033[36m📄 Value:\033[0m"
        
        # Get value
        value=$(docker exec universal-tracking-redis redis-cli GET "$key")
        
        if [ -n "$value" ]; then
            # Check if jq is available for JSON pretty-printing
            if command -v jq &> /dev/null; then
                echo "$value" | jq '.' 2>/dev/null | sed 's/^/   /' || echo "   $value"
            else
                # Fallback to Python if available
                if command -v python3 &> /dev/null; then
                    echo "$value" | python3 -m json.tool 2>/dev/null | sed 's/^/   /' || echo "   $value"
                else
                    echo "   $value"
                fi
            fi
        else
            echo -e "   \033[90m(empty)\033[0m"
        fi
        
        echo ""
    done <<< "$keys"
    
    echo -e "\033[36m===========================================\033[0m"
    echo -e "\033[32m✅ Total: $key_count key(s) displayed\033[0m"
    echo -e "\033[36m===========================================\033[0m"
}

if [ "$WATCH_MODE" = true ]; then
    echo -e "\033[33m👀 Watch mode enabled - Refreshing every 2 seconds...\033[0m"
    echo -e "\033[33mPress Ctrl+C to stop\033[0m"
    echo ""
    
    while true; do
        clear
        show_redis_data "$PATTERN"
        sleep 2
    done
else
    show_redis_data "$PATTERN"
fi


