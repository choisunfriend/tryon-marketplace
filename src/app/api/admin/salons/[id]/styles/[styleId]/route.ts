import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { deleteStyle, getStyle, ID_RE, parseStyleInput, updateStyle } from "@/lib/salons-db"
import { ownSalon } from "@/lib/salons-guard"

// (2026-11-01) 헤어스타일 하나 — 수정(PATCH) · 삭제(DELETE)
type Ctx = { params: Promise<{ id: string; styleId: string }> }

async function guard(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return { err: g.err }
  const { id, styleId } = await ctx.params
  if (!ID_RE.test(styleId) || !(await ownSalon(g.session, g.db, id))) return { err: fail("미용실이 없거나 권한이 없습니다", 404) }
  const style = await getStyle(g.db, styleId)
  if (!style || style.salon_id !== id) return { err: fail("스타일이 없습니다", 404) }
  return { db: g.db, styleId }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const r = await guard(request, ctx)
  if ("err" in r) return r.err
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail("JSON 형식이 아닙니다")
  }
  try {
    const style = await updateStyle(r.db, r.styleId, parseStyleInput(body, false))
    return NextResponse.json({ success: true, style }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "수정하지 못했습니다")
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const r = await guard(request, ctx)
  if ("err" in r) return r.err
  await deleteStyle(r.db, r.styleId)
  return NextResponse.json({ success: true }, { headers: noStore })
}
