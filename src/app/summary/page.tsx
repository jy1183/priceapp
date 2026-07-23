'use client';
// 종합검토 결과 — ① 매매 시세vs실거래, ② 전세가 시세vs실거래, ③ 전세가율 검토, ④ 시세·⑤ 실거래 평형대별 매매/전세 비교
import { Fragment, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { buildSummaryRows, buildJeonseSummaryRows, type SummaryRow } from '@/lib/summary';
import ExportBar from '@/components/ExportBar';
import BarChart from '@/components/BarChart';
import { parseSiseRaw, jeonseDepositPpa } from '@/lib/calc/sise';
import { AREA_BANDS, SISE_RESIDENTIAL, bandAggregate, bandByFacility, type BandInput, type BandByFacilityResult } from '@/lib/areaBands';

/** 평형대 차트용 시설 시리즈 색상 — 매매(진한 계열) */
const SALE_COLORS = ['#1d4ed8', '#d97706', '#7c3aed', '#dc2626', '#0f766e', '#4d7c0f'];
/** 평형대 차트용 시설 시리즈 색상 — 전세(초록 계열, 매매와 구분) */
const JEONSE_COLORS = ['#059669', '#0891b2', '#65a30d', '#0d9488', '#16a34a', '#a21caf'];

const fmt = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : '-');
const fmtPct = (v: number) => (Number.isFinite(v) ? v.toFixed(1) + '%' : '-');

