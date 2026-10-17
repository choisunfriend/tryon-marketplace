import { NextResponse } from "next/server"
import { isAdminRequest, isSameOriginWrite } from "@/lib/security"

// ============================================================================
// 관리자 상품 등록 프록시 — POST /api/admin/products → 백엔드 Worker POST /api/products
// ============================================================================
// 브라우저가 백엔드 쓰기 API 를 직접 부르지 않게 합니다.
// 이 라우트는 관리자 쿠키를 확인한 뒤, 서버 secret(BACKEND_ADMIN_TOKEN)을
// Authorization 헤더에 붙여 백엔드로 넘깁니다. 토큰은 브라우저에 절대 내려가지 않습니다.
// 백엔드 Worker 는 이 토큰이 없으면 쓰기 요청을 거절해야 합니다 (SECURITY.md 참고).
// ============================================================================

const MAX_BODY = 256 * 1024

function backendBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://tryon-marketplace.choisunfriend.workers.dev"
  ).replace(/\/+$/, "")
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "관리자 로그인이 필요합니다" }, { status: 401 })
  }
  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ success: false, error: "허용되지 않은 요청 출처입니다" }, { status: 403 })
  }
  const token = process.env.BACKEND_ADMIN_TOKEN
  if (!token) {
    return NextResponse.json({ success: false, error: "BACKEND_ADMIN_TOKEN 이 설정되지 않았습니다" }, { status: 503 })
  }

  const text = await request.text()
  if (text.length > MAX_BODY) {
    return NextResponse.json({ success: false, error: "요청이 너무 큽니다" }, { status: 413 })
  }
  try {
    JSON.parse(text)
  } catch {
    return NextResponse.json({ success: false, error: "JSON 형식이 아닙니다" }, { status: 400 })
  }

  const res = await fetch(`${backendBase()}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: text,
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  })
}
