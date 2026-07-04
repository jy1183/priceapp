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

/* ===== 네이버 부동산 붙여넣기 파서 (시세파싱참고.md VBA 이식) ===== */
const _BLD_TYPES = ['아파트','원룸','상가점포','오피스텔','빌라/연립','빌라','연립다세대','단독/다가구','단독주택','다가구','상가','사무실','공장/창고','토지','주택','다세대','전원주택','상가주택','상가건물','지식산업센터','기타'];

function isPriceLine(s: string): boolean {
  return /매매|전세|월세|억/.test(s);
}
function isBuildingType(s: string): boolean { return _BLD_TYPES.includes(s.trim()); }
function isYearInfo(s: string): boolean { return s.includes('년차'); }
function extractApprovalDate(s: string): string {
  const p = s.indexOf('(');
  return (p > 0 ? s.slice(0, p) : s).trim();
}
function isFloorLine(s: string): boolean { return s.includes('층') && /\d/.test(s); }
function isDirectionLine(s: string): boolean {
  if (['남향','북향','동향','서향','남동향','남서향','북동향','북서향'].includes(s)) return true;
  return s.endsWith('향') && s.length <= 5;
}
const _NOISE = ['확인매물','매물 보러가기','관심매물','매물 이미지','매물목록','VR이미지','360도','Npay','공인중개사','중개사','매경부동산','부동산써브','부동산뱅크','부동산렛츠','우리집부동산','피터팬','텐컴즈','산업부동산','직거래','집주인','소유자','현장','여기서부터','■','☞'];
function isNoiseLine(s: string): boolean {
  if (s === 'VR' || s === '아실') return true;
  if (s.includes('이미지') && s.includes('개')) return true;
  return _NOISE.some((k) => s.includes(k));
}
/** 네이버 유형라벨 → 시세 시설 라벨 정규화 */
function normFacility(t: string): string {
  const map: Record<string, string> = { '빌라/연립': '빌라／연립', '빌라': '빌라／연립', '다세대': '빌라／연립', '공장/창고': '공장／창고', '단독주택': '단독/다가구', '다가구': '단독/다가구', '주택': '단독/다가구', '상가': '상가점포' };
  return map[t] ?? (t || '기타');
}

/** 네이버 매물목록 원문(여러 줄) → 물건별 원문 항목 배열 */
export function parseNaverPaste(text: string): SiseRawInput[] {
  const lines = (text || '').replace(/\r/g, '').split('\n').map((s) => s.trim());
  const n = lines.length;
  const priceIdx: number[] = [];
  for (let i = 0; i < n; i++) if (lines[i] && isPriceLine(lines[i])) priceIdx.push(i);

  const items: SiseRawInput[] = [];
  for (let p = 0; p < priceIdx.length; p++) {
    const pi = priceIdx[p];
    const endIdx = p < priceIdx.length - 1 ? priceIdx[p + 1] - 1 : n - 1;

    // 건물명: 가격 줄 바로 위 첫 비어있지 않은 줄(노이즈/가격/유형 아니면 채택)
    let name = '';
    for (let r = pi - 1; r >= 0; r--) {
      const va = lines[r];
      if (va !== '') { if (!isNoiseLine(va) && !isPriceLine(va) && !isBuildingType(va)) name = va; break; }
    }
    const price = lines[pi];
    let bldType = '', apvd = '', area = '', fl = '', direc = '', feat = '';
    let gotArea = false;
    for (let r = pi + 1; r <= endIdx; r++) {
      const v = lines[r];
      if (v === '') continue;
      if (!gotArea) {
        if (isNoiseLine(v)) continue;
        else if (isBuildingType(v) && bldType === '') bldType = v;
        else if (isYearInfo(v) && apvd === '') apvd = extractApprovalDate(v);
        else if (v.includes('㎡') && area === '') {
          // 유형이 면적 줄 앞에 붙는 경우("아파트66㎡ (전용55)4/14층") 접두어 분리
          let a = v;
          if (bldType === '') {
            const bt = _BLD_TYPES.find((t) => a.startsWith(t));
            if (bt) { bldType = bt; a = a.slice(bt.length).trim(); }
          }
          area = a; gotArea = true;
        }
      } else {
        if (isFloorLine(v) && fl === '') fl = v;
        else if (isDirectionLine(v) && direc === '') direc = v;
        else if (!isNoiseLine(v) && !isPriceLine(v)) feat = feat ? feat + ' ' + v : v;
      }
    }
    if (area === '') continue;
    let areaFL = area;
    if (fl) areaFL += ' ' + fl;
    if (direc) areaFL += ' ' + direc;
    items.push({ facility: normFacility(bldType), approvalDate: apvd, name, amountText: price, areaText: areaFL });
  }
  return items;
}
