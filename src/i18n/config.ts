// ============================================================================
// (2026-11-14) 언어 — 영어(en)·한국어(ko) 두 가지
// ============================================================================
// 정하는 순서 (src/i18n/server.ts · middleware.ts)
//   ① 주소의 ?lang=ko|en  — GYEOL 앱이 옷장·지도를 열 때 앱 언어를 붙여 보냄 (쿠키로 기억)
//   ② 쿠키 NEXT_LOCALE    — 전에 고른 언어 (관리자 화면의 EN/한국어 버튼도 이걸 씀)
//   ③ 브라우저 언어(Accept-Language) — 한국어면 ko, 나머지는 en
// ============================================================================

export const defaultLocale = "en" as const
export const locales = ["en", "ko"] as const

export type Locale = (typeof locales)[number]

export const LOCALE_COOKIE = "NEXT_LOCALE"
export const LOCALE_HEADER = "x-gyeol-lang"
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function normalizeLocale(v: unknown): Locale | null {
  const s = String(v ?? "").trim().toLowerCase()
  if (s === "ko" || s.startsWith("ko-") || s.startsWith("ko_")) return "ko"
  if (s === "en" || s.startsWith("en-") || s.startsWith("en_")) return "en"
  return null
}

// "ko-KR,ko;q=0.9,en-US;q=0.8" → ko · "ja-JP,ja;q=0.9" → en(기본)
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  const items = String(header ?? "")
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";")
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="))
      const weight = q ? Number(q.slice(2)) : 1
      return { tag, weight: Number.isFinite(weight) ? weight : 0, i }
    })
    .filter((x) => x.tag && x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i)
  for (const it of items) {
    const l = normalizeLocale(it.tag)
    if (l) return l
  }
  return defaultLocale
}
