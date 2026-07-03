'use client';
import { useMemo, useState } from 'react';
import { parseSiseRaw, type SiseRawInput } from '@/lib/calc/sise';
import { aggregate } from '@/lib/calc/aggregate';
import { DEFAULT_CONFIG, SISE_FACILITIES } from '@/lib/calc/constants';

interface Row extends SiseRawInput { id: number }
let _id = 1;

const SAMPLE = `오피스텔\t매매 3억5000\t전용39.98㎡ 5/15층
오피스텔\t월세 3000/130\t전용29.7㎡ 3/15층
아파트\t전세 6억\t전용84.9㎡ 12/25층`;

export default function SisePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [paste, setPaste] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  function doParse(text: string) {
    const parsed: Row[] = text.trim().split('\n').filter(Boolean).map((line) => {
      const [facility, amountText, areaText, approvalDate, name] = line.split('\t').map((s) => s?.trim() ?? '');
      return { id: _id++, facility: facility || '기타', amountText: amountText || '', areaText: areaText || '', approvalDate, name };
    });
    setRows(parsed); setConfirmed(false);
  }

  const results = useMemo(
    () => rows.map((r) => ({ r, p: parseSiseRaw(r, DEFAULT_CONFIG) })),
    [rows],
  );
  const errorCount = results.filter((x) => x.p.errors.length > 0).length;

  function edit(id: number, field: keyof SiseRawInput, v: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: v } : r)));
  }

  // 확정 후 시설별 집계 (전용 기준 평당가)
  const agg = useMemo(() => {
    const byFac = new Map<string, number[]>();
    results.forEach(({ r, p }) => {
      const v = p.ppa.ppaExcl;
      if (v != null && Number.isFinite(v) && p.errors.length === 0) {
        if (!byFac.has(r.facility)) byFac.set(r.facility, []);
        byFac.get(r.facility)!.push(v);
      }
    });
    return [...byFac.entries()].map(([facility, vals]) => ({ facility, ...aggregate(vals, DEFAULT_CONFIG.topPercentiles) }));
  }, [results]);

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">시세 입력 · 분석</h1>
      <p className="mb-4 text-sm text-gray-600">
        네이버 부동산 데이터를 붙여넣으면 파싱 기준표로 정리합니다(탭 구분: 시설 · 금액 · 면적·층 · [승인일] · [건물명]).
        오류 행은 빨간색으로 표시되며 셀에서 직접 수정할 수 있습니다. 확정 시 시세 분석에 반영됩니다.
      </p>

      <div className="no-print mb-4 rounded-lg border bg-white p-4">
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4}
          placeholder={`탭으로 구분해 붙여넣기 (예)\n${SAMPLE}`}
          className="w-full rounded border px-2 py-1 font-mono text-xs" />
        <div className="mt-2 flex gap-2">
          <button onClick={() => doParse(paste)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">파싱</button>
          <button onClick={() => { setPaste(SAMPLE); doParse(SAMPLE); }} className="rounded-md border px-4 py-2 text-sm">샘플 넣기</button>
          {rows.length > 0 && <button onClick={() => setConfirmed(true)} disabled={errorCount > 0}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {errorCount > 0 ? `오류 ${errorCount}행 수정 필요` : '확정 → 분석 반영'}</button>}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="mb-5 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-2 py-2">시설</th><th className="px-2 py-2">금액(원문)</th><th className="px-2 py-2">면적·층(원문)</th>
                <th className="px-2 py-2">거래</th><th className="px-2 py-2">금액(천원)</th><th className="px-2 py-2">전용㎡</th>
                <th className="px-2 py-2">평당가-공급</th><th className="px-2 py-2">평당가-전용</th><th className="px-2 py-2">비고</th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ r, p }) => (
                <tr key={r.id} className={`border-t ${p.errors.length ? 'bg-red-50' : ''}`}>
                  <td className="px-1 py-1">
                    <select value={r.facility} onChange={(e) => edit(r.id, 'facility', e.target.value)} className="rounded border px-1 py-0.5 text-xs">
                      {SISE_FACILITIES.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input value={r.amountText} onChange={(e) => edit(r.id, 'amountText', e.target.value)} className="w-28 rounded border px-1 py-0.5 text-xs" /></td>
                  <td className="px-1 py-1"><input value={r.areaText} onChange={(e) => edit(r.id, 'areaText', e.target.value)} className="w-40 rounded border px-1 py-0.5 text-xs" /></td>
                  <td className="px-2 py-1">{p.row.deal}</td>
                  <td className="px-2 py-1">{p.row.amountCheonwon?.toLocaleString()}</td>
                  <td className="px-2 py-1">{p.row.exclM2 ?? '-'}</td>
                  <td className="px-2 py-1">{p.ppa.ppaSupply ? Math.round(p.ppa.ppaSupply).toLocaleString() : '-'}</td>
                  <td className="px-2 py-1">{p.ppa.ppaExcl ? Math.round(p.ppa.ppaExcl).toLocaleString() : '-'}</td>
                  <td className="px-2 py-1 text-xs text-red-600">{p.errors.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmed && agg.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">시세 분석 — 시설별 평당가(전용 기준, 천원/평)</h2>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr><th className="px-3 py-2">시설</th><th className="px-3 py-2">건수</th><th className="px-3 py-2">평균</th><th className="px-3 py-2">상위10%</th><th className="px-3 py-2">상위30%</th><th className="px-3 py-2">상위50%</th></tr>
              </thead>
              <tbody>
                {agg.map((a) => (
                  <tr key={a.facility} className="border-t">
                    <td className="px-3 py-1.5">{a.facility}</td>
                    <td className="px-3 py-1.5">{a.count}</td>
                    <td className="px-3 py-1.5">{Math.round(a.avg).toLocaleString()}</td>
                    <td className="px-3 py-1.5">{Math.round(a.top10).toLocaleString()}</td>
                    <td className="px-3 py-1.5">{Math.round(a.top30).toLocaleString()}</td>
                    <td className="px-3 py-1.5">{Math.round(a.top50).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
