"use client"

// ============================================================================
// GYEOL 앱 ↔ 마켓플레이스(iframe) 메시지 다리 — 허용된 앱 주소하고만 주고받음
// ============================================================================
// 앱은 iframe 을 referrerpolicy="no-referrer" 로 띄우므로 document.referrer 가 비어 있을 수 있습니다.
// 부모 주소는 ① location.ancestorOrigins(크롬·사파리) ② document.referrer ③ 앱이 보낸 gyeol-hello 의
// event.origin 순서로 알아내고, 아래 목록에 있을 때만 씁니다. postMessage 는 그 주소로만 보냅니다("*" 금지).
// 앱 주소를 바꾸면 NEXT_PUBLIC_APP_ORIGINS(공백 구분)를 설정하세요.
// ============================================================================

const DEFAULT_APP_ORIGINS = ["https://choisunfriend.github.io"]

function allowedOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_APP_ORIGINS ?? ""
  const list = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(s))
  return list.length ? list : DEFAULT_APP_ORIGINS
}

let helloOrigin: string | null = null

function inFrame(): boolean {
  try {
    return window.parent !== window
  } catch {
    return true
  }
}

export function parentAppOrigin(): string | null {
  if (typeof window === "undefined" || !inFrame()) return null
  const ok = allowedOrigins()
  const candidates: string[] = []
  try {
    const ao = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins
    if (ao && ao.length) candidates.push(ao[0])
  } catch {
    /* 없음 */
  }
  try {
    if (document.referrer) candidates.push(new URL(document.referrer).origin)
  } catch {
    /* 없음 */
  }
  if (helloOrigin) candidates.push(helloOrigin)
  return candidates.find((o) => ok.includes(o)) ?? null
}

// 앱이 iframe 을 다 띄운 뒤 보내는 { type: "gyeol-hello" } 를 받아 부모 주소를 기억
export function listenForAppHello(): () => void {
  if (typeof window === "undefined") return () => {}
  const ok = allowedOrigins()
  const onMessage = (e: MessageEvent) => {
    if (e.source !== window.parent || !ok.includes(e.origin)) return
    const d = e.data as { type?: unknown } | null
    if (d && typeof d === "object" && d.type === "gyeol-hello") helloOrigin = e.origin
  }
  window.addEventListener("message", onMessage)
  return () => window.removeEventListener("message", onMessage)
}

export function postToApp(message: unknown): boolean {
  const origin = parentAppOrigin()
  if (!origin) return false
  try {
    window.parent.postMessage(message, origin)
    return true
  } catch {
    return false
  }
}
