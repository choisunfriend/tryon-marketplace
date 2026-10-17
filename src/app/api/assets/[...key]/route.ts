import { getAssetsBucket } from "@/lib/assets-bucket"
import { appOrigins } from "@/lib/security"

// ============================================================================
// R2 파일 제공 — /api/assets/products/.../main.jpg
// ============================================================================
// 버킷을 공개로 열지 않고 같은 도메인에서 이미지·3D 파일을 내려줍니다.

// (2026-10-17 보안 1차) 다른 사이트에서 3D·이미지 파일을 가져다 쓰는 것을 줄이려고 CORS 를 앱 주소로만 엽니다.
// (같은 도메인의 쇼핑 화면 <img> 는 CORS 와 상관없이 그대로 보입니다)
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin")
  if (origin && appOrigins().includes(origin)) return { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
  return { Vary: "Origin" }
}

const KEY_RE = /^products\/[A-Za-z0-9_-]{1,80}\/(images\/|model\/)?[A-Za-z0-9._-]{1,160}$/

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: parts } = await params
  const key = (parts ?? []).map((p) => decodeURIComponent(p)).join("/")

  // 404 에도 CORS 헤더를 붙여야 다른 사이트(GYEOL)에서 "없음"을 정상적으로 알아챕니다
  const notFound = () =>
    new Response("Not Found", {
      status: 404,
      headers: { ...corsHeaders(request), "Cache-Control": "no-cache" },
    })

  // products/ 아래의 정해진 모양 경로만 내줌 (다른 접두어·이상한 문자·.. 차단)
  if (!key || key.includes("..") || !KEY_RE.test(key)) return notFound()

  const bucket = await getAssetsBucket()
  if (!bucket) return new Response("R2 binding missing", { status: 500 })

  const object = await bucket.get(key)
  if (!object) return notFound()

  return new Response(object.body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(object.size),
      ETag: object.etag,
      // fitted.json 은 다시 구우면 바로 바뀌어야 하므로 캐시하지 않음
      "Cache-Control": key.endsWith("/fitted.json") ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...corsHeaders(request),
    },
  })
}


