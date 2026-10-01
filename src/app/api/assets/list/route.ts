import { NextResponse } from "next/server"
import { assetUrl, getAssetsBucket } from "@/lib/assets-bucket"

// ============================================================================
// R2 상품 폴더 목록 — /api/assets/list
// ============================================================================
// products/{folder}/images/... · products/{folder}/model/... 를 폴더별로 묶어
// 관리자 "R2 동기화" 화면에 돌려줍니다. 파일 내용은 읽지 않고 이름만 봅니다.

interface FolderInfo {
  folder: string
  images: string[] // 화면에 바로 쓸 주소 (/api/assets/...)
  models: string[] // R2 키 (products/.../model/x.obj) — 상품 model_file 에 그대로 저장
  uploaded: string | null
}

export async function GET() {
  const bucket = await getAssetsBucket()
  if (!bucket) {
    return NextResponse.json(
      { success: false, error: "R2 바인딩(ASSETS_BUCKET)이 없습니다" },
      { status: 500 }
    )
  }

  const folders = new Map<string, FolderInfo>()
  let cursor: string | undefined
  let pages = 0

  do {
    const res = await bucket.list({ prefix: "products/", cursor, limit: 1000 })
    for (const obj of res.objects) {
      // products/{folder}/{images|model}/{file}
      const parts = obj.key.split("/")
      if (parts.length < 4) continue
      const [, folder, dir] = parts
      let info = folders.get(folder)
      if (!info) {
        info = { folder, images: [], models: [], uploaded: null }
        folders.set(folder, info)
      }
      if (dir === "images") info.images.push(assetUrl(obj.key))
      else if (dir === "model") info.models.push(obj.key)
      const t = obj.uploaded ? new Date(obj.uploaded).toISOString() : null
      if (t && (!info.uploaded || t > info.uploaded)) info.uploaded = t
    }
    cursor = res.truncated ? res.cursor : undefined
    pages++
  } while (cursor && pages < 20)

  const list = Array.from(folders.values()).sort((a, b) =>
    (b.uploaded ?? "").localeCompare(a.uploaded ?? "")
  )

  return NextResponse.json(
    { success: true, folders: list },
    { headers: { "Cache-Control": "no-store" } }
  )
}
