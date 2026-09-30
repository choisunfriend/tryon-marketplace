import { NextResponse } from "next/server"
import { assetUrl, getAssetsBucket } from "@/lib/assets-bucket"

// ============================================================================
// 관리자 파일 업로드 → R2
// ============================================================================
// POST multipart/form-data
//   file   : 파일
//   kind   : "image" | "model"
//   folder : 상품 폴더 이름 (영문·숫자·-·_)
// 저장 위치: products/{folder}/images/... 또는 products/{folder}/model/...
//   (기존 테스트 상품과 같은 규칙: products/product-test-001/model/product.obj)
// ============================================================================

const RULES = {
  image: {
    dir: "images",
    maxBytes: 10 * 1024 * 1024,
    ext: ["jpg", "jpeg", "png", "webp", "gif"],
  },
  model: {
    dir: "model",
    maxBytes: 50 * 1024 * 1024,
    ext: ["obj", "mtl", "glb", "gltf"],
  },
} as const

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  obj: "text/plain",
  mtl: "text/plain",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
}

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

// 영문·숫자·-·_ 만 남긴 이름 + 소문자 확장자. 한글 등으로 이름이 비면 시간값으로.
function safeName(name: string, ext: string): string {
  const dot = name.lastIndexOf(".")
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `${base || `file-${Date.now().toString(36)}`}.${ext}`
}

export async function POST(request: Request) {
  const bucket = await getAssetsBucket()
  if (!bucket) {
    return fail("R2 바인딩(ASSETS_BUCKET)이 없습니다 — wrangler.jsonc 확인", 500)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail("multipart/form-data 형식이 아닙니다")
  }

  const file = form.get("file")
  const kind = String(form.get("kind") ?? "")
  const folder = String(form.get("folder") ?? "").trim()

  if (!(file instanceof File)) return fail("file 이 없습니다")
  if (kind !== "image" && kind !== "model") return fail("kind 는 image 또는 model")
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(folder)) return fail("folder 이름이 올바르지 않습니다")

  const rule = RULES[kind]
  const ext = (file.name.split(".").pop() ?? "").toLowerCase()
  if (!(rule.ext as readonly string[]).includes(ext)) {
    return fail(`허용 확장자: ${rule.ext.join(", ")}`)
  }
  if (file.size > rule.maxBytes) {
    return fail(`파일이 너무 큽니다 (최대 ${rule.maxBytes / 1024 / 1024}MB)`)
  }

  const key = `products/${folder}/${rule.dir}/${safeName(file.name, ext)}`
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: TYPES[ext] ?? "application/octet-stream" },
  })

  return NextResponse.json({
    success: true,
    key,
    url: assetUrl(key),
    size: file.size,
  })
}
