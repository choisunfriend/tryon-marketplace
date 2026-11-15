import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { MIN_PASSWORD } from "@/lib/security"
import { addStoreUser, EMAIL_RE, getStore } from "@/lib/stores-db"
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"

// (2026-11-01) 입점사 계정 추가 — POST { email, password, role: "owner" | "staff" }
//   · 플랫폼 운영자: 어느 입점사든
//   · 입점사 owner: 자기 입점사에 staff 만
type Ctx = { params: Promise<{ id: string }> }

async function handlePOST(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err
  const { session, db } = g
  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return fail(bi("잘못된 id", "Invalid id"))

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail(bi("JSON 형식이 아닙니다", "Not valid JSON"))
  }
  const email = String(body.email ?? "").trim()
  const password = String(body.password ?? "")
  const role = body.role === "owner" ? "owner" : "staff"

  if (session.role !== "platform") {
    if (session.role !== "owner" || session.sid !== id) return fail(bi("권한이 없습니다", "No permission"), 403)
    if (role !== "staff") return fail(bi("입점사 대표는 직원(staff) 계정만 만들 수 있습니다", "Store owners can only create staff accounts"), 403)
  }
  if (!EMAIL_RE.test(email)) return fail(bi("이메일이 올바르지 않습니다", "Invalid email"))
  if (password.length < MIN_PASSWORD || password.length > 256) return fail(bi(`비밀번호는 ${MIN_PASSWORD}자 이상`, `Password must be at least ${MIN_PASSWORD} characters`))
  if (!(await getStore(db, id))) return fail(bi("입점사가 없습니다", "Store not found"), 404)

  try {
    const user = await addStoreUser(db, { storeId: id, email, password, role })
    return NextResponse.json({ success: true, user }, { status: 201, headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : bi("만들지 못했습니다", "Couldn't create"), 409)
  }
}

export const POST = withLang(handlePOST)
