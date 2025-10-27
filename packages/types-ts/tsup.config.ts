import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points - tüm export edilen tipler
  entry: ['src/index.ts'],
  
  // Output formats - library için hem ESM hem CJS
  format: ['esm', 'cjs'],
  
  // Output directory
  outDir: 'dist',
  
  // TypeScript declarations
  dts: true,
  
  // Sourcemaps
  sourcemap: true,
  
  // Clean dist before build
  clean: true,
  
  // Types-only package, no minification needed
  minify: false,
  
  // Tree shaking
  treeshake: true,
  
  // Target for maximum compatibility
  target: 'es2020',
  
  // This is a library, not a Node.js app
  platform: 'neutral',
  
  // External dependencies (peerDependencies should be external)
  external: [],
  
  // Library bundle
  splitting: false,
  
  onSuccess: async () => {
    console.log('✅ Types package built successfully!');
  },
});


