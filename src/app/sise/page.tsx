'use client';
import { useMemo, useState } from 'react';
import { parseSiseRaw, parseNaverPaste, type SiseRawInput } from '@/lib/calc/sise';
import { aggregate } from '@/lib/calc/aggregate';
import { DEFAULT_CONFIG, SISE_FACILITIES } from '@/lib/calc/constants';
import { useStore, type SiseInputRow } from '@/lib/store';

let _id = 1;

const SAMPLE = [
  '당산역 리버리치',
  '매매 3억 5,000',
  '오피스텔',
  '5년차(2016.03.)',
  '전용 39.98㎡',
  '5/15층',
  '남향',
  '확인매물 25.06.30.',
  '리버리치공인중개사',
  '',
  '롯데캐슬',
  '월세 3,000/130',
  '오피스텔',
  '전용 29.7㎡',
  '3/15층',
  '',
  '문래자이',
  '전세 6억',
  '아파트',
  '9년차',
  '전용 84.9㎡',
  '12/25층',
  '동향',
].join('\n');

export default function SisePage() {
  const rows = useStore((st) => st.siseInput);
  const setRows = useStore((st) => st.setSiseInput);
  const paste = useStore((st) => st.sisePaste);
  const setPaste = useStore((st) => st.setSisePaste);
  const confirmed = useStore((st) => st.siseConfirmed);
  const setConfirmed = useStore((st) => st.setSiseConfirmed);
  const resetSise = useStore((st) => st.resetSise);
  const setSise = useStore((st) => st.setSise);
  const [appendMode, setAppendMode] = useState(false);

  function doParse(text: string) {
    // 기존 행과 id 충돌 방지 (새로고침 후 _id 리셋 대비)
    const base = rows.reduce((m, r) => Math.max(m, r.id), 0);
    if (_id <= base) _id = base + 1;
    const parsed: SiseInputRow[] = parseNaverPaste(text).map((it) => ({ id: _id++, ...it }));
    setRows(appendMode ? [...rows, ...parsed] : parsed);
    setConfirmed(false);
    setAppendMode(false);
  }

  const results = useMemo(
    () => rows.map((r) => ({ r, p: parseSiseRaw(r, DEFAULT_CONFIG) })),
    [rows],
  );
  const errorCount = results.filter((x) => x.p.errors.length > 0).length;

  function edit(id: number, field: keyof SiseRawInput, v: string) {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: v } : r)));
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
        네이버 부동산 매물목록을 그대로(세로 여러 줄) 붙여넣으면 가격 줄을 기준으로 건물명·유형·승인일·면적·층·향을 자동 인식해 기준표로 정리합니다.
        오류 행은 빨간색으로 표시되며 셀에서 직접 수정할 수 있습니다. 확정 시 시세 분석에 반영됩니다.
      </p>

      <div className="no-print mb-4 rounded-lg border bg-white p-4">
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={8}
          placeholder={`네이버 매물목록을 그대로 붙여넣기 (예)\n${SAMPLE}`}
          className="w-full rounded border px-2 py-1 font-mono text-xs" />
        <div className="mt-2 flex gap-2">
          <button onClick={() => doParse(paste)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">파싱</button>
          <button onClick={() => { setPaste(SAMPLE); doParse(SAMPLE); }} className="rounded-md border px-4 py-2 text-sm">샘플 넣기</button>
          {rows.length > 0 && <button onClick={() => {
              setConfirmed(true);
              setSise(
                results.filter((x) => x.p.errors.length === 0).map((x) => ({
                  facility: x.r.facility, deal: x.p.row.deal,
                  ppaSupply: x.p.ppa.ppaSupply ?? null, ppaExcl: x.p.ppa.ppaExcl ?? null,
                })),
                { parsedCount: results.length, errorCount },
              );
            }} disabled={errorCount > 0}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {errorCount > 0 ? `오류 ${errorCount}행 수정 필요` : '확정 → 분석 반영'}</button>}
          {rows.length > 0 && <button onClick={() => { setAppendMode(true); setPaste(''); setConfirmed(false); }}
            className="rounded-md border border-blue-300 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50">데이터 추가</button>}
          {rows.length > 0 && <button onClick={() => { if (confirm('파싱한 데이터를 모두 지웁니다. 계속할까요?')) { resetSise(); setAppendMode(false); } }}
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">초기화</button>}
        </div>
        {appendMode && (
          <p className="mt-2 text-xs font-medium text-blue-600">
            추가 입력 모드 — 새 매물목록을 붙여넣고 &quot;파싱&quot;하면 기존 표 아래에 이어서 추가됩니다.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mb-5 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-2 py-2">건물명</th><th className="px-2 py-2">시설</th><th className="px-2 py-2">금액(원문)</th><th className="px-2 py-2">면적·층(원문)</th>
                <th className="px-2 py-2">거래</th><th className="px-2 py-2">금액(천원)</th><th className="px-2 py-2">전용㎡</th>
                <th className="px-2 py-2">평당가-공급</th><th className="px-2 py-2">평당가-전용</th><th className="px-2 py-2">비고</th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ r, p }) => (
                <tr key={r.id} className={`border-t ${p.errors.length ? 'bg-red-50' : ''}`}>
                  <td className="px-1 py-1"><input value={r.name ?? ''} onChange={(e) => edit(r.id, 'name', e.target.value)} className="w-28 rounded border px-1 py-0.5 text-xs" /></td>
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

      {confirmed && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✓ 확정되었습니다 — <b>④ 시세 분석</b>·<b>⑤ 종합 검토</b>에 반영됩니다. (무오류 {results.filter((x)=>x.p.errors.length===0).length}건)
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
