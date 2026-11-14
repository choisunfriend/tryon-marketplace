import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { deleteSalon, parseSalonInput, updateSalon } from "@/lib/salons-db"
import { ownSalon } from "@/lib/salons-guard"

// (2026-11-01) 미용실 하나 — 수정(PATCH) · 삭제(DELETE, 스타일도 함께)
//   입점사 계정은 자기 미용실만, platform 은 전부
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!(await ownSalon(g.session, g.db, id))) return fail("미용실이 없거나 권한이 없습니다", 404)
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail("JSON 형식이 아닙니다")
  }
  try {
    const salon = await updateSalon(g.db, id, parseSalonInput(body, false))
    return NextResponse.json({ success: true, salon }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "수정하지 못했습니다")
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!(await ownSalon(g.session, g.db, id))) return fail("미용실이 없거나 권한이 없습니다", 404)
  await deleteSalon(g.db, id)
  return NextResponse.json({ success: true }, { headers: noStore })
}
