// ============================================================================
// 보안 공용 도구 — 관리자 세션(서명 쿠키) · 같은 출처 확인 · 상수 시간 비교 · 앱 출처 목록
// ============================================================================
// Cloudflare Worker(Edge)와 Node 양쪽에서 돌도록 Web Crypto(crypto.subtle)만 씁니다.
//
// 필요한 secret (Cloudflare 대시보드 → Workers & Pages → tryon-marketplace-web → 설정 → 변수 및 비밀):
//   ADMIN_PASSWORD        관리자 비밀번호 (12자 이상)
//   ADMIN_SESSION_SECRET  쿠키 서명 키 (32자 이상 무작위 문자열)
//   BACKEND_ADMIN_TOKEN   백엔드 API Worker 쓰기용 토큰 (관리자 상품 등록 프록시에서만 사용)
// ============================================================================

export const ADMIN_COOKIE = "admin_session"
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60 // 8시간

// GYEOL 앱이 실제로 열리는 주소 (마켓플레이스를 iframe 으로 띄우고, 3D 파일을 받아 가는 곳)
export const DEFAULT_APP_ORIGINS = ["https://choisunfriend.github.io"]

export function appOrigins(): string[] {
  const fromEnv = (process.env.APP_ORIGINS ?? process.env.FRAME_ANCESTORS ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(s)) // 와일드카드(*)·http 는 받지 않음
  return fromEnv.length ? Array.from(new Set(fromEnv)) : DEFAULT_APP_ORIGINS
}

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(data)))
}

// 길이·내용이 달라도 걸리는 시간이 같게 비교 (양쪽을 같은 키로 HMAC 한 뒤 비교)
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const k = crypto.getRandomValues(new Uint8Array(32))
  const ks = toHex(k.buffer)
  const [ha, hb] = await Promise.all([hmac(ks, a), hmac(ks, b)])
  let diff = ha.length ^ hb.length
  for (let i = 0; i < Math.min(ha.length, hb.length); i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i)
  return diff === 0
}

function sessionSecret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET ?? ""
  return s.length >= 32 ? s : null
}

// 토큰 = "{만료시각(초)}.{nonce}.{HMAC}"
export async function createAdminSession(): Promise<string | null> {
  const secret = sessionSecret()
  if (!secret) return null
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(12)).buffer)
  const body = `${exp}.${nonce}`
  return `${body}.${await hmac(secret, body)}`
}

export async function verifyAdminSession(token: string | undefined | null): Promise<boolean> {
  const secret = sessionSecret()
  if (!secret || !token) return false
  const parts = token.split(".")
  if (parts.length !== 3) return false
  const [expStr, nonce, sig] = parts
  if (!/^\d{1,12}$/.test(expStr) || !/^[0-9a-f]{24}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(sig)) return false
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return false
  return safeEqual(sig, await hmac(secret, `${expStr}.${nonce}`))
}

export function adminCookie(token: string, maxAge: number): string {
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
}

export function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? ""
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=")
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1)
  }
  return null
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  return verifyAdminSession(readCookie(request, ADMIN_COOKIE))
}

// 쓰기 요청(POST 등)은 이 사이트 화면에서 보낸 것만 받음 (CSRF 방지)
export function isSameOriginWrite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site")
  if (site && site !== "same-origin") return false
  const origin = request.headers.get("origin")
  if (!origin) return site === "same-origin"
  try {
    return origin === new URL(request.url).origin
  } catch {
    return false
  }
}
