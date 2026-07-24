import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  css: { postcss: { plugins: [] } }, // 앱 tailwind postcss 로드 차단(테스트 격리)
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }, // tsconfig paths(@/*→src/*) 매핑
  test: { globals: true, environment: 'node' },
});
