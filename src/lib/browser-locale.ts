// ============================================================================
// (2026-11-14) 브라우저 언어·지역 — 지도 시작 위치·지도 글자 언어에 씀 (클라이언트 전용)
// ============================================================================
// 화면 글자 번역은 브라우저 자동 번역(크롬/사파리)에 맡긴다 — translate-guard.tsx 참고.
// 지도 글자(지명)는 타일 안에 그려져 자동 번역이 안 되므로 여기서 언어를 골라 지도 설정에 넣는다.
//
// 지역 판단 순서: navigator.languages 의 지역 꼬리(ko-KR → KR) → 시간대(Asia/Seoul → KR) → 없음
// (IP 국가는 쓰지 않음 — 사용자 지시: 브라우저 언어 기준)
// ============================================================================

import type { Map as MlMap } from "maplibre-gl"

/** 브라우저 첫 언어의 앞부분 ("ko-KR" → "ko"). 서버 렌더 중엔 "en". */
export function browserLang(): string {
  if (typeof navigator === "undefined") return "en"
  const l = (navigator.languages && navigator.languages[0]) || navigator.language || "en"
  return l.toLowerCase().split("-")[0] || "en"
}

// 시간대 → 나라 (지역 꼬리가 없는 "ko", "en" 같은 언어일 때 보조로)
const TZ_COUNTRY: Record<string, string> = {
  "Asia/Seoul": "KR", "Asia/Tokyo": "JP", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW",
  "Asia/Singapore": "SG", "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN", "Asia/Jakarta": "ID", "Asia/Manila": "PH",
  "Asia/Kolkata": "IN", "Asia/Dubai": "AE", "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
  "Europe/London": "GB", "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Mexico_City": "MX", "America/Sao_Paulo": "BR",
}

// 언어만 있고 지역이 없을 때의 대표 나라
const LANG_COUNTRY: Record<string, string> = { ko: "KR", ja: "JP", zh: "CN", vi: "VN", th: "TH", id: "ID", fr: "FR", de: "DE", it: "IT", pt: "BR", es: "ES" }

/** 브라우저 기준 나라 코드(대문자 2자) 또는 null */
export function browserCountry(): string | null {
  if (typeof navigator === "undefined") return null
  for (const l of navigator.languages ?? [navigator.language]) {
    const m = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(l || "")
    if (m) return m[1].toUpperCase()
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz]
  } catch {
    /* 무시 */
  }
  return LANG_COUNTRY[browserLang()] ?? null
}

// 나라별 지도 시작 화면 [경도, 위도, 확대] — 세계 지도·위치 고르기가 처음 열릴 때
const COUNTRY_VIEW: Record<string, [number, number, number]> = {
  KR: [127.8, 36.3, 6.2], JP: [138.0, 36.5, 4.6], CN: [104.0, 35.0, 3.2], HK: [114.17, 22.32, 9.5], TW: [121.0, 23.7, 6.5],
  SG: [103.82, 1.35, 10], TH: [101.0, 13.5, 5], VN: [106.0, 16.0, 4.8], ID: [118.0, -2.5, 3.8], PH: [122.0, 12.5, 5],
  IN: [79.0, 22.5, 3.8], AE: [54.3, 24.3, 6.5], AU: [134.0, -26.0, 3.3], NZ: [173.0, -41.0, 4.6],
  GB: [-2.5, 54.0, 5], IE: [-8.0, 53.4, 6], FR: [2.4, 46.6, 5], DE: [10.4, 51.1, 5.2], ES: [-3.7, 40.2, 5.2], IT: [12.6, 42.6, 5],
  NL: [5.3, 52.2, 6.5], US: [-98.5, 39.5, 3.3], CA: [-96.0, 56.0, 2.8], MX: [-102.0, 23.6, 4.3], BR: [-52.0, -14.0, 3.3],
}

/** 브라우저 지역의 지도 시작 화면. 모르는 나라면 null (부르는 쪽 기본값 유지). */
export function browserMapView(): { center: [number, number]; zoom: number } | null {
  const c = browserCountry()
  const v = c ? COUNTRY_VIEW[c] : null
  return v ? { center: [v[0], v[1]], zoom: v[2] } : null
}

/**
 * 지도 타일 글자(지명)를 브라우저 언어로. OpenFreeMap(OpenMapTiles) 타일은 name:ko · name:en … 을 갖고 있어
 * 기존 글자 칸의 "name" 을 [name:{lang} → name:latin(로마자) → name] 순서로 바꾼다. 번역이 없는 곳은 현지 이름 그대로.
 * 우리 레이어(salon-…)는 건드리지 않는다. style 이 다 읽힌 뒤("load")에 부를 것.
 */
export function localizeMapLabels(map: MlMap, lang = browserLang(), skipPrefix = "salon-"): void {
  const want: unknown[] = ["coalesce", ["get", `name:${lang}`], ["get", "name:latin"], ["get", "name"]]
  const style = map.getStyle()
  for (const layer of style?.layers ?? []) {
    if (layer.type !== "symbol" || layer.id.startsWith(skipPrefix)) continue
    const tf = map.getLayoutProperty(layer.id, "text-field")
    if (tf == null) continue
    const s = JSON.stringify(tf)
    // 지명을 쓰는 글자 칸만 (도로 번호·층수 같은 건 그대로)
    if (!/"name(:[a-z_]+)?"|\{name(:[a-z_]+)?\}/.test(s)) continue
    try {
      map.setLayoutProperty(layer.id, "text-field", want as never)
    } catch {
      /* 표현식을 못 받는 레이어는 그대로 */
    }
  }
}
