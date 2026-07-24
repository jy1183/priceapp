'use client';
import { useMemo, useState } from 'react';
import { normalize, type TxRecord } from '@/lib/normalize';
import type { Facility, Trade } from '@/lib/molit';
import RegionPicker, { type RegionValue } from '@/components/RegionPicker';
import { useStore } from '@/lib/store';

const FACILITIES: Facility[] = ['아파트', '오피스텔', '연립다세대', '단독다가구', '토지', '상업업무용'];

/** 헤더 클릭 드롭다운 필터를 지원하는 컬럼 */
const FILTERABLE = new Set<keyof TxRecord>(['name', 'dealType']);

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

/** 조회 조건 1건 (기본 조회 + 추가 조회 라인 공용) */
interface QueryForm {
  sido: string; lawdCd: string; dong: string;
  facility: Facility; trade: Trade; from: string; to: string;
}

/** 국토부 실거래 조회 (기본·추가 조회 공용 헬퍼) */
async function fetchTx(f: Pick<QueryForm, 'lawdCd' | 'dong' | 'facility' | 'trade' | 'from' | 'to'>): Promise<TxRecord[]> {
  const months = monthsBetween(f.from, f.to);
  const all: TxRecord[] = [];
  for (const ymd of months) {
    const p = new URLSearchParams({ facility: f.facility, trade: f.trade, lawdCd: f.lawdCd, ymd, dong: f.dong });
    const res = await fetch(`/api/molit?${p}`);
    const j = await res.json();
    if (j.error) throw new Error(j.error);
    for (const it of j.items ?? []) all.push(normalize(f.facility, f.trade, it));
  }
  return all;
}

let _qid = 1;

