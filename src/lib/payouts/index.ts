import { countryOf, type PayoutProviderId } from "@/lib/countries"
import { manualProvider } from "./manual"
import { payoneerProvider } from "./payoneer"
import { tossProvider } from "./toss"
import type { PayoutProvider, PayoutStore } from "./types"

export type { PayoutProvider, PayoutRequest, PayoutResult, PayoutStore } from "./types"

const PROVIDERS: Record<PayoutProviderId, PayoutProvider> = {
  manual: manualProvider,
  toss: tossProvider,
  payoneer: payoneerProvider,
}

export function getProvider(id: string | null | undefined): PayoutProvider | null {
  return (id && PROVIDERS[id as PayoutProviderId]) || null
}

// 이 입점사가 원래 쓸 업체 (입점사에 지정한 것 → 없으면 나라 기본값)
export function intendedProvider(store: { country: string; payout_provider?: string | null }): PayoutProvider {
  return getProvider(store.payout_provider) ?? getProvider(countryOf(store.country)?.payoutProvider) ?? manualProvider
}

// 지금 실제로 쓸 업체 — 원래 업체가 아직 연동 전(secret 없음)이거나 안 맞으면 수동
export function activeProvider(store: PayoutStore & { payout_provider?: string | null }): PayoutProvider {
  const p = intendedProvider(store)
  return p.isConfigured() && p.supports(store.country, store.currency) ? p : manualProvider
}
