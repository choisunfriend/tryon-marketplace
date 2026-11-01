// ============================================================================
// (2026-11-01) 입점 가능한 나라 — 나라를 늘릴 때 여기에 한 줄 추가
// ============================================================================
//   currency       정산 통화 (장부·지급 단위)
//   minorDigits    최소 단위 자릿수 (KRW 0 · USD 2 → 금액은 센트로 저장)
//   payoutProvider 기본 정산 업체 (src/lib/payouts)
// ============================================================================

export type PayoutProviderId = "manual" | "toss" | "payoneer"

export interface CountryConfig {
  code: string
  name: string
  currency: string
  minorDigits: number
  payoutProvider: PayoutProviderId
}

export const COUNTRIES: Record<string, CountryConfig> = {
  KR: { code: "KR", name: "대한민국", currency: "KRW", minorDigits: 0, payoutProvider: "toss" },
  US: { code: "US", name: "United States", currency: "USD", minorDigits: 2, payoutProvider: "payoneer" },
}

export function countryOf(code: string | null | undefined): CountryConfig | null {
  return (code && COUNTRIES[code]) || null
}

export function minorDigits(currency: string): number {
  return Object.values(COUNTRIES).find((c) => c.currency === currency)?.minorDigits ?? 2
}

// 화면 금액 ↔ 저장 정수
export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** minorDigits(currency))
}

export function formatMinor(minor: number, currency: string): string {
  const v = minor / 10 ** minorDigits(currency)
  try {
    return new Intl.NumberFormat(currency === "KRW" ? "ko-KR" : "en-US", { style: "currency", currency }).format(v)
  } catch {
    return `${v} ${currency}`
  }
}
