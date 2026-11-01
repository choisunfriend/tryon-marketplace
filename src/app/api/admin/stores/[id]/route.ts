import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { STORE_STATUSES, updateStore, type StoreStatus } from "@/lib/stores-db"

// (2026-11-01) 입점사 수정 — 플랫폼 운영자 전용
//   PATCH { name?, status?, commission_rate? }   status: pending | active | suspended
//   suspended 로 바꾸면 그 입점사 계정의 다음 요청부터 바로 막힘(admin-guard)

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true, platform: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return fail("잘못된 id")
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail("JSON 형식이 아닙니다")
  }
  const input: { name?: string; status?: StoreStatus; commission_rate?: number } = {}
  if ("name" in body) {
    const n = String(body.name ?? "").trim()
    if (!n || n.length > 80) return fail("이름은 1~80자")
    input.name = n
  }
  if ("status" in body) {
    if (!STORE_STATUSES.includes(body.status as StoreStatus)) return fail("status 값이 올바르지 않습니다")
    input.status = body.status as StoreStatus
  }
  if ("commission_rate" in body) {
    const r = Number(body.commission_rate)
    if (!Number.isFinite(r) || r < 0 || r > 1) return fail("수수료는 0~1 (예: 0.1 = 10%)")
    input.commission_rate = r
  }
  try {
    const store = await updateStore(g.db, id, input)
    if (!store) return fail("입점사가 없습니다", 404)
    return NextResponse.json({ success: true, store }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "수정하지 못했습니다", 500)
  }
}
