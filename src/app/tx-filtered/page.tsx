'use client';
// 실거래 조회에서 '결과 값 보내기'로 보낸 필터링 표를 순서대로 쌓아 보여주고 삭제하는 페이지
import Link from 'next/link';
import { useStore, type FilteredSet } from '@/lib/store';
import { txValue } from '@/lib/normalize';
import { visibleColumns } from '@/lib/txFilter';

export default function TxFilteredPage() {
  const filteredSets = useStore((st) => st.filteredSets);
  const removeFilteredSet = useStore((st) => st.removeFilteredSet);

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">필터링 데이터</h1>
      <p className="mb-4 text-sm text-gray-600">
        <b>실거래가 조회</b>에서 &quot;결과 값 보내기&quot;로 보낸 표가 보낸 순서대로 쌓입니다. 표마다 삭제할 수 있습니다.
      </p>

      {filteredSets.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          보낸 표가 없습니다. <Link href="/transactions" className="font-medium underline">실거래가 조회</Link>에서 &quot;결과 값 보내기&quot;로 표를 보내세요.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSets.map((set) => (
            <SetCard key={set.id} set={set} onRemove={() => removeFilteredSet(set.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 보낸 표 1건 카드 — 제목·조건·필터 요약·표(읽기 전용) */
function SetCard({ set, onRemove }: { set: FilteredSet; onRemove: () => void }) {
  const cols = visibleColumns(set.rows);
  const m = set.meta;
  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{set.label}</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            보낸 시각 {new Date(set.createdAt).toLocaleString('ko-KR')}
            {m && ` · 조회 조건 ${m.region} · ${m.facility}·${m.trade} · ${m.from}~${m.to}`}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            필터·정렬 {set.filterDesc.length ? set.filterDesc.join(' · ') : '없음(전체)'}
          </p>
        </div>
        <button onClick={onRemove}
          className="no-print shrink-0 rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">
          표 삭제
        </button>
      </div>

      {/* 행이 많으면 표 영역 최대 높이 + 내부 스크롤(머릿글 고정) */}
      <div className="max-h-96 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-gray-600">
            <tr>{cols.map((c) => <th key={String(c.key)} className="whitespace-nowrap px-3 py-2 font-medium">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {set.rows.map((r, i) => (
              <tr key={i} className="border-t">
                {cols.map((c) => (
                  <td key={String(c.key)} className="whitespace-nowrap px-3 py-1.5">
                    {c.fmt ? c.fmt(txValue(r, c.key)) : (txValue(r, c.key) as any) ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
