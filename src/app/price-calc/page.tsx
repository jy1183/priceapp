'use client';
// 가격 산정 — 표 상단에서 공통 평당 단가·적용비율을 고르면 행별(시설·전용면적)로 세대당 매각가·총매출을 산출하는 페이지
import { useMemo, useState } from 'react';
import { useStore, type PriceCalcRow } from '@/lib/store';
import { buildPriceCatalog, resolveAreaBandOptions, PRICE_CATEGORIES, type PriceOption } from '@/lib/priceCalc';
import { bandByFacility } from '@/lib/areaBands';
import { bandByRecencyFacility } from '@/lib/monthlyRent';
import { PYEONG } from '@/lib/calc/constants';
import { orderFacilities } from '@/lib/txAnalysis';

let _id = 1;

/** 적용비율 프리셋(10% 단위) — 목록 밖 값은 직접입력으로 표시 */
const RATIO_PRESETS = [70, 80, 90, 100, 110, 120, 130, 140, 150];

const fmt = (v: number | null) => (v != null && Number.isFinite(v) ? Math.round(v).toLocaleString() : '-');
const fmt2 = (v: number | null) => (v != null && Number.isFinite(v) ? (Math.round(v * 100) / 100).toLocaleString() : '-');

export default function PriceCalcPage() {
  const rows = useStore((st) => st.priceCalc);
  const setRows = useStore((st) => st.setPriceCalc);
  const priceKey = useStore((st) => st.priceCalcKey);
  const setPriceKey = useStore((st) => st.setPriceCalcKey);
  const ratio = useStore((st) => st.priceCalcRatio);
  const setRatio = useStore((st) => st.setPriceCalcRatio);
  const sise = useStore((st) => st.sise);
  const tx = useStore((st) => st.tx);
  const config = useStore((st) => st.config);
  /** 적용비율 컨트롤을 "직접입력"으로 전환할지 — 저장 데이터가 아닌 화면 표시 상태 */
  const [customRatio, setCustomRatio] = useState(false);

  const thisYear = new Date().getFullYear();
  const catalog = useMemo(() => buildPriceCatalog(sise, tx, config, thisYear), [sise, tx, config, thisYear]);
  const facilities = useMemo(() => orderFacilities(catalog.keys()), [catalog]);

  const saleTx = useMemo(() => tx.filter((t) => t.dealType === '매매'), [tx]);
  const bandFac = useMemo(() => bandByFacility(saleTx), [saleTx]);
  const bandRecFac = useMemo(() => bandByRecencyFacility(saleTx, thisYear), [saleTx, thisYear]);

  /** 시설·전용면적(㎡) → 그 행에서 상단 선택 단가에 대응하는 옵션(고정 10종 + 면적범위 자동 3종 통합 조회용) */
  function optionsFor(facility: string, exclM2: number | null): PriceOption[] {
    return [...(catalog.get(facility) ?? []), ...resolveAreaBandOptions(facility, exclM2, bandFac, bandRecFac)];
  }

  function addRow() {
    const base = rows.reduce((m, r) => Math.max(m, r.id), 0);
    if (_id <= base) _id = base + 1;
    setRows([...rows, { id: _id++, facility: facilities[0] ?? '', type: '', units: null, exclM2: null }]);
  }
  function removeRow(id: number) {
    setRows(rows.filter((r) => r.id !== id));
  }
  function edit<K extends keyof PriceCalcRow>(id: number, field: K, v: PriceCalcRow[K]) {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: v } : r)));
  }

  /** 1행 계산 — 전용(평), 상단 공통 단가·비율을 적용한 적용 평당가, 세대당 매각가, 총매출 */
  function calc(r: PriceCalcRow) {
    const pyeong = r.exclM2 != null && Number.isFinite(r.exclM2) ? r.exclM2 * PYEONG : null;
    const opt = optionsFor(r.facility, r.exclM2).find((o) => o.key === priceKey && !o.disabled) ?? null;
    const appliedPpa = opt ? opt.value * (ratio / 100) : null; // 적용 평당가(천원/평)
    const unitPrice = pyeong != null && appliedPpa != null ? pyeong * appliedPpa : null; // 천원
    const total = unitPrice != null && r.units != null ? unitPrice * r.units : null; // 천원
    return { pyeong, opt, appliedPpa, unitPrice, total };
  }

  const calced = rows.map((r) => ({ r, c: calc(r) }));
  const totalUnits = calced.reduce((s, x) => s + (x.r.units ?? 0), 0);
  const totalM2 = calced.reduce((s, x) => s + (x.r.exclM2 ?? 0), 0);
  const totalPyeong = calced.reduce((s, x) => s + (x.c.pyeong ?? 0), 0);
  const totalRevenue = calced.reduce((s, x) => s + (x.c.total ?? 0), 0);
  const blendedPpa = totalPyeong > 0 ? totalRevenue / totalPyeong : null; // 총매출 ÷ 총평 = 가중평균 평당가

  const inputCls = 'w-full rounded border px-1.5 py-1 text-xs';
  const groups = [...new Set(PRICE_CATEGORIES.map((o) => o.group))];
  const isPresetRatio = RATIO_PRESETS.includes(ratio);
  const showCustomRatio = customRatio || !isPresetRatio;

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">가격 산정 (매매)</h1>
      <p className="mb-4 text-sm text-gray-600">
        아래에서 평당매매가격(적용 단가)과 적용비율을 고르면 모든 행에 공통 적용됩니다.
        실제 평당가는 행마다 시설·전용면적(㎡) 기준으로 조회되며, 면적 범위(자동) 단가는 행의 전용면적에 맞는 구간 값을 자동으로 사용합니다.
        전용면적(평) = 전용면적(㎡) × {PYEONG}. 세대당 매각가 = 전용면적(평) × 적용 평당가. 총매출 = 세대당 매각가 × 세대수. 단위 천원.
      </p>

      {facilities.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          적용할 수 있는 시세·실거래(매매) 분석 값이 없습니다. <b>① 시세 입력</b>을 확정하거나 <b>② 실거래 조회</b>를 매매로 실행한 뒤 다시 오세요.
        </div>
      ) : (
        <>
          <div className="no-print mb-4 flex flex-wrap items-end gap-4 rounded-lg border bg-white p-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">평당매매가격(적용 단가)</label>
              <select value={priceKey ?? ''} onChange={(e) => setPriceKey(e.target.value || null)}
                className="rounded border px-2 py-1.5 text-sm">
                <option value="">선택 안 함</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {PRICE_CATEGORIES.filter((o) => o.group === g).map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">적용비율(%)</label>
              {showCustomRatio ? (
                <div className="flex items-center gap-1">
                  <input type="number" value={ratio} onChange={(e) => setRatio(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-24 rounded border px-2 py-1.5 text-sm" />
                  {isPresetRatio && (
                    <button type="button" onClick={() => setCustomRatio(false)} className="text-xs text-blue-600 hover:underline">목록</button>
                  )}
                </div>
              ) : (
                <select value={ratio} onChange={(e) => {
                    if (e.target.value === 'custom') { setCustomRatio(true); return; }
                    setRatio(Number(e.target.value));
                  }} className="rounded border px-2 py-1.5 text-sm">
                  {RATIO_PRESETS.map((p) => <option key={p} value={p}>{p}%</option>)}
                  <option value="custom">직접입력…</option>
                </select>
              )}
            </div>
          </div>

          <div className="no-print mb-3">
            <button onClick={addRow} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              + 행 추가
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-2 py-2">시설</th>
                  <th className="px-2 py-2">타입(평형)</th>
                  <th className="w-12 px-2 py-2 text-right">세대수</th>
                  <th className="w-20 px-2 py-2 text-right">전용면적<br />(㎡)</th>
                  <th className="px-2 py-2 text-right">전용면적(평)</th>
                  <th className="px-2 py-2 text-right">적용 평당가(천원/평)</th>
                  <th className="px-2 py-2 text-right">세대당 매각가(천원)</th>
                  <th className="px-2 py-2 text-right">총매출(천원)</th>
                  <th className="no-print px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {calced.map(({ r, c }) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-1 py-1">
                      <select value={r.facility} onChange={(e) => edit(r.id, 'facility', e.target.value)} className={inputCls}>
                        {facilities.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1"><input value={r.type} onChange={(e) => edit(r.id, 'type', e.target.value)} className={inputCls} placeholder="예: 84A(34평)" /></td>
                    <td className="px-1 py-1">
                      <input type="number" value={r.units ?? ''} onChange={(e) => edit(r.id, 'units', e.target.value === '' ? null : Number(e.target.value))}
                        className={`${inputCls} w-12 text-right`} />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" value={r.exclM2 ?? ''} onChange={(e) => edit(r.id, 'exclM2', e.target.value === '' ? null : Number(e.target.value))}
                        className={`${inputCls} w-20 text-right`} />
                    </td>
                    <td className="px-2 py-1 text-right text-gray-500">{fmt2(c.pyeong)}</td>
                    <td className="px-2 py-1 text-right">{fmt(c.appliedPpa)}</td>
                    <td className="px-2 py-1 text-right font-medium">{fmt(c.unitPrice)}</td>
                    <td className="px-2 py-1 text-right font-medium">{fmt(c.total)}</td>
                    <td className="no-print px-1 py-1 text-center">
                      <button onClick={() => removeRow(r.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-4 text-center text-gray-400">행을 추가해 산정을 시작하세요.</td></tr>
                )}
                {rows.length > 0 && (
                  <tr className="border-t-2 bg-gray-50 font-semibold">
                    <td className="px-2 py-1.5" colSpan={2}>합계</td>
                    <td className="px-2 py-1.5 text-right">{totalUnits.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right">{fmt2(totalM2)}</td>
                    <td className="px-2 py-1.5 text-right">{fmt2(totalPyeong)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-500">가중평균 {fmt(blendedPpa)}</td>
                    <td className="px-2 py-1.5" />
                    <td className="px-2 py-1.5 text-right">{fmt(totalRevenue || null)}</td>
                    <td className="no-print px-2 py-1.5" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