/** 대분류 섹션 구분 헤더 */
function SectionHead({ tone, title, desc }: { tone: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose'; title: string; desc: string }) {
  const c = { blue: 'border-blue-500', emerald: 'border-emerald-500', violet: 'border-violet-500', amber: 'border-amber-500', rose: 'border-rose-500' }[tone];
  return (
    <div className={`mt-10 mb-4 border-l-4 ${c} pl-3`}>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{desc}</p>
    </div>
  );
}

/** 시세 vs 실거래 비교표 — 매매·전세 공용. 괴리는 평균 기준이므로 제목에 (평균) 표기 */
function CompareTable({ rows }: { rows: { f: string; sa: SummaryRow['sise']; ta: SummaryRow['tx']; gap: number }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th rowSpan={2} className="px-3 py-2 text-left align-bottom">시설</th>
            <th colSpan={4} className="border-l px-3 py-1 text-center">시세 (전용, 천원/평)</th>
            <th colSpan={4} className="border-l px-3 py-1 text-center">실거래 (전용, 천원/평)</th>
            <th rowSpan={2} className="border-l px-3 py-2 text-center align-bottom">시세/실거래<br/>괴리 (평균)</th>
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
  );
}

/** 평형대별×시설별 매매/전세/전세가율 비교 블록 — 시세(④)·실거래(⑤) 공용 (표 + 그룹 막대차트) */
function BandCompareBlock({ sale, jeonse, chartTitle, emptyMsg }: {
  sale: BandByFacilityResult; jeonse: BandByFacilityResult; chartTitle: string; emptyMsg: string;
}) {
  const facs = [...sale.facilities];
  jeonse.facilities.forEach((f) => { if (!facs.includes(f)) facs.push(f); });

  const cell = (band: BandByFacilityResult, f: string, key: string) => {
    const c = band.cells[f]?.[key];
    return c && c.count > 0 ? (
      <>
        {fmt(c.avg)}
        <span className="ml-1 text-[10px] text-gray-400">{c.count}</span>
      </>
    ) : '-';
  };

  if (facs.length === 0) {
    return (
      <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">{emptyMsg}</div>
    );
  }
  return (
    <>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">시설</th>
              <th className="px-3 py-2">구분</th>
              {AREA_BANDS.map((b) => <th key={b.key} className="px-3 py-2 text-right">{b.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {facs.map((f) => (
              <Fragment key={f}>
                <tr className="border-t">
                  <td rowSpan={3} className="px-3 py-1.5 align-top font-medium">{f}</td>
                  <td className="px-3 py-1.5 text-blue-700">매매</td>
                  {AREA_BANDS.map((b) => (
                    <td key={b.key} className="px-3 py-1.5 text-right">{cell(sale, f, b.key)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-3 py-1.5 text-emerald-700">전세</td>
                  {AREA_BANDS.map((b) => (
                    <td key={b.key} className="px-3 py-1.5 text-right">{cell(jeonse, f, b.key)}</td>
                  ))}
                </tr>
                <tr className="bg-violet-50/40">
                  <td className="px-3 py-1.5 font-medium text-violet-700">전세가율</td>
                  {AREA_BANDS.map((b) => {
                    const s = sale.cells[f]?.[b.key];
                    const j = jeonse.cells[f]?.[b.key];
                    const v = s && j && s.count > 0 && j.count > 0 && s.avg > 0 ? (j.avg / s.avg) * 100 : NaN;
                    return <td key={b.key} className="px-3 py-1.5 text-right font-semibold text-violet-700">{fmtPct(v)}</td>;
                  })}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <BarChart title={chartTitle} xName="평형대" wrapX
          x={AREA_BANDS.map((b) => b.label)}
          series={facs.flatMap((f, i) => [
            {
              name: `${f} 매매`,
              data: AREA_BANDS.map((b) => {
                const c = sale.cells[f]?.[b.key];
                return c && c.count > 0 ? Math.round(c.avg) : null;
              }),
              color: SALE_COLORS[i % SALE_COLORS.length],
            },
            {
              name: `${f} 전세`,
              data: AREA_BANDS.map((b) => {
                const c = jeonse.cells[f]?.[b.key];
                return c && c.count > 0 ? Math.round(c.avg) : null;
              }),
              color: JEONSE_COLORS[i % JEONSE_COLORS.length],
            },
          ])} />
      </div>
    </>
  );
}

/** 가격검토종합 — 시세 vs 실거래(매매·전세) 비교 및 시세 평형대별 매매/전세 비교 */
export default function SummaryPage() {
  const { sise, tx, config, txMeta, siseInput } = useStore();

  // ── 1. 매매: 시세 vs 실거래 시설별 집계 ──
  const rows = useMemo(
    () => buildSummaryRows(sise, tx, config).map((r) => ({ f: r.facility, sa: r.sise, ta: r.tx, gap: r.gap })),
    [sise, tx, config],
  );

  // ── 2. 전세가: 시세(보증금 전용 평당가) vs 실거래(전세) 시설별 집계 ──
  const jeonseRows = useMemo(
    () => buildJeonseSummaryRows(siseInput, tx, config).map((r) => ({ f: r.facility, sa: r.sise, ta: r.tx, gap: r.gap })),
    [siseInput, tx, config],
  );

  // ── 3. 전세가율 검토: 매매·전세 표를 합치고 항목별(평균/상위10%/상위30%) 전세가율 산출 ──
  const ratioRows = useMemo(() => {
    const saleByF = new Map(rows.map((r) => [r.f, r] as const));
    const jeonseByF = new Map(jeonseRows.map((r) => [r.f, r] as const));
    const facs = rows.map((r) => r.f);
    jeonseRows.forEach((r) => { if (!facs.includes(r.f)) facs.push(r.f); });
    const rat = (j: number | undefined, s: number | undefined) =>
      j != null && s != null && Number.isFinite(j) && Number.isFinite(s) && s > 0 ? (j / s) * 100 : NaN;
    return facs.map((f) => {
      const s = saleByF.get(f);
      const j = jeonseByF.get(f);
      return {
        f, sale: s, jeonse: j,
        siseRatio: { avg: rat(j?.sa.avg, s?.sa.avg), top10: rat(j?.sa.top10, s?.sa.top10), top30: rat(j?.sa.top30, s?.sa.top30) },
        txRatio: { avg: rat(j?.ta.avg, s?.ta.avg), top10: rat(j?.ta.top10, s?.ta.top10), top30: rat(j?.ta.top30, s?.ta.top30) },
      };
    });
  }, [rows, jeonseRows]);

  // ── 4. 시세: 평형대별·시설별 매매가/전세가 집계 (주거 시설, 전용면적 기준) ──
  const saleBand = useMemo(() => {
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

  const jeonseBand = useMemo(() => {
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

  // ── 5. 실거래: 평형대별·시설별 매매가/전세가 집계 (주거 시설, 전용면적 기준 — 단독다가구는 연면적) ──
  const txSaleBand = useMemo(() => bandByFacility(tx.filter((t) => t.dealType === '매매')), [tx]);
  const txJeonseBand = useMemo(() => bandByFacility(tx.filter((t) => t.dealType === '전세')), [tx]);

  const hasAny = rows.length > 0 || jeonseRows.length > 0
    || saleBand.facilities.length > 0 || jeonseBand.facilities.length > 0
    || txSaleBand.facilities.length > 0 || txJeonseBand.facilities.length > 0;

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">종합 검토 — 시세 vs 실거래</h1>
      <p className="mb-4 text-sm text-gray-600">
        시세 분석(확정)과 실거래 조회 결과를 매매·전세로 구분해 시설별 전용 평당가로 비교하고, 시세·실거래 각각의 평형대별 매매가/전세가를 비교합니다. 단위 천원/평.
      </p>

      <ExportBar />

      {!hasAny ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          비교할 데이터가 없습니다. <b>① 시세 입력</b>에서 확정하고 <b>② 실거래 조회</b>를 실행한 뒤 다시 오세요.
        </div>
      ) : (
        <>
          {/* ═══════════ 1. 매매 ═══════════ */}
          <SectionHead tone="blue" title="1. 매매 — 시설별 가격 분석 (시세 vs 실거래)"
            desc="매매 기준 시설별 전용 평당가를 시세·실거래로 비교합니다. 괴리는 평균 평당가 기준(시세평균 ÷ 실거래평균 − 1)입니다." />

          {rows.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
              매매 기준으로 비교할 데이터가 없습니다.
            </div>
          ) : (
            <>
              <CompareTable rows={rows} />
              <div className="mt-4">
                <BarChart title="시설별 매매 평균 평당가 — 시세 vs 실거래 (전용, 천원/평)" xName="시설"
                  rotateX={rows.length > 4 ? 30 : 0}
                  x={rows.map((r) => r.f)}
                  series={[
                    { name: '시세 평균', data: rows.map((r) => (r.sa.count ? Math.round(r.sa.avg) : null)), color: '#1d4ed8' },
                    { name: '실거래 평균', data: rows.map((r) => (r.ta.count ? Math.round(r.ta.avg) : null)), color: '#d97706' },
                  ]} />
              </div>
            </>
          )}

          {/* ═══════════ 2. 전세가 ═══════════ */}
          <SectionHead tone="emerald" title="2. 전세가 — 시설별 가격 분석 (시세 vs 실거래)"
            desc="전세 기준 시설별 전용 평당가(보증금 기준)를 시세·실거래로 비교합니다. 괴리는 평균 평당가 기준(시세평균 ÷ 실거래평균 − 1)입니다." />

          {jeonseRows.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
              전세 기준으로 비교할 데이터가 없습니다. (시세에 전세 매물이 있고, 실거래 조회를 전월세로 실행했는지 확인하세요.)
            </div>
          ) : (
            <>
              <CompareTable rows={jeonseRows} />
              <div className="mt-4">
                <BarChart title="시설별 전세 평균 평당가 — 시세 vs 실거래 (전용, 천원/평)" xName="시설"
                  rotateX={jeonseRows.length > 4 ? 30 : 0}
                  x={jeonseRows.map((r) => r.f)}
                  series={[
                    { name: '시세 평균', data: jeonseRows.map((r) => (r.sa.count ? Math.round(r.sa.avg) : null)), color: '#059669' },
                    { name: '실거래 평균', data: jeonseRows.map((r) => (r.ta.count ? Math.round(r.ta.avg) : null)), color: '#d97706' },
                  ]} />
              </div>
            </>
          )}

          {/* ═══════════ 3. 전세가율 검토 ═══════════ */}
          <SectionHead tone="violet" title="3. 전세가율 검토 — 시설별 매매·전세 통합 비교"
            desc="1번 매매 표와 2번 전세가 표를 시설별로 합치고, 각 항목(평균·상위10%·상위30%)별 전세가율(전세가 ÷ 매매가)을 산출합니다. 단위 천원/평." />

          {ratioRows.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
              전세가율을 검토할 데이터가 없습니다.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th rowSpan={2} className="px-3 py-2 text-left align-bottom">시설</th>
                      <th rowSpan={2} className="px-3 py-2 text-left align-bottom">가격 구분</th>
                      <th colSpan={4} className="border-l px-3 py-1 text-center">시세 (전용, 천원/평)</th>
                      <th colSpan={4} className="border-l px-3 py-1 text-center">실거래 (전용, 천원/평)</th>
                      <th rowSpan={2} className="border-l px-3 py-2 text-center align-bottom">시세/실거래<br/>괴리 (평균)</th>
                    </tr>
                    <tr className="text-xs">
                      <th className="border-l px-2 py-1">건수</th><th className="px-2 py-1">평균</th><th className="px-2 py-1">상위10%</th><th className="px-2 py-1">상위30%</th>
                      <th className="border-l px-2 py-1">건수</th><th className="px-2 py-1">평균</th><th className="px-2 py-1">상위10%</th><th className="px-2 py-1">상위30%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratioRows.map((r) => (
                      <Fragment key={r.f}>
                        <tr className="border-t">
                          <td rowSpan={3} className="px-3 py-1.5 align-top font-medium">{r.f}</td>
                          <td className="px-3 py-1.5 text-blue-700">매매가</td>
                          <td className="border-l px-2 py-1.5 text-center text-gray-500">{r.sale ? r.sale.sa.count : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.sale ? fmt(r.sale.sa.avg) : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.sale ? fmt(r.sale.sa.top10) : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.sale ? fmt(r.sale.sa.top30) : '-'}</td>
                          <td className="border-l px-2 py-1.5 text-center text-gray-500">{r.sale ? r.sale.ta.count : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.sale ? fmt(r.sale.ta.avg) : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.sale ? fmt(r.sale.ta.top10) : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.sale ? fmt(r.sale.ta.top30) : '-'}</td>
                          <td className={`border-l px-2 py-1.5 text-right font-medium ${r.sale && Number.isFinite(r.sale.gap) ? (r.sale.gap >= 0 ? 'text-red-600' : 'text-blue-600') : 'text-gray-400'}`}>
                            {r.sale && Number.isFinite(r.sale.gap) ? `${r.sale.gap >= 0 ? '+' : ''}${r.sale.gap.toFixed(1)}%` : '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-1.5 text-emerald-700">전세가</td>
                          <td className="border-l px-2 py-1.5 text-center text-gray-500">{r.jeonse ? r.jeonse.sa.count : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.jeonse ? fmt(r.jeonse.sa.avg) : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.jeonse ? fmt(r.jeonse.sa.top10) : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.jeonse ? fmt(r.jeonse.sa.top30) : '-'}</td>
                          <td className="border-l px-2 py-1.5 text-center text-gray-500">{r.jeonse ? r.jeonse.ta.count : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.jeonse ? fmt(r.jeonse.ta.avg) : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.jeonse ? fmt(r.jeonse.ta.top10) : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{r.jeonse ? fmt(r.jeonse.ta.top30) : '-'}</td>
                          <td className={`border-l px-2 py-1.5 text-right font-medium ${r.jeonse && Number.isFinite(r.jeonse.gap) ? (r.jeonse.gap >= 0 ? 'text-red-600' : 'text-blue-600') : 'text-gray-400'}`}>
                            {r.jeonse && Number.isFinite(r.jeonse.gap) ? `${r.jeonse.gap >= 0 ? '+' : ''}${r.jeonse.gap.toFixed(1)}%` : '-'}
                          </td>
                        </tr>
                        <tr className="bg-violet-50/40">
                          <td className="px-3 py-1.5 font-medium text-violet-700">전세가비율</td>
                          <td className="border-l px-2 py-1.5" />
                          <td className="px-2 py-1.5 text-right font-semibold text-violet-700">{fmtPct(r.siseRatio.avg)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-violet-700">{fmtPct(r.siseRatio.top10)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-violet-700">{fmtPct(r.siseRatio.top30)}</td>
                          <td className="border-l px-2 py-1.5" />
                          <td className="px-2 py-1.5 text-right font-semibold text-violet-700">{fmtPct(r.txRatio.avg)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-violet-700">{fmtPct(r.txRatio.top10)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-violet-700">{fmtPct(r.txRatio.top30)}</td>
                          <td className="border-l px-2 py-1.5" />
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <BarChart title="시설별 전세가율 — 시세 vs 실거래 (평균 기준, %)" xName="시설"
                  rotateX={ratioRows.length > 4 ? 30 : 0}
                  x={ratioRows.map((r) => r.f)}
                  series={[
                    { name: '시세 전세가율', data: ratioRows.map((r) => (Number.isFinite(r.siseRatio.avg) ? Math.round(r.siseRatio.avg * 10) / 10 : null)), color: '#7c3aed' },
                    { name: '실거래 전세가율', data: ratioRows.map((r) => (Number.isFinite(r.txRatio.avg) ? Math.round(r.txRatio.avg * 10) / 10 : null)), color: '#d97706' },
                  ]} />
              </div>
            </>
          )}

          {/* ═══════════ 4. 시세 — 평형대별 매매가/전세가 비교 ═══════════ */}
          <SectionHead tone="amber" title="4. 시세 — 평형대별·시설별 매매가/전세가 비교"
            desc="시세 데이터만으로 주거 시설의 평형대별(전용면적 기준) 매매·전세 평균 평당가를 비교하고, 각 시설 하단에 평형대별 전세가율(전세가 ÷ 매매가)을 표시합니다. 매매는 매매 거래만(월세환산 제외), 전세는 보증금 기준입니다. 단위 천원/평." />

          <BandCompareBlock sale={saleBand} jeonse={jeonseBand}
            chartTitle="시세 평형대별 매매·전세 평균 평당가 (전용면적 기준, 천원/평)"
            emptyMsg="평형대별로 집계할 시세 데이터가 없습니다." />

          {/* ═══════════ 5. 실거래 — 평형대별 매매가/전세가 비교 ═══════════ */}
          <SectionHead tone="rose" title="5. 실거래 — 평형대별·시설별 매매가/전세가 비교"
            desc="실거래 조회 결과만으로 주거 시설의 평형대별(전용면적 기준, 단독다가구는 연면적) 매매·전세 평균 평당가를 비교하고, 각 시설 하단에 평형대별 전세가율(전세가 ÷ 매매가)을 표시합니다. 전세는 보증금 기준이며 월세 실거래는 제외합니다. 단위 천원/평." />

          <BandCompareBlock sale={txSaleBand} jeonse={txJeonseBand}
            chartTitle="실거래 평형대별 매매·전세 평균 평당가 (전용면적 기준, 천원/평)"
            emptyMsg="평형대별로 집계할 실거래 데이터가 없습니다. (매매·전월세 실거래 조회를 실행했는지 확인하세요.)" />
        </>
      )}
      {txMeta && <p className="mt-4 text-xs text-gray-400">실거래 기준: {txMeta.region} · {txMeta.facility}·{txMeta.trade} · {txMeta.from}~{txMeta.to}</p>}
    </div>
  );
}
