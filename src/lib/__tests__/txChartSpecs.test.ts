// 필터링 데이터 차트 빌더가 실거래가 분석(tx-analysis)과 같은 집계값을 내는지 검증
import { describe, it, expect, vi } from 'vitest';

// store.ts는 window.localStorage가 있을 때만 persist를 쓰므로, node 환경에서는 메모리 저장소로 대신한다.
vi.hoisted(() => {
  const mem = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
    },
  };
});
import { buildTxChart, dealsIn } from '@/lib/txChartSpecs';
import { stripRaw, type TxChartKind } from '@/lib/store';
import { DEFAULT_CONFIG } from '@/lib/calc/constants';
import { facilityAgg, topBuildings, facilityByRecency, facilityByAgeBucket } from '@/lib/txAnalysis';
import { AREA_BANDS, bandByFacility, bandByRecency, bandCountByFacility } from '@/lib/areaBands';
import type { TxRecord } from '@/lib/normalize';

const THIS_YEAR = 2026;
const mk = (o: Partial<TxRecord>): TxRecord => ({
  facility: '오피스텔', trade: '매매', dealType: '매매', name: 'A', buildYear: 2018, areaM2: 30,
  amountManwon: 30000, depositManwon: null, monthlyRentManwon: null, dealDate: '2025-01-01',
  floor: 3, ppa: 1000, raw: {}, ...o,
});

const rows: TxRecord[] = [
  mk({ name: 'A오피스텔', ppa: 1000, areaM2: 30, buildYear: 2018 }),
  mk({ name: 'A오피스텔', ppa: 1200, areaM2: 45, buildYear: 2018 }),
  mk({ name: 'B타워', ppa: 1500, areaM2: 60, buildYear: 2010 }),
  mk({ name: 'C빌', ppa: 900, areaM2: 80, buildYear: 1995 }),
  mk({ facility: '아파트', name: 'D아파트', ppa: 2500, areaM2: 84, buildYear: 2005 }),
  mk({ facility: '아파트', name: 'D아파트', ppa: 2700, areaM2: 59, buildYear: 2005 }),
  mk({ facility: '단독다가구', name: 'E주택', ppa: 800, areaM2: 100, buildYear: 1990, raw: { totalFloorAr: '60.5', junk: 'x'.repeat(50) } }),
  mk({ facility: '토지', name: '지번', ppa: 700, areaM2: 200, buildYear: null }),
  // 전세 — 매매 차트에는 절대 섞이면 안 된다
  mk({ dealType: '전세', trade: '전월세', ppa: 500, depositManwon: 15000, amountManwon: null }),
  mk({ dealType: '전세', trade: '전월세', name: 'Z전세', ppa: 600, depositManwon: 18000, amountManwon: null }),
];

const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const build = (k: TxChartKind, r = rows, d: 'sale' | 'jeonse' = 'sale') =>
  buildTxChart(k, r, d === 'sale' ? '매매' : '전세', DEFAULT_CONFIG, THIS_YEAR);

