import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { ADMIN_COOKIE, appOrigins, verifyAdminSession } from "@/lib/security"

// ============================================================================
// 마켓플레이스 접근 규칙 (2026-10-17 보안 1차)
// ============================================================================
// ① 매장 화면(/shop, 상품 페이지 등)은 GYEOL 앱 안(iframe)에서만 열립니다.
//    주소창에 직접 치거나 새 탭으로 열면(브라우저가 Sec-Fetch-Dest: document 를 붙임)
//    안내 화면(403)을 보여 줍니다. iframe 을 띄울 수 있는 부모는 CSP frame-ancestors 로
//    앱 주소(APP_ORIGINS, 기본 https://choisunfriend.github.io)만 허용합니다.
//    ⚠ Sec-Fetch-Dest 를 안 보내는 아주 오래된 브라우저는 구분할 수 없어 통과시킵니다.
// ② 관리자 화면(/admin…)은 서명된 관리자 쿠키가 있어야 열립니다(없으면 /admin-login).
//    관리자 화면은 어떤 사이트에도 iframe 으로 들어가지 못합니다(frame-ancestors 'none').
// ③ API(/api/…)는 각 라우트가 직접 권한·출처를 확인합니다.
// ============================================================================

const BACKEND_ORIGIN = "https://tryon-marketplace.choisunfriend.workers.dev"

function isAdminPath(p: string) {
  return p === "/admin" || p.startsWith("/admin/") || p === "/admin-login"
}

function blockedPage(): NextResponse {
  const app = appOrigins()[0] ?? "https://choisunfriend.github.io"
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GYEOL</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#1b1816;color:#f3e9da;text-align:center;padding:24px}a{color:#c98b52}</style></head>
<body><div><h1 style="font-size:20px">This shop opens inside the GYEOL app</h1><p>이 쇼핑몰은 GYEOL 앱 안에서만 열립니다.</p><p><a href="${app}/">Open the app</a></p></div></body></html>`
  return new NextResponse(html, {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}

function securityHeaders(response: NextResponse, admin: boolean) {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin")
  if (admin) response.headers.set("X-Frame-Options", "DENY")

  const csp = [
    "default-src 'self'",
    // Next.js 가 넣는 인라인 스크립트 때문에 'unsafe-inline' 은 남김('unsafe-eval' 은 뺌)
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${BACKEND_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${admin ? "'none'" : ["'self'", ...appOrigins()].join(" ")}`,
  ].join("; ")
  response.headers.set("Content-Security-Policy", csp)
  return response
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const admin = isAdminPath(path)

  if (admin) {
    if (path !== "/admin-login") {
      const ok = await verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)
      if (!ok) {
        const url = request.nextUrl.clone()
        url.pathname = "/admin-login"
        url.search = `?next=${encodeURIComponent(path)}`
        return securityHeaders(NextResponse.redirect(url), true)
      }
    }
    return securityHeaders(NextResponse.next(), true)
  }

  // 매장 화면: 최상위 창으로 직접 여는 것은 막고, iframe(앱 안)·페이지 안 요청은 통과
  const dest = request.headers.get("sec-fetch-dest")
  if (dest === "document") return securityHeaders(blockedPage(), false)

  return securityHeaders(NextResponse.next(), false)
}

export const config = {
  matcher: [
    // API·정적 파일·Next 내부 경로는 빼고 모든 화면에 적용
    "/((?!api/|_next/static|_next/image|favicon.ico|images|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
}
