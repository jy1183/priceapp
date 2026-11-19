'use client';
// 실거래 조회에서 '결과 값 보내기'로 보낸 필터링 표를 순서대로 쌓아 보여주고 삭제하는 페이지
import { useState } from 'react';
import Link from 'next/link';
import { useStore, type FilteredSet, type TxChartSpec } from '@/lib/store';
import { txValue } from '@/lib/normalize';
import { visibleColumns } from '@/lib/txFilter';
import BarChart from '@/components/BarChart';
import { DEAL_LABELS, type DealType } from '@/lib/txAnalysis';
import { buildTxChart, dealsIn, TX_CHART_KINDS } from '@/lib/txChartSpecs';

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

/** 보낸 표 1건 카드 — 제목·조건·필터 요약·표(읽기 전용)·차트 */
function SetCard({ set, onRemove }: { set: FilteredSet; onRemove: () => void }) {
  const config = useStore((st) => st.config);
  const addChart = useStore((st) => st.addChart);
  const removeChart = useStore((st) => st.removeChart);
  const thisYear = new Date().getFullYear();
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

      {/* 차트 목록(추가 순서) — 같은 블록·거래방식도 여러 개 추가할 수 있다 */}
      {set.charts.length > 0 && (
        <div className="mt-3 space-y-3">
          {set.charts.map((spec) => {
            const chart = buildTxChart(spec.kind, set.rows, spec.deal, config, thisYear);
            return (
              <div key={spec.id}>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{chartName(spec)}</span>
                  <button onClick={() => removeChart(set.id, spec.id)}
                    className="no-print rounded border border-gray-300 px-2 py-0.5 text-gray-600 hover:bg-gray-50">차트 삭제</button>
                </div>
                {chart ? <BarChart {...chart} /> : (
                  <div className="mt-2 rounded-lg border bg-white px-3 py-3 text-sm text-gray-400">해당 조건의 데이터가 없습니다.</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ChartAdder rows={set.rows} onAdd={(kind, deal) => addChart(set.id, { kind, deal })} />
    </section>
  );
}

/** 차트 캡션 — 블록 이름과 거래방식 */
function chartName(spec: TxChartSpec): string {
  const kind = TX_CHART_KINDS.find((k) => k.kind === spec.kind)?.label ?? spec.kind;
  return `${kind} — ${DEAL_LABELS[spec.deal]}`;
}

/** [+ 차트 추가] — 블록 목록에서 고르면 즉시 추가. 표에 거래방식이 2종 이상일 때만 거래방식 선택을 보여주고, 1종이면 자동 적용 */
function ChartAdder({ rows, onAdd }: { rows: FilteredSet['rows']; onAdd: (kind: TxChartSpec['kind'], deal: DealType) => void }) {
  const deals = dealsIn(rows);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<DealType | null>(null);
  const deal = picked && deals.includes(picked) ? picked : deals[0];

  return (
    <div className="no-print relative mt-3 flex flex-wrap items-center gap-2">
      <button onClick={() => setOpen((o) => !o)} disabled={!deal}
        className="rounded-md border border-blue-300 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50">
        + 차트 추가
      </button>
      {deals.length > 1 && (
        <label className="flex items-center gap-1 text-xs text-gray-500">
          거래방식
          <select value={deal} onChange={(e) => setPicked(e.target.value as DealType)} className="rounded border px-1 py-0.5">
            {deals.map((d) => <option key={d} value={d}>{DEAL_LABELS[d]}</option>)}
          </select>
        </label>
      )}
      {open && deal && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute left-0 top-full z-20 mt-1 w-80 rounded-md border bg-white py-1 shadow-lg">
            {TX_CHART_KINDS.map((k) => (
              <li key={k.kind}>
                <button onClick={() => { onAdd(k.kind, deal); setOpen(false); }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50">{k.label}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
