import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// ============================================================================
// 마켓플레이스를 GYEOL 앱 안에 iframe으로 띄우기 위한 허용 목록
// ============================================================================
// 예전에는 X-Frame-Options: DENY + frame-ancestors 'none' 이라
// 어떤 사이트도 이 페이지를 iframe에 넣을 수 없었습니다
// (브라우저 화면: "...workers.dev에서 연결을 거부했습니다").
//
// 이제 아래 출처(origin)만 iframe으로 띄울 수 있습니다.
// GYEOL 앱 주소가 바뀌면 wrangler.jsonc 의 vars.FRAME_ANCESTORS 에
// 공백으로 구분해 추가하세요. 값이 없으면 DEFAULT_FRAME_ANCESTORS 를 씁니다.
// ============================================================================
const DEFAULT_FRAME_ANCESTORS = [
  "'self'",
  "https://*.choisunfriend.workers.dev",
  "https://choisunfriend.github.io",
  "http://localhost:*",
  "http://127.0.0.1:*",
]

function frameAncestors(): string {
  const fromEnv = (process.env.FRAME_ANCESTORS ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const list = fromEnv.length ? ["'self'", ...fromEnv] : DEFAULT_FRAME_ANCESTORS
  return Array.from(new Set(list)).join(" ")
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  // X-Frame-Options 는 특정 사이트만 허용하는 방법이 없어(DENY/SAMEORIGIN 뿐) 쓰지 않습니다.
  // iframe 허용 여부는 아래 CSP frame-ancestors 하나로만 정합니다.
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-DNS-Prefetch-Control", "on")
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // tighten in production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https:",
    `frame-ancestors ${frameAncestors()}`,
  ].join("; ")

  // frame-ancestors 는 Report-Only 로는 적용되지 않으므로 개발/운영 모두 실제 헤더로 보냅니다.
  response.headers.set("Content-Security-Policy", csp)

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
