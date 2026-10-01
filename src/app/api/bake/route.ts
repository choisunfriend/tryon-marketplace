import { NextResponse } from "next/server"
import { getAssetsBucket } from "@/lib/assets-bucket"

// ============================================================================
// 3D 굽기 저장 — POST /api/bake
// ============================================================================
// 관리자 화면(브라우저)에서 구운 OBJ를 받아 R2에 저장하고,
// 상품 폴더에 fitted.json(몸별 구운 파일 목록)을 남깁니다.
// GYEOL 앱은 fitted.json 이 있으면 구운 파일을, 없으면 원본을 자동 맞춤해서 씁니다.
//
//   products/{folder}/model/{원본이름}.{male|female}.fitted.{시각}.obj
//   products/{folder}/model/{원본이름}.{male|female}.bind.{시각}.json   ← 몸 묶음 기록
//   products/{folder}/fitted.json
//     { source, male?, female?, bind: { male?, female? }, params, bakedAt }
// bind 는 옷 정점을 표준 몸 삼각형에 묶은 기록(gyeol-bind-v1) — 손님 체형 몸에서
// 다시 풀면 옷이 따라간다. 지금 앱은 아직 안 쓰고, 체형 기능에서 쓴다.
// ============================================================================

const MAX_BYTES = 40 * 1024 * 1024

interface BakeBody {
  folder?: string
  source?: string
  results?: { male?: string; female?: string }
  binds?: { male?: string; female?: string }
  params?: Record<string, unknown>
}

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function POST(request: Request) {
  const bucket = await getAssetsBucket()
  if (!bucket) return fail("R2 바인딩(ASSETS_BUCKET)이 없습니다", 500)

  let body: BakeBody
  try {
    body = await request.json()
  } catch {
    return fail("JSON 형식이 아닙니다")
  }

  const folder = String(body.folder ?? "")
  const source = String(body.source ?? "")
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(folder)) return fail("folder 이름이 올바르지 않습니다")
  if (!source.startsWith(`products/${folder}/`) || source.includes("..")) {
    return fail("source 는 같은 상품 폴더의 파일이어야 합니다")
  }
  const results = body.results ?? {}
  const genders = (["male", "female"] as const).filter((g) => typeof results[g] === "string")
  if (!genders.length) return fail("구운 결과가 없습니다")

  // 이전 manifest 를 이어받아 한쪽 몸만 다시 구워도 다른 쪽은 유지
  const manifestKey = `products/${folder}/fitted.json`
  let manifest: Record<string, unknown> = {}
  const prev = await bucket.get(manifestKey)
  if (prev) {
    try {
      manifest = JSON.parse(await new Response(prev.body).text())
    } catch {
      manifest = {}
    }
    if (manifest.source !== source) manifest = {} // 원본이 바뀌었으면 새로 시작
  }

  const base = (source.split("/").pop() ?? "garment")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .slice(0, 60)
  const stamp = Date.now().toString(36)
  const saved: Record<string, string> = {}

  for (const g of genders) {
    const text = results[g] as string
    if (text.length > MAX_BYTES) return fail(`${g} 결과가 너무 큽니다`)
    if (!/^v\s/m.test(text)) return fail(`${g} 결과가 OBJ가 아닙니다`)
    const key = `products/${folder}/model/${base}.${g}.fitted.${stamp}.obj`
    await bucket.put(key, new TextEncoder().encode(text).buffer as ArrayBuffer, {
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
    })
    saved[g] = key
  }

  const savedBind: Record<string, string> = {}
  for (const g of genders) {
    const b = body.binds?.[g]
    if (typeof b !== "string") continue
    if (b.length > MAX_BYTES) return fail(`${g} 바인딩이 너무 큽니다`)
    try {
      if (JSON.parse(b).format !== "gyeol-bind-v1") throw new Error()
    } catch {
      return fail(`${g} 바인딩 형식이 올바르지 않습니다`)
    }
    const key = `products/${folder}/model/${base}.${g}.bind.${stamp}.json`
    await bucket.put(key, new TextEncoder().encode(b).buffer as ArrayBuffer, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    })
    savedBind[g] = key
  }

  manifest = {
    ...manifest,
    ...saved,
    // 한쪽 몸만 다시 구웠으면 그 몸의 바인딩만 바꾸고, 바인딩 없이 구웠으면 옛 기록은 버림
    bind: {
      ...Object.fromEntries(
        Object.entries((manifest.bind as Record<string, string>) ?? {}).filter(([g]) => !genders.includes(g as "male" | "female"))
      ),
      ...savedBind,
    },
    source,
    params: { ...((manifest.params as object) ?? {}), ...Object.fromEntries(genders.map((g) => [g, body.params?.[g] ?? body.params ?? {}])) },
    bakedAt: new Date().toISOString(),
  }
  await bucket.put(manifestKey, new TextEncoder().encode(JSON.stringify(manifest, null, 2)).buffer as ArrayBuffer, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  })

  return NextResponse.json({ success: true, manifest })
}
