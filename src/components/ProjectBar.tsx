'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

/** 상단 프로젝트 바 — 저장/불러오기 (Supabase) */
export default function ProjectBar() {
  const { projectName, setProjectName, config, sise, tx, txMeta, loadSnapshot } = useStore();
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const r = await fetch('/api/projects'); const j = await r.json();
      if (j.projects) setList(j.projects);
    } catch { /* noop */ }
  }
  useEffect(() => { refresh(); }, []);

  async function save() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, config, sise, tx, txMeta }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMsg('저장됨'); refresh();
    } catch (e) { setMsg('저장 실패: ' + String(e)); }
    finally { setBusy(false); }
  }

  async function load(id: string) {
    if (!id) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`/api/projects/${id}`); const j = await r.json();
      if (j.error) throw new Error(j.error);
      loadSnapshot({ projectName: j.name, config: j.config, sise: j.sise, tx: j.tx, txMeta: j.txMeta });
      setMsg('불러옴');
    } catch (e) { setMsg('불러오기 실패: ' + String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="no-print flex items-center gap-2 border-b bg-white px-6 py-2 text-sm">
      <input value={projectName} onChange={(e) => setProjectName(e.target.value)}
        className="w-48 rounded border px-2 py-1" placeholder="프로젝트명" />
      <button onClick={save} disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50">저장</button>
      <select onChange={(e) => load(e.target.value)} className="rounded border px-2 py-1" defaultValue="">
        <option value="">불러오기…</option>
        {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}
