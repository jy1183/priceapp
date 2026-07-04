'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { aggregate } from '@/lib/calc/aggregate';

/** ④ 시세 분석 — /sise에서 확정한 시세의 시설별 평당가 집계 */
export default function SiseAnalysisPage() {
  const { sise, config, siseConfirmed } = useStore();

  const rows = useMemo(() => {
    const facs = new Set(sise.map((s) => s.facility));
    const pct = config.topPercentiles;
    return [...facs].map((f) => {
      const excl = sise.filter((s) => s.facility === f && s.ppaExcl != null).map((s) => s.ppaExcl!) as number[];
      const supply = sise.filter((s) => s.facility === f && s.ppaSupply != null).map((s) => s.ppaSupply!) as number[];
      return { f, excl: aggregate(excl, pct), supplyAvg: supply.length ? supply.reduce((a, b) => a + b, 0) / supply.length : NaN };
    }).filter((r) => r.excl.count > 0);
  }, [sise, config]);

  const fmt = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : '-');

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">시세 분석</h1>
      <p className="mb-4 text-sm text-gray-600">
        <b>① 시세 입력</b>에서 파싱·확정한 시세를 시설별 전용 평당가로 집계합니다. 단위 천원/평.
      </p>

      {rows.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          확정된 시세가 없습니다. <Link href="/sise" className="font-medium underline">① 시세 입력</Link>에서 붙여넣고 <b>확정 → 분석 반영</b>을 누르세요.
          {siseConfirmed && ' (확정은 됐으나 평당가가 산출된 행이 없습니다 — 면적 파싱을 확인하세요.)'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">시설</th><th className="px-3 py-2">건수</th>
                <th className="px-3 py-2">전용 평균</th><th className="px-3 py-2">상위10%</th><th className="px-3 py-2">상위30%</th><th className="px-3 py-2">상위50%</th>
                <th className="px-3 py-2">공급 평균</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.f} className="border-t">
                  <td className="px-3 py-1.5 font-medium">{r.f}</td>
                  <td className="px-3 py-1.5">{r.excl.count}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.excl.avg)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.excl.top10)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.excl.top30)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.excl.top50)}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{fmt(r.supplyAvg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
