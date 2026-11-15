// POST /api/customer/logout — 이 기기 로그아웃
//   body { all?: true } → 모든 기기에서 로그아웃
// 로그아웃한 뒤 앱은 토큰을 지우고, 필요하면 /api/customer/start 로 새로(가입 없이) 시작합니다.
import { withLang } from "@/i18n/api"
import { cjson, preflight, readJson, requireCustomer } from "@/lib/customer-auth"
import { endAllSessions, endSession } from "@/lib/customers-db"

async function handlePOST(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  const body = (await readJson(request)) ?? {}
  if (body.all === true) await endAllSessions(g.db, g.customer.id)
  else await endSession(g.db, g.tokenHash)
  return cjson(request, { success: true })
}

export const POST = withLang(handlePOST)
export const OPTIONS = (request: Request) => preflight(request)
