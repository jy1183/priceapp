'use client';
import { useMemo } from 'react';
import { useStore } from '@/lib/store';

type Level = 'pass' | 'warn' | 'fail';
interface Check { level: Level; rule: string; detail: string; }

/** 검증 리포트 — 대사 규칙·이상치·제외 데이터 (계산로직_명세서 §8) */
export default function ValidationPage() {
  const { sise, siseMeta, tx } = useStore();

  const checks: Check[] = useMemo(() => {
    const out: Check[] = [];

    // 대사① 시세: 파싱건수 = 확정(무오류)건수 + 오류건수
    const siseConfirmed = sise.length;
    out.push({
      level: siseMeta.errorCount === 0 ? 'pass' : 'warn',
      rule: '시세 대사: 파싱 = 확정 + 오류',
      detail: `파싱 ${siseMeta.parsedCount} = 확정 ${siseConfirmed} + 오류 ${siseMeta.errorCount}`,
    });

    // 대사② 실거래: 평당가 산출 성공 vs 결측
    const txTotal = tx.length;
    const txNull = tx.filter((t) => t.ppa == null).length;
    out.push({
      level: txNull === 0 ? 'pass' : 'warn',
      rule: '실거래 대사: 평당가 산출',
      detail: `조회 ${txTotal}건 중 평당가 결측 ${txNull}건 (면적/금액 누락)`,
    });

    // 이상치: 평당가 정상범위 (100 ~ 500,000 천원/평)
    const outlier = tx.filter((t) => t.ppa != null && (t.ppa < 100 || t.ppa > 500000));
    out.push({
      level: outlier.length === 0 ? 'pass' : 'warn',
      rule: '실거래 이상치: 평당가 범위(100~500,000)',
      detail: outlier.length === 0 ? '이상치 없음' : `범위 밖 ${outlier.length}건 (단위 오류·면적 이상 의심)`,
    });

    // 이상치: 면적 0/결측
    const areaBad = tx.filter((t) => !t.areaM2 || t.areaM2 <= 0).length;
    out.push({
      level: areaBad === 0 ? 'pass' : 'warn',
      rule: '실거래 면적 유효성',
      detail: areaBad === 0 ? '면적 정상' : `면적 0/결측 ${areaBad}건`,
    });

    // 평균이 min~max 범위 내인지(시세 전용)
    const ppas = sise.map((s) => s.ppaExcl).filter((v): v is number => v != null);
    if (ppas.length) {
      const avg = ppas.reduce((a, b) => a + b, 0) / ppas.length;
      const inRange = avg >= Math.min(...ppas) && avg <= Math.max(...ppas);
      out.push({ level: inRange ? 'pass' : 'fail', rule: '시세 평균 범위 정합', detail: `평균 ${Math.round(avg).toLocaleString()} ∈ [${Math.round(Math.min(...ppas)).toLocaleString()}, ${Math.round(Math.max(...ppas)).toLocaleString()}]` });
    }

    return out;
  }, [sise, siseMeta, tx]);

  const badge = (l: Level) => l === 'pass' ? ['통과', 'bg-emerald-100 text-emerald-700'] : l === 'warn' ? ['경고', 'bg-amber-100 text-amber-700'] : ['실패', 'bg-red-100 text-red-700'];
  const passRate = checks.length ? Math.round((checks.filter((c) => c.level === 'pass').length / checks.length) * 100) : 0;

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">검증 리포트</h1>
      <p className="mb-4 text-sm text-gray-600">
        분석 결과의 정합성을 자동 점검합니다(대사 규칙·이상치·제외 데이터). 검증 일시 {new Date().toLocaleString('ko-KR')} · 통과율 {passRate}%
      </p>

      {checks.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">검증할 데이터가 없습니다. 시세·실거래 분석을 먼저 실행하세요.</div>
      ) : (
        <div className="space-y-2">
          {checks.map((c, i) => {
            const [txt, cls] = badge(c.level);
            return (
              <div key={i} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{txt}</span>
                <div>
                  <div className="text-sm font-medium">{c.rule}</div>
                  <div className="text-xs text-gray-500">{c.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
