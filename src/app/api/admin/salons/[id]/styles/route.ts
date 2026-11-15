import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { createStyle, listStyles, parseStyleInput } from "@/lib/salons-db"
import { getStore } from "@/lib/stores-db"
import { ownSalon } from "@/lib/salons-guard"
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"

// (2026-11-01) 미용실 헤어스타일 — 목록(GET) · 추가(POST { name, spec, gender?, price_minor?, … })
type Ctx = { params: Promise<{ id: string }> }

async function handleGET(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request)
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!(await ownSalon(g.session, g.db, id))) return fail(bi("미용실이 없거나 권한이 없습니다", "Salon not found or no permission"), 404)
  return NextResponse.json({ success: true, styles: await listStyles(g.db, id) }, { headers: noStore })
}

async function handlePOST(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  const salon = await ownSalon(g.session, g.db, id)
  if (!salon) return fail(bi("미용실이 없거나 권한이 없습니다", "Salon not found or no permission"), 404)
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail(bi("JSON 형식이 아닙니다", "Not valid JSON"))
  }
  try {
    const input = parseStyleInput(body, true)
    if (!input.currency) input.currency = (await getStore(g.db, salon.store_id))?.currency ?? "KRW"
    const style = await createStyle(g.db, id, input)
    return NextResponse.json({ success: true, style }, { status: 201, headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : bi("추가하지 못했습니다", "Couldn't add"))
  }
}

export const GET = withLang(handleGET)
export const POST = withLang(handlePOST)
