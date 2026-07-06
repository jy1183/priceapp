'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { aggregate } from '@/lib/calc/aggregate';
import { parseSiseRaw } from '@/lib/calc/sise';
import { FacilityChart, BuildingChart } from '@/components/SiseAnalysisCharts';

/** ④ 시세 분석 — /sise에서 확정한 시세의 시설별 평당가 집계 */
export default function SiseAnalysisPage() {
  const { sise, config, siseConfirmed, siseInput } = useStore();

  const rows = useMemo(() => {
    const facs = new Set(sise.map((s) => s.facility));
    const pct = config.topPercentiles;
    return [...facs].map((f) => {
      const excl = sise.filter((s) => s.facility === f && s.ppaExcl != null).map((s) => s.ppaExcl!) as number[];
      const supply = sise.filter((s) => s.facility === f && s.ppaSupply != null).map((s) => s.ppaSupply!) as number[];
      const yeon = sise.filter((s) => s.facility === f && s.ppaYeon != null).map((s) => s.ppaYeon!) as number[];
      return {
        f,
        excl: aggregate(excl, pct),
        yeon: aggregate(yeon, pct),
        supplyAvg: supply.length ? supply.reduce((a, b) => a + b, 0) / supply.length : NaN,
      };
    }).filter((r) => r.excl.count > 0);
  }, [sise, config]);

  // 건물명별 전용 평당가 평균 — 소스 리스트(siseInput)에 건물명이 있는 행만 집계, 평균 상위 5개
  const buildings = useMemo(() => {
    const byName = new Map<string, number[]>();
    siseInput.forEach((r) => {
      const name = (r.name ?? '').trim();
      if (!name) return;
      const v = parseSiseRaw(r, config).ppa.ppaExcl;
      if (v != null && Number.isFinite(v)) {
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name)!.push(v);
      }
    });
    return [...byName.entries()]
      .map(([name, vals]) => ({ name, count: vals.length, avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [siseInput, config]);

  const fmt = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : '-');

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">시세 분석</h1>
      <p className="mb-4 text-sm text-gray-600">
        <b>① 시세 입력</b>에서 파싱·확정한 시세를 시설별 평당가로 집계합니다. 단독·상가주택 등은 대지 기준이며, 소스에 연면적이 있으면 연면적 기준도 함께 표시합니다. 단위 천원/평.
      </p>

      {rows.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          확정된 시세가 없습니다. <Link href="/sise" className="font-medium underline">① 시세 입력</Link>에서 붙여넣고 <b>확정 → 분석 반영</b>을 누르세요.
          {siseConfirmed && ' (확정은 됐으나 평당가가 산출된 행이 없습니다 — 면적 파싱을 확인하세요.)'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2" rowSpan={2}>시설</th>
                  <th className="px-3 py-2 text-center" colSpan={6}>전용/대지 기준</th>
                  <th className="px-3 py-2 text-center" colSpan={5}>연면적 기준</th>
                </tr>
                <tr>
                  <th className="px-3 py-2">건수</th><th className="px-3 py-2">평균</th><th className="px-3 py-2">상위10%</th><th className="px-3 py-2">상위30%</th><th className="px-3 py-2">상위50%</th><th className="px-3 py-2">공급 평균</th>
                  <th className="px-3 py-2">건수</th><th className="px-3 py-2">평균</th><th className="px-3 py-2">상위10%</th><th className="px-3 py-2">상위30%</th><th className="px-3 py-2">상위50%</th>
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
                    <td className="px-3 py-1.5 text-gray-500">{r.yeon.count || '-'}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{r.yeon.count ? fmt(r.yeon.avg) : '-'}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{r.yeon.count ? fmt(r.yeon.top10) : '-'}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{r.yeon.count ? fmt(r.yeon.top30) : '-'}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{r.yeon.count ? fmt(r.yeon.top50) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 시설 평균 분석 차트 */}
          <div className="mt-4">
            <FacilityChart rows={rows.map((r) => ({ f: r.f, avg: r.excl.avg, top10: r.excl.top10, top30: r.excl.top30, top50: r.excl.top50 }))} />
          </div>

          {/* 건물명별 상위 5 */}
          <div className="mt-8">
            <h2 className="mb-1 text-lg font-semibold">건물별 평균 평당가 상위 5</h2>
            <p className="mb-3 text-sm text-gray-600">
              소스 리스트에서 <b>건물명</b>이 있는 매물을 건물명 기준으로 묶어 전용 평당가 평균을 구한 뒤 상위 5개를 표시합니다. 단위 천원/평.
            </p>
            {buildings.length === 0 ? (
              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                건물명이 있는 매물이 없어 집계할 수 없습니다.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr>
                        <th className="px-3 py-2">순위</th><th className="px-3 py-2">건물명</th>
                        <th className="px-3 py-2">건수</th><th className="px-3 py-2">평균 평당가</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildings.map((b, i) => (
                        <tr key={b.name} className="border-t">
                          <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium">{b.name}</td>
                          <td className="px-3 py-1.5">{b.count}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(b.avg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4">
                  <BuildingChart rows={buildings.map((b) => ({ name: b.name, avg: b.avg }))} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
