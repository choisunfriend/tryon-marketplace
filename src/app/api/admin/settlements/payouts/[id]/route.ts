import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { setPayoutStatus } from "@/lib/ledger"
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"

// (2026-11-01) 지급 상태 바꾸기 — PATCH { status: "paid" | "failed", providerRef?, error? } (플랫폼 운영자)
//   수동 송금을 마쳤을 때 paid, 송금이 안 됐으면 failed (→ 금액이 다시 잔액으로 돌아감)
//   업체 연동 뒤에는 업체 웹훅이 같은 setPayoutStatus 를 부름.
type Ctx = { params: Promise<{ id: string }> }

async function handlePATCH(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true, platform: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return fail(bi("잘못된 id", "Invalid id"))
  let body: { status?: unknown; providerRef?: unknown; error?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail(bi("JSON 형식이 아닙니다", "Not valid JSON"))
  }
  if (body.status !== "paid" && body.status !== "failed") return fail(bi("status 는 paid 또는 failed", "status must be paid or failed"))
  try {
    const ok = await setPayoutStatus(g.db, id, body.status, {
      providerRef: typeof body.providerRef === "string" ? body.providerRef.slice(0, 120) : undefined,
      error: typeof body.error === "string" ? body.error.slice(0, 300) : undefined,
    })
    if (!ok) return fail(bi("지급이 없습니다", "Payout not found"), 404)
    return NextResponse.json({ success: true }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : bi("바꾸지 못했습니다", "Couldn't change it"), 409)
  }
}

export const PATCH = withLang(handlePATCH)
