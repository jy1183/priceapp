import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import ProjectBar from '@/components/ProjectBar';
import StoreHydrator from '@/components/StoreHydrator';
import SideNav from '@/components/SideNav';

export const metadata: Metadata = {
  title: '주변 가격 분석',
  description: '시세·실거래·지역분석 통합 검토 도구',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <StoreHydrator />
        <div className="flex h-screen overflow-hidden">
          <aside className="no-print w-56 shrink-0 overflow-y-auto border-r bg-white px-3 py-4">
            <Link href="/" className="mb-5 block rounded-md px-2 py-1 text-lg font-bold text-gray-900 hover:bg-gray-100">
              주변 가격 분석
            </Link>
            <SideNav />
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
