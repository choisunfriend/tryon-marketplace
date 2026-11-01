import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { createPayout } from "@/lib/ledger"

// (2026-11-01) 지급 만들기 — POST { storeId } (플랫폼 운영자)
//   미지급 잔액 전부를 한 건으로 묶어 정산 업체에 요청. 업체 연동 전이면 "수동 송금" 으로 만들어지고
//   운영자가 직접 보낸 뒤 [지급 완료] 를 누름.
export async function POST(request: Request) {
  const g = await requireAdmin(request, { write: true, platform: true })
  if ("err" in g) return g.err
  let body: { storeId?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail("JSON 형식이 아닙니다")
  }
  const storeId = typeof body.storeId === "string" ? body.storeId : ""
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(storeId)) return fail("storeId 가 올바르지 않습니다")
  try {
    const payout = await createPayout(g.db, storeId)
    return NextResponse.json({ success: true, payout }, { status: 201, headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "지급을 만들지 못했습니다", 409)
  }
}
