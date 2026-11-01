import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { reviewStore } from "@/lib/stores-db"

// (2026-11-01) 입점 심사 — 플랫폼 운영자 전용
//   POST { decision: "approve" | "reject", note? }
//   승인 → 영업 시작(active) · 거절 → 사유가 신청자 로그인 화면에 보임
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true, platform: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return fail("잘못된 id")
  let body: { decision?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail("JSON 형식이 아닙니다")
  }
  const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : null
  if (!decision) return fail("decision 은 approve 또는 reject")
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null
  if (decision === "reject" && !note) return fail("거절 사유를 적어 주세요 (신청자에게 보입니다)")
  const store = await reviewStore(g.db, id, decision, note)
  if (!store) return fail("심사할 수 있는 신청이 아닙니다 (이미 처리됨)", 409)
  return NextResponse.json({ success: true, store }, { headers: noStore })
}
