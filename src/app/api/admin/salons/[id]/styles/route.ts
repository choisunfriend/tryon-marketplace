import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { createStyle, listStyles, parseStyleInput } from "@/lib/salons-db"
import { getStore } from "@/lib/stores-db"
import { ownSalon } from "@/lib/salons-guard"

// (2026-11-01) 미용실 헤어스타일 — 목록(GET) · 추가(POST { name, spec, gender?, price_minor?, … })
type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request)
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!(await ownSalon(g.session, g.db, id))) return fail("미용실이 없거나 권한이 없습니다", 404)
  return NextResponse.json({ success: true, styles: await listStyles(g.db, id) }, { headers: noStore })
}

export async function POST(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  const salon = await ownSalon(g.session, g.db, id)
  if (!salon) return fail("미용실이 없거나 권한이 없습니다", 404)
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail("JSON 형식이 아닙니다")
  }
  try {
    const input = parseStyleInput(body, true)
    if (!input.currency) input.currency = (await getStore(g.db, salon.store_id))?.currency ?? "KRW"
    const style = await createStyle(g.db, id, input)
    return NextResponse.json({ success: true, style }, { status: 201, headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "추가하지 못했습니다")
  }
}
