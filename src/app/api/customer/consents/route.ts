// /api/customer/consents  (2026-11-28)
//   GET  → { success, consents: [{ item, version, agreed, updated_at }] }
//   POST body { items: { terms: true, marketing: false, ... }, version }  동의 저장(마케팅은 나중에 철회도 여기로)
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"
import { cfail, cjson, preflight, readJson, requireCustomer } from "@/lib/customer-auth"
import { CONSENT_ITEMS, CONSENT_VERSION } from "@/lib/consent"

async function handleGET(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  const r = await g.db.prepare("SELECT item, version, agreed, updated_at FROM customer_consents WHERE customer_id = ?").bind(g.customer.id).all()
  return cjson(request, { success: true, consents: r.results ?? [] })
}

async function handlePOST(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  const body = await readJson(request)
  const items = body?.items as Record<string, unknown> | undefined
  if (!body || !items || typeof items !== "object") return cfail(request, bi("동의 항목이 없습니다", "No consent items"))
  const version = typeof body.version === "string" ? body.version.slice(0, 20) : CONSENT_VERSION
  const lang = typeof body.lang === "string" ? body.lang.slice(0, 8) : null
  const rows: [string, number][] = []
  for (const it of CONSENT_ITEMS) {
    if (!(it.id in items)) continue
    const agreed = items[it.id] ? 1 : 0
    if (it.required && !agreed) return cfail(request, bi("필수 항목에 동의해야 합니다", "Required items must be accepted"))
    rows.push([it.id, agreed])
  }
  for (const [item, agreed] of rows) {
    await g.db.prepare(
        `INSERT INTO customer_consents (customer_id, item, version, agreed, lang, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(customer_id, item) DO UPDATE SET version=excluded.version, agreed=excluded.agreed, lang=excluded.lang, updated_at=excluded.updated_at`,
      ).bind(g.customer.id, item, version, agreed, lang).run()
  }
  return cjson(request, { success: true })
}

export const GET = withLang(handleGET)
export const POST = withLang(handlePOST)
export const OPTIONS = (request: Request) => preflight(request)
