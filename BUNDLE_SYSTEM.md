# 📦 Bundle ve Modüler Yapı Kılavuzu

## 🎯 Genel Bakış

Proje modern, performanslı ve modüler bir bundle sistemi kullanıyor:

- **Packages**: `tsup` (esbuild tabanlı, hızlı TypeScript bundler)
- **Services**: `tsup` (Node.js servisleri için optimize edilmiş)
- **Apps/Dashboard**: `Vite` (React için modern bundler)

## 🏗️ Yapı

```
traffic-tracking-system/
├── packages/           # Paylaşılan kütüphaneler
│   ├── types-ts/      # TypeScript tip tanımlamaları
│   │   └── tsup.config.ts
│   └── schemas/       # JSON Schema tanımları
│       └── tsup.config.ts
├── services/          # Backend servisleri
│   └── universal-tracking/
│       └── tsup.config.ts
└── apps/              # Frontend uygulamaları
    └── dashboard/
        └── vite.config.ts
```

## ⚡ Bundle Özellikleri

### 1. **tsup (Packages & Services)**

#### Avantajlar:
- ⚡ **Çok Hızlı**: esbuild tabanlı (10-100x daha hızlı)
- 🌳 **Tree Shaking**: Kullanılmayan kod otomatik kaldırılır
- 📦 **Code Splitting**: Optimal chunk stratejisi
- 🗜️ **Minification**: Production build'lerde kod küçültme
- 📝 **Source Maps**: Debug için kaynak haritaları
- 🔄 **Watch Mode**: Geliştirme için otomatik rebuild
- 📚 **Type Declarations**: Otomatik .d.ts oluşturma
- 🎯 **Multiple Formats**: ESM ve CJS çıktısı

#### Konfigürasyon Özellikleri:

**Packages** (`types-ts`, `schemas`):
```typescript
{
  format: ['esm', 'cjs'],     // Hem ESM hem CJS desteği
  platform: 'neutral',         // Library için platform-agnostic
  dts: true,                   // TypeScript declarations
  sourcemap: true,             // Debug için
  treeshake: true,             // Dead code elimination
  splitting: false             // Library'ler için tek bundle
}
```

**Services** (`universal-tracking`):
```typescript
{
  format: ['esm'],             // Sadece ESM (type: "module")
  platform: 'node',            // Node.js optimize
  target: 'node18',            // Node.js 18 uyumluluğu
  splitting: true,             // Code splitting aktif
  minify: production,          // Production'da minify
  banner: { js: '...' }        // ESM compatibility shim
}
```

### 2. **Vite (Dashboard)**

#### Avantajlar:
- ⚡ **Lightning Fast HMR**: Anlık hot module replacement
- 📦 **Rollup Build**: Production için optimize
- 🎨 **CSS Processing**: PostCSS, Tailwind desteği
- 🔧 **Plugin Ecosystem**: React, TypeScript entegrasyonu
- 📊 **Bundle Analysis**: Built-in analiz araçları

## 🚀 Build Komutları

### Root Seviyede

```bash
# Tüm projeyi build et (sıralı, doğru dependency order'ı ile)
pnpm build

# Sadece packages
pnpm run build:packages

# Sadece services
pnpm run build:services

# Sadece apps
pnpm run build:apps

# Sıralı build (packages → services → apps)
pnpm run build:sequential
```

### Package Seviyesinde

```bash
# types-ts package
cd packages/types-ts
pnpm build              # tsup ile build
pnpm dev                # Watch mode
pnpm run build:tsc      # Fallback: sadece TypeScript compiler

# schemas package
cd packages/schemas
pnpm build              # tsup ile build
pnpm dev                # Watch mode
```

### Service Seviyesinde

```bash
# universal-tracking service
cd services/universal-tracking
pnpm build              # tsup ile build
pnpm dev                # tsx watch mode (development)
pnpm run build:tsc      # Fallback: sadece TypeScript compiler
```

### App Seviyesinde

```bash
# dashboard app
cd apps/dashboard
pnpm build              # Vite build
pnpm dev                # Vite dev server
pnpm preview            # Production preview
```

## 📊 Build Performansı

### Önceki Sistem (tsc)
```
Packages:  ~2-3 saniye
Services:  ~5-8 saniye
Toplam:    ~7-11 saniye
```

