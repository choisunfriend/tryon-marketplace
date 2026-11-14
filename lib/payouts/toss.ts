import type { PayoutProvider } from "./types"

// ============================================================================
// 토스페이먼츠 지급대행 (한국 판매자 · KRW)
// ============================================================================
// 연동할 때 할 일 (이 파일만 고치면 됨):
//   1. Cloudflare secret 에 TOSS_PAYOUT_SECRET_KEY 넣기 (토스 상점관리자에서 발급)
//   2. onboardingUrl: 필요 없음 — 판매자 등록은 send 전에 API 로 (store.payout_account 의 은행·계좌 사용),
//      받은 셀러 id 는 stores.payout_ref 에 저장
//   3. send: 지급 요청 API 호출 → { status: "processing", providerRef: 토스 지급 id }
//   4. 결과 웹훅을 받는 라우트를 만들어 payouts.status 를 paid / failed 로 바꾸기
//      (지금은 정산 화면에서 운영자가 직접 바꿀 수 있음)
// 토스 API 문서: https://docs.tosspayments.com (지급대행)
// ============================================================================

export const tossProvider: PayoutProvider = {
  id: "toss",
  label: "토스페이먼츠 지급대행",
  isConfigured: () => !!process.env.TOSS_PAYOUT_SECRET_KEY && process.env.TOSS_PAYOUT_ENABLED === "1",
  supports: (country, currency) => country === "KR" && currency === "KRW",
  async send() {
    // TODO(토스 연동): 실제 API 호출. isConfigured() 가 false 인 동안은 여기 오지 않음(수동으로 대신 처리).
    return { status: "failed", error: "토스 지급대행 연동 전입니다" }
  },
}
