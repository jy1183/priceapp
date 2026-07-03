export default function Home() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">주변 가격 분석 앱</h1>
      <p className="mb-6 text-gray-600">
        엑셀 기반 주변 가격 검토 프로세스를 웹으로 전환한 도구입니다.
        시세 입력 → 실거래 조회 → 분석 → 종합 검토 → 지역분석 → 보고서 내보내기까지 한 흐름으로 제공합니다.
      </p>
      <div className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold">개발 진행 상태 (Phase 0)</h2>
        <ul className="space-y-1 text-sm text-gray-700">
          <li>✅ 계산 엔진 이식 + 골든 데이터셋 검증(0 오차)</li>
          <li>✅ 국토부 실거래가 API 프록시 (/api/molit)</li>
          <li>✅ 분석환경설정 골격 (자본환원율·보증금운영수익률 등)</li>
          <li>⬜ Supabase 프로젝트 저장/불러오기</li>
          <li>⬜ 각 분석 화면 · 차트 · 내보내기</li>
        </ul>
      </div>
    </div>
  );
}