### Yeni Sistem (tsup)
```
Packages:  ~1 saniye    (⚡ 2-3x daha hızlı)
Services:  ~0.5 saniye  (⚡ 10-16x daha hızlı)
Toplam:    ~1.5 saniye  (⚡ 5-7x daha hızlı)
```

## 🎯 Bundle Boyutları

### Services (universal-tracking)
```
dist/index.js     140.48 KB  (minified: ~60 KB)
dist/index.d.ts   13.00 B
```

### Packages
```
types-ts:
  - index.mjs:  70 bytes
  - index.js:   82 bytes
  - index.d.ts: 1.37 KB

schemas:
  - index.mjs:  1.81 KB
  - index.js:   1.82 KB
  - index.d.ts: 1.87 KB
```

### Dashboard
```
dist/index.html             0.49 KB
dist/assets/index.css       0.29 KB (gzip: 0.23 KB)
dist/assets/index.js      143.92 KB (gzip: 46.37 KB)
```

## 🐳 Docker Entegrasyonu

Dockerfile'lar yeni bundle sistemi ile uyumlu:

```dockerfile
# tsup.config.ts dosyalarını kopyala
COPY services/universal-tracking/tsup.config.ts ./services/universal-tracking/

# Build (artık tsup kullanıyor)
RUN pnpm run build
```

Build sırası Docker içinde:
1. **Packages** → types-ts, schemas
2. **Services** → universal-tracking
3. **Apps** → dashboard

## 🔧 Geliştirme İpuçları

### 1. Watch Mode
```bash
# Tüm projede watch mode
pnpm dev

# Sadece bir package/service
cd packages/types-ts && pnpm dev
cd services/universal-tracking && pnpm dev
```

### 2. Clean Build
```bash
# Tüm dist klasörlerini temizle
pnpm clean

# Sonra yeniden build
pnpm build
```

### 3. Type Check
```bash
# Sadece tip kontrolü (build etmeden)
pnpm type-check
```

### 4. Bundle Analizi
```bash
# Dashboard için
cd apps/dashboard
pnpm build

# Bundle size analizi
npx vite-bundle-visualizer
```

## 🎨 Özelleştirme

### tsup.config.ts Özelleştirme

```typescript
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  
  // Minification kontrolü
  minify: process.env.NODE_ENV === 'production',
  
  // External dependencies (bundle'a dahil etme)
  external: ['fastify', 'redis'],
  
  // Target değiştir
  target: 'node20',
  
  // Custom banner
  banner: {
    js: '// Custom header',
  },
  
  // Build sonrası hook
  onSuccess: async () => {
    console.log('Build completed!');
  },
});
```

## 📝 Best Practices

### ✅ Yapılması Gerekenler

1. **Packages önce build edilmeli** (services bunlara bağımlı)
2. **Production'da minification kullan**
3. **Source maps her zaman aktif** (debug için)
4. **Type declarations her zaman oluştur**
5. **Tree shaking aktif tut**

### ❌ Yapılmaması Gerekenler

1. **node_modules bundle'a dahil etme** (external kullan)
2. **Gereksiz dependencies import etme** (bundle size artar)
3. **Development'ta minification kullanma** (build yavaşlar)
4. **Watch mode'u production'da kullanma**

## 🔍 Troubleshooting

### Problem: Build hataları

```bash
# Cache temizle
pnpm clean
rm -rf node_modules
pnpm install

# Yeniden build
pnpm build
```

### Problem: Type errors

```bash
# Type check
pnpm type-check

# Sadece TypeScript compiler ile build
pnpm run build:tsc
```

### Problem: Docker build hataları

```bash
# Local build test et
pnpm build

# Docker cache temizle
docker-compose build --no-cache

# Yeniden başlat
docker-compose up -d --build
```

## 📚 Kaynaklar

- [tsup Dokümantasyonu](https://tsup.egoist.dev/)
- [Vite Dokümantasyonu](https://vitejs.dev/)
- [esbuild Dokümantasyonu](https://esbuild.github.io/)
- [pnpm Workspace](https://pnpm.io/workspaces)

## 🎉 Sonuç

Yeni bundle sistemi ile:

- ⚡ **5-7x daha hızlı** build süreleri
- 📦 **Daha küçük** bundle boyutları
- 🌳 **Otomatik** tree shaking
- 🔄 **Hızlı** watch mode
- 📝 **Otomatik** type declarations
- 🎯 **Modern** JavaScript çıktısı

Tüm modüller bağımsız çalışıyor ve birbirini etkilemiyor! ✅


