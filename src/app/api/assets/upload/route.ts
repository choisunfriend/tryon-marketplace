import { NextResponse } from "next/server"
import { assetUrl, getAssetsBucket } from "@/lib/assets-bucket"
import { canUseFolder, requireAdmin } from "@/lib/admin-guard"

// ============================================================================
// 관리자 파일 업로드 → R2
// ============================================================================
// POST multipart/form-data
//   file   : 파일
//   kind   : "image" | "model"
//   folder : 상품 폴더 이름 (영문·숫자·-·_)
// 저장 위치: products/{folder}/images/... 또는 products/{folder}/model/...
//   (기존 테스트 상품과 같은 규칙: products/product-test-001/model/product.obj)
//
// (2026-11-14) 3D 옷은 OBJ + MTL(색) + 텍스처 이미지가 한 벌이다.
//   · model 칸에서도 png/jpg/webp 를 받아 같은 model/ 폴더에 둔다 — MTL 의 map_Kd 가
//     상대경로(같은 폴더)로 이미지를 찾기 때문.
//   · 파일 이름을 safeName 으로 바꾸므로, OBJ 안의 `mtllib` 과 MTL 안의 `map_*` 이 가리키는
//     이름도 같은 규칙으로 바꿔 적는다(안 그러면 "Shirt 01.mtl" → "Shirt-01.mtl" 로 저장돼 연결이 끊김).
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
    ext: ["obj", "mtl", "glb", "gltf", "png", "jpg", "jpeg", "webp"],
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

// 확장자만 바꾼 다른 파일(HTML·스크립트 등)이 올라가지 않게 앞부분 바이트로 확인
function looksLike(ext: string, head: Uint8Array): boolean {
  const at = (sig: number[], off = 0) => sig.every((b, i) => head[off + i] === b)
  switch (ext) {
    case "jpg":
    case "jpeg":
      return at([0xff, 0xd8, 0xff])
    case "png":
      return at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case "gif":
      return at([0x47, 0x49, 0x46, 0x38])
    case "webp":
      return at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)
    case "glb":
      return at([0x67, 0x6c, 0x54, 0x46]) // "glTF"
    case "obj":
    case "mtl":
    case "gltf": {
      // 텍스트 파일: NUL 바이트가 없고 HTML/스크립트 태그로 시작하지 않아야 함
      if (head.includes(0)) return false
      const text = new TextDecoder().decode(head).trimStart().toLowerCase()
      if (/^<(!doctype|html|script|svg|\?xml)/.test(text)) return false
      return ext !== "gltf" || text.startsWith("{")
    }
    default:
      return false
  }
}

// 경로 조각("textures\\Shirt 01.png", "C:/Users/.../a.png")에서 파일 이름만 꺼내 safeName 규칙으로
function refName(ref: string): string | null {
  const file = ref.trim().replace(/^["']|["']$/g, "").split(/[\\/]/).pop() ?? ""
  const dot = file.lastIndexOf(".")
  if (dot <= 0) return null
  return safeName(file, file.slice(dot + 1).toLowerCase())
}

// OBJ: `mtllib a.mtl b.mtl` / MTL: `map_Kd [-옵션 값…] 경로` — 경로 부분만 바꾼다.
// 블렌더가 내 컴퓨터 절대경로(C:\Users\…\shirt.png)를 적어 와도 파일 이름만 남는다.
function relinkText(ext: string, text: string): string {
  if (ext === "obj") {
    return text.replace(/^(mtllib[ \t]+)(.+?)[ \t]*$/gm, (_m, head: string, rest: string) => {
      // 블렌더는 "mtllib Shirt 01.mtl" 처럼 공백 있는 이름을 따옴표 없이 적는다 —
      // 토큰마다 .mtl 로 끝날 때만 여러 파일로 보고, 아니면 줄 전체를 한 이름으로 본다
      const toks = rest.trim().split(/\s+/)
      const list = toks.every((t) => /\.mtl$/i.test(t)) ? toks : [rest.trim()]
      return head + list.map((r) => refName(r) ?? r).join(" ")
    })
  }
  if (ext === "mtl") {
    return text.replace(/^([ \t]*(?:map_\w+|bump|disp|decal|refl|norm)[ \t]+)(.+?)[ \t]*$/gim, (_m, head: string, rest: string) => {
      // 옵션(-s 1 1 1, -bm 0.5 …) 뒤 마지막 토큰들이 경로 — 공백 있는 경로를 위해 마지막 "확장자 있는" 덩어리를 찾는다
      const mm = rest.match(/^((?:-\w+(?:[ \t]+-?[\d.]+)*[ \t]+)*)(.+)$/)
      const opts = mm ? mm[1] : ""
      const path = mm ? mm[2] : rest
      const name = refName(path)
      return head + opts + (name ?? path)
    })
  }
  return text
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
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err

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
  // (2026-11-01) 입점사는 자기 폴더에만 (남의 상품 파일 덮어쓰기 방지)
  if (!(await canUseFolder(g.session, g.db, folder))) return fail("이 폴더에 올릴 권한이 없습니다", 403)

  const rule = RULES[kind]
  const ext = (file.name.split(".").pop() ?? "").toLowerCase()
  if (!(rule.ext as readonly string[]).includes(ext)) {
    return fail(`허용 확장자: ${rule.ext.join(", ")}`)
  }
  if (file.size > rule.maxBytes) {
    return fail(`파일이 너무 큽니다 (최대 ${rule.maxBytes / 1024 / 1024}MB)`)
  }

  let data = await file.arrayBuffer()
  if (!looksLike(ext, new Uint8Array(data.slice(0, 512)))) {
    return fail("파일 내용이 확장자와 맞지 않습니다")
  }
  // (2026-11-14) OBJ·MTL 안의 파일 참조를 저장 이름 규칙에 맞춤 (mtllib·map_Kd 연결 유지)
  let refs: string[] = []
  if (kind === "model" && (ext === "obj" || ext === "mtl")) {
    const before = new TextDecoder().decode(data)
    const after = relinkText(ext, before)
    if (after !== before) data = new TextEncoder().encode(after).buffer as ArrayBuffer
    const re = ext === "obj" ? /^mtllib[ \t]+(.+?)[ \t]*$/gm : /^[ \t]*map_Kd[ \t]+(?:.*[ \t])?(\S+\.\w+)[ \t]*$/gim
    refs = [...after.matchAll(re)].flatMap((m) => m[1].trim().split(/\s+/))
  }

  const key = `products/${folder}/${rule.dir}/${safeName(file.name, ext)}`
  await bucket.put(key, data, {
    httpMetadata: { contentType: TYPES[ext] ?? "application/octet-stream" },
  })

  return NextResponse.json({
    success: true,
    key,
    url: assetUrl(key),
    size: file.size,
    name: key.split("/").pop(),
    refs, // OBJ 면 mtllib 이름들, MTL 이면 map_Kd 이미지 이름들 — 화면이 빠진 파일을 알려 줄 때 씀
  })
}
