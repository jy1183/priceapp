'use client';
// 사이드바·프로젝트 바를 감싸는 앱 셸(로그인 화면에서는 단독 화면으로 표시)

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ProjectBar from '@/components/ProjectBar';
import SideNav from '@/components/SideNav';

async function logout() {
  await fetch('/api/auth', { method: 'DELETE' });
  window.location.href = '/login';
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  if (usePathname() === '/login') return <>{children}</>;
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="no-print flex w-56 shrink-0 flex-col overflow-y-auto border-r bg-white px-3 py-4">
        <Link href="/" className="mb-5 block rounded-md px-2 py-1 text-lg font-bold text-gray-900 hover:bg-gray-100">
          주변 가격 분석
        </Link>
        <SideNav />
        <button
          type="button"
          onClick={logout}
          className="mt-auto rounded-md px-2 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
        >
          로그아웃
        </button>
      </aside>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <ProjectBar />
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
