// /api/customer/wishlist — 찜 목록 (기기를 바꿔도 따라옴)
//   GET                         → { success, items: [productId…] }
//   POST   body { productId }   찜하기
//   DELETE ?productId=…         찜 빼기
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"
import { cfail, cjson, preflight, readJson, requireCustomer } from "@/lib/customer-auth"
import { AccountError, addWishlist, listWishlist, PRODUCT_ID_RE, removeWishlist } from "@/lib/customers-db"

async function handleGET(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  return cjson(request, { success: true, items: await listWishlist(g.db, g.customer.id) })
}

async function handlePOST(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  const body = await readJson(request)
  const id = body && typeof body.productId === "string" ? body.productId : ""
  if (!PRODUCT_ID_RE.test(id)) return cfail(request, bi("상품 id 가 올바르지 않습니다", "Invalid product id"))
  try {
    await addWishlist(g.db, g.customer.id, id)
  } catch (e) {
    if (e instanceof AccountError) return cfail(request, bi("찜 목록이 가득 찼습니다", "Your wishlist is full"), 409)
    throw e
  }
  return cjson(request, { success: true, items: await listWishlist(g.db, g.customer.id) })
}

async function handleDELETE(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  const id = new URL(request.url).searchParams.get("productId") ?? ""
  if (!PRODUCT_ID_RE.test(id)) return cfail(request, bi("상품 id 가 올바르지 않습니다", "Invalid product id"))
  await removeWishlist(g.db, g.customer.id, id)
  return cjson(request, { success: true, items: await listWishlist(g.db, g.customer.id) })
}

export const GET = withLang(handleGET)
export const POST = withLang(handlePOST)
export const DELETE = withLang(handleDELETE)
export const OPTIONS = (request: Request) => preflight(request)
