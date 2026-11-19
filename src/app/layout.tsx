import type { Metadata } from 'next';
import './globals.css';
import StoreHydrator from '@/components/StoreHydrator';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: '주변 가격 분석',
  description: '시세·실거래·지역분석 통합 검토 도구',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <StoreHydrator />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
