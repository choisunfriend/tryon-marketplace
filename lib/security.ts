// ============================================================================
// 보안 공용 도구 — 관리자 세션(서명 쿠키) · 같은 출처 확인 · 상수 시간 비교 · 앱 출처 목록
// ============================================================================
// Cloudflare Worker(Edge)와 Node 양쪽에서 돌도록 Web Crypto(crypto.subtle)만 씁니다.
//
// 필요한 secret (Cloudflare 대시보드 → Workers & Pages → tryon-marketplace-web → 설정 → 변수 및 비밀):
//   ADMIN_PASSWORD        플랫폼 운영자 비상 비밀번호 (12자 이상) — 이메일 없이 이것만 넣으면 platform 권한
//                         (입점사 계정은 D1 store_users 에 있음 · migrations/0001_multi_store.sql)
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

// ----------------------------------------------------------------------------
// (2026-11-01) 마켓플레이스 세션 — 누가(uid)·어떤 역할(role)·어느 입점사(sid)인지 쿠키에 서명해 담음
//   토큰 = "{base64url(JSON payload)}.{HMAC-SHA256 hex}"
//   role: platform(플랫폼 운영자 · 모든 입점사) | owner · staff(자기 입점사만)
//   예전 형식(만료.nonce.서명) 쿠키는 더 이상 통과하지 않음 → 다시 로그인
// ----------------------------------------------------------------------------
export type AdminRole = "platform" | "owner" | "staff"

export interface AdminSession {
  uid: string // store_users.id · ADMIN_PASSWORD 로 들어오면 "env"
  role: AdminRole
  sid: string | null // 입점사 id (platform 은 null)
  slug: string | null // 입점사 slug (R2 폴더 앞머리 확인용)
  exp: number
}

function b64urlEncode(text: string): string {
  const bytes = enc.encode(text)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlDecode(text: string): string {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export async function createAdminSession(
  who: Omit<AdminSession, "exp">
): Promise<string | null> {
  const secret = sessionSecret()
  if (!secret) return null
  const payload: AdminSession & { n: string } = {
    ...who,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS,
    n: toHex(crypto.getRandomValues(new Uint8Array(12)).buffer),
  }
  const body = b64urlEncode(JSON.stringify(payload))
  return `${body}.${await hmac(secret, body)}`
}

export async function verifyAdminSession(token: string | undefined | null): Promise<AdminSession | null> {
  const secret = sessionSecret()
  if (!secret || !token || token.length > 2048) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[0-9a-f]{64}$/.test(sig)) return null
  if (!(await safeEqual(sig, await hmac(secret, body)))) return null
  try {
    const p = JSON.parse(b64urlDecode(body)) as Partial<AdminSession>
    if (typeof p.exp !== "number" || p.exp < Math.floor(Date.now() / 1000)) return null
    if (typeof p.uid !== "string") return null
    if (p.role === "platform") return { uid: p.uid, role: "platform", sid: null, slug: null, exp: p.exp }
    if ((p.role === "owner" || p.role === "staff") && typeof p.sid === "string" && typeof p.slug === "string") {
      return { uid: p.uid, role: p.role, sid: p.sid, slug: p.slug, exp: p.exp }
    }
    return null
  } catch {
    return null
  }
}

// ----------------------------------------------------------------------------
// 비밀번호 저장 — PBKDF2-SHA256 (Workers 상한 100,000회)
//   "pbkdf2-sha256${반복}${솔트 hex}${해시 hex}"
// ----------------------------------------------------------------------------
const PBKDF2_ITER = 100_000

async function pbkdf2(password: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: iter },
    key,
    256
  )
  return toHex(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2-sha256$${PBKDF2_ITER}$${toHex(salt.buffer)}$${await pbkdf2(password, salt, PBKDF2_ITER)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const m = /^pbkdf2-sha256\$(\d{1,7})\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(stored)
  if (!m) return false
  const iter = Number(m[1])
  if (iter < 10_000 || iter > PBKDF2_ITER) return false
  const salt = Uint8Array.from(m[2].match(/../g)!.map((h) => parseInt(h, 16)))
  return safeEqual(await pbkdf2(password, salt, iter), m[3])
}

// 계정 비밀번호 규칙
export const MIN_PASSWORD = 10

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

export async function getAdminSession(request: Request): Promise<AdminSession | null> {
  return verifyAdminSession(readCookie(request, ADMIN_COOKIE))
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  return (await getAdminSession(request)) !== null
}

export async function isPlatformRequest(request: Request): Promise<boolean> {
  return (await getAdminSession(request))?.role === "platform"
}

// R2 상품 폴더를 이 세션이 쓸 수 있는지 — 입점사는 "{slug}--" 로 시작하는 폴더만 새로 만듦
// (slug 에는 "--" 가 못 들어가므로 "a--" 와 "a-b--" 가 서로 겹치지 않음)
// (기존 폴더는 routes 에서 products-db.storeOwnsFolder 로 따로 확인)
export function folderHasStorePrefix(session: AdminSession, folder: string): boolean {
  if (session.role === "platform") return true
  return !!session.slug && folder.startsWith(`${session.slug}--`)
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
