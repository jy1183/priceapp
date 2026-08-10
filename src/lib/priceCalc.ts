/**
 * 가격 산정 페이지 — 시설별 매매 평당단가 옵션 카탈로그
 * 근거: 20260810 가격 산정 페이지 추가 작업요청 / 가격산정_면적자동적용_적용비율리스트_context-notes.md
 * - 기존 종합검토(summary.ts)·실거래 분석(txAnalysis.ts·areaBands.ts·monthlyRent.ts) 집계 함수를 그대로 재사용해
 *   시설별로 선택 가능한 매매 단가(천원/평) 목록을 만든다. 새 집계 로직은 추가하지 않음.
 * - 매매 기준만 다룬다(작업요청의 단가 리스트가 매매 전용이므로 전세·임대는 이번 범위 밖).
 * - 면적 범위(6구간) 관련 옵션은 고정 목록으로 나열하지 않고, 행에 입력된 전용면적(㎡)에 맞는
 *   구간 하나만 자동으로 골라 값을 보여준다(resolveAreaBandOptions).
 */
import type { SiseResult } from '@/lib/store';
import type { TxRecord } from '@/lib/normalize';
import type { AnalysisConfig } from '@/lib/calc/constants';
import { buildSummaryRows } from '@/lib/summary';
import { classifyBand, type BandByFacilityResult } from '@/lib/areaBands';
import { facilityByRecency, orderFacilities } from '@/lib/txAnalysis';
import type { RecencyFacilityBandRow } from '@/lib/monthlyRent';

export interface PriceOption {
  key: string;
  group: string;
  label: string;
  value: number; // 천원/평 (disabled=true면 의미 없음)
  disabled?: boolean;
}

const AREA_BAND_GROUP = '실거래 · 면적 범위(자동)';

/**
 * 평당매매가격(적용 단가) 종류 정적 목록(값 없음) — 표 상단 공통 선택용.
 * 실제 값은 행마다(시설·전용면적 기준) buildPriceCatalog·resolveAreaBandOptions로 조회한다.
 */
export const PRICE_CATEGORIES: { key: string; group: string; label: string }[] = [
  { key: 'sise_avg', group: '시세', label: '시세: (전용) 평균가' },
  { key: 'sise_top10', group: '시세', label: '시세: (전용) 상위10%' },
  { key: 'sise_top30', group: '시세', label: '시세: (전용) 상위30%' },
  { key: 'sise_top50', group: '시세', label: '시세: (전용) 상위50%' },
  { key: 'tx_avg', group: '실거래', label: '실거래: (전용) 전체 평균' },
  { key: 'tx_top10', group: '실거래', label: '실거래: (전용) 상위 10% 평당가' },
  { key: 'tx_top30', group: '실거래', label: '실거래: (전용) 상위 30% 평당가' },
  { key: 'tx_top50', group: '실거래', label: '실거래: (전용) 상위 50% 평당가' },
  { key: 'tx_recent5', group: '실거래', label: '실거래: (전용) 최근 5년' },
  { key: 'tx_recent10', group: '실거래', label: '실거래: (전용) 최근 10년' },
  { key: 'band_auto', group: AREA_BAND_GROUP, label: '실거래: 면적 범위 평균가 (행별 전용면적 자동 적용)' },
  { key: 'band_r5_auto', group: AREA_BAND_GROUP, label: '실거래: 준공 최근5년 · 면적 범위 평균가 (행별 전용면적 자동 적용)' },
  { key: 'band_r10_auto', group: AREA_BAND_GROUP, label: '실거래: 준공 최근10년 · 면적 범위 평균가 (행별 전용면적 자동 적용)' },
];

