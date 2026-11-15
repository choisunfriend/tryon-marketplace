import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { createSalon, ID_RE, listSalons, parseSalonInput } from "@/lib/salons-db"
import { getStore } from "@/lib/stores-db"
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"

// ============================================================================
// (2026-11-01) 미용실 관리
//   GET  내 미용실 목록 (platform 은 전체)
//   POST { name, lat, lng, address?, … }  — platform 은 store_id 도 넣어야 함
// ============================================================================

async function handleGET(request: Request) {
  const g = await requireAdmin(request)
  if ("err" in g) return g.err
  try {
    const salons = await listSalons(g.db, g.session.role === "platform" ? null : g.session.sid)
    return NextResponse.json({ success: true, salons }, { headers: noStore })
  } catch {
    return fail(bi("목록을 읽지 못했습니다 — migrations/0003_salons.sql 을 실행했는지 확인하세요", "Couldn't load the list — check that migrations/0003_salons.sql was run"), 500)
  }
}

async function handlePOST(request: Request) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail(bi("JSON 형식이 아닙니다", "Not valid JSON"))
  }
  let storeId = g.session.sid
  if (g.session.role === "platform") {
    storeId = String(body.store_id ?? "")
    if (!ID_RE.test(storeId)) return fail(bi("어느 입점사의 미용실인지 store_id 를 골라 주세요", "Choose which store (store_id) this salon belongs to"))
  }
  if (!storeId) return fail(bi("입점사 계정이 아닙니다", "Not a store account"), 403)
  const store = await getStore(g.db, storeId)
  if (!store) return fail(bi("입점사가 없습니다", "Store not found"), 404)
  try {
    const input = parseSalonInput(body, true)
    if (input.country === undefined) input.country = store.country ?? null
    const salon = await createSalon(g.db, storeId, input)
    return NextResponse.json({ success: true, salon }, { status: 201, headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : bi("만들지 못했습니다", "Couldn't create"))
  }
}

export const GET = withLang(handleGET)
export const POST = withLang(handlePOST)
