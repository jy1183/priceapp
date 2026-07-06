'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { REB_STATS, rebStat, REB_NATIONWIDE_CLS, rebSidoName, findSidoCls, findGuCls, type RebItem } from '@/lib/reb';
import { sigunguName } from '@/lib/regions';
import { useStore } from '@/lib/store';
import KosisPopulation from '@/components/KosisPopulation';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
type Pt = { time: string; value: number };

/** 지역분석 — 부동산원 가격지수·거래현황 시계열 (Phase 4)
 *  지역선정: 실거래 조회지역(txForm) 기준 기준1(시도)·기준2(구)를 비교 */
export default function RegionPage() {
  const txForm = useStore((s) => s.txForm);
  const sggName = sigunguName(txForm.sido, txForm.lawdCd);     // 예: 영등포구

  const [statId, setStatId] = useState('sale_idx');
  const [items, setItems] = useState<RebItem[]>([]);
  const [sidoCls, setSidoCls] = useState('');   // 기준1 (시도)
  const [guCls, setGuCls] = useState('');       // 기준2 (구/동→구 폴백, 수동조정 가능)
  const [start, setStart] = useState('202301');
  const [end, setEnd] = useState('202506');
  const [sidoSeries, setSidoSeries] = useState<Pt[]>([]);
  const [guSeries, setGuSeries] = useState<Pt[]>([]);
  const [natl, setNatl] = useState<Pt[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const stat = rebStat(statId)!;

  // 통계 변경 시 지역 항목 로드 + 실거래 조회지역 기준 기준1/기준2 자동선택
  useEffect(() => {
    (async () => {
      setErr('');
      try {
        const r = await fetch(`/api/reb?mode=items&statbl=${stat.statbl}`);
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        const its: RebItem[] = j.items ?? [];
        setItems(its);
        const sido = findSidoCls(its, txForm.sido);
        const gu = findGuCls(its, txForm.sido, sggName);
        setSidoCls(sido?.clsId ?? '');
        setGuCls(gu?.clsId ?? sido?.clsId ?? '');
      } catch (e) { setErr(String(e)); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statId, txForm.sido, txForm.lawdCd]);

  async function load() {
    setLoading(true); setErr('');
    try {
      const base = `/api/reb?mode=data&statbl=${stat.statbl}&cycle=${stat.cycle}&start=${start}&end=${end}`;
      const [a, b, c] = await Promise.all([
        sidoCls ? fetch(`${base}&cls=${sidoCls}`).then((r) => r.json()) : Promise.resolve({ series: [] }),
        guCls ? fetch(`${base}&cls=${guCls}`).then((r) => r.json()) : Promise.resolve({ series: [] }),
        fetch(`${base}&cls=${REB_NATIONWIDE_CLS}`).then((r) => r.json()),
      ]);
      if (a.error) throw new Error(a.error);
      setSidoSeries(a.series ?? []);
      setGuSeries(b.series ?? []);
      setNatl(c.series ?? []);
      if ((a.series ?? []).length === 0 && (b.series ?? []).length === 0)
        setErr(a.message || b.message || '데이터가 없습니다(주기/기간 확인).');
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  const sidoName = rebSidoName(txForm.sido);
  const guName = items.find((i) => i.clsId === guCls)?.name ?? sggName ?? '구';
  const guIsFallbackToSido = guCls && guCls === sidoCls;

  // x축은 세 시리즈 시간의 합집합
  const times = useMemo(() => {
    const set = new Set<string>();
    [sidoSeries, guSeries, natl].forEach((s) => s.forEach((p) => set.add(p.time)));
    return Array.from(set).sort((x, y) => x.localeCompare(y));
  }, [sidoSeries, guSeries, natl]);
  const align = (s: Pt[]) => { const m = new Map(s.map((p) => [p.time, p.value])); return times.map((t) => m.get(t) ?? null); };

  const lineLabel = (color: string, pos: 'top' | 'bottom') => ({
    show: true, position: pos, fontSize: 9, color, formatter: (p: any) => (p.value == null ? '' : Number(p.value).toLocaleString()),
  });
  const option = useMemo(() => ({
    title: { text: `${stat.label} — 기준1(${sidoName}) vs 기준2(${guName})`, left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    legend: { bottom: 0, data: [`기준1 ${sidoName}(시도)`, `기준2 ${guName}`, '전국'] },
    grid: { left: 60, right: 20, top: 40, bottom: 45 },
    xAxis: { type: 'category', data: times },
    yAxis: { type: 'value', scale: true, name: stat.unit },
    series: [
      { name: `기준1 ${sidoName}(시도)`, type: 'line', smooth: true, connectNulls: true, data: align(sidoSeries),
        itemStyle: { color: '#2563eb' }, label: lineLabel('#2563eb', 'top') },
      { name: `기준2 ${guName}`, type: 'line', smooth: true, connectNulls: true, data: align(guSeries),
        itemStyle: { color: '#dc2626' }, label: lineLabel('#dc2626', 'bottom') },
      ...(natl.length ? [{ name: '전국', type: 'line', smooth: true, connectNulls: true, data: align(natl),
        itemStyle: { color: '#9ca3af' }, lineStyle: { type: 'dashed' }, label: { show: false } }] : []),
    ],
  }), [times, sidoSeries, guSeries, natl, stat, sidoName, guName]);

  const last = (s: Pt[]) => (s.length ? s[s.length - 1] : null);
  const hasData = sidoSeries.length > 0 || guSeries.length > 0;

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">지역분석 — 부동산원 통계</h1>
      <p className="mb-4 text-sm text-gray-600">
        실거래 조회지역 기준으로 <b>기준1(시도)</b>과 <b>기준2(구)</b>의 매매가격지수·전세·상가임대·거래현황을 비교합니다(전국 포함).
      </p>

      <div className="no-print mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
        실거래 조회지역: <b>{txForm.sido}</b> {sggName && <>&gt; <b>{sggName}</b></>} {txForm.dong && <>&gt; {txForm.dong}</>}
        <span className="ml-2 text-blue-700">→ 기준1 <b>{sidoName}</b>, 기준2 <b>{guName}</b>{guIsFallbackToSido && ' (구 지수 없음→시도로 대체)'}</span>
      </div>

      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <L label="통계">
          <select value={statId} onChange={(e) => setStatId(e.target.value)} className="rounded border px-2 py-1">
            {REB_STATS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </L>
        <L label="기준2 지역(구, 조정 가능)">
          <select value={guCls} onChange={(e) => setGuCls(e.target.value)} className="max-w-56 rounded border px-2 py-1">
            {items.map((i) => <option key={i.clsId} value={i.clsId}>{i.fullNm}</option>)}
          </select>
        </L>
        <L label="기간(YYYYMM)">
          <div className="flex items-center gap-1">
            <input value={start} onChange={(e) => setStart(e.target.value)} className="w-24 rounded border px-2 py-1" />
            <span>~</span>
            <input value={end} onChange={(e) => setEnd(e.target.value)} className="w-24 rounded border px-2 py-1" />
          </div>
        </L>
        <button onClick={load} disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? '조회 중…' : '조회'}
        </button>
        <span className="pb-1.5 text-xs text-gray-400">주기 {stat.cycle}</span>
      </div>

      {err && <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{err}</div>}

      {hasData && (
        <>
          <div className="mb-3 overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr><th className="px-3 py-2 text-left">구분</th><th className="px-3 py-2 text-left">지역</th>
                  <th className="px-3 py-2 text-right">시작({sidoSeries[0]?.time ?? guSeries[0]?.time ?? '-'})</th>
                  <th className="px-3 py-2 text-right">최근({last(sidoSeries)?.time ?? last(guSeries)?.time ?? '-'})</th>
                  <th className="px-3 py-2 text-right">변동</th></tr>
              </thead>
              <tbody>
                {[{ tag: '기준1(시도)', nm: sidoName, s: sidoSeries },
                  { tag: '기준2(구)', nm: guName, s: guSeries },
                  { tag: '전국', nm: '전국', s: natl }].map((r) => {
                  const f = r.s[0]?.value, l = last(r.s)?.value;
                  const d = f != null && l != null ? l - f : null;
                  return r.s.length ? (
                    <tr key={r.tag} className="border-t">
                      <td className="px-3 py-2">{r.tag}</td><td className="px-3 py-2">{r.nm}</td>
                      <td className="px-3 py-2 text-right">{f?.toLocaleString() ?? '-'}</td>
                      <td className="px-3 py-2 text-right font-medium">{l?.toLocaleString() ?? '-'}</td>
                      <td className={`px-3 py-2 text-right ${d != null && d < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {d != null ? (d > 0 ? '+' : '') + d.toLocaleString() : '-'}</td>
                    </tr>) : null;
                })}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border bg-white p-2"><ReactECharts option={option} style={{ height: 380 }} /></div>
        </>
      )}

      <KosisPopulation />
    </div>
  );
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-gray-500">{label}{children}</label>;
}
