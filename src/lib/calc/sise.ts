/**
 * 시세 파이프라인 — 네이버 붙여넣기 파싱 + 평당가 산출
 * 근거: 계산로직_명세서 §1-1, §1-2
 */
import { PYEONG, type AnalysisConfig, type DealType } from './constants';

/** 금액 문자열(만원 표기) → 천원. "12억5,000" | "5억" | "3,500" */
export function amountToCheonwon(g: string): number | '' {
  if (!g) return '';
  const t = g.replace(/ /g, '');
  if (t.includes('억')) {
    const [eok, rest] = t.split('억');
    const base = parseFloat(eok) * 100000; // 1억 = 100,000천원
    const tail = rest ? parseFloat(rest.replace(/,/g, '')) * 10 : 0;
    return base + (Number.isFinite(tail) ? tail : 0);
  }
  const v = parseFloat(t.replace(/,/g, ''));
  return Number.isFinite(v) ? v * 10 : '';
}

/** 거래방식 판별: 원문 금액 셀 앞 2글자 */
export function parseDealType(raw: string): DealType | '' {
  const head = (raw || '').replace(/ /g, '').slice(0, 2);
  return head === '매매' || head === '전세' || head === '월세' ? head : '';
}

/** 면적 텍스트에서 전용/공급/대지/연면적 추출 (㎡) */
export function parseAreas(text: string): {
  daeji?: number; yeon?: number; supply?: number; excl?: number; floor?: number;
} {
  const s = (text || '').replace(/[ABCDEF]/g, '');
  const num = (re: RegExp) => {
    const m = s.match(re);
    return m ? parseFloat(m[1]) : undefined;
  };
  const daeji = num(/대지\s*([\d.]+)\s*㎡/);
  const yeon = num(/연면적\s*([\d.]+)/);
  const excl = num(/전용\s*([\d.]+)/);
  const supply = daeji ? undefined : (num(/공급\s*([\d.]+)/) ?? num(/계약\s*([\d.]+)/) ?? num(/^([\d.]+)\s*㎡/));
  const fm = s.match(/(\d+)\s*\/\s*\d+\s*층/);
  const floor = fm ? parseFloat(fm[1]) : undefined;
  return { daeji, yeon, supply, excl, floor };
}

export interface SiseRow {
  facility: string;
  deal: DealType;
  amountCheonwon: number;      // 매매가 or 보증금 (천원)
  monthlyRentCheonwon?: number; // 월세 (천원)
  supplyM2?: number;
  exclM2?: number;
  daejiM2?: number;
  yeonM2?: number;
}

export interface SiseComputed extends SiseRow {
  supplyPyeong?: number;
  exclPyeong?: number;
  convertedSale: number;   // 환산매매가 (천원)
  ppaSupply?: number;      // 평당가 공급/계약 기준
  ppaExcl?: number;        // 평당가 전용 기준
  jeonseDepositPerPyeong?: number;
}

/** 시세 행 평당가 계산 (§1-2) */
export function computeSiseRow(r: SiseRow, cfg: AnalysisConfig): SiseComputed {
  const supplyPyeong = r.supplyM2 ? r.supplyM2 * PYEONG : undefined;
  const exclPyeong = r.exclM2 ? r.exclM2 * PYEONG : undefined;
  const yearRent = r.deal === '월세' ? (r.monthlyRentCheonwon ?? 0) * 12 : 0;

  let convertedSale = 0;
  if (r.deal === '매매') convertedSale = r.amountCheonwon;
  else if (r.deal === '월세') convertedSale = (yearRent + r.amountCheonwon * cfg.depositYield) / cfg.capRate;
  else convertedSale = 0; // 전세

  return {
    ...r,
    supplyPyeong,
    exclPyeong,
    convertedSale,
    ppaSupply: supplyPyeong ? convertedSale / supplyPyeong : undefined,
    ppaExcl: exclPyeong ? convertedSale / exclPyeong : undefined,
    jeonseDepositPerPyeong:
      r.deal === '전세' && supplyPyeong ? r.amountCheonwon / supplyPyeong : 0,
  };
}

/** 시세 입력 1행 원문 (붙여넣기/수기) */
export interface SiseRawInput {
  facility: string;
  approvalDate?: string;
  name?: string;
  amountText: string;      // "매매 5억" | "전세 3억" | "월세 3000/50"(보증금/월세)
  areaText: string;        // "전용59.8㎡ 3/15층" 등
}

export interface SiseParsed {
  row: SiseRow;
  ppa: SiseComputed;
  errors: string[];
}

/** 원문 → SiseRow 파싱 + 평당가 계산 (DB전처리 §1-1 로직) */
export function parseSiseRaw(inp: SiseRawInput, cfg: AnalysisConfig): SiseParsed {
  const errors: string[] = [];
  const deal = parseDealType(inp.amountText);
  if (!deal) errors.push('거래방식');

  const body = (inp.amountText || '').replace(/ /g, '').replace(/^(매매|전세|월세)/, '');
  const [amtPart, monthlyPart] = body.split('/');
  const amt = amtPart ? amountToCheonwon(amtPart) : '';
  if (amt === '') errors.push('금액');
  const monthly = monthlyPart ? parseFloat(monthlyPart.replace(/,/g, '')) * 10 : undefined;

  const a = parseAreas(inp.areaText);
  if (!a.excl && !a.supply && !a.daeji && !a.yeon) errors.push('면적');

  const row: SiseRow = {
    facility: inp.facility,
    deal: (deal || '매매') as DealType,
    amountCheonwon: typeof amt === 'number' ? amt : 0,
    monthlyRentCheonwon: monthly,
    supplyM2: a.supply,
    exclM2: a.excl,
    daejiM2: a.daeji,
    yeonM2: a.yeon,
  };
  return { row, ppa: computeSiseRow(row, cfg), errors };
}
