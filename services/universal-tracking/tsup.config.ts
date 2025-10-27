import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry point
  entry: ['src/index.ts'],
  
  // Output format
  format: ['esm'], // ESM format (type: "module" kullanıyoruz)
  
  // Output directory
  outDir: 'dist',
  
  // Generate TypeScript declarations
  dts: true,
  
  // Sourcemaps for debugging
  sourcemap: true,
  
  // Clean output directory before build
  clean: true,
  
  // Minify for production
  minify: process.env.NODE_ENV === 'production',
  
  // Tree shaking
  treeshake: true,
  
  // Split chunks for better caching
  splitting: true,
  
  // Target environment
  target: 'node18',
  platform: 'node',
  
  // Keep dynamic imports
  shims: false,
  
  // Bundle all dependencies (external sadece peer dependencies)
  external: [
    // Node.js built-ins otomatik external
  ],
  
  // Skip node_modules bundling (optional - performans için)
  noExternal: [],
  
  // Preserve modules structure
  // splitting: true ile birlikte kullanılıyor
  
  // Banner for ESM compatibility
  banner: {
    js: `// Universal Tracking Service - Bundled with tsup
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`,
  },
  
  // Environment variables injection
  env: {
    NODE_ENV: process.env.NODE_ENV || 'production',
  },
  
  // onSuccess hook
  onSuccess: async () => {
    console.log('✅ Build completed successfully!');
  },
});


