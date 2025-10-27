#!/usr/bin/env node

/**
 * Redis Active Users Checker
 * Checks Redis for active user presence data
 */

const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  db: 0
});

async function checkActiveUsers() {
  console.log('🔍 Checking Redis for Active Users data...\n');

  try {
    // Get all presence keys
    const presenceKeys = await redis.keys('presence:*');
    console.log(`📊 Found ${presenceKeys.length} active presence entries\n`);

    if (presenceKeys.length > 0) {
      console.log('👥 Active Users:');
      console.log('─'.repeat(80));
      
      for (const key of presenceKeys) {
        const data = await redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          const [, customerId, sessionId] = key.split(':');
          
          console.log(`\n🔑 Key: ${key}`);
          console.log(`┌─ Session Info`);
          console.log(`│  customerId: ${parsed.customerId || customerId}`);
          console.log(`│  sessionId: ${parsed.sessionId || sessionId}`);
          console.log(`│  session_mode: ${parsed.session_mode || 'N/A'}`);
          console.log(`│  tabId: ${parsed.tabId || 'N/A'}`);
          console.log(`│  isLeader: ${parsed.isLeader ? '👑 YES' : 'no'}`);
          console.log(`│`);
          console.log(`├─ Device Info`);
          console.log(`│  platform: ${parsed.platform || 'N/A'}`);
          console.log(`│  device: ${parsed.device || 'N/A'}`);
          console.log(`│  browser: ${parsed.browser || 'N/A'}`);
          console.log(`│  desktop_mode: ${parsed.desktop_mode ? '🚨 TRUE' : 'false'}`);
          console.log(`│`);
          console.log(`├─ Tab Tracking`);
          console.log(`│  total_tab_quantity: ${parsed.total_tab_quantity || 'N/A'}`);
          console.log(`│  total_backgroundTab_quantity: ${parsed.total_backgroundTab_quantity || 'N/A'}`);
          console.log(`│`);
          console.log(`└─ Timestamps`);
          console.log(`   createdAt: ${parsed.createdAt || 'N/A'}`);
          console.log(`   updatedAt: ${parsed.updatedAt || 'N/A'}`);
          console.log(`   lastActivity: ${parsed.lastActivity || 'N/A'}`);
          console.log(`   TTL: ${await redis.ttl(key)} seconds`);
        }
      }
      
      console.log('\n' + '─'.repeat(80));
    }

    // Get EMA data
    const emaKeys = await redis.keys('ema:*');
    if (emaKeys.length > 0) {
      console.log('\n📈 EMA Values:');
      console.log('─'.repeat(80));
      
      for (const key of emaKeys) {
        const value = await redis.get(key);
        const customerId = key.split(':')[1];
        console.log(`   ${customerId}: ${parseFloat(value).toFixed(2)}`);
      }
      
      console.log('─'.repeat(80));
    }

    // Summary by customer
    console.log('\n📊 Summary by Customer:');
    console.log('─'.repeat(80));
    
    const customers = {};
    for (const key of presenceKeys) {
      const [, customerId] = key.split(':');
      customers[customerId] = (customers[customerId] || 0) + 1;
    }
    
    for (const [customerId, count] of Object.entries(customers)) {
      const ema = await redis.get(`ema:${customerId}`);
      console.log(`   ${customerId}: ${count} active users (EMA: ${ema ? parseFloat(ema).toFixed(2) : 'N/A'})`);
    }
    
    console.log('─'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await redis.quit();
  }
}

// Run check once (no auto-refresh to avoid connection issues)
console.log('🚀 Starting Active Users Monitor...');
console.log('Press Ctrl+C to exit\n');

checkActiveUsers();

