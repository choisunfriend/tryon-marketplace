// POST /api/customer/login — 애플·구글·카카오 로그인
//   headers: Authorization: Bearer <지금 토큰>  (있으면 가입 전 데이터를 이어 붙임 · 없어도 됨)
//   body: { provider: "apple"|"google"|"kakao", idToken: string, nonce?: string, platform?, deviceId?,
//           name?: string }   ← 애플은 이름을 첫 로그인 때 앱에만 한 번 줌 → 앱이 같이 보내면 저장
//   → { success, token, expiresAt, customer, merged, created }
// 새 토큰을 받으면 앱은 예전 토큰을 버리세요(예전 세션은 서버에서 지움).
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"
import { cfail, cjson, clientInfo, customerDb, optionalCustomer, overCustomerLimit, preflight, readJson, bearerToken } from "@/lib/customer-auth"
import { AccountError, cleanSessionMeta, endSession, hashToken, linkOrLogin, toPublic, TOKEN_RE } from "@/lib/customers-db"
import { isProvider, OidcError, verifyIdToken } from "@/lib/oidc"

async function handlePOST(request: Request) {
  const info = clientInfo(request)
  if (await overCustomerLimit(`login:${info.ip}`)) return cfail(request, bi("요청이 너무 많습니다. 잠시 뒤 다시 해 주세요", "Too many requests. Try again shortly"), 429)
  const body = await readJson(request)
  if (!body) return cfail(request, bi("JSON 형식이 아닙니다", "Not valid JSON"))
  if (!isProvider(body.provider)) return cfail(request, bi("지원하지 않는 로그인 방식입니다", "Unsupported sign-in method"))
  const nonce = typeof body.nonce === "string" && body.nonce.length <= 256 ? body.nonce : null

  let idt
  try {
    idt = await verifyIdToken(body.provider, String(body.idToken ?? ""), nonce)
  } catch (e) {
    if (e instanceof OidcError && e.message === "provider disabled") {
      return cfail(request, bi("이 로그인 방식은 아직 켜지지 않았습니다", "This sign-in method isn't enabled yet"), 503)
    }
    return cfail(request, bi("로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요", "Couldn't verify the sign-in. Please try again"), 401)
  }
  if (!idt.name && typeof body.name === "string" && body.name.trim()) idt.name = body.name.trim().slice(0, 80)

  const d = await customerDb(request)
  if ("err" in d) return d.err
  try {
    const current = await optionalCustomer(request, d.db)
    const r = await linkOrLogin(d.db, idt, current, cleanSessionMeta(body), info)
    // 예전 토큰은 끝냄 (가입 전 고객이 합쳐져 지워졌다면 이미 없음)
    const old = bearerToken(request)
    if (old && TOKEN_RE.test(old)) await endSession(d.db, await hashToken(old))
    return cjson(request, {
      success: true,
      token: r.token,
      expiresAt: r.expiresAt,
      customer: await toPublic(d.db, r.customer),
      merged: r.merged,
      created: r.created,
    })
  } catch (e) {
    if (e instanceof AccountError && e.status === 403) return cfail(request, bi("사용이 중지된 계정입니다", "This account is disabled"), 403)
    return cfail(request, bi("로그인하지 못했습니다", "Couldn't sign in"), 500)
  }
}

export const POST = withLang(handlePOST)
export const OPTIONS = (request: Request) => preflight(request)
