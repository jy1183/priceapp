'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { aggregate } from '@/lib/calc/aggregate';
import { parseSiseRaw, jeonseDepositPpa } from '@/lib/calc/sise';
import { FacilityChart, BuildingChart } from '@/components/SiseAnalysisCharts';
import BarChart from '@/components/BarChart';
import { AREA_BANDS, SISE_RESIDENTIAL, bandAggregate, type BandInput } from '@/lib/areaBands';

/** 평형대 차트용 시설 시리즈 색상 */
const BAND_COLORS = ['#1d4ed8', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];
/** 전세 평형대 차트용 색상(초록 계열 위주로 매매와 구분) */
const JEONSE_BAND_COLORS = ['#059669', '#0891b2', '#65a30d', '#0d9488', '#16a34a', '#4d7c0f'];

/** 대분류 섹션 구분 헤더 — 매매/전세/전세가율 시각 구분 */
function SectionHead({ tone, title, desc }: { tone: 'blue' | 'emerald' | 'violet'; title: string; desc: string }) {
  const c = { blue: 'border-blue-500', emerald: 'border-emerald-500', violet: 'border-violet-500' }[tone];
  return (
    <div className={`mt-10 mb-4 border-l-4 ${c} pl-3`}>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{desc}</p>
    </div>
  );
}

