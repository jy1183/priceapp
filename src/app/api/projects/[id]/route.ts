/** 프로젝트 불러오기(GET by id) */
import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getAdmin();
  if (!db) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 미설정' }, { status: 500 });
  const { data: proj, error: e1 } = await db.from('projects').select('id,name,config').eq('id', id).single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 404 });
  const { data: snap } = await db.from('analysis_snapshots')
    .select('config,filters,result').eq('project_id', id).eq('kind', 'full')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json({
    name: proj.name, config: snap?.config ?? proj.config,
    sise: snap?.result?.sise ?? [], tx: snap?.result?.tx ?? [], txMeta: snap?.filters ?? null,
  });
}
