/**
 * 국토부 실거래가 프록시 (CORS 우회 + 키 서버 보관 + 페이징 + 동 필터)
 * GET /api/molit?facility=오피스텔&trade=매매&lawdCd=11560&ymd=202506&dong=영등포동8가
 */
import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import { endpointUrl, type Facility, type Trade } from '@/lib/molit';

export const runtime = 'nodejs';
export const revalidate = 3600; // 응답 캐싱(호출 한도 절약)

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const facility = sp.get('facility') as Facility | null;
  const trade = (sp.get('trade') as Trade) ?? '매매';
  const lawdCd = sp.get('lawdCd');
  const ymd = sp.get('ymd');
  const dong = sp.get('dong') ?? '';

  if (!facility || !lawdCd || !ymd) {
    return NextResponse.json({ error: 'facility, lawdCd, ymd 필수' }, { status: 400 });
  }
  const base = endpointUrl(facility, trade);
  if (!base) return NextResponse.json({ error: `${facility} ${trade} 미지원` }, { status: 400 });

  const key = process.env.MOLIT_API_KEY;
  if (!key) return NextResponse.json({ error: 'MOLIT_API_KEY 미설정' }, { status: 500 });

  const items: Record<string, unknown>[] = [];
  const numOfRows = 1000; // 대부분의 구·월 조합은 1페이지로 완결

  // 한 페이지 조회 → response.body 반환
  async function fetchBody(pageNo: number) {
    const url = `${base}?serviceKey=${key}&LAWD_CD=${lawdCd}&DEAL_YMD=${ymd}&pageNo=${pageNo}&numOfRows=${numOfRows}`;
    const res = await fetch(url, { headers: { Accept: 'application/xml' }, next: { revalidate } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parser.parse(await res.text())?.response?.body;
  }
  // 페이지 body에서 동 필터링해 items에 누적 → 필터 전 원본 행 수 반환
  function collect(body: any): number {
    let raw = body?.items?.item ?? [];
    if (!Array.isArray(raw)) raw = raw ? [raw] : [];
    for (const it of raw) {
      if (!dong || String(it.umdNm ?? '').trim() === dong) items.push(it);
    }
    return raw.length;
  }

  try {
    // 1페이지로 totalCount·실제 페이지 크기 파악 후, 나머지 페이지는 병렬 조회
    const first = await fetchBody(1);
    const pageSize = collect(first) || numOfRows; // API가 numOfRows를 축소해도 실제 반환 크기 사용
    const total = Number(first?.totalCount ?? 0);
    const lastPage = Math.min(50, Math.ceil(total / pageSize));
    if (lastPage > 1) {
      const rest = await Promise.all(
        Array.from({ length: lastPage - 1 }, (_, i) => fetchBody(i + 2)),
      );
      rest.forEach(collect);
    }
    return NextResponse.json({ facility, trade, lawdCd, ymd, dong, count: items.length, items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
