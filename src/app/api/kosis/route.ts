/** KOSIS 주민등록인구(읍면동/5세별) 프록시 — 키 서버보관·캐싱
 *  GET /api/kosis?objL1=11560  (objL1 = 5자리 시군구 법정동코드)
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 86400; // 1일

const BASE = 'https://kosis.kr/openapi/Param/statisticsParameterData.do';

export async function GET(req: NextRequest) {
  const objL1 = req.nextUrl.searchParams.get('objL1');
  const key = process.env.KOSIS_API_KEY;
  if (!key) return NextResponse.json({ error: 'KOSIS_API_KEY 미설정' }, { status: 500 });
  if (!objL1) return NextResponse.json({ error: 'objL1(시군구코드) 필수' }, { status: 400 });

  const url = `${BASE}?method=getList&apiKey=${key}&itmId=T2&objL1=${objL1}&objL2=ALL&format=json&jsonVD=Y&prdSe=Y&newEstPrdCnt=1&orgId=101&tblId=DT_1B04005N`;
  try {
    const j = await (await fetch(url, { next: { revalidate } })).json();
    if (!Array.isArray(j) || (j[0] && j[0].err)) {
      return NextResponse.json({ error: j?.[0]?.errMsg ?? '데이터 없음' }, { status: 502 });
    }
    const region = j[0]?.C1_NM ?? '';
    const period = j[0]?.PRD_DE ?? '';
    const total = Number(j.find((r: any) => r.C2_NM === '계')?.DT ?? 0);
    const ages = j.filter((r: any) => r.C2_NM && r.C2_NM !== '계')
      .map((r: any) => ({ label: String(r.C2_NM), value: Number(r.DT) }))
      .filter((a: any) => Number.isFinite(a.value));
    return NextResponse.json({ region, period, total, ages });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
