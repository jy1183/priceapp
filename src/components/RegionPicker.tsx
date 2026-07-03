'use client';
import { useMemo } from 'react';
import { SIDO_LIST, sigunguOf, dongsOf } from '@/lib/regions';

export interface RegionValue { sido: string; lawdCd: string; dong: string }

/** 시도→시군구(코드 자동)→읍면동 3단 선택기 */
export default function RegionPicker({ value, onChange }: {
  value: RegionValue; onChange: (v: RegionValue) => void;
}) {
  const sgg = useMemo(() => sigunguOf(value.sido), [value.sido]);
  const dongs = useMemo(() => dongsOf(value.sido, value.lawdCd), [value.sido, value.lawdCd]);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs text-gray-500">시도
        <select value={value.sido} className="rounded border px-2 py-1"
          onChange={(e) => {
            const s = e.target.value; const first = sigunguOf(s)[0];
            onChange({ sido: s, lawdCd: first?.code ?? '', dong: '' });
          }}>
          {SIDO_LIST.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-500">시군구
        <select value={value.lawdCd} className="rounded border px-2 py-1"
          onChange={(e) => onChange({ ...value, lawdCd: e.target.value, dong: '' })}>
          {sgg.map((s) => <option key={s.code} value={s.code}>{s.sigungu}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-500">읍면동
        <select value={value.dong} className="rounded border px-2 py-1"
          onChange={(e) => onChange({ ...value, dong: e.target.value })}>
          <option value="">전체</option>
          {dongs.map((d) => <option key={d}>{d}</option>)}
        </select>
      </label>
      <span className="pb-1.5 text-xs text-gray-400">코드 {value.lawdCd || '-'}</span>
    </div>
  );
}
