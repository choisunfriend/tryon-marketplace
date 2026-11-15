import { cookies, headers } from "next/headers"
import {
  LOCALE_COOKIE,
  LOCALE_HEADER,
  localeFromAcceptLanguage,
  normalizeLocale,
  type Locale,
} from "./config"
import { loc, makeL } from "./l"

// 서버 화면·API 라우트용 — 지금 요청의 언어
export async function getLang(): Promise<Locale> {
  const h = await headers()
  const fromHeader = normalizeLocale(h.get(LOCALE_HEADER))
  if (fromHeader) return fromHeader
  const fromCookie = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)
  if (fromCookie) return fromCookie
  return localeFromAcceptLanguage(h.get("accept-language"))
}

export async function getL() {
  const lang = await getLang()
  return { lang, L: makeL(lang), loc: (s: string) => loc(s, lang) }
}
