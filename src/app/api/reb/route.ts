/** 부동산원 r-one 프록시 (키 서버보관·XML→JSON·캐싱)
 *  GET /api/reb?mode=items&statbl=A_2024_00016
 *  GET /api/reb?mode=data&statbl=A_2024_00016&cycle=MM&cls=500008&start=202001&end=202506
 */
import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const runtime = 'nodejs';
export const revalidate = 21600; // 6h 캐싱

const REB_ITM = 'https://www.reb.or.kr/r-one/openapi/SttsApiTblItm.do';
const REB_DAT = 'https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do';
const parser = new XMLParser({ ignoreAttributes: false });

function rows(doc: any): any[] {
  const r = doc?.SttsApiTblItm?.row ?? doc?.SttsApiTblData?.row ?? doc?.row ?? [];
  return Array.isArray(r) ? r : r ? [r] : [];
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get('mode') ?? 'data';
  const statbl = sp.get('statbl');
  const key = process.env.REB_API_KEY;
  if (!key) return NextResponse.json({ error: 'REB_API_KEY 미설정' }, { status: 500 });
  if (!statbl) return NextResponse.json({ error: 'statbl 필수' }, { status: 400 });

  try {
    if (mode === 'items') {
      const url = `${REB_ITM}?KEY=${key}&Type=xml&pIndex=1&pSize=1000&STATBL_ID=${statbl}`;
      const doc = parser.parse(await (await fetch(url, { next: { revalidate } })).text());
      const items = rows(doc)
        .filter((x) => String(x.ITM_TAG ?? '').includes('분류'))
        .map((x) => ({ clsId: String(x.ITM_ID), name: String(x.ITM_NM || x.ITM_FULLNM), fullNm: String(x.ITM_FULLNM || x.ITM_NM), par: String(x.PAR_ITM_ID) }));
      return NextResponse.json({ items });
    }
    const cycle = sp.get('cycle') ?? 'MM';
    const cls = sp.get('cls');
    const start = sp.get('start'); const end = sp.get('end');
    if (!cls || !start || !end) return NextResponse.json({ error: 'cls, start, end 필수' }, { status: 400 });
    const url = `${REB_DAT}?KEY=${key}&Type=xml&pIndex=1&pSize=1000&STATBL_ID=${statbl}&DTACYCLE_CD=${cycle}&CLS_ID=${cls}&START_WRTTIME=${start}&END_WRTTIME=${end}`;
    const doc = parser.parse(await (await fetch(url, { next: { revalidate } })).text());
    const series = rows(doc)
      .map((x) => ({ time: String(x.WRTTIME_IDTFR_ID), value: Number(x.DTA_VAL) }))
      .filter((p) => p.time && Number.isFinite(p.value))
      .sort((a, b) => a.time.localeCompare(b.time));
    const msg = doc?.RESULT?.MESSAGE ?? doc?.SttsApiTblData?.head?.RESULT?.MESSAGE;
    return NextResponse.json({ series, count: series.length, message: msg ?? null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
