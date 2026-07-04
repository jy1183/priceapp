'use client';
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { buildSummaryRows } from '@/lib/summary';
import ExportBar from '@/components/ExportBar';

/** 가격검토종합 — 시세(전용) vs 실거래(전용) 시설별 평당가 비교 (엑셀 '가격검토종합' 대응) */
export default function SummaryPage() {
  const { sise, tx, config, txMeta } = useStore();

  const rows = useMemo(
    () => buildSummaryRows(sise, tx, config).map((r) => ({ f: r.facility, sa: r.sise, ta: r.tx, gap: r.gap })),
    [sise, tx, config],
  );

  const fmt = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : '-');

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">종합 검토 — 시세 vs 실거래</h1>
      <p className="mb-4 text-sm text-gray-600">
        시세 분석(확정)과 실거래 조회 결과를 시설별 전용 평당가(매매 기준)로 비교합니다. 단위 천원/평.
      </p>

      <ExportBar />

      {rows.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          비교할 데이터가 없습니다. <b>① 시세 입력</b>에서 확정하고 <b>② 실거래 조회</b>를 실행한 뒤 다시 오세요.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th rowSpan={2} className="px-3 py-2 text-left align-bottom">시설</th>
                <th colSpan={4} className="border-l px-3 py-1 text-center">시세 (전용, 천원/평)</th>
                <th colSpan={4} className="border-l px-3 py-1 text-center">실거래 (전용, 천원/평)</th>
                <th rowSpan={2} className="border-l px-3 py-2 text-center align-bottom">시세/실거래<br/>괴리</th>
              </tr>
              <tr className="text-xs">
                <th className="border-l px-2 py-1">건수</th><th className="px-2 py-1">평균</th><th className="px-2 py-1">상위10%</th><th className="px-2 py-1">상위30%</th>
                <th className="border-l px-2 py-1">건수</th><th className="px-2 py-1">평균</th><th className="px-2 py-1">상위10%</th><th className="px-2 py-1">상위30%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.f} className="border-t">
                  <td className="px-3 py-1.5 font-medium">{r.f}</td>
                  <td className="border-l px-2 py-1.5 text-center text-gray-500">{r.sa.count}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.sa.avg)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.sa.top10)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.sa.top30)}</td>
                  <td className="border-l px-2 py-1.5 text-center text-gray-500">{r.ta.count}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.ta.avg)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.ta.top10)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.ta.top30)}</td>
                  <td className={`border-l px-2 py-1.5 text-right font-medium ${Number.isFinite(r.gap) ? (r.gap >= 0 ? 'text-red-600' : 'text-blue-600') : 'text-gray-400'}`}>
                    {Number.isFinite(r.gap) ? `${r.gap >= 0 ? '+' : ''}${r.gap.toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {txMeta && <p className="mt-2 text-xs text-gray-400">실거래 기준: {txMeta.region} · {txMeta.facility}·{txMeta.trade} · {txMeta.from}~{txMeta.to}</p>}
    </div>
  );
}
