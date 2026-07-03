# 주변 가격 분석 앱 (priceapp)

엑셀(xlsm) 기반 주변 가격 검토 프로세스를 웹 앱으로 전환. **Next.js 15 + Supabase + Vercel**.
근거: `20260703 가격분석앱 실행계획.md`, `20260703 계산로직_명세서.md`.

## 현재 구현 (Phase 0 + 계산 엔진)
- `src/lib/calc/` — 엑셀 계산 로직 TS 이식 (시세/실거래 평당가, 집계, 파싱)
- `src/lib/calc/__tests__/golden.test.ts` — **골든 데이터셋 0 오차 검증(통과)**
- `src/app/api/molit/route.ts` — 국토부 실거래가 프록시(CORS 우회·키 서버보관·페이징·동 필터·캐싱)
- `src/app/settings/` — 분석환경설정 골격
- `supabase/schema.sql` — DB 스키마

## 로컬 실행
```bash
npm install
cp .env.example .env.local   # 키 채우기
npm run dev                  # http://localhost:3000
npm test                     # 골든 테스트
```

## 배포 (Vercel + Supabase)
1. **Supabase**: 프로젝트 생성 → SQL Editor에 `supabase/schema.sql` 실행 → URL·anon key 확보
2. **Vercel**: 이 폴더를 GitHub에 push → Vercel Import → 환경변수 등록
   - `MOLIT_API_KEY` (서버 전용, xlsm의 발급 키)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. push 시 자동 배포

## 계산 설계 결정(2026-07-03)
- 평 환산계수 **0.3025 통일** (0.3026 삭제)
- 단독다가구 평당가 **금액/대지×3.3058** (전 시설 통일)
- 보증금운영수익률 **독립 변수** + 산정근거 메모 저장
- **"최근 N년" = 준공연도 기준** (거래일 기간필터와 별개)

## 다음 단계 (실행계획 Phase 1~5)
Phase1 실거래 조회·분석 → Phase2 시세 입력·분석 → Phase3 종합+저장+검증리포트 → Phase4 지역분석 → Phase5 내보내기.
