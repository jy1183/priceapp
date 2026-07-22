'use client';
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import BarChart from '@/components/BarChart';
import {
  DEAL_TYPES, DEAL_LABELS, BUILD_BUCKETS, type DealType,
  facilityAgg, facilityByRecency, facilityByAgeBucket,
  topBuildings,
} from '@/lib/txAnalysis';
import { AREA_BANDS, bandByFacility, bandByRecency, bandCountByFacility } from '@/lib/areaBands';
import { facilityWithBasis } from '@/lib/normalize';

/** 시설별 시리즈 색상 팔레트 */
const FAC_COLORS = ['#1d4ed8', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#65a30d'];

const fmt = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : '-');
/** 차트용: 유한값이면 반올림, 아니면 null(막대 생략) */
const chartVal = (v: number): number | null => (Number.isFinite(v) ? Math.round(v) : null);
/** YYYYMM → YYYY.MM (조회기간 표기용) */
const fmtYm = (v: string) => (/^\d{6}$/.test(v) ? `${v.slice(0, 4)}.${v.slice(4)}` : v);

/** ④ 실거래 분석 — 엑셀 「실거래 데이터 분석」 시트 이식.
 *  거래방식 탭 + 각 블록을 표 → 차트 순으로 표시 */
export default function TxAnalysisPage() {
  const { tx, txMeta, config } = useStore();
  const [deal, setDeal] = useState<DealType>('매매');
  const thisYear = new Date().getFullYear();

  const dealRows = useMemo(() => tx.filter((r) => r.dealType === deal), [tx, deal]);

  const aggRows = useMemo(() => facilityAgg(dealRows, config.topPercentiles), [dealRows, config]);
  const topBld = useMemo(() => topBuildings(dealRows, 10), [dealRows]);
  const recencyRows = useMemo(() => facilityByRecency(dealRows, thisYear), [dealRows, thisYear]);
  const bucketRows = useMemo(() => facilityByAgeBucket(dealRows, thisYear), [dealRows, thisYear]);
  const bandFac = useMemo(() => bandByFacility(dealRows), [dealRows]);
  const bandRec = useMemo(() => bandByRecency(dealRows, thisYear), [dealRows, thisYear]);
  const bandCnt = useMemo(() => bandCountByFacility(dealRows), [dealRows]);

  const dealCounts = useMemo(() => {
    const c: Record<string, number> = { 매매: 0, 전세: 0, 월세: 0 };
    tx.forEach((r) => { c[r.dealType] = (c[r.dealType] ?? 0) + 1; });
    return c;
  }, [tx]);

  const dl = DEAL_LABELS[deal];

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">실거래 분석</h1>
      <p className="mb-4 text-sm text-gray-600">
        <b>② 실거래 조회</b>로 가져온 실거래를 거래방식·준공연도별로 분석합니다. 단위 천원/평.
        전세·월세는 <b>환산 평당가</b>(전세환산·월세 매매환산) 기준입니다. 각 블록은 표를 먼저, 이어서 차트를 표시합니다.
        <br />평당가 면적 기준 — 아파트·오피스텔·연립다세대: 전용 / 단독다가구: 대지 / 토지: 계약 / 상업업무용: 연면적.
      </p>

      {tx.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          조회된 실거래가 없습니다. <Link href="/transactions" className="font-medium underline">② 실거래 조회</Link>를 먼저 실행하세요.
        </div>
      ) : (
        <>
          {/* 컨트롤: 거래방식 탭 */}
          <div className="no-print mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">거래방식:</span>
            {DEAL_TYPES.map((d) => (
              <button key={d} onClick={() => setDeal(d)}
                className={`rounded-full px-3 py-1 text-xs ${deal === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {DEAL_LABELS[d]} {dealCounts[d] ? `(${dealCounts[d]})` : ''}
              </button>
            ))}
            {txMeta && <span className="ml-2 text-xs text-gray-400">{txMeta.region} · {tx.length}건 · {dl} {dealRows.length}건</span>}
          </div>

          {/* 1. 시설별 평균·상위 평균 (표 → 차트) */}
          <Section title={`1. 시설별 평균·상위 평균 — ${dl}`}
            note="상위 n%평균 = 상위 백분위 이상 값들의 평균.">
            {aggRows.length === 0 ? <Empty /> : (
              <>
                <TableBox>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr><th className="px-3 py-2">시설</th><th className="px-3 py-2">건수</th><Th>평균 평당가</Th><Th>상위50%</Th><Th>상위30%</Th><Th>상위10%</Th></tr>
                    </thead>
                    <tbody>
                      {aggRows.map((r) => (
                        <tr key={r.facility} className="border-t">
                          <td className="px-3 py-1.5 font-medium">{facilityWithBasis(r.facility)}</td>
                          <td className="px-3 py-1.5">{r.agg.count}</td>
                          <Td>{fmt(r.agg.avg)}</Td><Td>{fmt(r.agg.top50)}</Td><Td>{fmt(r.agg.top30)}</Td><Td>{fmt(r.agg.top10)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableBox>
                <BarChart title={`시설별 평균·상위 평균 (${dl}, 천원/평)`} xName="시설"
                  x={aggRows.map((r) => facilityWithBasis(r.facility))}
                  series={[
                    { name: '평균', data: aggRows.map((r) => chartVal(r.agg.avg)), color: '#93c5fd' },
                    { name: '상위50%', data: aggRows.map((r) => chartVal(r.agg.top50)), color: '#60a5fa' },
                    { name: '상위30%', data: aggRows.map((r) => chartVal(r.agg.top30)), color: '#3b82f6' },
                    { name: '상위10%', data: aggRows.map((r) => chartVal(r.agg.top10)), color: '#1d4ed8' },
                  ]} />
              </>
            )}
          </Section>

          {/* 2. 건물(단지)별 상위 10 (표 → 차트) */}
          <Section title={`2. 건물(단지)별 상위 10 평균 평당가 — ${dl}`}
            note="선택 거래방식 기준. 실거래 건물명(아파트·오피스텔명 등)별 평균 평당가 상위 10개.">
            {topBld.length === 0 ? <Empty /> : (
              <>
                <TableBox>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr><th className="px-3 py-2">순위</th><th className="px-3 py-2">건물(단지)</th><th className="px-3 py-2">준공연도</th><th className="px-3 py-2 text-right">건수</th><Th>평균 평당가(전용)</Th></tr>
                    </thead>
                    <tbody>
                      {topBld.map((r, i) => (
                        <tr key={r.name} className="border-t">
                          <td className="px-3 py-1.5 font-medium">{i + 1}</td>
                          <td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5">{r.buildYears.length ? r.buildYears.join('·') : '-'}</td>
                          <td className="px-3 py-1.5 text-right text-gray-500">{r.count}</td>
                          <Td>{fmt(r.avg)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableBox>
                <BarChart title={`건물(단지)별 상위 10 평균 평당가 (${dl}, 천원/평)`} xName="건물" rotateX={30}
                  x={topBld.map((r) => r.name)}
                  series={[{ name: '평균 평당가', data: topBld.map((r) => chartVal(r.avg)), color: '#2563eb' }]} />
              </>
            )}
          </Section>

          {/* 3. 시설별 × 준공연도 기간별 (표 → 차트) */}
          <Section title={`3. 시설별 × 준공연도 기간별 평균 평당가 — ${dl}`}
            note={`준공연도 기준(거래일과 별개). 기준연도 ${thisYear}년: 최근5년=${thisYear - 5}~${thisYear}, 최근10년=${thisYear - 10}~${thisYear}.`}>
            {recencyRows.length === 0 ? <Empty /> : (
              <>
                <TableBox>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr><th className="px-3 py-2">시설</th><Th>최근5년</Th><Th>최근10년</Th><Th>전체 평균</Th><th className="px-3 py-2 text-right">건수</th></tr>
                    </thead>
                    <tbody>
                      {recencyRows.map((r) => (
                        <tr key={r.facility} className="border-t">
                          <td className="px-3 py-1.5 font-medium">{facilityWithBasis(r.facility)}</td>
                          <Td>{fmt(r.recent5)}</Td><Td>{fmt(r.recent10)}</Td><Td>{fmt(r.all)}</Td>
                          <td className="px-3 py-1.5 text-right text-gray-500">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableBox>
                <BarChart title={`시설별 × 준공연도 기간별 평균 평당가 (${dl}, 천원/평)`} xName="시설"
                  x={recencyRows.map((r) => facilityWithBasis(r.facility))}
                  series={[
                    { name: '최근5년', data: recencyRows.map((r) => chartVal(r.recent5)), color: '#1d4ed8' },
                    { name: '최근10년', data: recencyRows.map((r) => chartVal(r.recent10)), color: '#60a5fa' },
                    { name: '전체', data: recencyRows.map((r) => chartVal(r.all)), color: '#cbd5e1' },
                  ]} />
              </>
            )}
          </Section>

          {/* 4. 준공연도 구간별 평균 (표 → 차트) */}
          <Section title={`4. 준공연도 구간별 평균 평당가 — ${dl}`}
            note="준공경과(기준연도−준공연도) 구간별 평균. 셀 아래 작은 숫자는 건수. 준공연도 있는 건만 집계.">
            {bucketRows.length === 0 ? <Empty /> : (
              <>
                <TableBox>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr><th className="px-3 py-2">시설</th>{BUILD_BUCKETS.map((b) => <Th key={b.key}>{b.label}</Th>)}</tr>
                    </thead>
                    <tbody>
                      {bucketRows.map((r) => (
                        <tr key={r.facility} className="border-t">
                          <td className="px-3 py-1.5 font-medium">{facilityWithBasis(r.facility)}</td>
                          {BUILD_BUCKETS.map((b) => (
                            <Td key={b.key}>{r.cells[b.key].count ? fmt(r.cells[b.key].avg) : '-'}
                              {r.cells[b.key].count ? <span className="ml-1 text-[10px] text-gray-400">{r.cells[b.key].count}</span> : null}</Td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableBox>
                <BarChart title={`준공연도 구간별 평균 평당가 (${dl}, 천원/평)`} xName="준공경과"
                  x={BUILD_BUCKETS.map((b) => b.label)}
                  series={bucketRows.map((r, i) => ({
                    name: facilityWithBasis(r.facility),
                    data: BUILD_BUCKETS.map((b) => (r.cells[b.key].count ? chartVal(r.cells[b.key].avg) : null)),
                    color: ['#1d4ed8', '#059669', '#d97706', '#7c3aed', '#dc2626'][i % 5],
                  }))} />
              </>
            )}
          </Section>

          {/* 5. 평형대별 평균 가격 분석 (표 → 차트) */}
          <Section title={`5. 평형대별 평균 가격 분석 (전용면적 기준) — ${dl}`}
            note="주거 상품(아파트·오피스텔·연립다세대·단독다가구)만 집계. 전용면적 기준 구분이며, 단독다가구는 전용면적이 제공되지 않아 연면적으로 분류. 토지·상업업무용 제외. 환산가 미산출(0)·결측 행은 평균에서 제외. 셀 아래 작은 숫자는 건수.">
            {bandFac.facilities.length === 0 ? <Empty /> : (
              <>
                <TableBox>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr><th className="px-3 py-2">시설</th>{AREA_BANDS.map((b) => <Th key={b.key}>{b.label}</Th>)}</tr>
                    </thead>
                    <tbody>
                      {bandFac.facilities.map((f) => (
                        <tr key={f} className="border-t">
                          <td className="px-3 py-1.5 font-medium">{facilityWithBasis(f)}</td>
                          {AREA_BANDS.map((b) => {
                            const c = bandFac.cells[f][b.key];
                            return <Td key={b.key}>{c.count ? fmt(c.avg) : '-'}
                              {c.count ? <span className="ml-1 text-[10px] text-gray-400">{c.count}</span> : null}</Td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableBox>
                <BarChart title={`평형대별 평균 평당가 (${dl}, 천원/평)`} xName="평형대" wrapX
                  x={AREA_BANDS.map((b) => b.label)}
                  series={bandFac.facilities.map((f, i) => ({
                    name: facilityWithBasis(f),
                    data: AREA_BANDS.map((b) => (bandFac.cells[f][b.key].count ? chartVal(bandFac.cells[f][b.key].avg) : null)),
                    color: FAC_COLORS[i % FAC_COLORS.length],
                  }))} />
              </>
            )}
          </Section>

          {/* 5-b. 준공연도 × 평형대별 평균 가격 (표 → 차트) */}
          <Section title={`5-b. 준공연도 × 평형대별 평균 가격 — ${dl}`}
            note={`주거 상품만 집계(전용면적 기준, 단독다가구는 연면적으로 분류). "최근 N년"은 준공연도 기준(거래일과 별개). 기준연도 ${thisYear}년: 최근5년=${thisYear - 5}~${thisYear}, 최근10년=${thisYear - 10}~${thisYear}. 환산가 미산출(0)·결측 행 제외.`}>
            {bandRec.rows.every((row) => AREA_BANDS.every((b) => row.cells[b.key].count === 0)) ? <Empty /> : (
              <>
                <TableBox>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr><th className="px-3 py-2">준공연도</th>{AREA_BANDS.map((b) => <Th key={b.key}>{b.label}</Th>)}</tr>
                    </thead>
                    <tbody>
                      {bandRec.rows.map((row) => (
                        <tr key={row.key} className="border-t">
                          <td className="px-3 py-1.5 font-medium">{row.label}</td>
                          {AREA_BANDS.map((b) => {
                            const c = row.cells[b.key];
                            return <Td key={b.key}>{c.count ? fmt(c.avg) : '-'}
                              {c.count ? <span className="ml-1 text-[10px] text-gray-400">{c.count}</span> : null}</Td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableBox>
                <BarChart title={`준공연도 × 평형대별 평균 평당가 (${dl}, 천원/평)`} xName="평형대" wrapX
                  x={AREA_BANDS.map((b) => b.label)}
                  series={bandRec.rows.map((row, i) => ({
                    name: row.label,
                    data: AREA_BANDS.map((b) => (row.cells[b.key].count ? chartVal(row.cells[b.key].avg) : null)),
                    color: ['#1d4ed8', '#60a5fa', '#cbd5e1'][i],
                  }))} />
              </>
            )}
          </Section>

          {/* 6. 평형대별 거래 건수 (표 → 차트) — 제목에 실거래 조회 기간 표시 */}
          <Section title={`6. 평형대별 거래 건수 — ${dl}${txMeta ? ` (조회기간 ${fmtYm(txMeta.from)}~${fmtYm(txMeta.to)})` : ''}`}
            note="주거 상품만 집계(전용면적 기준, 단독다가구는 연면적으로 분류). 건수 집계이므로 환산가 미산출(0) 행도 포함 — 평균 블록의 건수와 다를 수 있음. 조회기간은 ② 실거래 조회의 기본 조회 조건 기준(추가 조회분은 별도).">
            {bandCnt.facilities.length === 0 ? <Empty /> : (
              <>
                <TableBox>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr><th className="px-3 py-2">시설</th>{AREA_BANDS.map((b) => <Th key={b.key}>{b.label}</Th>)}</tr>
                    </thead>
                    <tbody>
                      {bandCnt.facilities.map((f) => (
                        <tr key={f} className="border-t">
                          <td className="px-3 py-1.5 font-medium">{facilityWithBasis(f)}</td>
                          {AREA_BANDS.map((b) => <Td key={b.key}>{bandCnt.cells[f][b.key] ? bandCnt.cells[f][b.key].toLocaleString() : '-'}</Td>)}
                        </tr>
                      ))}
                      <tr className="border-t bg-gray-50 font-medium">
                        <td className="px-3 py-1.5">전체</td>
                        {AREA_BANDS.map((b) => <Td key={b.key}>{bandCnt.totals[b.key] ? bandCnt.totals[b.key].toLocaleString() : '-'}</Td>)}
                      </tr>
                    </tbody>
                  </table>
                </TableBox>
                <BarChart title={`평형대별 거래 건수 (${dl}, 건)`} xName="평형대" wrapX
                  x={AREA_BANDS.map((b) => b.label)}
                  series={bandCnt.facilities.map((f, i) => ({
                    name: facilityWithBasis(f),
                    data: AREA_BANDS.map((b) => (bandCnt.cells[f][b.key] ? bandCnt.cells[f][b.key] : null)),
                    color: FAC_COLORS[i % FAC_COLORS.length],
                  }))} />
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-0.5 text-base font-semibold">{title}</h2>
      {note && <p className="mb-2 text-xs text-gray-500">{note}</p>}
      {children}
    </div>
  );
}
const TableBox = ({ children }: { children: ReactNode }) => <div className="overflow-x-auto rounded-lg border bg-white">{children}</div>;
const Th = ({ children }: { children: ReactNode }) => <th className="px-3 py-2 text-right">{children}</th>;
const Td = ({ children }: { children: ReactNode }) => <td className="px-3 py-1.5 text-right">{children}</td>;
const Empty = () => <div className="rounded-lg border bg-white px-3 py-3 text-sm text-gray-400">해당 조건의 데이터가 없습니다.</div>;
