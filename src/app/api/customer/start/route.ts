// POST /api/customer/start — 앱 첫 실행: 가입 없이 고객을 만들고 세션 토큰을 줌
//   body: { platform?: "ios"|"android"|"web", deviceId?: string }
//   → { success, token, expiresAt, customer }
// 앱은 token 을 키체인(iOS)·암호화 저장소(Android)에 보관하고, 이후 모든 요청에 Bearer 로 보냅니다.
// 이미 토큰이 있으면 다시 부르지 말고 /api/customer/me 를 쓰세요.
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"
import { cfail, cjson, clientInfo, customerDb, overCustomerLimit, preflight, readJson } from "@/lib/customer-auth"
import { cleanSessionMeta, startAnonymous, toPublic } from "@/lib/customers-db"

async function handlePOST(request: Request) {
  const info = clientInfo(request)
  if (await overCustomerLimit(`start:${info.ip}`)) return cfail(request, bi("요청이 너무 많습니다. 잠시 뒤 다시 해 주세요", "Too many requests. Try again shortly"), 429)
  const body = await readJson(request)
  if (!body) return cfail(request, bi("JSON 형식이 아닙니다", "Not valid JSON"))
  const d = await customerDb(request)
  if ("err" in d) return d.err
  try {
    const r = await startAnonymous(d.db, cleanSessionMeta(body), info)
    return cjson(request, { success: true, token: r.token, expiresAt: r.expiresAt, customer: await toPublic(d.db, r.customer) }, 201)
  } catch {
    return cfail(request, bi("계정 테이블이 없습니다 — migrations/0004_customers.sql 을 실행하세요", "Accounts table missing — run migrations/0004_customers.sql"), 503)
  }
}

export const POST = withLang(handlePOST)
export const OPTIONS = (request: Request) => preflight(request)
