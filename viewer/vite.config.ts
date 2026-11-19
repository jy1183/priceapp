import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * 오프라인 패키지용 뷰어 번들 — file://에서 열려야 하므로 ESM·코드 스플리팅 없는 단일 IIFE + CSS 1개.
 * 산출물(public/viewer/viewer.js·viewer.css)은 저장 시 앱이 fetch해 패키지 폴더에 기록한다.
 */
export default defineConfig({
  root: r('..'),
  base: './',
  publicDir: false, // outDir(public/viewer)이 public 안이므로 public 복사 비활성화
  resolve: {
    alias: {
      '@': r('../src'),
      'next/link': r('./shims/next-link.tsx'),
      'next/navigation': r('./shims/next-navigation.ts'),
      'next/dynamic': r('./shims/next-dynamic.tsx'),
    },
  },
  esbuild: { jsx: 'automatic' },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'public/viewer',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 6000,
    lib: { entry: r('./main.tsx'), name: 'PriceAppViewer', formats: ['iife'], fileName: () => 'viewer.js' },
    rollupOptions: {
      output: { inlineDynamicImports: true, assetFileNames: 'viewer[extname]' },
      // 기존 페이지 파일의 'use client' 지시문은 뷰어 번들에서 무의미 — 경고 소음만 제거
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.code === 'SOURCEMAP_ERROR') return;
        warn(warning);
      },
    },
  },
});
