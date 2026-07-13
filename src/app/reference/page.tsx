/** 참고 — 전용면적 카테고리별 수요 특성 (R5). 정적 페이지(사용자 제공 이미지 전문 전사). */

const ROWS = [
  {
    cat: '40㎡ 이하 (초소형)',
    room: '1룸 (원룸) ~ 1.5룸',
    house: '1인 가구',
    desc: '독립된 침실 1개 혹은 거실 분리형(1.5룸). 공간 효율성을 위한 대면형 오픈 키친 중심 설계.',
  },
  {
    cat: '40㎡ ~ 60㎡ (소형)',
    room: '2룸 ~ 3룸 (소형)',
    house: '1~2인 가구',
    desc: '신혼부부 등 2인 가구 주력. 최근 59㎡ 4베이 설계 도입으로 3룸 2욕실 구조가 보편화되며 활용도 극대화.',
  },
  {
    cat: '60㎡ ~ 85㎡ (중소형)',
    room: '3룸 ~ 4룸 (알파룸)',
    house: '3~4인 가구',
    desc: '취학 자녀를 둔 표준 가구. 거실 중심 생활과 자녀 방 분리가 동시 요구됨. 84㎡ 4베이-알파룸 구조의 치열한 경쟁 구간.',
  },
  {
    cat: '85㎡ ~ 135㎡ (중대형)',
    room: '4룸 이상',
    house: '4인 이상 가구',
    desc: '노부모 부양 또는 다자녀 가구. 세대원 간 프라이버시가 핵심이며, 소음/냄새 차단을 위한 분리형 주방 구조 선호.',
  },
  {
    cat: '135㎡ 초과 (대형)',
    room: '4룸 이상 (멀티룸 포함)',
    house: '다인 가구 / 자산가',
    desc: '하이엔드 슈퍼 리치 수요. 방의 개수보다 서재, 게스트룸 등 공간의 질적 특화와 거실의 이면 개방 등이 가격을 견인.',
  },
];

export default function ReferencePage() {
  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">참고 — 전용면적 카테고리별 수요 특성</h1>
      <p className="mb-4 text-sm text-gray-600">
        전용면적 구간별 주력 구조·목표 가구원·수요 계층의 일반적 특성을 정리한 참고 자료입니다.
      </p>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2 whitespace-nowrap">전용면적 카테고리</th>
              <th className="px-3 py-2 whitespace-nowrap">주력 방의 개수 및 구조</th>
              <th className="px-3 py-2 whitespace-nowrap">목표 가구원 수</th>
              <th className="px-3 py-2">수요 계층 및 구조적 특성 분석</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.cat} className="border-t align-top">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.cat}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.room}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.house}</td>
                <td className="px-3 py-2 text-gray-700">{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        ※ 본 참고표는 40/60/85/135㎡ 5구간 기준입니다. 본 앱의 평형대 분석(③ 시세 분석·④ 실거래 분석)은 40/55/65/85/135㎡ 6구간 기준으로 집계합니다.
      </p>
    </div>
  );
}