export default function TransactionsPage() {
  const txForm = useStore((st) => st.txForm);
  const setTxForm = useStore((st) => st.setTxForm);
  const rows = useStore((st) => st.tx);            // 표시 소스 = 스토어(유지)
  const setTxStore = useStore((st) => st.setTx);
  const appendTx = useStore((st) => st.appendTx);
  const region: RegionValue = { sido: txForm.sido, lawdCd: txForm.lawdCd, dong: txForm.dong };
  const setRegion = (r: RegionValue) => setTxForm({ sido: r.sido, lawdCd: r.lawdCd, dong: r.dong });
  const facility = txForm.facility as Facility;
  const setFacility = (v: Facility) => setTxForm({ facility: v });
  const trade = txForm.trade as Trade;
  const setTrade = (v: Trade) => setTxForm({ trade: v });
  const from = txForm.from, to = txForm.to;
  const setFrom = (v: string) => setTxForm({ from: v });
  const setTo = (v: string) => setTxForm({ to: v });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // 헤더 드롭다운 필터: 컬럼별 "표시할 값" 집합 (없으면 전체 표시)
  const [filters, setFilters] = useState<Partial<Record<keyof TxRecord, Set<string>>>>({});
  const [openFilter, setOpenFilter] = useState<keyof TxRecord | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  // 추가 조회 라인 (기존 데이터에 누적)
  const [extras, setExtras] = useState<(QueryForm & { id: number })[]>([]);
  const [extraState, setExtraState] = useState<Record<number, { loading: boolean; err: string; added: number | null }>>({});

  async function query() {
    setLoading(true); setErr(''); setFilters({}); setOpenFilter(null);
    try {
      const all = await fetchTx({ lawdCd: region.lawdCd, dong: region.dong, facility, trade, from, to });
      setTxStore(all, { facility, trade, region: `${region.sido} ${region.dong}`.trim(), from, to });
      if (all.length === 0) setErr('조회 결과가 없습니다. 기간·지역을 조정해 보세요.');
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  function addQueryLine() {
    // 현재 기본 조회 조건을 초기값으로 복사
    setExtras((xs) => [...xs, { id: _qid++, sido: region.sido, lawdCd: region.lawdCd, dong: region.dong, facility, trade, from, to }]);
  }
  function updateExtra(id: number, patch: Partial<QueryForm>) {
    setExtras((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeExtra(id: number) {
    setExtras((xs) => xs.filter((x) => x.id !== id));
    setExtraState((s) => { const n = { ...s }; delete n[id]; return n; });
  }
  async function runExtra(f: QueryForm & { id: number }) {
    setExtraState((s) => ({ ...s, [f.id]: { loading: true, err: '', added: null } }));
    try {
      const got = await fetchTx(f);
      if (got.length === 0) { setExtraState((s) => ({ ...s, [f.id]: { loading: false, err: '조회 결과가 없습니다.', added: null } })); return; }
      appendTx(got);
      setExtraState((s) => ({ ...s, [f.id]: { loading: false, err: '', added: got.length } }));
    } catch (e) { setExtraState((s) => ({ ...s, [f.id]: { loading: false, err: String(e), added: null } })); }
  }

  // 값 있는 컬럼만 노출
  const cols = useMemo(() => {
    const defs: { key: keyof TxRecord; label: string; fmt?: (v: any) => string }[] = [
      { key: 'facility', label: '유형' },
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
    return defs.filter((c) => rows.some((r) => r[c.key] != null && r[c.key] !== ''));
  }, [rows]);

  // 필터 컬럼별 고유값 목록 (드롭다운 옵션)
  const distinct = useMemo(() => {
    const m: Partial<Record<keyof TxRecord, string[]>> = {};
    for (const key of FILTERABLE) {
      const s = new Set<string>();
      for (const r of rows) { const v = r[key]; if (v != null && v !== '') s.add(String(v)); }
      m[key] = [...s].sort((a, b) => a.localeCompare(b, 'ko'));
    }
    return m;
  }, [rows]);

  // 활성 필터를 모두 통과한 행만 표시
  const filteredRows = useMemo(() => rows.filter((r) =>
    (Object.entries(filters) as [keyof TxRecord, Set<string>][])
      .every(([k, set]) => !set || set.has(String(r[k])))
  ), [rows, filters]);

  function openFilterFor(key: keyof TxRecord) {
    setFilterSearch('');
    setOpenFilter((cur) => (cur === key ? null : key));
    // 최초 열 때는 전체 선택 상태로 초기화
    setFilters((f) => (f[key] ? f : { ...f, [key]: new Set(distinct[key]) }));
  }
  function toggleFilterValue(key: keyof TxRecord, val: string) {
    setFilters((f) => {
      const cur = new Set(f[key] ?? distinct[key]);
      if (cur.has(val)) cur.delete(val); else cur.add(val);
      return { ...f, [key]: cur };
    });
  }
  function setAllFilter(key: keyof TxRecord, all: boolean) {
    setFilters((f) => ({ ...f, [key]: new Set(all ? distinct[key] : []) }));
  }
  // 필터가 걸려 일부만 표시 중인 컬럼인지
  const isFiltered = (key: keyof TxRecord) => {
    const set = filters[key];
    return !!set && set.size < (distinct[key]?.length ?? 0);
  };

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">실거래 조회 · 분석</h1>
      <p className="mb-4 text-sm text-gray-600">
        국토부 실거래가를 조회해 원본을 확인합니다.
        <br />평당가 기준 — 아파트·오피스텔·연립다세대: 전용 / 단독다가구: 대지 / 토지: 계약 / 상업업무용: 연면적.
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
        <button onClick={addQueryLine}
          className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">
          + 조회 추가
        </button>
      </div>

      {extras.length > 0 && (
        <div className="no-print mb-4 space-y-3">
          <p className="text-xs text-gray-500">추가 조회 — 지역·시설·거래·기간을 설정하고 &quot;조회(추가)&quot;하면 기존 데이터 아래에 누적됩니다.</p>
          {extras.map((f) => {
            const stt = extraState[f.id] ?? { loading: false, err: '', added: null };
            return (
              <div key={f.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                <RegionPicker
                  value={{ sido: f.sido, lawdCd: f.lawdCd, dong: f.dong }}
                  onChange={(r) => updateExtra(f.id, { sido: r.sido, lawdCd: r.lawdCd, dong: r.dong })}
                />
                <L label="시설유형">
                  <select value={f.facility} onChange={(e) => updateExtra(f.id, { facility: e.target.value as Facility })} className="rounded border px-2 py-1">
                    {FACILITIES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </L>
                <L label="거래">
                  <select value={f.trade} onChange={(e) => updateExtra(f.id, { trade: e.target.value as Trade })} className="rounded border px-2 py-1">
                    <option value="매매">매매</option><option value="전월세">전월세</option>
                  </select>
                </L>
                <L label="기간(YYYYMM)">
                  <div className="flex items-center gap-1">
                    <input value={f.from} onChange={(e) => updateExtra(f.id, { from: e.target.value })} className="w-24 rounded border px-2 py-1" />
                    <span>~</span>
                    <input value={f.to} onChange={(e) => updateExtra(f.id, { to: e.target.value })} className="w-24 rounded border px-2 py-1" />
                  </div>
                </L>
                <button onClick={() => runExtra(f)} disabled={stt.loading}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  {stt.loading ? '조회 중…' : '조회(추가)'}
                </button>
                <button onClick={() => removeExtra(f.id)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">삭제</button>
                {stt.added != null && <span className="pb-1.5 text-xs font-medium text-emerald-700">+{stt.added}건 추가됨</span>}
                {stt.err && <span className="pb-1.5 text-xs text-amber-700">{stt.err}</span>}
              </div>
            );
          })}
        </div>
      )}

      {err && <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{err}</div>}

      {rows.length > 0 && (
        <>
          <div className="no-print mb-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">
              기준: {facility}·{trade}, {rows.length}건
              {filteredRows.length !== rows.length && ` · 필터 ${filteredRows.length}건`}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>{cols.map((c) => (
                  <th key={String(c.key)} className="whitespace-nowrap px-3 py-2 font-medium">
                    {FILTERABLE.has(c.key) ? (
                      <FilterHeader
                        label={c.label}
                        active={isFiltered(c.key)}
                        open={openFilter === c.key}
                        values={distinct[c.key] ?? []}
                        selected={filters[c.key] ?? new Set(distinct[c.key])}
                        search={filterSearch}
                        onSearch={setFilterSearch}
                        onToggle={() => openFilterFor(c.key)}
                        onToggleValue={(v) => toggleFilterValue(c.key, v)}
                        onSelectAll={() => setAllFilter(c.key, true)}
                        onClear={() => setAllFilter(c.key, false)}
                      />
                    ) : c.label}
                  </th>
                ))}</tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
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

/** 표 머릿글 드롭다운 필터 (체크박스 다중선택 + 검색) */
function FilterHeader({
  label, active, open, values, selected, search,
  onSearch, onToggle, onToggleValue, onSelectAll, onClear,
}: {
  label: string; active: boolean; open: boolean;
  values: string[]; selected: Set<string>; search: string;
  onSearch: (v: string) => void; onToggle: () => void;
  onToggleValue: (v: string) => void; onSelectAll: () => void; onClear: () => void;
}) {
  const shown = values.filter((v) => v.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="relative inline-block">
      <button type="button" onClick={onToggle}
        className={`flex items-center gap-1 font-medium ${active ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
        {label}
        <span className="text-[9px] leading-none">{active ? '●' : '▾'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggle} />
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border bg-white p-2 shadow-lg">
            <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="검색"
              className="mb-2 w-full rounded border px-2 py-1 text-xs font-normal" />
            <div className="mb-1.5 flex justify-between text-xs">
              <button type="button" onClick={onSelectAll} className="text-blue-600 hover:underline">전체 선택</button>
              <button type="button" onClick={onClear} className="text-gray-500 hover:underline">해제</button>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {shown.map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs font-normal text-gray-700 hover:bg-gray-50">
                  <input type="checkbox" checked={selected.has(v)} onChange={() => onToggleValue(v)} />
                  <span className="truncate" title={v}>{v}</span>
                </label>
              ))}
              {shown.length === 0 && <div className="px-1 py-2 text-xs text-gray-400">결과 없음</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
