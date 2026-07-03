/** 프로젝트 저장(POST)·목록(GET) — service_role 서버 처리 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const db = getAdmin();
  if (!db) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 미설정' }, { status: 500 });
  const { data, error } = await db.from('projects').select('id,name,created_at').order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}

export async function POST(req: NextRequest) {
  const db = getAdmin();
  if (!db) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 미설정' }, { status: 500 });
  const body = await req.json();
  const { name, config, sise, tx, txMeta } = body ?? {};
  const { data: proj, error: e1 } = await db.from('projects')
    .insert({ name: name || '무제 검토', config: config ?? {}, region_dong: txMeta?.region ?? null })
    .select('id').single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const { error: e2 } = await db.from('analysis_snapshots')
    .insert({ project_id: proj.id, kind: 'full', config: config ?? {}, filters: txMeta ?? {}, result: { sise: sise ?? [], tx: tx ?? [] } });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  return NextResponse.json({ id: proj.id });
}
