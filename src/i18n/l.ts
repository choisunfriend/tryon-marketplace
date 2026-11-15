import { type Locale } from "./config"

// ============================================================================
// (2026-11-14) 화면 글자 한/영 — L("한국어", "English")
// ============================================================================
//   · 화면(클라이언트): const { L } = useL()          — src/i18n/client.ts
//   · 서버 화면·API:    const { L, loc } = await getL() — src/i18n/server.ts
//   · 요청을 모르는 곳(lib 검증 오류 등): bi("한국어", "English") 로 두 벌을 한 문자열에 담아
//     던지고, 화면에 내보내기 직전에 loc(메시지) 로 지금 언어만 꺼낸다.
//     (사용자 눈에 bi 원문이 보이면 loc 를 빠뜨린 것)
// ============================================================================

export type LFn = (ko: string, en: string) => string

const START = ""
const MID = ""
const END = ""
const BI_RE = /([\s\S]*?)([\s\S]*?)/g

export function bi(ko: string, en: string): string {
  return START + ko + MID + en + END
}

export function loc(s: string, lang: Locale): string {
  if (typeof s !== "string" || s.indexOf(START) < 0) return s
  return s.replace(BI_RE, (_m, ko: string, en: string) => (lang === "ko" ? ko : en))
}

export function makeL(lang: Locale): LFn {
  return (ko, en) => (lang === "ko" ? ko : en)
}
