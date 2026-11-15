import { useLocale } from "next-intl"
import { normalizeLocale, type Locale } from "./config"
import { loc, makeL } from "./l"

// (2026-11-14) 화면 글자 한/영 — 서버 컴포넌트(async 아님)·클라이언트 컴포넌트 어디서나
//   const { L } = useL();  L("한국어", "English")
// async 서버 컴포넌트·API 는 src/i18n/server.ts 의 getL()
export function useL() {
  const lang: Locale = normalizeLocale(useLocale()) ?? "en"
  return { lang, L: makeL(lang), loc: (s: string) => loc(s, lang) }
}
