import { NextResponse } from "next/server"
import { adminCookie, isSameOriginWrite } from "@/lib/security"
import { withLang } from "@/i18n/api"

// 관리자 로그아웃 — 쿠키 삭제
async function handlePOST(request: Request) {
  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ success: false }, { status: 403 })
  }
  return NextResponse.json({ success: true }, { headers: { "Set-Cookie": adminCookie("", 0) } })
}

export const POST = withLang(handlePOST)
