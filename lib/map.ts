// ============================================================================
// (2026-11-01) 세계 지도 설정 — MapLibre GL + OpenFreeMap(무료·키 없음, OpenStreetMap 데이터)
// ============================================================================
// · 지도 타일: https://tiles.openfreemap.org — API 키·요금 없음, 출처 표기(© OpenStreetMap)만 지키면 됨
//   다른 타일(MapTiler·Stadia 등 키 필요)로 바꾸려면 NEXT_PUBLIC_MAP_STYLE_URL 에 style.json 주소를 넣고
//   그 서버 주소를 NEXT_PUBLIC_MAP_ORIGINS(공백 구분)에 넣으세요 — CSP(connect-src)에 자동으로 들어갑니다.
// · 주소 검색: Nominatim(OpenStreetMap) — 키 없음, "초당 1회 이하·직접 입력 때만" 규칙을 지킴(자동완성 X)
// ============================================================================

export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty"

export const GEOCODER_URL = "https://nominatim.openstreetmap.org"

// CSP connect-src 에 넣을 지도·검색 서버 주소
export function mapOrigins(): string[] {
  const extra = (process.env.NEXT_PUBLIC_MAP_ORIGINS ?? "")
    .split(/[\s,]+/)
    .filter((s) => /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(s))
  let styleOrigin: string[] = []
  try {
    styleOrigin = [new URL(MAP_STYLE_URL).origin]
  } catch {
    /* 상대 주소면 'self' 로 충분 */
  }
  return Array.from(new Set(["https://tiles.openfreemap.org", GEOCODER_URL, ...styleOrigin, ...extra]))
}

// 최소 단위 정수(KRW 원, USD 센트) → "₩35,000" / "$45.00"
export function formatMinor(amount: number | null, currency: string | null): string | null {
  if (amount == null) return null
  const cur = currency || "KRW"
  try {
    const nf = new Intl.NumberFormat(undefined, { style: "currency", currency: cur })
    const digits = nf.resolvedOptions().maximumFractionDigits ?? 2
    return nf.format(amount / 10 ** digits)
  } catch {
    return `${amount.toLocaleString()} ${cur}`
  }
}

// 두 점 사이 거리(km)
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export async function geocode(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `${GEOCODER_URL}/search?format=json&limit=1&q=${encodeURIComponent(q)}`
  const r = await fetch(url, { headers: { Accept: "application/json" } })
  if (!r.ok) return null
  const d = (await r.json()) as Array<{ lat: string; lon: string; display_name: string }>
  if (!d.length) return null
  return { lat: Number(d[0].lat), lng: Number(d[0].lon), label: d[0].display_name }
}
