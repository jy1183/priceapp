import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import ProjectBar from '@/components/ProjectBar';
import StoreHydrator from '@/components/StoreHydrator';

export const metadata: Metadata = {
  title: '주변 가격 분석',
  description: '시세·실거래·지역분석 통합 검토 도구',
};

// 좌측 네비게이션: 성격별 카테고리 그룹 구성
const NAV_GROUPS = [
  {
    title: '입력',
    items: [
      { href: '/sise', label: '시세 입력' },
      { href: '/transactions', label: '실거래가 조회' },
    ],
  },
  {
    title: '가격 분석',
    items: [
      { href: '/sise-analysis', label: '시세 분석' },
      { href: '/tx-analysis', label: '실거래가 분석' },
      { href: '/summary', label: '종합검토 결과' },
    ],
  },
  {
    title: '기타 분석',
    items: [
      { href: '/region', label: '지역 분석' },
    ],
  },
  {
    title: '설정',
    items: [
      { href: '/settings', label: '분석환경설정' },
      { href: '/validation', label: '검증 리포트' },
      { href: '/reference', label: '참고' },
    ],
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <StoreHydrator />
        <div className="flex h-screen overflow-hidden">
          <aside className="no-print w-56 shrink-0 overflow-y-auto border-r bg-white px-3 py-4">
            <Link href="/" className="mb-4 block rounded-md px-2 py-1 text-lg font-bold text-gray-900 hover:bg-gray-100">
              주변 가격 분석
            </Link>
            <nav className="flex flex-col gap-5">
              {NAV_GROUPS.map((group) => (
                <div key={group.title} className="flex flex-col gap-1">
                  <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {group.title}
                  </div>
                  {group.items.map((n) => (
                    <Link key={n.href} href={n.href}
                      className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      {n.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </aside>
          <div className="flex flex-1 flex-col overflow-y-auto">
            <ProjectBar />
            <main className="flex-1 px-8 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