describe('buildTxChart — 실거래가 분석 집계값과 일치', () => {
  it('1. 시설별 평균: 매매 행만으로 계산한 독립 평균과 같다(전세 제외)', () => {
    const c = build('1')!;
    expect(c.title).toBe('시설별 평균·상위 평균 (매매, 천원/평)');
    const i = c.x.indexOf('오피스텔(전용)');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(c.series[0].data[i]).toBe(Math.round(avg([1000, 1200, 1500, 900])));
    const j = c.x.indexOf('아파트(전용)');
    expect(c.series[0].data[j]).toBe(Math.round(avg([2500, 2700])));
    const direct = facilityAgg(rows.filter((r) => r.dealType === '매매'), DEFAULT_CONFIG.topPercentiles);
    expect(c.series.map((s) => s.data)).toEqual([
      direct.map((r) => Math.round(r.agg.avg)), direct.map((r) => Math.round(r.agg.top50)),
      direct.map((r) => Math.round(r.agg.top30)), direct.map((r) => Math.round(r.agg.top10)),
    ]);
  });

  it('1. 전세로 만들면 전세 행만 집계하고 제목에 월세환산/전세 라벨을 쓴다', () => {
    const c = build('1', rows, 'jeonse')!;
    expect(c.title).toBe('시설별 평균·상위 평균 (전세, 천원/평)');
    expect(c.series[0].data).toEqual([Math.round(avg([500, 600]))]);
  });

  it('2. 건물별 상위 10: 평균 내림차순', () => {
    const c = build('2')!;
    const direct = topBuildings(rows.filter((r) => r.dealType === '매매'), 10);
    expect(c.x).toEqual(direct.map((r) => r.name));
    expect(c.series[0].data).toEqual(direct.map((r) => Math.round(r.avg)));
    expect(c.x[0]).toBe('D아파트');
    expect(c.rotateX).toBe(30);
  });

  it('3. 시설별 × 준공연도 기간별', () => {
    const c = build('3')!;
    const direct = facilityByRecency(rows.filter((r) => r.dealType === '매매'), THIS_YEAR);
    expect(c.series.map((s) => s.name)).toEqual(['최근5년', '최근10년', '전체']);
    expect(c.series[2].data).toEqual(direct.map((r) => Math.round(r.all)));
  });

  it('4. 준공연도 구간별', () => {
    const c = build('4')!;
    const direct = facilityByAgeBucket(rows.filter((r) => r.dealType === '매매'), THIS_YEAR);
    expect(c.alwaysShowLegend).toBe(true);
    expect(c.series).toHaveLength(direct.length);
    expect(c.x).toEqual(['<5년', '5–10년', '10–20년', '20–30년', '30년+']);
  });

  it('5. 평형대별 평균: 오피스텔 30㎡·45㎡는 각각 초소형·2룸 소형 구간', () => {
    const c = build('5')!;
    const k = c.series.find((s) => s.name === '오피스텔(전용)')!;
    expect(k.data[0]).toBe(1000); // 40㎡ 이하
    expect(k.data[1]).toBe(1200); // 40~55㎡
    expect(k.data[2]).toBe(1500); // 55~65㎡
    expect(k.data[3]).toBe(900);  // 65~85㎡
    expect(c.x).toEqual(AREA_BANDS.map((b) => b.label));
    expect(c.wrapX).toBe(true);
  });

  it('5-b. 준공연도 × 평형대', () => {
    const c = build('5b')!;
    const direct = bandByRecency(rows.filter((r) => r.dealType === '매매'), THIS_YEAR);
    expect(c.series.map((s) => s.name)).toEqual(direct.rows.map((r) => r.label));
    expect(c.series).toHaveLength(3);
  });

  it('6. 평형대별 거래 건수: 주거 상품만 집계(토지 제외)', () => {
    const c = build('6')!;
    const direct = bandCountByFacility(rows.filter((r) => r.dealType === '매매'));
    expect(c.series.map((s) => s.name)).toEqual(direct.facilities.map((f) => (f === '단독다가구' ? '단독다가구(대지)' : `${f}(전용)`)));
    const total = c.series.reduce((n, s) => n + s.data.reduce((a: number, v) => a + (v ?? 0), 0), 0);
    expect(total).toBe(7); // 오피스텔 4 + 아파트 2 + 단독다가구 1 (토지 제외)
  });

  it('데이터가 없으면 null (거래방식·시설 조건 불일치)', () => {
    expect(build('1', [])).toBeNull();
    expect(buildTxChart('1', rows, '월세', DEFAULT_CONFIG, THIS_YEAR)).toBeNull();
    expect(build('5', [rows[7]])).toBeNull(); // 토지만 있으면 평형대 차트 없음
  });
});

describe('stripRaw 이후에도 차트 값이 변하지 않는다', () => {
  it('단독다가구 평형대 분류(raw.totalFloorAr)가 보존돼 5·5-b·6이 동일하다', () => {
    const stripped = rows.map(stripRaw);
    expect(stripped.find((r) => r.facility === '단독다가구')!.raw).toEqual({ totalFloorAr: '60.5' });
    for (const k of ['1', '2', '3', '4', '5', '5b', '6'] as TxChartKind[]) {
      expect(build(k, stripped)).toEqual(build(k, rows));
    }
    // 연면적 60.5㎡ → 55~65㎡ 구간에 단독다가구가 잡힌다
    const direct = bandByFacility(stripped.filter((r) => r.dealType === '매매'));
    expect(direct.cells['단독다가구']['b5565'].count).toBe(1);
  });
});

describe('dealsIn', () => {
  it('표에 있는 거래방식만 매매·전세·월세 순으로 돌려준다', () => {
    expect(dealsIn(rows)).toEqual(['매매', '전세']);
    expect(dealsIn([rows[0]])).toEqual(['매매']);
    expect(dealsIn([])).toEqual([]);
  });
});
