import { defineConfig } from 'vitest/config';
export default defineConfig({
  css: { postcss: { plugins: [] } }, // 앱 tailwind postcss 로드 차단(테스트 격리)
  test: { globals: true, environment: 'node' },
});
