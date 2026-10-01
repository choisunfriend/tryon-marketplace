import { getAssetsBucket } from "@/lib/assets-bucket"

// ============================================================================
// R2 파일 제공 — /api/assets/products/.../main.jpg
// ============================================================================
// 버킷을 공개로 열지 않고 같은 도메인에서 이미지·3D 파일을 내려줍니다.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: parts } = await params
  const key = (parts ?? []).map((p) => decodeURIComponent(p)).join("/")

  // 404 에도 CORS 헤더를 붙여야 다른 사이트(GYEOL)에서 "없음"을 정상적으로 알아챕니다
  const notFound = () =>
    new Response("Not Found", {
      status: 404,
      headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" },
    })

  if (!key || key.includes("..")) return notFound()

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
      "Access-Control-Allow-Origin": "*",
    },
  })
}

