import type { PayoutProvider } from "./types"

// ============================================================================
// 페이오니아 Mass Payouts (해외 판매자 · USD 등)
// ============================================================================
// 연동할 때 할 일 (이 파일만 고치면 됨):
//   1. Cloudflare secret 에 PAYONEER_PARTNER_ID · PAYONEER_API_KEY 넣기 (파트너 승인 뒤 발급)
//   2. onboardingUrl: payee 가입 링크 API 호출 (payee id = store.id 로 고정하면 payout_ref 가 필요 없음)
//      → 판매자 정산 화면의 [페이오니아 연결] 버튼이 이 주소로 보냄
//   3. send: Submit Mass Payout API 호출 (client_reference_id = req.id) → { status: "processing", providerRef }
//   4. 상태 알림(IPCN/웹훅) 라우트에서 payouts.status 를 paid / failed 로 바꾸기
// 페이오니아 API 문서: https://developer.payoneer.com
// ============================================================================

export const payoneerProvider: PayoutProvider = {
  id: "payoneer",
  label: "Payoneer",
  isConfigured: () =>
    !!process.env.PAYONEER_PARTNER_ID && !!process.env.PAYONEER_API_KEY && process.env.PAYONEER_ENABLED === "1",
  supports: () => true,
  async onboardingUrl() {
    // TODO(페이오니아 연동): 가입 링크 API
    return null
  },
  async send() {
    // TODO(페이오니아 연동): 실제 API 호출. isConfigured() 가 false 인 동안은 여기 오지 않음.
    return { status: "failed", error: "페이오니아 연동 전입니다" }
  },
}
