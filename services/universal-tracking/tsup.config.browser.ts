import { defineConfig } from 'tsup';

/**
 * Browser Bundle Configuration
 * Bundles ActiveUsers + PassiveActive client for browser use
 */
export default defineConfig({
  // Entry point - ActiveUsers client (PassiveActive dahil)
  entry: {
    'active-users-sdk': 'src/modules/active_users/client/index.ts',
  },
  
  // IIFE format for browser (self-contained, no module system needed)
  format: 'iife',
  
  // Global name for window object
  globalName: 'ActiveUsersSDK',
  
  // Output directory
  outDir: 'dist-browser',
  
  // Platform: browser
  platform: 'browser',
  
  // Target modern browsers
  target: 'es2020',
  
  // Bundle everything together (single file)
  bundle: true,
  splitting: false,
  
  // Minify for production
  minify: process.env.NODE_ENV === 'production',
  
  // Source maps for debugging
  sourcemap: true,
  
  // Tree shaking
  treeshake: true,
  
  // Clean output directory before build
  clean: true,
  
  // Generate TypeScript declarations (not really needed for IIFE but good to have)
  dts: false,
  
  // External dependencies (none - everything bundled)
  external: [],
  
  // No Node.js shims (pure browser code)
  shims: false,
  
  // Banner
  banner: {
    js: `/**
 * Active Users SDK - Hybrid WebSocket + Polling
 * Version: 1.0.0
 * 
 * Features:
 * - Focus-based tab leadership
 * - Hybrid connection (WebSocket + Polling fallback)
 * - Passive-Active state tracking
 * - Video & ChatBot detection
 * - localStorage session management (cross-tab)
 * 
 * Usage:
 *   const client = new ActiveUsersSDK.ActiveUsersClient({
 *     customerId: 'your-customer-id',
 *     apiUrl: 'https://api.example.com',
 *     debug: true
 *   });
 *   client.init();
 */
`,
  },
  
  // Define globals for browser environment
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  
  // onSuccess hook
  onSuccess: async () => {
    console.log('✅ Browser bundle built successfully!');
    console.log('   Output: dist-browser/active-users-sdk.js');
  },
});

