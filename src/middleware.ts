import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { ADMIN_COOKIE, appOrigins, verifyAdminSession } from "@/lib/security"
import { mapOrigins } from "@/lib/map"
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_HEADER, normalizeLocale, type Locale } from "@/i18n/config"

// ============================================================================
// 마켓플레이스 접근 규칙 (2026-10-17 보안 1차)
// ============================================================================
// ① 매장 화면(/shop, 상품 페이지 등)은 GYEOL 앱 안(iframe)에서만 열립니다.
//    주소창에 직접 치거나 새 탭으로 열면(브라우저가 Sec-Fetch-Dest: document 를 붙임)
//    안내 화면(403)을 보여 줍니다. iframe 을 띄울 수 있는 부모는 CSP frame-ancestors 로
//    앱 주소(APP_ORIGINS, 기본 https://choisunfriend.github.io)만 허용합니다.
//    ⚠ Sec-Fetch-Dest 를 안 보내는 아주 오래된 브라우저는 구분할 수 없어 통과시킵니다.
// ② 관리자 화면(/admin…)은 서명된 관리자 쿠키가 있어야 열립니다(없으면 /admin-login).
//    (2026-11-01) /admin/stores · /admin/sync 는 플랫폼 운영자만 (입점사 계정은 /admin 으로)
//    (2026-11-01) /seller/apply(입점 신청)는 누구나 바로 열 수 있음(iframe 금지)
//    관리자 화면은 어떤 사이트에도 iframe 으로 들어가지 못합니다(frame-ancestors 'none').
// ③ API(/api/…)는 각 라우트가 직접 권한·출처를 확인합니다.
// ============================================================================

const BACKEND_ORIGIN = "https://tryon-marketplace.choisunfriend.workers.dev"

function isAdminPath(p: string) {
  return p === "/admin" || p.startsWith("/admin/") || p === "/admin-login"
}

// (2026-11-01) 입점 신청 화면 — 앱 밖에서 바로 여는 공개 페이지 (로그인 필요 없음, iframe 금지)
function isSellerPath(p: string) {
  return p === "/seller" || p.startsWith("/seller/")
}

// (2026-11-01) 플랫폼 운영자만 여는 관리자 화면
function isPlatformOnlyPath(p: string) {
  return p === "/admin/stores" || p.startsWith("/admin/stores/") || p === "/admin/sync" || p.startsWith("/admin/sync/")
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

function securityHeaders(response: NextResponse, admin: boolean, turnstile = false) {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  // (2026-11-01) geolocation=(self): 미용실 지도의 "내 위치" (앱 iframe 에 allow="geolocation" 도 있어야 함)
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), payment=(), usb=()")
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin")
  if (admin) {
    response.headers.set("X-Frame-Options", "DENY")
    // (2026-11-01) 관리자 화면은 브라우저·Cloudflare 가 저장해 두지 못하게 함.
    //   저장된 옛 화면(옛 JS)이 남아 일반 창에서만 메뉴가 안 넘어가던 문제 방지.
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate")
  }

  const csp = [
    "default-src 'self'",
    // Next.js 가 넣는 인라인 스크립트 때문에 'unsafe-inline' 은 남김('unsafe-eval' 은 뺌)
    `script-src 'self' 'unsafe-inline'${turnstile ? " https://challenges.cloudflare.com" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    // (2026-11-01) 지도 타일·글꼴·주소 검색 서버 (src/lib/map.ts)
    `connect-src 'self' ${BACKEND_ORIGIN} ${mapOrigins().join(" ")}`,
    // (2026-11-01) MapLibre 는 지도 계산을 blob: 워커에서 함
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(turnstile ? ["frame-src https://challenges.cloudflare.com"] : []),
    `frame-ancestors ${admin ? "'none'" : ["'self'", ...appOrigins(), ...nativeFrameAncestors()].join(" ")}`,
  ].join("; ")
  response.headers.set("Content-Security-Policy", csp)
  return response
}

// (2026-11-14) ?lang=ko|en — 이번 요청은 그 언어로 그리고(요청 헤더), 쿠키로 기억해 다음 화면도 같게.
// 앱 iframe 안(제3자)에서도 남도록 SameSite=None; Secure; Partitioned.
function langOf(request: NextRequest): Locale | null {
  return normalizeLocale(request.nextUrl.searchParams.get("lang"))
}
function nextWithLang(request: NextRequest, lang: Locale | null): NextResponse {
  if (!lang) return NextResponse.next()
  const h = new Headers(request.headers)
  h.set(LOCALE_HEADER, lang)
  return NextResponse.next({ request: { headers: h } })
}
function rememberLang(res: NextResponse, lang: Locale | null): NextResponse {
  if (!lang) return res
  res.headers.append(
    "Set-Cookie",
    `${LOCALE_COOKIE}=${lang}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=None; Secure; Partitioned`
  )
  return res
}

export async function middleware(request: NextRequest) {
  const lang = langOf(request)
  return rememberLang(await route(request, lang), lang)
}

async function route(request: NextRequest, lang: Locale | null): Promise<NextResponse> {
  const path = request.nextUrl.pathname
  const admin = isAdminPath(path)

  // (2026-11-15) 손님 로그인·내 계정 화면은 아직 없음(템플릿 가짜) → 쇼핑 화면으로
  if (path === "/auth" || path.startsWith("/auth/") || path === "/account" || path.startsWith("/account/")) {
    const to = request.nextUrl.clone()
    to.pathname = "/shop"
    to.search = ""
    return NextResponse.redirect(to)
  }

  if (isSellerPath(path)) return securityHeaders(nextWithLang(request, lang), true, true)

  if (admin) {
    if (path !== "/admin-login") {
      const session = await verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)
      if (!session) {
        const url = request.nextUrl.clone()
        url.pathname = "/admin-login"
        url.search = `?next=${encodeURIComponent(path)}`
        return securityHeaders(NextResponse.redirect(url), true)
      }
      if (isPlatformOnlyPath(path) && session.role !== "platform") {
        const url = request.nextUrl.clone()
        url.pathname = "/admin"
        url.search = ""
        return securityHeaders(NextResponse.redirect(url), true)
      }
    }
    return securityHeaders(nextWithLang(request, lang), true)
  }

  // 매장 화면: 최상위 창으로 직접 여는 것은 막고, iframe(앱 안)·페이지 안 요청은 통과
  const dest = request.headers.get("sec-fetch-dest")
  if (dest === "document") return securityHeaders(blockedPage(), false)

  return securityHeaders(nextWithLang(request, lang), false)
}

export const config = {
  matcher: [
    // API·정적 파일·Next 내부 경로는 빼고 모든 화면에 적용
    "/((?!api/|_next/static|_next/image|favicon.ico|images|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
}

// (2026-11-28) 앱스토어 앱(Capacitor)은 capacitor://localhost 에서 쇼핑몰을 iframe 으로 띄웁니다.
//   https 웹앱 목록(APP_ORIGINS)과 따로 둡니다. 바꾸려면 NATIVE_FRAME_ANCESTORS(공백 구분).
function nativeFrameAncestors(): string[] {
  const raw = (process.env.NATIVE_FRAME_ANCESTORS ?? "capacitor://localhost")
  return raw.split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^(capacitor|ionic|https):\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(s))
}
