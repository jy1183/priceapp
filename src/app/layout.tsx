import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import ProjectBar from '@/components/ProjectBar';
import StoreHydrator from '@/components/StoreHydrator';

export const metadata: Metadata = {
  title: '주변 가격 분석',
  description: '시세·실거래·지역분석 통합 검토 도구',
};

const NAV = [
  { href: '/', label: '홈' },
  { href: '/sise', label: '① 시세 입력' },
  { href: '/transactions', label: '② 실거래 조회' },
  { href: '/sise-analysis', label: '③ 시세 분석' },
  { href: '/tx-analysis', label: '④ 실거래 분석' },
  { href: '/summary', label: '⑤ 종합 검토' },
  { href: '/region', label: '⑥ 지역분석' },
  { href: '/settings', label: '⚙ 분석환경설정' },
  { href: '/validation', label: '✓ 검증 리포트' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <StoreHydrator />
        <div className="flex min-h-screen">
          <aside className="no-print w-56 shrink-0 border-r bg-white px-3 py-4">
            <div className="mb-4 px-2 text-lg font-bold">주변 가격 분석</div>
            <nav className="flex flex-col gap-1">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}
                  className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  {n.label}
                </Link>
              ))}
            </nav>
          </aside>
          <div className="flex flex-1 flex-col">
            <ProjectBar />
            <main className="flex-1 px-8 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