/** 시설명 → 선택 가능한 매매 단가 옵션 목록(면적범위 제외 고정 10종). 값이 유효(양수)한 옵션만 담는다. */
export function buildPriceCatalog(
  sise: SiseResult[],
  tx: TxRecord[],
  config: AnalysisConfig,
  thisYear: number,
): Map<string, PriceOption[]> {
  const saleTx = tx.filter((t) => t.dealType === '매매');
  const summaryRows = buildSummaryRows(sise, tx, config);
  const recencyRows = facilityByRecency(saleTx, thisYear);

  const facilities = orderFacilities([
    ...summaryRows.map((r) => r.facility),
    ...recencyRows.map((r) => r.facility),
  ]);

  const catalog = new Map<string, PriceOption[]>();
  for (const f of facilities) {
    const opts: PriceOption[] = [];
    const sr = summaryRows.find((r) => r.facility === f);
    if (sr) {
      opts.push({ key: 'sise_avg', group: '시세', label: '시세: (전용) 평균가', value: sr.sise.avg });
      opts.push({ key: 'sise_top10', group: '시세', label: '시세: (전용) 상위10%', value: sr.sise.top10 });
      opts.push({ key: 'sise_top30', group: '시세', label: '시세: (전용) 상위30%', value: sr.sise.top30 });
      opts.push({ key: 'sise_top50', group: '시세', label: '시세: (전용) 상위50%', value: sr.sise.top50 });
      opts.push({ key: 'tx_avg', group: '실거래', label: '실거래: (전용) 전체 평균', value: sr.tx.avg });
      opts.push({ key: 'tx_top10', group: '실거래', label: '실거래: (전용) 상위 10% 평당가', value: sr.tx.top10 });
      opts.push({ key: 'tx_top30', group: '실거래', label: '실거래: (전용) 상위 30% 평당가', value: sr.tx.top30 });
      opts.push({ key: 'tx_top50', group: '실거래', label: '실거래: (전용) 상위 50% 평당가', value: sr.tx.top50 });
    }
    const rr = recencyRows.find((r) => r.facility === f);
    if (rr) {
      opts.push({ key: 'tx_recent5', group: '실거래', label: '실거래: (전용) 최근 5년', value: rr.recent5 });
      opts.push({ key: 'tx_recent10', group: '실거래', label: '실거래: (전용) 최근 10년', value: rr.recent10 });
    }
    catalog.set(f, opts.filter((o) => Number.isFinite(o.value) && o.value > 0));
  }
  return catalog;
}

/**
 * 전용면적(㎡) 1개 값에 맞는 면적 범위 실거래 평균가 3종(면적범위 전체 / 준공 최근5년 / 준공 최근10년)을
 * 자동으로 판정해 반환한다. 전용면적 미입력이거나 해당 구간에 유효 실거래가 없으면 disabled로 표시.
 * bandFac·bandRecFac은 페이지에서 tx 전체 기준으로 한 번만 계산해 넘겨받는다(행마다 재계산하지 않음).
 */
export function resolveAreaBandOptions(
  facility: string,
  exclM2: number | null,
  bandFac: BandByFacilityResult,
  bandRecFac: RecencyFacilityBandRow[],
): PriceOption[] {
  const band = classifyBand(exclM2);
  const defs: { key: string; label: string; cell: () => { avg: number; count: number } | undefined }[] = [
    { key: 'band_auto', label: '실거래: 면적 범위 평균가', cell: () => (band ? bandFac.cells[facility]?.[band.key] : undefined) },
    {
      key: 'band_r5_auto', label: '실거래: 준공 최근5년 · 면적 범위 평균가',
      cell: () => (band ? bandRecFac.find((r) => r.facility === facility && r.recencyKey === '5')?.cells[band.key] : undefined),
    },
    {
      key: 'band_r10_auto', label: '실거래: 준공 최근10년 · 면적 범위 평균가',
      cell: () => (band ? bandRecFac.find((r) => r.facility === facility && r.recencyKey === '10')?.cells[band.key] : undefined),
    },
  ];

  return defs.map((d) => {
    if (!band) {
      return { key: d.key, group: AREA_BAND_GROUP, label: `${d.label} — 전용면적을 입력하세요`, value: NaN, disabled: true };
    }
    const c = d.cell();
    if (!c || c.count === 0 || !(c.avg > 0)) {
      return { key: d.key, group: AREA_BAND_GROUP, label: `${d.label} (${band.label}) — 해당 구간 실거래 없음`, value: NaN, disabled: true };
    }
    return { key: d.key, group: AREA_BAND_GROUP, label: `${d.label} (${band.label})`, value: c.avg };
  });
}