/** ④ 시세 분석 — /sise에서 확정한 시세의 매매·전세 평당가 집계 및 전세가율 분석 */
export default function SiseAnalysisPage() {
  const { sise, config, siseConfirmed, siseInput } = useStore();

  // ── A. 매매(월세 환산 포함) 시설별 집계 — 전세 행(평당가 0)은 deal 기준으로 제외 ──
  const rows = useMemo(() => {
    const pct = config.topPercentiles;
    const isSale = (d: string) => d === '매매' || d === '월세';
    const facs = new Set(sise.filter((s) => isSale(s.deal)).map((s) => s.facility));
    return [...facs].map((f) => {
      const pick = (key: 'ppaExcl' | 'ppaSupply' | 'ppaYeon') =>
        sise.filter((s) => s.facility === f && isSale(s.deal) && s[key] != null && (s[key] as number) > 0)
          .map((s) => s[key]!) as number[];
      return {
        f,
        excl: aggregate(pick('ppaExcl'), pct),
        yeon: aggregate(pick('ppaYeon'), pct),
        supplyAvg: (() => {
          const supply = pick('ppaSupply');
          return supply.length ? supply.reduce((a, b) => a + b, 0) / supply.length : NaN;
        })(),
      };
    }).filter((r) => r.excl.count > 0);
  }, [sise, config]);

  // 건물명별 전용 평당가 평균(매매·월세) — 소스 리스트(siseInput)에서 건물명 있는 행, 평균 상위 5개
  const buildings = useMemo(() => {
    const byName = new Map<string, number[]>();
    siseInput.forEach((r) => {
      const name = (r.name ?? '').trim();
      if (!name) return;
      const p = parseSiseRaw(r, config);
      if (p.row.deal === '전세') return; // 전세는 매매환산가 0 → 매매 집계에서 제외(B 섹션에서 별도 집계)
      const v = p.ppa.ppaExcl;
      if (v != null && Number.isFinite(v) && v > 0) {
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name)!.push(v);
      }
    });
    return [...byName.entries()]
      .map(([name, vals]) => ({ name, count: vals.length, avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [siseInput, config]);

  // 평형대별 평균 가격(매매·월세) — 주거 시설만, 전용면적(폴백: 단독/전원주택 연면적) 기준 (D2·R4)
  const bandRows = useMemo(() => {
    const inputs: BandInput[] = siseInput
      .map((r) => parseSiseRaw(r, config))
      .filter((p) => p.errors.length === 0 && p.row.deal !== '전세')
      .map((p) => {
        const fac = p.row.facility;
        if (p.row.exclM2 != null) return { facility: fac, area: p.row.exclM2, ppa: p.ppa.ppaExcl ?? null };
        if ((fac === '단독/다가구' || fac === '전원주택') && p.row.yeonM2 != null)
          return { facility: fac, area: p.row.yeonM2, ppa: p.ppa.ppaYeon ?? null };
        return { facility: fac, area: null, ppa: null };
      })
      .filter((i) => SISE_RESIDENTIAL.includes(i.facility));
    return bandAggregate(inputs);
  }, [siseInput, config]);

  // ── B. 전세 시설별 집계 — 보증금 기준 평당가(전용/공급/연면적) ──
  const jeonseRows = useMemo(() => {
    const pct = config.topPercentiles;
    const byFac = new Map<string, { excl: number[]; supply: number[]; yeon: number[] }>();
    siseInput.forEach((r) => {
      const p = parseSiseRaw(r, config);
      if (p.errors.length !== 0 || p.row.deal !== '전세') return;
      const j = jeonseDepositPpa(p.ppa);
      if (!byFac.has(p.row.facility)) byFac.set(p.row.facility, { excl: [], supply: [], yeon: [] });
      const b = byFac.get(p.row.facility)!;
      if (j.excl != null && Number.isFinite(j.excl) && j.excl > 0) b.excl.push(j.excl);
      if (j.supply != null && Number.isFinite(j.supply) && j.supply > 0) b.supply.push(j.supply);
      if (j.yeon != null && Number.isFinite(j.yeon) && j.yeon > 0) b.yeon.push(j.yeon);
    });
    return [...byFac.entries()].map(([f, b]) => ({
      f,
      excl: aggregate(b.excl, pct),
      yeon: aggregate(b.yeon, pct),
      supplyAvg: b.supply.length ? b.supply.reduce((a, c) => a + c, 0) / b.supply.length : NaN,
    })).filter((r) => r.excl.count > 0);
  }, [siseInput, config]);

  // 전세 평형대별 평균 — 주거 시설만, 전용(폴백 연면적) 기준
  const jeonseBandRows = useMemo(() => {
    const inputs: BandInput[] = siseInput
      .map((r) => parseSiseRaw(r, config))
      .filter((p) => p.errors.length === 0 && p.row.deal === '전세')
      .map((p) => {
        const fac = p.row.facility;
        const j = jeonseDepositPpa(p.ppa);
        if (p.row.exclM2 != null) return { facility: fac, area: p.row.exclM2, ppa: j.excl ?? null };
        if ((fac === '단독/다가구' || fac === '전원주택') && p.row.yeonM2 != null)
          return { facility: fac, area: p.row.yeonM2, ppa: j.yeon ?? null };
        return { facility: fac, area: null, ppa: null };
      })
      .filter((i) => SISE_RESIDENTIAL.includes(i.facility));
    return bandAggregate(inputs);
  }, [siseInput, config]);

  // 건물명별 전세 평당가 평균 상위 5
  const jeonseBuildings = useMemo(() => {
    const byName = new Map<string, number[]>();
    siseInput.forEach((r) => {
      const name = (r.name ?? '').trim();
      if (!name) return;
      const p = parseSiseRaw(r, config);
      if (p.errors.length !== 0 || p.row.deal !== '전세') return;
      const v = jeonseDepositPpa(p.ppa).excl;
      if (v != null && Number.isFinite(v) && v > 0) {
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name)!.push(v);
      }
    });
    return [...byName.entries()]
      .map(([name, vals]) => ({ name, count: vals.length, avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [siseInput, config]);

  // ── C. 매매 대비 전세 비율(전세가율) — 분모는 매매(월세환산 제외) ──
  const saleOnlyRows = useMemo(() => {
    // 전세가율 분모: 매매 거래만(월세환산 제외, D4). 시설별 전용 평균 평당가.
    const pct = config.topPercentiles;
    const byFac = new Map<string, number[]>();
    sise.forEach((s) => {
      if (s.deal !== '매매' || s.ppaExcl == null || s.ppaExcl <= 0) return;
      if (!byFac.has(s.facility)) byFac.set(s.facility, []);
      byFac.get(s.facility)!.push(s.ppaExcl);
    });
    return new Map([...byFac.entries()].map(([f, v]) => [f, aggregate(v, pct)] as const));
  }, [sise, config]);

  const ratioByFacility = useMemo(() => {
    const jByF = new Map(jeonseRows.map((r) => [r.f, r] as const));
    const facs = [...jByF.keys()].filter((f) => saleOnlyRows.has(f));
    return facs.map((f) => {
      const sale = saleOnlyRows.get(f)!;
      const jeonse = jByF.get(f)!;
      const ratio = sale.avg > 0 && Number.isFinite(sale.avg) && Number.isFinite(jeonse.excl.avg)
        ? (jeonse.excl.avg / sale.avg) * 100 : NaN;
      return { f, saleAvg: sale.avg, saleCount: sale.count, jeonseAvg: jeonse.excl.avg, jeonseCount: jeonse.excl.count, ratio };
    }).filter((r) => Number.isFinite(r.ratio));
  }, [jeonseRows, saleOnlyRows]);

  // 매매(월세환산 제외) 평형대 집계 — 전세가율 평형대 분모
  const saleBandRows = useMemo(() => {
    const inputs: BandInput[] = siseInput
      .map((r) => parseSiseRaw(r, config))
      .filter((p) => p.errors.length === 0 && p.row.deal === '매매')
      .map((p) => {
        const fac = p.row.facility;
        if (p.row.exclM2 != null) return { facility: fac, area: p.row.exclM2, ppa: p.ppa.ppaExcl ?? null };
        if ((fac === '단독/다가구' || fac === '전원주택') && p.row.yeonM2 != null)
          return { facility: fac, area: p.row.yeonM2, ppa: p.ppa.ppaYeon ?? null };
        return { facility: fac, area: null, ppa: null };
      })
      .filter((i) => SISE_RESIDENTIAL.includes(i.facility));
    return bandAggregate(inputs);
  }, [siseInput, config]);

  const ratioBand = useMemo(() => {
    const facs = jeonseBandRows.facilities.filter((f) => saleBandRows.facilities.includes(f));
    const cells: Record<string, Record<string, number | null>> = {};
    facs.forEach((f) => {
      cells[f] = {};
      AREA_BANDS.forEach((b) => {
        const s = saleBandRows.cells[f]?.[b.key];
        const j = jeonseBandRows.cells[f]?.[b.key];
        cells[f][b.key] = s && j && s.count > 0 && j.count > 0 && s.avg > 0 ? (j.avg / s.avg) * 100 : null;
      });
    });
    return { facilities: facs.filter((f) => AREA_BANDS.some((b) => cells[f][b.key] != null)), cells };
  }, [saleBandRows, jeonseBandRows]);

  const fmt = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : '-');
  const fmtPct = (v: number | null) => (v != null && Number.isFinite(v) ? v.toFixed(1) + '%' : '-');

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">시세 분석</h1>
      <p className="mb-4 text-sm text-gray-600">
        <b>① 시세 입력</b>에서 파싱·확정한 시세를 <b>매매(월세 환산 포함)</b>·<b>전세</b>로 구분해 평당가로 집계하고, 매매 대비 전세 비율(전세가율)을 분석합니다. 단독·상가주택 등은 대지 기준이며, 소스에 연면적이 있으면 연면적 기준도 함께 표시합니다. 단위 천원/평.
      </p>

      {rows.length === 0 && jeonseRows.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          확정된 시세가 없습니다. <Link href="/sise" className="font-medium underline">① 시세 입력</Link>에서 붙여넣고 <b>확정 → 분석 반영</b>을 누르세요.
          {siseConfirmed && ' (확정은 됐으나 평당가가 산출된 행이 없습니다 — 면적 파싱을 확인하세요.)'}
        </div>
      ) : (
        <>
          {/* ═══════════ A. 매매 가격 분석 ═══════════ */}
          <SectionHead tone="blue" title="A. 매매 가격 분석"
            desc="매매 거래 기준이며, 월세는 자본환원율로 환산한 매매환산가로 포함합니다. 전세는 아래 B 섹션에서 별도 집계합니다." />

          {rows.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
              매매·월세 매물이 없어 집계할 수 없습니다.
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

          {/* 평형대별 평균 가격 분석 */}
          {bandRows.facilities.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-1 text-lg font-semibold">평형대별 평균 가격 분석 (전용면적 기준)</h3>
              <p className="mb-3 text-sm text-gray-600">
                주거 상품(아파트·오피스텔·빌라／연립·단독/다가구·전원주택)만 집계합니다. 전용면적 기준 구분이며, 단독/다가구·전원주택은 전용면적이 없으면 연면적으로 분류합니다. 월세는 매매환산 평당가, 환산가 미산출(0)·결측 행은 집계에서 제외합니다. 단위 천원/평.
              </p>
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-3 py-2">시설</th>
                      {AREA_BANDS.map((b) => <th key={b.key} className="px-3 py-2 text-right">{b.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {bandRows.facilities.map((f) => (
                      <tr key={f} className="border-t">
                        <td className="px-3 py-1.5 font-medium">{f}</td>
                        {AREA_BANDS.map((b) => {
                          const c = bandRows.cells[f][b.key];
                          return (
                            <td key={b.key} className="px-3 py-1.5 text-right">
                              {c.count ? fmt(c.avg) : '-'}
                              {c.count ? <span className="ml-1 text-[10px] text-gray-400">{c.count}</span> : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <BarChart title="평형대별 평균 평당가 (전용면적 기준, 천원/평)" xName="평형대" wrapX
                  x={AREA_BANDS.map((b) => b.label)}
                  series={bandRows.facilities.map((f, i) => ({
                    name: f,
                    data: AREA_BANDS.map((b) => (bandRows.cells[f][b.key].count ? Math.round(bandRows.cells[f][b.key].avg) : null)),
                    color: BAND_COLORS[i % BAND_COLORS.length],
                  }))} />
              </div>
            </div>
          )}

          {/* 건물명별 상위 5 */}
          <div className="mt-8">
            <h3 className="mb-1 text-lg font-semibold">건물별 평균 평당가 상위 5</h3>
            <p className="mb-3 text-sm text-gray-600">
              소스 리스트에서 <b>건물명</b>이 있는 매매·월세 매물을 건물명 기준으로 묶어 전용 평당가 평균을 구한 뒤 상위 5개를 표시합니다. 단위 천원/평.
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
                        <th className="px-3 py-2">건수</th><th className="px-3 py-2 text-center">평균 평당가(전용)</th>
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

          {/* ═══════════ B. 전세 가격 분석 ═══════════ */}
          <SectionHead tone="emerald" title="B. 전세 가격 분석"
            desc="전세 보증금 기준 평당가입니다(전용면적 기준, 단독/다가구·전원주택은 전용면적이 없으면 연면적 기준). 단위 천원/평." />

          {jeonseRows.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
              전세 매물이 없어 집계할 수 없습니다.
            </div>
          ) : (
            <>
              {/* 전세 시설별 평당가 */}
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-3 py-2" rowSpan={2}>시설</th>
                      <th className="px-3 py-2 text-center" colSpan={6}>전용 기준</th>
                      <th className="px-3 py-2 text-center" colSpan={5}>연면적 기준</th>
                    </tr>
                    <tr>
                      <th className="px-3 py-2">건수</th><th className="px-3 py-2">평균</th><th className="px-3 py-2">상위10%</th><th className="px-3 py-2">상위30%</th><th className="px-3 py-2">상위50%</th><th className="px-3 py-2">공급 평균</th>
                      <th className="px-3 py-2">건수</th><th className="px-3 py-2">평균</th><th className="px-3 py-2">상위10%</th><th className="px-3 py-2">상위30%</th><th className="px-3 py-2">상위50%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jeonseRows.map((r) => (
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
              <div className="mt-4">
                <FacilityChart title="시설별 전세 평당가(전용, 천원/평)"
                  rows={jeonseRows.map((r) => ({ f: r.f, avg: r.excl.avg, top10: r.excl.top10, top30: r.excl.top30, top50: r.excl.top50 }))} />
              </div>

              {/* 전세 평형대별 평균 가격 */}
              {jeonseBandRows.facilities.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-1 text-lg font-semibold">평형대별 전세 평균 가격 분석 (전용면적 기준)</h3>
                  <p className="mb-3 text-sm text-gray-600">
                    주거 상품(아파트·오피스텔·빌라／연립·단독/다가구·전원주택) 전세만 집계합니다. 전용면적 기준 구분이며, 단독/다가구·전원주택은 전용면적이 없으면 연면적으로 분류합니다. 단위 천원/평.
                  </p>
                  <div className="overflow-x-auto rounded-lg border bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-gray-600">
                        <tr>
                          <th className="px-3 py-2">시설</th>
                          {AREA_BANDS.map((b) => <th key={b.key} className="px-3 py-2 text-right">{b.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {jeonseBandRows.facilities.map((f) => (
                          <tr key={f} className="border-t">
                            <td className="px-3 py-1.5 font-medium">{f}</td>
                            {AREA_BANDS.map((b) => {
                              const c = jeonseBandRows.cells[f][b.key];
                              return (
                                <td key={b.key} className="px-3 py-1.5 text-right">
                                  {c.count ? fmt(c.avg) : '-'}
                                  {c.count ? <span className="ml-1 text-[10px] text-gray-400">{c.count}</span> : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4">
                    <BarChart title="평형대별 전세 평균 평당가 (전용면적 기준, 천원/평)" xName="평형대" wrapX
                      x={AREA_BANDS.map((b) => b.label)}
                      series={jeonseBandRows.facilities.map((f, i) => ({
                        name: f,
                        data: AREA_BANDS.map((b) => (jeonseBandRows.cells[f][b.key].count ? Math.round(jeonseBandRows.cells[f][b.key].avg) : null)),
                        color: JEONSE_BAND_COLORS[i % JEONSE_BAND_COLORS.length],
                      }))} />
                  </div>
                </div>
              )}

              {/* 전세 건물명별 상위 5 */}
              <div className="mt-8">
                <h3 className="mb-1 text-lg font-semibold">건물별 전세 평균 평당가 상위 5</h3>
                <p className="mb-3 text-sm text-gray-600">
                  소스 리스트에서 <b>건물명</b>이 있는 전세 매물을 건물명 기준으로 묶어 전용 평당가 평균을 구한 뒤 상위 5개를 표시합니다. 단위 천원/평.
                </p>
                {jeonseBuildings.length === 0 ? (
                  <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                    건물명이 있는 전세 매물이 없어 집계할 수 없습니다.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-lg border bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-600">
                          <tr>
                            <th className="px-3 py-2">순위</th><th className="px-3 py-2">건물명</th>
                            <th className="px-3 py-2">건수</th><th className="px-3 py-2 text-center">평균 평당가(전용)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jeonseBuildings.map((b, i) => (
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
                      <BuildingChart title="건물별 전세 평균 평당가(전용) 상위(천원/평)" color="#0891b2"
                        rows={jeonseBuildings.map((b) => ({ name: b.name, avg: b.avg }))} />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ═══════════ C. 매매 대비 전세 비율(전세가율) 분석 ═══════════ */}
          <SectionHead tone="violet" title="C. 매매 대비 전세 비율(전세가율) 분석"
            desc="전세가율 = 전세 평당가 ÷ 매매 평당가 × 100. 분모는 매매 거래만(월세환산 제외)이며, 매매·전세 평균이 모두 있는 항목만 표시합니다." />

          {ratioByFacility.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
              매매·전세가 모두 있는 시설이 없어 전세가율을 산출할 수 없습니다.
            </div>
          ) : (
            <>
              {/* 시설별 전세가율 */}
              <h3 className="mb-1 text-lg font-semibold">시설별 전세가율</h3>
              <p className="mb-3 text-sm text-gray-600">전용면적 기준 평균 평당가 비교. 괄호는 표본 건수. 단위 천원/평.</p>
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-3 py-2">시설</th>
                      <th className="px-3 py-2 text-right">매매 평균(전용)</th>
                      <th className="px-3 py-2 text-right">전세 평균(전용)</th>
                      <th className="px-3 py-2 text-right">전세가율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratioByFacility.map((r) => (
                      <tr key={r.f} className="border-t">
                        <td className="px-3 py-1.5 font-medium">{r.f}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(r.saleAvg)}<span className="ml-1 text-[10px] text-gray-400">{r.saleCount}</span></td>
                        <td className="px-3 py-1.5 text-right">{fmt(r.jeonseAvg)}<span className="ml-1 text-[10px] text-gray-400">{r.jeonseCount}</span></td>
                        <td className="px-3 py-1.5 text-right font-semibold text-violet-700">{fmtPct(r.ratio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <BarChart title="시설별 전세가율 (%)" xName="시설" rotateX={ratioByFacility.length > 4 ? 30 : 0}
                  x={ratioByFacility.map((r) => r.f)}
                  series={[{ name: '전세가율', data: ratioByFacility.map((r) => Math.round(r.ratio * 10) / 10), color: '#7c3aed' }]} />
              </div>

              {/* 평형대별 전세가율 */}
              {ratioBand.facilities.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-1 text-lg font-semibold">평형대별 전세가율</h3>
                  <p className="mb-3 text-sm text-gray-600">각 평형대에서 매매·전세 평균이 모두 산출된 셀만 전세가율(%)을 표시합니다.</p>
                  <div className="overflow-x-auto rounded-lg border bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-gray-600">
                        <tr>
                          <th className="px-3 py-2">시설</th>
                          {AREA_BANDS.map((b) => <th key={b.key} className="px-3 py-2 text-right">{b.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {ratioBand.facilities.map((f) => (
                          <tr key={f} className="border-t">
                            <td className="px-3 py-1.5 font-medium">{f}</td>
                            {AREA_BANDS.map((b) => (
                              <td key={b.key} className="px-3 py-1.5 text-right">{fmtPct(ratioBand.cells[f][b.key])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4">
                    <BarChart title="평형대별 전세가율 (%)" xName="평형대" wrapX
                      x={AREA_BANDS.map((b) => b.label)}
                      series={ratioBand.facilities.map((f, i) => ({
                        name: f,
                        data: AREA_BANDS.map((b) => (ratioBand.cells[f][b.key] != null ? Math.round(ratioBand.cells[f][b.key]! * 10) / 10 : null)),
                        color: BAND_COLORS[i % BAND_COLORS.length],
                      }))} />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
