import type { PayoutProviderId } from "@/lib/countries"

// ============================================================================
// (2026-11-01) 정산 업체 어댑터 — 업체 하나 = 이 인터페이스를 구현한 파일 하나
// ============================================================================

export interface PayoutStore {
  id: string
  name: string
  country: string
  currency: string
  contact_email: string | null
  payout_ref: string | null // 업체 쪽 판매자 id
  payout_account: Record<string, unknown> | null // 한국: { bank, holder, number }
}

export interface PayoutRequest {
  id: string // 우리 payouts.id — 업체에 멱등 키로 넘김
  amountMinor: number
  currency: string
  store: PayoutStore
}

export type PayoutResult =
  | { status: "processing" | "paid"; providerRef?: string }
  | { status: "failed"; error: string }

export interface PayoutProvider {
  id: PayoutProviderId
  label: string
  // 서버 secret 이 다 있어 실제로 쓸 수 있는지 (없으면 수동 모드로 대신 처리)
  isConfigured(): boolean
  supports(country: string, currency: string): boolean
  // 판매자가 업체에 가입·계좌 연결하는 주소 (페이오니아 가입 링크 등). 없으면 null
  onboardingUrl?(store: PayoutStore): Promise<string | null>
  // 송금 요청
  send(req: PayoutRequest): Promise<PayoutResult>
}
