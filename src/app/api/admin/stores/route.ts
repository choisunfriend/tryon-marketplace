import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { MIN_PASSWORD } from "@/lib/security"
import { createStoreWithOwner, EMAIL_RE, listStores, SLUG_RE, STORE_STATUSES, type StoreStatus } from "@/lib/stores-db"
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"

// ============================================================================
// (2026-11-01) 입점사 — 플랫폼 운영자 전용
//   GET  목록 (상품 수·대표 이메일 포함)
//   POST { slug, name, ownerEmail, ownerPassword, status? } → 입점사 + 대표 계정 생성
// ============================================================================

async function handleGET(request: Request) {
  const g = await requireAdmin(request, { platform: true })
  if ("err" in g) return g.err
  try {
    return NextResponse.json({ success: true, stores: await listStores(g.db) }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : bi("목록을 읽지 못했습니다 — 마이그레이션을 실행했는지 확인하세요", "Couldn't load the list — check that the migrations were run"), 500)
  }
}

async function handlePOST(request: Request) {
  const g = await requireAdmin(request, { write: true, platform: true })
  if ("err" in g) return g.err
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail(bi("JSON 형식이 아닙니다", "Not valid JSON"))
  }
  const slug = String(body.slug ?? "").trim().toLowerCase()
  const name = String(body.name ?? "").trim()
  const ownerEmail = String(body.ownerEmail ?? "").trim()
  const ownerPassword = String(body.ownerPassword ?? "")
  const status = (body.status ?? "active") as StoreStatus

  if (!SLUG_RE.test(slug)) return fail(bi("slug 는 영문 소문자·숫자·- 2~30자 ('--' 불가)", "slug must be 2–30 lowercase letters, numbers or - (no '--')"))
  if (slug === "p") return fail(bi("쓸 수 없는 slug 입니다", "That slug can't be used"))
  if (!name || name.length > 80) return fail(bi("입점사 이름을 1~80자로 넣어 주세요", "Store name must be 1–80 characters"))
  if (!EMAIL_RE.test(ownerEmail)) return fail(bi("대표 이메일이 올바르지 않습니다", "Invalid owner email"))
  if (ownerPassword.length < MIN_PASSWORD || ownerPassword.length > 256) {
    return fail(bi(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다`, `Password must be at least ${MIN_PASSWORD} characters`))
  }
  if (!STORE_STATUSES.includes(status)) return fail(bi("status 값이 올바르지 않습니다", "Invalid status"))

  try {
    const store = await createStoreWithOwner(g.db, { slug, name, ownerEmail, ownerPassword, status })
    return NextResponse.json({ success: true, store }, { status: 201, headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : bi("만들지 못했습니다", "Couldn't create"), 409)
  }
}

export const GET = withLang(handleGET)
export const POST = withLang(handlePOST)
