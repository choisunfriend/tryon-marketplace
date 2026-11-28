// (2026-11-28) 로그인 창의 약관 동의 항목 — 쿠팡·아마존 가입 화면 구조 참고
//   [모두 동의] → [필수] 만 14세 이상 · [필수] 이용약관 · [필수] 개인정보 수집·이용 · [필수] 예약 시 미용실 제공 · [선택] 마케팅 수신
// 약관 내용을 바꾸면 CONSENT_VERSION 을 올리세요. (버전이 바뀌면 다시 동의받는 용도로 쓸 수 있게 기록합니다.)
export const CONSENT_VERSION = "2026-12-01"

export type ConsentId = "age14" | "terms" | "privacy" | "salon_share" | "marketing"

export interface ConsentItem {
  id: ConsentId
  required: boolean
  label: [string, string] // [한국어, English]
  doc?: string // 약관 전문 키 (policy-text.ts) — 있으면 오른쪽 ">" 로 열람
}

export const CONSENT_ITEMS: ConsentItem[] = [
  { id: "age14", required: true, label: ["만 14세 이상입니다", "I am 14 years of age or older"] },
  { id: "terms", required: true, label: ["Today's Stylepeek 이용약관 동의", "Terms of Service"], doc: "terms" },
  { id: "privacy", required: true, label: ["개인정보 수집 및 이용 동의", "Collection and use of personal information"], doc: "privacy-consent" },
  { id: "salon_share", required: true, label: ["예약 시 미용실에 개인정보 제공 동의", "Sharing my booking details with the salon"], doc: "salon-share" },
  { id: "marketing", required: false, label: ["이벤트·혜택 알림 수신 동의", "Receive offers and event news"], doc: "marketing" },
]

const KEY = "gyeol_consent_pending"

/** 로그인 전에 체크한 내용을 잠깐 보관 → 로그인 끝나면 서버에 저장 */
export function savePendingConsent(items: Record<ConsentId, boolean>) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ items, version: CONSENT_VERSION })) } catch {}
}
export function takePendingConsent(): { items: Record<string, boolean>; version: string } | null {
  try {
    const v = sessionStorage.getItem(KEY)
    if (!v) return null
    sessionStorage.removeItem(KEY)
    return JSON.parse(v)
  } catch { return null }
}
