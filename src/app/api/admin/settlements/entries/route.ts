import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { toMinor } from "@/lib/countries"
import { recordAdjustment, recordRefund, recordSale } from "@/lib/ledger"

// (2026-11-01) 장부 수동 기록 — POST (플랫폼 운영자)
//   { storeId, type: "sale" | "refund" | "adjustment", amount(화면 금액, 예: 12000 또는 19.99), orderRef?, memo? }
//   결제 연동 전 테스트·예외 처리용. 연동 뒤에는 결제 완료/환불 처리에서 recordSale/recordRefund 를 부름.
export async function POST(request: Request) {
  const g = await requireAdmin(request, { write: true, platform: true })
  if ("err" in g) return g.err
  let b: Record<string, unknown>
  try {
    b = await request.json()
  } catch {
    return fail("JSON 형식이 아닙니다")
  }
  const storeId = typeof b.storeId === "string" ? b.storeId : ""
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(storeId)) return fail("storeId 가 올바르지 않습니다")
  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || Math.abs(amount) > 1e9) return fail("금액이 올바르지 않습니다")
  const orderRef = typeof b.orderRef === "string" && b.orderRef.trim() ? b.orderRef.trim().slice(0, 80) : `manual-${Date.now()}`
  const memo = typeof b.memo === "string" ? b.memo.trim().slice(0, 200) : ""

  const store = await g.db.prepare(`SELECT currency FROM stores WHERE id = ?`).bind(storeId).first<{ currency: string }>()
  if (!store) return fail("입점사가 없습니다", 404)
  const minor = toMinor(amount, store.currency)

  try {
    if (b.type === "sale") await recordSale(g.db, { storeId, grossMinor: minor, orderRef, memo })
    else if (b.type === "refund") await recordRefund(g.db, { storeId, refundMinor: minor, orderRef, memo })
    else if (b.type === "adjustment") {
      if (!memo) return fail("조정 사유(memo)를 적어 주세요")
      await recordAdjustment(g.db, { storeId, amountMinor: minor, memo })
    } else return fail("type 은 sale · refund · adjustment")
    return NextResponse.json({ success: true }, { status: 201, headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "기록하지 못했습니다", 400)
  }
}
