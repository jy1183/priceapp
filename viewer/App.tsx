// 오프라인 뷰어의 화면 골격 — 좌측 내비 + 상단 뷰어 바 + 해시 경로별 기존 페이지 컴포넌트
import type { ComponentType } from 'react';
import Link from 'next/link';
import SideNav from '@/components/SideNav';
import { useStore } from '@/lib/store';
import type { PackageMeta } from '@/lib/viewerMode';
import { useHashPath, DEFAULT_PATH } from './hashRouter';
import SisePage from '@/app/sise/page';
import TransactionsPage from '@/app/transactions/page';
import SiseAnalysisPage from '@/app/sise-analysis/page';
import TxAnalysisPage from '@/app/tx-analysis/page';
import TxFilteredPage from '@/app/tx-filtered/page';
import SummaryPage from '@/app/summary/page';
import PriceCalcPage from '@/app/price-calc/page';
import RegionPage from '@/app/region/page';
import SettingsPage from '@/app/settings/page';
import ValidationPage from '@/app/validation/page';
import ReferencePage from '@/app/reference/page';

const ROUTES: Record<string, ComponentType> = {
  '/sise': SisePage,
  '/transactions': TransactionsPage,
  '/sise-analysis': SiseAnalysisPage,
  '/tx-analysis': TxAnalysisPage,
  '/tx-filtered': TxFilteredPage,
  '/summary': SummaryPage,
  '/price-calc': PriceCalcPage,
  '/region': RegionPage,
  '/settings': SettingsPage,
  '/validation': ValidationPage,
  '/reference': ReferencePage,
};

const fmtSavedAt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ko-KR');
};

/** 상단 바 — 프로젝트명·저장일시·오프라인 안내·웹에서 편집(저장 시점의 본앱 주소) */
function ViewerBar({ meta }: { meta?: PackageMeta }) {
  const projectName = useStore((s) => s.projectName);
  const editable = !!meta?.appOrigin && /^https?:\/\//.test(meta.appOrigin);
  return (
    <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-amber-50 px-6 py-2 text-sm">
      <span className="font-semibold text-gray-900">{projectName}</span>
      {meta?.savedAt && <span className="text-xs text-gray-600">저장일시 {fmtSavedAt(meta.savedAt)}</span>}
      <span className="text-xs text-amber-800">오프라인 보기 — 조회 기능은 사용할 수 없고, 화면에서 바꾼 값은 저장되지 않습니다.</span>
      {editable && (
        <span className="ml-auto flex items-center gap-2 text-xs text-gray-600">
          <a href={meta!.appOrigin} target="_blank" rel="noopener noreferrer"
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">웹에서 편집</a>
          <span>앱 주소: <span className="select-all font-mono">{meta!.appOrigin}</span></span>
        </span>
      )}
    </div>
  );
}

export default function App({ meta, hasSnapshot }: { meta?: PackageMeta; hasSnapshot: boolean }) {
  const path = useHashPath();
  const Page = ROUTES[path] ?? ROUTES[DEFAULT_PATH];
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="no-print w-56 shrink-0 overflow-y-auto border-r bg-white px-3 py-4">
        <Link href="/" className="mb-5 block rounded-md px-2 py-1 text-lg font-bold text-gray-900 hover:bg-gray-100">
          주변 가격 분석
        </Link>
        <SideNav />
      </aside>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <ViewerBar meta={meta} />
        <main className="flex-1 px-8 py-6">
          {hasSnapshot ? <Page /> : (
            <p className="text-sm text-red-600">저장된 데이터(snapshot.js)를 찾을 수 없습니다. 데이터 폴더가 이 HTML 파일과 같은 위치에 있는지 확인하세요.</p>
          )}
        </main>
      </div>
    </div>
  );
}
