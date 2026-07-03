/**
 * 국토부 API item → 정규화 실거래 레코드 + 평당가(천원/평)
 * 근거: 계산로직_명세서 §2-1, §3 (시설별 필드/면적/환산식)
 */
import { ppaTrade, ppaJeonse, ppaMonthly } from '@/lib/calc/transaction';
import { DEFAULT_CONFIG, type AnalysisConfig } from '@/lib/calc/constants';
import type { Facility, Trade } from '@/lib/molit';

export interface TxRecord {
  facility: Facility;
  trade: Trade;
  dealType: '매매' | '전세' | '월세';
  name: string;
  buildYear: number | null;
  areaM2: number | null;     // 평당가 산출 기준면적
  amountManwon: number | null;
  depositManwon: number | null;
  monthlyRentManwon: number | null;
  dealDate: string | null;   // YYYY-MM-DD (거래일)
  floor: number | null;
  ppa: number | null;        // 전용/기준 평당가 (천원/평)
  raw: Record<string, unknown>;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

/** 시설별 기준면적 필드 선택 (§2-1) */
function pickArea(facility: Facility, it: Record<string, unknown>): number | null {
  switch (facility) {
    case '단독다가구': return num(it.plottageAr ?? it.totalFloorAr); // 대지면적 우선
    case '토지':       return num(it.dealArea ?? it.landAr);          // 거래(계약)면적
    case '상업업무용': return num(it.totalFloorAr ?? it.buildingAr);  // 연면적
    default:           return num(it.excluUseAr ?? it.buildingAr);    // 전용면적
  }
}

const nameField = (facility: Facility, it: Record<string, unknown>): string =>
  String(it.aptNm ?? it.offiNm ?? it.mhouseNm ?? it.jibun ?? it.umdNm ?? '') || '-';

export function normalize(
  facility: Facility,
  trade: Trade,
  it: Record<string, unknown>,
  cfg: AnalysisConfig = DEFAULT_CONFIG,
): TxRecord {
  const buildYear = num(it.buildYear);
  const area = pickArea(facility, it);
  const amount = num(it.dealAmount);
  const deposit = num(it.deposit);
  const monthly = num(it.monthlyRent);
  const y = num(it.dealYear), m = num(it.dealMonth), d = num(it.dealDay);
  const dealDate = y && m ? `${y}-${String(m).padStart(2, '0')}-${String(d ?? 1).padStart(2, '0')}` : null;

  let dealType: '매매' | '전세' | '월세';
  let ppa: number | null = null;
  if (trade === '매매') {
    dealType = '매매';
    ppa = amount != null && area ? ppaTrade(amount, area) : null;
  } else if (monthly && monthly > 0) {
    dealType = '월세';
    ppa = deposit != null && area ? ppaMonthly(deposit, monthly, area, cfg) : null;
  } else {
    dealType = '전세';
    ppa = deposit != null && area ? ppaJeonse(deposit, area) : null;
  }

  return {
    facility, trade, dealType,
    name: nameField(facility, it),
    buildYear, areaM2: area, amountManwon: amount,
    depositManwon: deposit, monthlyRentManwon: monthly,
    dealDate, floor: num(it.floor),
    ppa: ppa != null && Number.isFinite(ppa) ? Math.round(ppa * 100) / 100 : null,
    raw: it,
  };
}
