"use client"

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, normalizeLocale, type Locale } from "./config"

// 화면용 useL 은 use-l.ts (서버·클라이언트 공용) — 여기서도 꺼내 쓸 수 있게
export { useL } from "./use-l"

// 이벤트 처리 중 등 훅을 못 쓰는 곳 — <html lang> 을 읽음
export function currentLang(): Locale {
  if (typeof document === "undefined") return "en"
  return normalizeLocale(document.documentElement.lang) ?? "en"
}

// 언어를 바꾸고 화면을 다시 그림 (앱 iframe 안에서도 기억되도록 Partitioned)
export function setLang(lang: Locale) {
  document.cookie =
    `${LOCALE_COOKIE}=${lang}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=None; Secure; Partitioned`
  const url = new URL(window.location.href)
  url.searchParams.delete("lang")
  window.location.replace(url.toString())
}
