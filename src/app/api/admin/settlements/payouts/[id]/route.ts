import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { setPayoutStatus } from "@/lib/ledger"

// (2026-11-01) 지급 상태 바꾸기 — PATCH { status: "paid" | "failed", providerRef?, error? } (플랫폼 운영자)
//   수동 송금을 마쳤을 때 paid, 송금이 안 됐으면 failed (→ 금액이 다시 잔액으로 돌아감)
//   업체 연동 뒤에는 업체 웹훅이 같은 setPayoutStatus 를 부름.
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true, platform: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return fail("잘못된 id")
  let body: { status?: unknown; providerRef?: unknown; error?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail("JSON 형식이 아닙니다")
  }
  if (body.status !== "paid" && body.status !== "failed") return fail("status 는 paid 또는 failed")
  try {
    const ok = await setPayoutStatus(g.db, id, body.status, {
      providerRef: typeof body.providerRef === "string" ? body.providerRef.slice(0, 120) : undefined,
      error: typeof body.error === "string" ? body.error.slice(0, 300) : undefined,
    })
    if (!ok) return fail("지급이 없습니다", 404)
    return NextResponse.json({ success: true }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "바꾸지 못했습니다", 409)
  }
}
