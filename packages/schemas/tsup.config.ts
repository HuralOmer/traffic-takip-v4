import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points
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
  
  // Minification for smaller bundle size
  minify: false,
  
  // Tree shaking
  treeshake: true,
  
  // Target
  target: 'es2020',
  
  // Platform
  platform: 'neutral',
  
  // External dependencies
  external: [],
  
  // Library bundle - no splitting
  splitting: false,
  
  onSuccess: async () => {
    console.log('✅ Schemas package built successfully!');
  },
});


