import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { STORE_STATUSES, updateStore, type StoreStatus } from "@/lib/stores-db"
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"

// (2026-11-01) 입점사 수정 — 플랫폼 운영자 전용
//   PATCH { name?, status?, commission_rate? }   status: pending | active | suspended
//   suspended 로 바꾸면 그 입점사 계정의 다음 요청부터 바로 막힘(admin-guard)

type Ctx = { params: Promise<{ id: string }> }

async function handlePATCH(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true, platform: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return fail(bi("잘못된 id", "Invalid id"))
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail(bi("JSON 형식이 아닙니다", "Not valid JSON"))
  }
  const input: { name?: string; status?: StoreStatus; commission_rate?: number } = {}
  if ("name" in body) {
    const n = String(body.name ?? "").trim()
    if (!n || n.length > 80) return fail(bi("이름은 1~80자", "Name must be 1–80 characters"))
    input.name = n
  }
  if ("status" in body) {
    if (!STORE_STATUSES.includes(body.status as StoreStatus)) return fail(bi("status 값이 올바르지 않습니다", "Invalid status"))
    input.status = body.status as StoreStatus
  }
  if ("commission_rate" in body) {
    const r = Number(body.commission_rate)
    if (!Number.isFinite(r) || r < 0 || r > 1) return fail(bi("수수료는 0~1 (예: 0.1 = 10%)", "Commission must be 0–1 (e.g. 0.1 = 10%)"))
    input.commission_rate = r
  }
  try {
    const store = await updateStore(g.db, id, input)
    if (!store) return fail(bi("입점사가 없습니다", "Store not found"), 404)
    return NextResponse.json({ success: true, store }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : bi("수정하지 못했습니다", "Couldn't update"), 500)
  }
}

export const PATCH = withLang(handlePATCH)
