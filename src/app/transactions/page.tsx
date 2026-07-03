'use client';
import { useMemo, useState } from 'react';
import { normalize, type TxRecord } from '@/lib/normalize';
import { aggregate } from '@/lib/calc/aggregate';
import { DEFAULT_CONFIG } from '@/lib/calc/constants';
import type { Facility, Trade } from '@/lib/molit';
import RegionPicker, { type RegionValue } from '@/components/RegionPicker';
import TxCharts from '@/components/TxCharts';
import { useStore } from '@/lib/store';

const FACILITIES: Facility[] = ['아파트', '오피스텔', '연립다세대', '단독다가구', '토지', '상업업무용'];
const PERIODS = [
  { key: 'all', label: '전체' },
  { key: '5', label: '준공 5년내' },
  { key: '10', label: '준공 10년내' },
] as const;

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = +from.slice(0, 4), m = +from.slice(4, 6);
  const ty = +to.slice(0, 4), tm = +to.slice(4, 6);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
    if (out.length > 60) break;
  }
  return out;
}

export default function TransactionsPage() {
  const [region, setRegion] = useState<RegionValue>({ sido: '서울특별시', lawdCd: '11560', dong: '영등포동8가' });
  const [facility, setFacility] = useState<Facility>('오피스텔');
  const [trade, setTrade] = useState<Trade>('매매');
  const [from, setFrom] = useState('202501');
  const [to, setTo] = useState('202506');
  const [period, setPeriod] = useState<string>('all');
  const [rows, setRows] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const setTxStore = useStore((st) => st.setTx);

  async function query() {
    setLoading(true); setErr(''); setRows([]);
    try {
      const months = monthsBetween(from, to);
      const all: TxRecord[] = [];
      for (const ymd of months) {
        const p = new URLSearchParams({ facility, trade, lawdCd: region.lawdCd, ymd, dong: region.dong });
        const res = await fetch(`/api/molit?${p}`);
        const j = await res.json();
        if (j.error) throw new Error(j.error);
        for (const it of j.items ?? []) all.push(normalize(facility, trade, it));
      }
      setRows(all);
      setTxStore(all, { facility, trade, region: `${region.sido} ${region.dong}`.trim(), from, to });
      if (all.length === 0) setErr('조회 결과가 없습니다. 기간·지역을 조정해 보세요.');
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  const thisYear = new Date().getFullYear();
  const filtered = useMemo(() => {
    if (period === 'all') return rows;
    const n = +period;
    return rows.filter((r) => r.buildYear != null && r.buildYear >= thisYear - n && r.buildYear <= thisYear);
  }, [rows, period, thisYear]);

  const agg = useMemo(() => {
    const ppas = filtered.map((r) => r.ppa).filter((v): v is number => v != null);
    return aggregate(ppas, DEFAULT_CONFIG.topPercentiles);
  }, [filtered]);

  // 값 있는 컬럼만 노출
  const cols = useMemo(() => {
    const defs: { key: keyof TxRecord; label: string; fmt?: (v: any) => string }[] = [
      { key: 'name', label: '시설명' },
      { key: 'dealType', label: '거래' },
      { key: 'dealDate', label: '거래일' },
      { key: 'buildYear', label: '준공연도' },
      { key: 'areaM2', label: '면적(㎡)' },
      { key: 'amountManwon', label: '금액(만원)', fmt: (v) => v?.toLocaleString() ?? '' },
      { key: 'depositManwon', label: '보증금(만원)', fmt: (v) => v?.toLocaleString() ?? '' },
      { key: 'monthlyRentManwon', label: '월세(만원)', fmt: (v) => v?.toLocaleString() ?? '' },
      { key: 'floor', label: '층' },
      { key: 'ppa', label: '평당가(천원/평)', fmt: (v) => v?.toLocaleString() ?? '' },
    ];
    return defs.filter((c) => filtered.some((r) => r[c.key] != null && r[c.key] !== ''));
  }, [filtered]);

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">실거래 조회 · 분석</h1>
      <p className="mb-4 text-sm text-gray-600">
        국토부 실거래가를 조회해 원본을 확인하고, 시설별 평당가 평균·상위% 를 집계합니다. &quot;준공 N년내&quot;는 준공연도 기준입니다.
      </p>

      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <RegionPicker value={region} onChange={setRegion} />
        <L label="시설유형">
          <select value={facility} onChange={(e) => setFacility(e.target.value as Facility)} className="rounded border px-2 py-1">
            {FACILITIES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </L>
        <L label="거래">
          <select value={trade} onChange={(e) => setTrade(e.target.value as Trade)} className="rounded border px-2 py-1">
            <option value="매매">매매</option><option value="전월세">전월세</option>
          </select>
        </L>
        <L label="기간(YYYYMM)">
          <div className="flex items-center gap-1">
            <input value={from} onChange={(e) => setFrom(e.target.value)} className="w-24 rounded border px-2 py-1" />
            <span>~</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} className="w-24 rounded border px-2 py-1" />
          </div>
        </L>
        <button onClick={query} disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? '조회 중…' : '조회'}
        </button>
      </div>

      {err && <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{err}</div>}

      {rows.length > 0 && (
        <>
          <div className="no-print mb-3 flex items-center gap-2">
            <span className="text-sm text-gray-500">준공연도 필터:</span>
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`rounded-full px-3 py-1 text-xs ${period === p.key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {p.label}
              </button>
            ))}
            <span className="ml-2 text-xs text-gray-400">기준: {facility}·{trade}, {filtered.length}건</span>
          </div>

          <div className="mb-4 grid grid-cols-4 gap-3">
            <Stat label="평균" v={agg.avg} />
            <Stat label="상위10% 평균" v={agg.top10} />
            <Stat label="상위30% 평균" v={agg.top30} />
            <Stat label="상위50% 평균" v={agg.top50} />
          </div>

          <TxCharts rows={filtered} />

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>{cols.map((c) => <th key={String(c.key)} className="whitespace-nowrap px-3 py-2 font-medium">{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-t">
                    {cols.map((c) => (
                      <td key={String(c.key)} className="whitespace-nowrap px-3 py-1.5">
                        {c.fmt ? c.fmt(r[c.key]) : (r[c.key] as any) ?? ''}
                      </td>
                    ))}
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

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-gray-500">{label}{children}</label>;
}
function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold">{Number.isFinite(v) ? Math.round(v).toLocaleString() : '-'}<span className="ml-1 text-xs font-normal text-gray-400">천원/평</span></div>
    </div>
  );
}
