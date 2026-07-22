'use client';
// 좌측 카테고리 네비게이션: 그룹 구분·들여쓰기·현재 페이지 선택 표시(배경색+좌측 상태바)

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

export default function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <div className="mb-1 px-2 text-[13px] font-bold text-gray-900">
            {group.title}
          </div>
          {group.items.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`ml-3 flex items-center gap-2 rounded-md py-2 pl-2 pr-3 text-sm ${
                  active
                    ? 'bg-indigo-50 font-medium text-indigo-700 ring-1 ring-indigo-100'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span
                  className={`h-4 w-1 shrink-0 rounded-full ${
                    active ? 'bg-indigo-600' : 'bg-transparent'
                  }`}
                />
                {n.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
