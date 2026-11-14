import type { D1Database } from "@/lib/products-db"
import { getSalon, ID_RE } from "@/lib/salons-db"
import type { AdminSession } from "@/lib/security"

// (2026-11-01) 이 세션이 그 미용실을 다룰 수 있으면 미용실을, 아니면 null
//   platform → 전부 · 입점사 계정 → 자기 입점사 미용실만
export async function ownSalon(session: AdminSession, db: D1Database, id: string) {
  if (!ID_RE.test(id)) return null
  const salon = await getSalon(db, id)
  if (!salon) return null
  if (session.role !== "platform" && salon.store_id !== session.sid) return null
  return salon
}
