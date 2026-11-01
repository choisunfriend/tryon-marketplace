import { NextResponse } from "next/server"
import { noStore, requireAdmin } from "@/lib/admin-guard"
import { getStore } from "@/lib/stores-db"

// (2026-11-01) 지금 로그인한 관리자 — 화면이 메뉴·입점사 이름·R2 폴더 앞머리를 정할 때 씀
export async function GET(request: Request) {
  const g = await requireAdmin(request)
  if ("err" in g) return g.err
  const { session, db } = g
  const store = session.sid ? await getStore(db, session.sid) : null
  return NextResponse.json(
    {
      success: true,
      role: session.role,
      store: store ? { id: store.id, slug: store.slug, name: store.name } : null,
      // 새 상품 파일을 올릴 R2 폴더 앞머리 (platform 은 예전처럼 "p")
      folderPrefix: store ? `${store.slug}--` : "p-",
    },
    { headers: noStore }
  )
}
