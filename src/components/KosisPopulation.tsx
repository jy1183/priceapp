'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import RegionPicker, { type RegionValue } from '@/components/RegionPicker';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/** KOSIS 인구분석 — 시군구 총인구 + 연령대별 분포 */
export default function KosisPopulation() {
  const [region, setRegion] = useState<RegionValue>({ sido: '서울특별시', lawdCd: '11560', dong: '영등포동8가' });
  const [data, setData] = useState<{ region: string; period: string; total: number; ages: { label: string; value: number }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true); setErr(''); setData(null);
    try {
      const r = await fetch(`/api/kosis?objL1=${region.lawdCd}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  const option = useMemo(() => data && ({
    title: { text: `${data.region} 연령대별 인구 (${data.period})`, left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    grid: { left: 60, right: 20, top: 40, bottom: 70 },
    xAxis: { type: 'category', data: data.ages.map((a) => a.label), axisLabel: { rotate: 60, fontSize: 9 } },
    yAxis: { type: 'value', name: '명' },
    series: [{ type: 'bar', data: data.ages.map((a) => a.value), itemStyle: { color: '#7c3aed' } }],
  }), [data]);

  return (
    <div className="mt-8">
      <h2 className="mb-2 text-lg font-semibold">인구분석 (KOSIS 주민등록인구)</h2>
      <div className="no-print mb-3 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <RegionPicker value={region} onChange={setRegion} />
        <button onClick={load} disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? '조회 중…' : '인구 조회'}
        </button>
      </div>
      {err && <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{err}</div>}
      {data && (
        <>
          <div className="mb-3 inline-block rounded-lg border bg-white px-4 py-2 text-sm">
            <span className="text-gray-500">{data.region} 총인구 ({data.period}): </span>
            <b className="text-lg">{data.total.toLocaleString()}</b> 명
          </div>
          <div className="rounded-lg border bg-white p-2"><ReactECharts option={option} style={{ height: 320 }} /></div>
        </>
      )}
    </div>
  );
}
