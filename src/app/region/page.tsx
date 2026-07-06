'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { REB_STATS, rebStat } from '@/lib/reb';
import KosisPopulation from '@/components/KosisPopulation';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
type Pt = { time: string; value: number };
type Item = { clsId: string; name: string };

/** 지역분석 — 부동산원 가격지수·거래현황 시계열 (Phase 4) */
export default function RegionPage() {
  const [statId, setStatId] = useState('sale_idx');
  const [items, setItems] = useState<Item[]>([]);
  const [cls, setCls] = useState('500008');
  const [start, setStart] = useState('202301');
  const [end, setEnd] = useState('202506');
  const [series, setSeries] = useState<Pt[]>([]);
  const [natl, setNatl] = useState<Pt[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const stat = rebStat(statId)!;

  useEffect(() => {
    (async () => {
      setErr('');
      try {
        const r = await fetch(`/api/reb?mode=items&statbl=${stat.statbl}`);
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        setItems(j.items ?? []);
        if (j.items?.length && !j.items.find((x: Item) => x.clsId === cls)) setCls(j.items[0].clsId);
      } catch (e) { setErr(String(e)); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statId]);

  async function load() {
    setLoading(true); setErr('');
    try {
      const base = `/api/reb?mode=data&statbl=${stat.statbl}&cycle=${stat.cycle}&start=${start}&end=${end}`;
      const [a, b] = await Promise.all([
        fetch(`${base}&cls=${cls}`).then((r) => r.json()),
        fetch(`${base}&cls=500001`).then((r) => r.json()),
      ]);
      if (a.error) throw new Error(a.error);
      setSeries(a.series ?? []);
      setNatl(b.series ?? []);
      if ((a.series ?? []).length === 0) setErr(a.message || '데이터가 없습니다(주기/기간 확인).');
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  const regionName = items.find((i) => i.clsId === cls)?.name ?? cls;
  const option = useMemo(() => ({
    title: { text: `${stat.label} — ${regionName}`, left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    legend: { bottom: 0, data: [regionName, '전국'] },
    grid: { left: 60, right: 20, top: 40, bottom: 45 },
    xAxis: { type: 'category', data: series.map((p) => p.time) },
    yAxis: { type: 'value', scale: true, name: stat.unit },
    series: [
      { name: regionName, type: 'line', smooth: true, data: series.map((p) => p.value), itemStyle: { color: '#2563eb' },
        label: { show: true, position: 'top', fontSize: 9, formatter: (p: any) => Number(p.value).toLocaleString() } },
      ...(natl.length ? [{ name: '전국', type: 'line', smooth: true, data: natl.map((p) => p.value), itemStyle: { color: '#9ca3af' }, lineStyle: { type: 'dashed' },
        label: { show: true, position: 'bottom', fontSize: 9, color: '#9ca3af', formatter: (p: any) => Number(p.value).toLocaleString() } }] : []),
    ],
  }), [series, natl, stat, regionName]);

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">지역분석 — 부동산원 통계</h1>
      <p className="mb-4 text-sm text-gray-600">매매가격지수·전세가격·상가 임대지수·주택매매 거래현황의 지역별 시계열을 조회합니다(전국과 비교).</p>

      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <L label="통계">
          <select value={statId} onChange={(e) => setStatId(e.target.value)} className="rounded border px-2 py-1">
            {REB_STATS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </L>
        <L label="지역">
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="max-w-56 rounded border px-2 py-1">
            {items.map((i) => <option key={i.clsId} value={i.clsId}>{i.name}</option>)}
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
      {series.length > 0 && (
        <div className="rounded-lg border bg-white p-2"><ReactECharts option={option} style={{ height: 360 }} /></div>
      )}

      <KosisPopulation />
    </div>
  );
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-gray-500">{label}{children}</label>;
}
