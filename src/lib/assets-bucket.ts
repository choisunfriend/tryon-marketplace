import { getCloudflareContext } from "@opennextjs/cloudflare"

// ============================================================================
// R2 버킷 (tryon-marketplace-assets) — wrangler.jsonc 의 ASSETS_BUCKET 바인딩
// ============================================================================
// @cloudflare/workers-types 없이 쓰는 최소 타입

export interface AssetObject {
  body: ReadableStream
  size: number
  etag: string
  httpMetadata?: { contentType?: string }
}

export interface AssetsBucket {
  get(key: string): Promise<AssetObject | null>
  put(
    key: string,
    value: ArrayBuffer | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<unknown>
}

export async function getAssetsBucket(): Promise<AssetsBucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const bucket = (env as unknown as { ASSETS_BUCKET?: AssetsBucket })
      .ASSETS_BUCKET
    return bucket ?? null
  } catch {
    return null
  }
}

// 파일을 브라우저에 내려줄 때 쓰는 주소 (같은 도메인)
export function assetUrl(key: string): string {
  return `/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`
}
