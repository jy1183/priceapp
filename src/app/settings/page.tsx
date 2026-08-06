'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

/**
 * 분석환경설정 — 실행계획 §7
 * 전역 기본값 편집. 자본환원율 / 보증금운영수익률(독립+산정근거 메모) / 상위평균 기준
 * '적용' 버튼을 눌러야 스토어(config)에 반영되어 가격 분석 화면들이 재계산됨.
 */
export default function SettingsPage() {
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);
  const [cfg, setCfg] = useState(config);
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState('');

  // 스토어 값이 바뀌면(로컬 저장 복원 등) 아직 편집하지 않은 경우에만 동기화
  useEffect(() => {
    if (!touched) setCfg(config);
  }, [config, touched]);

  function edit(next: typeof cfg) {
    setCfg(next);
    setTouched(true);
    setMsg('');
  }

  function apply() {
    setConfig(cfg);
    setTouched(false);
    setMsg('적용됨 — 가격 분석 화면에 반영되었습니다.');
  }

  const dirty = touched;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">분석환경설정</h1>
      <p className="mb-6 text-sm text-gray-600">
        전역 기본값입니다. 신규 프로젝트에 자동 적용되며, 프로젝트별·화면별로 오버라이드할 수 있습니다.
        값을 수정한 뒤 <strong>적용</strong>을 눌러야 가격 분석 화면들이 새 값으로 다시 계산됩니다.
      </p>

      <div className="space-y-5 rounded-lg border bg-white p-6">
        <Field label="자본환원율" hint="순수익 가정 + 비용 감안 (기본 0.07 = 7%)">
          <input type="number" step="0.001" value={cfg.capRate}
            onChange={(e) => edit({ ...cfg, capRate: Number(e.target.value) })}
            className="w-32 rounded border px-2 py-1" />
        </Field>

        <Field label="보증금운영수익률" hint="독립 변수 — 자본환원율과 무관하게 설정 (기본 0.035)">
          <input type="number" step="0.001" value={cfg.depositYield}
            onChange={(e) => edit({ ...cfg, depositYield: Number(e.target.value) })}
            className="w-32 rounded border px-2 py-1" />
        </Field>

        <Field label="보증금운영수익률 산정 근거" hint="이 값을 어떻게 정했는지 기록 (보고서·재조회 추적)">
          <textarea value={cfg.depositYieldMemo}
            onChange={(e) => edit({ ...cfg, depositYieldMemo: e.target.value })}
            rows={2} className="w-full rounded border px-2 py-1 text-sm" />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="상위10% 기준" hint="백분위">
            <input type="number" step="0.05" value={cfg.topPercentiles.top10}
              onChange={(e) => edit({ ...cfg, topPercentiles: { ...cfg.topPercentiles, top10: Number(e.target.value) } })}
              className="w-full rounded border px-2 py-1" />
          </Field>
          <Field label="상위30% 기준" hint="백분위">
            <input type="number" step="0.05" value={cfg.topPercentiles.top30}
              onChange={(e) => edit({ ...cfg, topPercentiles: { ...cfg.topPercentiles, top30: Number(e.target.value) } })}
              className="w-full rounded border px-2 py-1" />
          </Field>
          <Field label="상위50% 기준" hint="백분위">
            <input type="number" step="0.05" value={cfg.topPercentiles.top50}
              onChange={(e) => edit({ ...cfg, topPercentiles: { ...cfg.topPercentiles, top50: Number(e.target.value) } })}
              className="w-full rounded border px-2 py-1" />
          </Field>
        </div>

        <div className="pt-2 text-xs text-gray-500">
          ※ 평 환산계수 0.3025 통일 · 단독다가구 평당가 3.3058 통일 · &quot;최근 N년&quot;은 준공연도 기준.
        </div>

        <div className="flex items-center gap-3 border-t pt-4">
          <button onClick={apply} disabled={!dirty}
            className="rounded bg-blue-600 px-4 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50">
            적용
          </button>
          {dirty && <span className="text-xs text-amber-600">변경사항이 있습니다 — 적용을 눌러야 반영됩니다.</span>}
          {!dirty && msg && <span className="text-xs text-green-600">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {hint && <div className="mb-1 text-xs text-gray-500">{hint}</div>}
      {children}
    </div>
  );
}
