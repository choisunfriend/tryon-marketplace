// DELETE /api/customer/identities/{apple|google|kakao} — 로그인 수단 연결 끊기 (마지막 하나는 못 끊음)
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"
import { cfail, cjson, preflight, requireCustomer } from "@/lib/customer-auth"
import { AccountError, getCustomer, toPublic, unlinkProvider } from "@/lib/customers-db"
import { isProvider } from "@/lib/oidc"

type Ctx = { params: Promise<{ provider: string }> }

async function handleDELETE(request: Request, ctx: Ctx) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  const { provider } = await ctx.params
  if (!isProvider(provider)) return cfail(request, bi("지원하지 않는 로그인 방식입니다", "Unsupported sign-in method"))
  try {
    await unlinkProvider(g.db, g.customer.id, provider)
  } catch (e) {
    if (e instanceof AccountError && e.status === 409) {
      return cfail(request, bi("마지막 로그인 방식은 끊을 수 없습니다", "You can't remove your last sign-in method"), 409)
    }
    return cfail(request, bi("연결되어 있지 않습니다", "Not linked"), 404)
  }
  const c = await getCustomer(g.db, g.customer.id)
  return cjson(request, { success: true, customer: c ? await toPublic(g.db, c) : null })
}

export const DELETE = withLang(handleDELETE)
export const OPTIONS = (request: Request) => preflight(request)
