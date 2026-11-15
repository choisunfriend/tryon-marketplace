import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { deleteSalon, parseSalonInput, updateSalon } from "@/lib/salons-db"
import { ownSalon } from "@/lib/salons-guard"
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"

// (2026-11-01) 미용실 하나 — 수정(PATCH) · 삭제(DELETE, 스타일도 함께)
//   입점사 계정은 자기 미용실만, platform 은 전부
type Ctx = { params: Promise<{ id: string }> }

async function handlePATCH(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!(await ownSalon(g.session, g.db, id))) return fail(bi("미용실이 없거나 권한이 없습니다", "Salon not found or no permission"), 404)
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail(bi("JSON 형식이 아닙니다", "Not valid JSON"))
  }
  try {
    const salon = await updateSalon(g.db, id, parseSalonInput(body, false))
    return NextResponse.json({ success: true, salon }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : bi("수정하지 못했습니다", "Couldn't update"))
  }
}

async function handleDELETE(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!(await ownSalon(g.session, g.db, id))) return fail(bi("미용실이 없거나 권한이 없습니다", "Salon not found or no permission"), 404)
  await deleteSalon(g.db, id)
  return NextResponse.json({ success: true }, { headers: noStore })
}

export const PATCH = withLang(handlePATCH)
export const DELETE = withLang(handleDELETE)
