import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { MIN_PASSWORD } from "@/lib/security"
import { createStoreWithOwner, EMAIL_RE, listStores, SLUG_RE, STORE_STATUSES, type StoreStatus } from "@/lib/stores-db"

// ============================================================================
// (2026-11-01) 입점사 — 플랫폼 운영자 전용
//   GET  목록 (상품 수·대표 이메일 포함)
//   POST { slug, name, ownerEmail, ownerPassword, status? } → 입점사 + 대표 계정 생성
// ============================================================================

export async function GET(request: Request) {
  const g = await requireAdmin(request, { platform: true })
  if ("err" in g) return g.err
  try {
    return NextResponse.json({ success: true, stores: await listStores(g.db) }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "목록을 읽지 못했습니다 — 마이그레이션을 실행했는지 확인하세요", 500)
  }
}

export async function POST(request: Request) {
  const g = await requireAdmin(request, { write: true, platform: true })
  if ("err" in g) return g.err
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail("JSON 형식이 아닙니다")
  }
  const slug = String(body.slug ?? "").trim().toLowerCase()
  const name = String(body.name ?? "").trim()
  const ownerEmail = String(body.ownerEmail ?? "").trim()
  const ownerPassword = String(body.ownerPassword ?? "")
  const status = (body.status ?? "active") as StoreStatus

  if (!SLUG_RE.test(slug)) return fail("slug 는 영문 소문자·숫자·- 2~30자 ('--' 불가)")
  if (slug === "p") return fail("쓸 수 없는 slug 입니다")
  if (!name || name.length > 80) return fail("입점사 이름을 1~80자로 넣어 주세요")
  if (!EMAIL_RE.test(ownerEmail)) return fail("대표 이메일이 올바르지 않습니다")
  if (ownerPassword.length < MIN_PASSWORD || ownerPassword.length > 256) {
    return fail(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다`)
  }
  if (!STORE_STATUSES.includes(status)) return fail("status 값이 올바르지 않습니다")

  try {
    const store = await createStoreWithOwner(g.db, { slug, name, ownerEmail, ownerPassword, status })
    return NextResponse.json({ success: true, store }, { status: 201, headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "만들지 못했습니다", 409)
  }
}
