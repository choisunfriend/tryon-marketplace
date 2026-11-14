import { NextResponse } from "next/server"
import { folderOwner, getProductsDb, type D1Database } from "@/lib/products-db"
import { folderHasStorePrefix, getAdminSession, isSameOriginWrite, type AdminSession } from "@/lib/security"

// ============================================================================
// (2026-11-01) 관리자 API 공용 문지기
// ============================================================================
//   · 서명 쿠키 확인 (없거나 위조 → 401)
//   · 쓰기면 같은 출처 확인 (CSRF → 403)
//   · platform 전용이면 역할 확인 (→ 403)
//   · 입점사 계정은 매 요청마다 D1 에서 "계정이 살아 있고 입점사가 active 인지" 다시 확인
//     (정지시키면 쿠키 만료 8시간을 기다리지 않고 바로 막힘)
// ============================================================================

export const noStore = { "Cache-Control": "no-store" }

export function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status, headers: noStore })
}

type GuardOk = { session: AdminSession; db: D1Database }
type GuardErr = { err: NextResponse }

export async function requireAdmin(
  request: Request,
  opts: { write?: boolean; platform?: boolean } = {}
): Promise<GuardOk | GuardErr> {
  const session = await getAdminSession(request)
  if (!session) return { err: fail("관리자 로그인이 필요합니다", 401) }
  if (opts.write && !isSameOriginWrite(request)) return { err: fail("허용되지 않은 요청 출처입니다", 403) }
  if (opts.platform && session.role !== "platform") return { err: fail("플랫폼 운영자만 할 수 있습니다", 403) }

  const db = await getProductsDb()
  if (!db) return { err: fail("D1 바인딩(DB)이 없습니다 — wrangler.jsonc 의 d1_databases 를 확인하세요", 503) }

  if (session.uid !== "env") {
    const row = await db
      .prepare(
        `SELECT u.disabled AS disabled, s.status AS status
           FROM store_users u LEFT JOIN stores s ON s.id = u.store_id
          WHERE u.id = ?`
      )
      .bind(session.uid)
      .first<{ disabled: number; status: string | null }>()
    if (!row || row.disabled) return { err: fail("계정이 없거나 사용 중지되었습니다", 401) }
    if (session.role !== "platform" && row.status !== "active") {
      return { err: fail("입점사가 영업 중(active)이 아닙니다", 403) }
    }
  }
  return { session, db }
}

// 이 세션이 그 상품을 다룰 수 있는지 (platform 은 전부, 입점사는 자기 것만)
export function canTouchProduct(session: AdminSession, product: Record<string, unknown> | null): boolean {
  if (!product) return false
  if (session.role === "platform") return true
  return product.store_id === session.sid
}

// R2 폴더 products/{folder}/ 에 쓸 수 있는지
//   · platform → 언제나
//   · 그 폴더를 이미 쓰는 상품이 있으면 → 그 상품이 내 입점사 것일 때만
//   · 아직 아무도 안 쓰는 폴더면 → "{내 slug}--" 로 시작할 때만
export async function canUseFolder(session: AdminSession, db: D1Database, folder: string): Promise<boolean> {
  if (session.role === "platform") return true
  const owner = await folderOwner(db, folder)
  if (owner !== "none") return owner === session.sid
  return folderHasStorePrefix(session, folder)
}
