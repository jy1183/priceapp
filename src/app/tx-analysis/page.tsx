'use client';
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import TxCharts from '@/components/TxCharts';
import {
  DEAL_TYPES, DEAL_LABELS, BUILD_BUCKETS, type DealType,
  filterByRecency, facilityAgg, facilityByDeal, facilityByRecency, facilityByAgeBucket,
} from '@/lib/txAnalysis';

const PERIODS = [
  { key: 'all', label: '전체' },
  { key: '5', label: '준공 5년내' },
  { key: '10', label: '준공 10년내' },
] as const;

const fmt = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : '-');

/** ④ 실거래 분석 — 엑셀 「실거래 데이터 분석」 시트 이식.
 *  거래방식 탭 + 시설별 집계 · 거래방식 교차 · 준공 최근성 · 준공 구간별 분석 */
export default function TxAnalysisPage() {
  const { tx, txMeta, config } = useStore();
  const [period, setPeriod] = useState('all');
  const [deal, setDeal] = useState<DealType>('매매');
  const thisYear = new Date().getFullYear();

  // 준공연도 필터 적용
  const filtered = useMemo(() => filterByRecency(tx, period, thisYear), [tx, period, thisYear]);
  // 선택 거래방식 rows
  const dealRows = useMemo(() => filtered.filter((r) => r.dealType === deal), [filtered, deal]);

  const aggRows = useMemo(() => facilityAgg(dealRows, config.topPercentiles), [dealRows, config]);
  const crossRows = useMemo(() => facilityByDeal(filtered), [filtered]);
  const recencyRows = useMemo(() => facilityByRecency(dealRows, thisYear), [dealRows, thisYear]);
  const bucketRows = useMemo(() => facilityByAgeBucket(dealRows, thisYear), [dealRows, thisYear]);

  const dealCounts = useMemo(() => {
    const c: Record<string, number> = { 매매: 0, 전세: 0, 월세: 0 };
    filtered.forEach((r) => { c[r.dealType] = (c[r.dealType] ?? 0) + 1; });
    return c;
  }, [filtered]);

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">실거래 분석</h1>
      <p className="mb-4 text-sm text-gray-600">
        <b>② 실거래 조회</b>로 가져온 실거래를 거래방식·준공연도별로 분석합니다. 단위 천원/평.
        전세·월세는 <b>환산 평당가</b>(전세환산·월세 매매환산) 기준입니다.
      </p>

      {tx.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          조회된 실거래가 없습니다. <Link href="/transactions" className="font-medium underline">② 실거래 조회</Link>를 먼저 실행하세요.
        </div>
      ) : (
        <>
          {/* 컨트롤: 거래방식 탭 + 준공연도 필터 */}
          <div className="no-print mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">거래방식:</span>
            {DEAL_TYPES.map((d) => (
              <button key={d} onClick={() => setDeal(d)}
                className={`rounded-full px-3 py-1 text-xs ${deal === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {DEAL_LABELS[d]} {dealCounts[d] ? `(${dealCounts[d]})` : ''}
              </button>
            ))}
            <span className="ml-3 text-sm text-gray-500">준공연도 필터:</span>
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`rounded-full px-3 py-1 text-xs ${period === p.key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}>{p.label}</button>
            ))}
            {txMeta && <span className="ml-2 text-xs text-gray-400">{txMeta.region} · {filtered.length}건 · {DEAL_LABELS[deal]} {dealRows.length}건</span>}
          </div>

          {/* 차트 */}
          <TxCharts rows={dealRows} dealLabel={DEAL_LABELS[deal]} />

          {/* A. 시설별 집계 (선택 거래방식) */}
          <Section title={`A. 시설별 평균·상위 평균 — ${DEAL_LABELS[deal]}`}
            note="선택 거래방식·준공필터 기준. 상위 n%평균 = 상위 백분위 이상 값들의 평균.">
            {aggRows.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr><th className="px-3 py-2">시설</th><th className="px-3 py-2">건수</th><Th>평균</Th><Th>상위50%</Th><Th>상위30%</Th><Th>상위10%</Th></tr>
                </thead>
                <tbody>
                  {aggRows.map((r) => (
                    <tr key={r.facility} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{r.facility}</td>
                      <td className="px-3 py-1.5">{r.agg.count}</td>
                      <Td>{fmt(r.agg.avg)}</Td><Td>{fmt(r.agg.top50)}</Td><Td>{fmt(r.agg.top30)}</Td><Td>{fmt(r.agg.top10)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* B. 시설별 × 거래방식 교차표 */}
          <Section title="B. 시설별 × 거래방식 평균 평당가"
            note="행=시설, 열=매매·전세환산·월세환산 평균. 준공필터만 적용. 데이터 없음은 '-'.">
            {crossRows.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr><th className="px-3 py-2">시설</th>{DEAL_TYPES.map((d) => <Th key={d}>{DEAL_LABELS[d]}</Th>)}</tr>
                </thead>
                <tbody>
                  {crossRows.map((r) => (
                    <tr key={r.facility} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{r.facility}</td>
                      {DEAL_TYPES.map((d) => (
                        <Td key={d}>{r.byDeal[d].count ? fmt(r.byDeal[d].avg) : '-'}
                          {r.byDeal[d].count ? <span className="ml-1 text-[10px] text-gray-400">{r.byDeal[d].count}</span> : null}</Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* C. 시설별 × 준공 최근성 */}
          <Section title={`C. 시설별 × 준공연도 최근성 — ${DEAL_LABELS[deal]}`}
            note={`준공연도 기준(거래일과 별개). 기준연도 ${thisYear}년: 최근5년=${thisYear - 5}~${thisYear}, 최근10년=${thisYear - 10}~${thisYear}.`}>
            {recencyRows.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr><th className="px-3 py-2">시설</th><Th>최근5년</Th><Th>최근10년</Th><Th>전체 평균</Th><th className="px-3 py-2 text-right">건수</th></tr>
                </thead>
                <tbody>
                  {recencyRows.map((r) => (
                    <tr key={r.facility} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{r.facility}</td>
                      <Td>{fmt(r.recent5)}</Td><Td>{fmt(r.recent10)}</Td><Td>{fmt(r.all)}</Td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* D. 준공연도 구간별 평균 */}
          <Section title={`D. 준공연도 구간별 평균 평당가 — ${DEAL_LABELS[deal]}`}
            note="준공경과(기준연도−준공연도) 구간별 평균. 셀 아래 작은 숫자는 건수. 준공연도 있는 건만 집계.">
            {bucketRows.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr><th className="px-3 py-2">시설</th>{BUILD_BUCKETS.map((b) => <Th key={b.key}>{b.label}</Th>)}</tr>
                </thead>
                <tbody>
                  {bucketRows.map((r) => (
                    <tr key={r.facility} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{r.facility}</td>
                      {BUILD_BUCKETS.map((b) => (
                        <Td key={b.key}>{r.cells[b.key].count ? fmt(r.cells[b.key].avg) : '-'}
                          {r.cells[b.key].count ? <span className="ml-1 text-[10px] text-gray-400">{r.cells[b.key].count}</span> : null}</Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="mb-0.5 text-base font-semibold">{title}</h2>
      {note && <p className="mb-2 text-xs text-gray-500">{note}</p>}
      <div className="overflow-x-auto rounded-lg border bg-white">{children}</div>
    </div>
  );
}
const Th = ({ children }: { children: ReactNode }) => <th className="px-3 py-2 text-right">{children}</th>;
const Td = ({ children }: { children: ReactNode }) => <td className="px-3 py-1.5 text-right">{children}</td>;
const Empty = () => <div className="px-3 py-3 text-sm text-gray-400">해당 조건의 데이터가 없습니다.</div>;
