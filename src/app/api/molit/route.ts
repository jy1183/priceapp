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
  let pageNo = 1;
  const numOfRows = 100;
  try {
    while (pageNo <= 50) {
      const url = `${base}?serviceKey=${key}&LAWD_CD=${lawdCd}&DEAL_YMD=${ymd}&pageNo=${pageNo}&numOfRows=${numOfRows}`;
      const res = await fetch(url, { headers: { Accept: 'application/xml' }, next: { revalidate } });
      if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
      const xml = await res.text();
      const doc = parser.parse(xml);
      const body = doc?.response?.body;
      const total = Number(body?.totalCount ?? 0);
      let raw = body?.items?.item ?? [];
      if (!Array.isArray(raw)) raw = raw ? [raw] : [];
      for (const it of raw) {
        if (!dong || String(it.umdNm ?? '').trim() === dong) items.push(it);
      }
      if (raw.length < numOfRows || pageNo * numOfRows >= total) break;
      pageNo += 1;
    }
    return NextResponse.json({ facility, trade, lawdCd, ymd, dong, count: items.length, items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
