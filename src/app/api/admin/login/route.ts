import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_SECONDS,
  adminCookie,
  createAdminSession,
  isSameOriginWrite,
  safeEqual,
} from "@/lib/security"

// ============================================================================
// 관리자 로그인 — POST /api/admin/login  { password }
// ============================================================================
// 비밀번호는 서버 secret(ADMIN_PASSWORD)과만 비교하고, 성공하면
// HttpOnly·Secure·SameSite=Strict 서명 쿠키를 줍니다 (8시간).
//
// 무차별 대입 방지: 같은 IP 에서 10분에 5번 실패하면 잠시 막습니다.
// (Worker 인스턴스마다 따로 세므로 보조 수단입니다 — Cloudflare 대시보드의
//  Rate limiting rule 로 /api/admin/login 을 함께 막는 것을 권장합니다.)
// ============================================================================

const WINDOW_MS = 10 * 60 * 1000
const MAX_FAILS = 5
const fails = new Map<string, { n: number; at: number }>()

function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? "unknown"
}

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ success: false, error: "허용되지 않은 요청 출처입니다" }, { status: 403 })
  }

  const expected = process.env.ADMIN_PASSWORD ?? ""
  if (expected.length < 12 || !process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json(
      { success: false, error: "서버에 ADMIN_PASSWORD(12자 이상)·ADMIN_SESSION_SECRET 이 설정되지 않았습니다" },
      { status: 503 }
    )
  }

  const ip = clientIp(request)
  const now = Date.now()
  const rec = fails.get(ip)
  if (rec && now - rec.at < WINDOW_MS && rec.n >= MAX_FAILS) {
    return NextResponse.json(
      { success: false, error: "시도가 너무 많습니다. 10분 뒤 다시 해 주세요" },
      { status: 429, headers: { "Retry-After": "600" } }
    )
  }

  let password = ""
  try {
    const body = (await request.json()) as { password?: unknown }
    password = typeof body.password === "string" ? body.password.slice(0, 256) : ""
  } catch {
    /* 아래에서 실패 처리 */
  }

  if (!(await safeEqual(password, expected))) {
    const cur = rec && now - rec.at < WINDOW_MS ? rec : { n: 0, at: now }
    fails.set(ip, { n: cur.n + 1, at: cur.at })
    await new Promise((r) => setTimeout(r, 400)) // 느리게 응답
    return NextResponse.json({ success: false, error: "비밀번호가 올바르지 않습니다" }, { status: 401 })
  }

  fails.delete(ip)
  const token = await createAdminSession()
  if (!token) {
    return NextResponse.json({ success: false, error: "세션 키 설정 오류" }, { status: 503 })
  }
  return NextResponse.json(
    { success: true },
    { headers: { "Set-Cookie": adminCookie(token, ADMIN_SESSION_SECONDS), "Cache-Control": "no-store" } }
  )
}
