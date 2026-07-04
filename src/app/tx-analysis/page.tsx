'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { aggregate } from '@/lib/calc/aggregate';
import TxCharts from '@/components/TxCharts';

const PERIODS = [
  { key: 'all', label: '전체' },
  { key: '5', label: '준공 5년내' },
  { key: '10', label: '준공 10년내' },
] as const;

/** ④ 실거래 분석 — /transactions에서 조회한 실거래를 준공연도 필터·시설 집계·연도별 차트로 분석 */
export default function TxAnalysisPage() {
  const { tx, txMeta, config } = useStore();
  const [period, setPeriod] = useState('all');
  const thisYear = new Date().getFullYear();

  const filtered = useMemo(() => {
    if (period === 'all') return tx;
    const n = +period;
    return tx.filter((r) => r.buildYear != null && r.buildYear >= thisYear - n && r.buildYear <= thisYear);
  }, [tx, period, thisYear]);

  const rows = useMemo(() => {
    const facs = new Set(filtered.map((t) => t.facility));
    const pct = config.topPercentiles;
    return [...facs].map((f) => {
      const vals = filtered.filter((t) => t.facility === f && t.ppa != null).map((t) => t.ppa!) as number[];
      return { f, agg: aggregate(vals, pct) };
    }).filter((r) => r.agg.count > 0);
  }, [filtered, config]);

  const fmt = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : '-');

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">실거래 분석</h1>
      <p className="mb-4 text-sm text-gray-600">
        <b>② 실거래 조회</b>로 가져온 실거래를 준공연도별·거래연도별로 분석합니다. 단위 천원/평.
      </p>

      {tx.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          조회된 실거래가 없습니다. <Link href="/transactions" className="font-medium underline">② 실거래 조회</Link>를 먼저 실행하세요.
        </div>
      ) : (
        <>
          <div className="no-print mb-3 flex items-center gap-2">
            <span className="text-sm text-gray-500">준공연도 필터:</span>
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`rounded-full px-3 py-1 text-xs ${period === p.key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}>{p.label}</button>
            ))}
            {txMeta && <span className="ml-2 text-xs text-gray-400">{txMeta.region} · {txMeta.facility}·{txMeta.trade} · {txMeta.from}~{txMeta.to} · {filtered.length}건</span>}
          </div>

          <TxCharts rows={filtered} />

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr><th className="px-3 py-2">시설</th><th className="px-3 py-2">건수</th><th className="px-3 py-2">평균</th><th className="px-3 py-2">상위10%</th><th className="px-3 py-2">상위30%</th><th className="px-3 py-2">상위50%</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.f} className="border-t">
                    <td className="px-3 py-1.5 font-medium">{r.f}</td>
                    <td className="px-3 py-1.5">{r.agg.count}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(r.agg.avg)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(r.agg.top10)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(r.agg.top30)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(r.agg.top50)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
