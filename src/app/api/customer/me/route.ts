// /api/customer/me
//   GET    → { success, customer }                 내 정보
//   PATCH  body { displayName?, lang? }            이름·언어 바꾸기
//   DELETE body { confirm: "DELETE" }              계정 삭제(탈퇴) — 찜·세션·로그인 연결 전부 지움.
//          앱스토어·플레이스토어 규정상 앱 안에서 탈퇴할 수 있어야 합니다.
//          애플 로그인을 쓴 계정은 앱이 애플 "토큰 철회"도 함께 하는 것이 규정입니다(문서 참고).
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"
import { cfail, cjson, preflight, readJson, requireCustomer } from "@/lib/customer-auth"
import { deleteCustomer, getCustomer, toPublic, updateProfile } from "@/lib/customers-db"
import { scrubCustomerBookings } from "@/lib/bookings-db"

async function handleGET(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  return cjson(request, { success: true, customer: await toPublic(g.db, g.customer) })
}

async function handlePATCH(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  const body = await readJson(request)
  if (!body) return cfail(request, bi("JSON 형식이 아닙니다", "Not valid JSON"))
  await updateProfile(g.db, g.customer.id, body)
  const c = await getCustomer(g.db, g.customer.id)
  return cjson(request, { success: true, customer: c ? await toPublic(g.db, c) : null })
}

async function handleDELETE(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  const body = await readJson(request)
  if (!body || body.confirm !== "DELETE") return cfail(request, bi('확인값이 필요합니다 (confirm: "DELETE")', 'Confirmation required (confirm: "DELETE")'))
  // (2026-11-28) 예약: 앞으로의 예약은 취소 · 이름·연락처·메모 지움 · 고객 연결 끊음
  await scrubCustomerBookings(g.db, g.customer.id)
  await deleteCustomer(g.db, g.customer.id)
  return cjson(request, { success: true })
}

export const GET = withLang(handleGET)
export const PATCH = withLang(handlePATCH)
export const DELETE = withLang(handleDELETE)
export const OPTIONS = (request: Request) => preflight(request)
