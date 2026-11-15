// ============================================================================
// (2026-11-15) 애플 · 구글 · 카카오 로그인 증표(ID 토큰, JWT) 확인
// ============================================================================
// 앱이 각 회사 로그인 화면에서 받은 ID 토큰을 서버로 보내면, 여기서
//   ① 그 회사의 공개 키(JWKS)로 서명이 진짜인지
//   ② 발급자(iss) · 대상 앱(aud) · 만료(exp) 가 맞는지
//   ③ (앱이 보냈다면) nonce 가 같은지
// 를 확인한 뒤 그 사람의 고유 번호(sub)와 이메일을 돌려줍니다.
//
// 대상 앱(aud) — Cloudflare 변수(공백·쉼표로 여러 개):
//   APPLE_CLIENT_IDS   iOS 앱 번들 ID (예: com.gyeol.app) · 웹 로그인 쓰면 Services ID 도
//   GOOGLE_CLIENT_IDS  구글 OAuth 클라이언트 ID (iOS · Android · 웹 각각)
//   KAKAO_CLIENT_IDS   카카오 앱 REST API 키 (= 카카오 OIDC 의 aud) · 카카오 개발자 콘솔에서 OpenID Connect 켜기
// 값이 비어 있는 로그인 수단은 꺼진 것으로 봅니다.
// ============================================================================

export type Provider = "apple" | "google" | "kakao"

interface ProviderConf {
  issuers: string[]
  jwks: string
  env: string
}

const PROVIDERS: Record<Provider, ProviderConf> = {
  apple: { issuers: ["https://appleid.apple.com"], jwks: "https://appleid.apple.com/auth/keys", env: "APPLE_CLIENT_IDS" },
  google: {
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    jwks: "https://www.googleapis.com/oauth2/v3/certs",
    env: "GOOGLE_CLIENT_IDS",
  },
  kakao: { issuers: ["https://kauth.kakao.com"], jwks: "https://kauth.kakao.com/.well-known/jwks.json", env: "KAKAO_CLIENT_IDS" },
}

export function isProvider(v: unknown): v is Provider {
  return v === "apple" || v === "google" || v === "kakao"
}

export function clientIds(p: Provider): string[] {
  return (process.env[PROVIDERS[p].env] ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function providerEnabled(p: Provider): boolean {
  return clientIds(p).length > 0
}

export interface VerifiedIdentity {
  provider: Provider
  subject: string
  email: string | null
  emailVerified: boolean
  name: string | null
}

interface Jwk {
  kid?: string
  kty: string
  alg?: string
  n?: string
  e?: string
  crv?: string
  x?: string
  y?: string
}

// 공개 키 묶음은 1시간 기억 (Worker 서버마다 따로)
const jwksCache = new Map<string, { at: number; keys: Jwk[] }>()
const JWKS_TTL = 60 * 60 * 1000

async function loadJwks(url: string, force = false): Promise<Jwk[]> {
  const hit = jwksCache.get(url)
  if (!force && hit && Date.now() - hit.at < JWKS_TTL) return hit.keys
  const res = await fetch(url, { headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`jwks ${res.status}`)
  const data = (await res.json()) as { keys?: Jwk[] }
  const keys = Array.isArray(data.keys) ? data.keys : []
  jwksCache.set(url, { at: Date.now(), keys })
  return keys
}

function b64urlBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function b64urlJson<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as T
}

async function importKey(jwk: Jwk, alg: string): Promise<CryptoKey | null> {
  if (alg === "RS256" && jwk.kty === "RSA") {
    return crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    )
  }
  if (alg === "ES256" && jwk.kty === "EC" && jwk.crv === "P-256") {
    return crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    )
  }
  return null
}

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export class OidcError extends Error {}

/**
 * ID 토큰을 확인합니다. 틀리면 OidcError 를 던집니다.
 * nonce: 앱이 로그인 요청 때 넣은 값(원문). 애플은 SHA-256 값을 토큰에 넣기도 해서 둘 다 받아 줍니다.
 */
export async function verifyIdToken(provider: Provider, idToken: string, nonce?: string | null): Promise<VerifiedIdentity> {
  const conf = PROVIDERS[provider]
  const auds = clientIds(provider)
  if (!auds.length) throw new OidcError("provider disabled")
  if (typeof idToken !== "string" || idToken.length > 8192) throw new OidcError("bad token")

  const parts = idToken.split(".")
  if (parts.length !== 3) throw new OidcError("bad token")
  const [h, p, s] = parts

  let header: { alg?: string; kid?: string }
  let claims: Record<string, unknown>
  try {
    header = b64urlJson(h)
    claims = b64urlJson(p)
  } catch {
    throw new OidcError("bad token")
  }
  const alg = header.alg ?? ""
  if (alg !== "RS256" && alg !== "ES256") throw new OidcError("bad alg")

  // 키 찾기 — 못 찾으면 키가 막 바뀐 것일 수 있어 한 번 새로 받음
  let keys = await loadJwks(conf.jwks)
  let jwk = keys.find((k) => k.kid === header.kid)
  if (!jwk) {
    keys = await loadJwks(conf.jwks, true)
    jwk = keys.find((k) => k.kid === header.kid)
  }
  if (!jwk) throw new OidcError("unknown key")
  const key = await importKey(jwk, alg)
  if (!key) throw new OidcError("bad key")

  const algo = alg === "RS256" ? { name: "RSASSA-PKCS1-v1_5" } : { name: "ECDSA", hash: "SHA-256" }
  const ok = await crypto.subtle.verify(algo, key, b64urlBytes(s) as BufferSource, new TextEncoder().encode(`${h}.${p}`))
  if (!ok) throw new OidcError("bad signature")

  const now = Math.floor(Date.now() / 1000)
  const skew = 120
  if (!conf.issuers.includes(String(claims.iss))) throw new OidcError("bad issuer")
  const aud = claims.aud
  const audList = Array.isArray(aud) ? aud.map(String) : [String(aud)]
  if (!audList.some((a) => auds.includes(a))) throw new OidcError("bad audience")
  if (typeof claims.exp !== "number" || claims.exp + skew < now) throw new OidcError("expired")
  if (typeof claims.iat === "number" && claims.iat - skew > now) throw new OidcError("issued in future")
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) throw new OidcError("no subject")

  if (nonce) {
    const tn = typeof claims.nonce === "string" ? claims.nonce : ""
    if (tn !== nonce && tn !== (await sha256Hex(nonce))) throw new OidcError("bad nonce")
  }

  const email = typeof claims.email === "string" && claims.email.length <= 254 ? claims.email : null
  const ev = claims.email_verified
  const name =
    typeof claims.name === "string"
      ? claims.name.slice(0, 80)
      : typeof claims.nickname === "string"
        ? claims.nickname.slice(0, 80)
        : null
  return {
    provider,
    subject: claims.sub,
    email,
    emailVerified: ev === true || ev === "true",
    name,
  }
}
