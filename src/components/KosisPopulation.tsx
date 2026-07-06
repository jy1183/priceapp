'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import RegionPicker, { type RegionValue } from '@/components/RegionPicker';
import { useStore } from '@/lib/store';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

type Age = { label: string; value: number };
type Pop = { region: string; period: string; total: number; ages: Age[] };

const ageStart = (l: string) => { const m = l.match(/-?\d+/); return m ? parseInt(m[0], 10) : 999; };

/** KOSIS 인구분석 — 조회지역 총인구·연령대 + 기준1(시도)/기준2(지역) 연령대 비율 비교 */
export default function KosisPopulation() {
  const txForm = useStore((s) => s.txForm);
  const [region, setRegion] = useState<RegionValue>({ sido: txForm.sido, lawdCd: txForm.lawdCd, dong: txForm.dong });
  const [data, setData] = useState<Pop | null>(null);   // 기준2: 조회지역(구)
  const [sido, setSido] = useState<Pop | null>(null);   // 기준1: 시도
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true); setErr(''); setData(null); setSido(null);
    try {
      const sidoCd = region.lawdCd.slice(0, 2); // 시군구 5자리 앞 2자리 = 시도코드
      const [reg, sd] = await Promise.all([
        fetch(`/api/kosis?objL1=${region.lawdCd}`).then((r) => r.json()),
        fetch(`/api/kosis?objL1=${sidoCd}`).then((r) => r.json()),
      ]);
      if (reg.error) throw new Error(reg.error);
      setData(reg);
      if (!sd.error) setSido(sd);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  // 조회지역 연령대 차트 (기존)
  const option = useMemo(() => data && ({
    title: { text: `${data.region} 연령대별 인구 (${data.period})`, left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    grid: { left: 60, right: 20, top: 40, bottom: 70 },
    xAxis: { type: 'category', data: data.ages.map((a) => a.label), axisLabel: { rotate: 60, fontSize: 9 } },
    yAxis: { type: 'value', name: '명' },
    series: [{ type: 'bar', data: data.ages.map((a) => a.value), itemStyle: { color: '#7c3aed' },
      label: { show: true, position: 'top', fontSize: 9, formatter: (p: any) => Number(p.value).toLocaleString() } }],
  }), [data]);

  // 기준1(시도) vs 기준2(지역) 연령대 비율(%) — 라벨 합집합·연령순 정렬
  const ratio = useMemo(() => {
    if (!data || !sido) return null;
    const rMap = new Map(data.ages.map((a) => [a.label, a.value]));
    const sMap = new Map(sido.ages.map((a) => [a.label, a.value]));
    const labels = Array.from(new Set([...data.ages, ...sido.ages].map((a) => a.label))).sort((x, y) => ageStart(x) - ageStart(y));
    const rows = labels.map((label) => {
      const rv = rMap.get(label) ?? 0, sv = sMap.get(label) ?? 0;
      const rp = data.total ? (rv / data.total) * 100 : 0;
      const sp = sido.total ? (sv / sido.total) * 100 : 0;
      return { label, sv, sp, rv, rp, diff: rp - sp };
    });
    return { labels, rows };
  }, [data, sido]);

  const ratioOption = useMemo(() => ratio && data && sido && ({
    title: { text: `연령대별 인구 비율 비교 — 기준1 ${sido.region} vs 기준2 ${data.region}`, left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis', valueFormatter: (v: any) => (v == null ? '' : Number(v).toFixed(1) + '%') },
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    legend: { bottom: 0, data: [`기준1 ${sido.region}(시도)`, `기준2 ${data.region}`] },
    grid: { left: 55, right: 20, top: 40, bottom: 70 },
    xAxis: { type: 'category', data: ratio.labels, axisLabel: { rotate: 60, fontSize: 9 } },
    yAxis: { type: 'value', name: '%' },
    series: [
      { name: `기준1 ${sido.region}(시도)`, type: 'bar', data: ratio.rows.map((r) => +r.sp.toFixed(2)), itemStyle: { color: '#2563eb' } },
      { name: `기준2 ${data.region}`, type: 'bar', data: ratio.rows.map((r) => +r.rp.toFixed(2)), itemStyle: { color: '#dc2626' } },
    ],
  }), [ratio, data, sido]);

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
            {sido && <span className="ml-3 text-gray-500">{sido.region} 총인구: <b>{sido.total.toLocaleString()}</b> 명</span>}
          </div>
          <div className="rounded-lg border bg-white p-2"><ReactECharts option={option} style={{ height: 320 }} /></div>
        </>
      )}

      {ratio && sido && data && (
        <div className="mt-6">
          <h3 className="mb-2 text-base font-semibold">연령대별 인구 비율 비교 (기준1 시도 · 기준2 지역)</h3>
          <div className="mb-3 overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">연령대</th>
                  <th className="px-3 py-2 text-right">기준1 {sido.region}(명)</th>
                  <th className="px-3 py-2 text-right">기준1 비율</th>
                  <th className="px-3 py-2 text-right">기준2 {data.region}(명)</th>
                  <th className="px-3 py-2 text-right">기준2 비율</th>
                  <th className="px-3 py-2 text-right">차이(%p)</th>
                </tr>
              </thead>
              <tbody>
                {ratio.rows.map((r) => (
                  <tr key={r.label} className="border-t">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-right">{r.sv.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{r.sp.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{r.rv.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium">{r.rp.toFixed(1)}%</td>
                    <td className={`px-3 py-2 text-right ${r.diff < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {(r.diff > 0 ? '+' : '') + r.diff.toFixed(1)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-gray-50 font-medium">
                  <td className="px-3 py-2">합계</td>
                  <td className="px-3 py-2 text-right">{sido.total.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">100.0%</td>
                  <td className="px-3 py-2 text-right">{data.total.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">100.0%</td>
                  <td className="px-3 py-2 text-right">-</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border bg-white p-2"><ReactECharts option={ratioOption} style={{ height: 340 }} /></div>
        </div>
      )}
    </div>
  );
}
