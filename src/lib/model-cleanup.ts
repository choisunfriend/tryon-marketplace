import type { AssetsBucket } from "@/lib/assets-bucket"

// ============================================================================
// (2026-11-14) 3D 폴더 정리 — 상품이 지금 쓰는 파일만 남기고 지운다
// ============================================================================
// 정리 대상은 products/{folder}/model/ 안의 파일뿐(대표·상세 이미지는 건드리지 않음).
// 남기는 것:
//   · 상품의 model_file (OBJ/GLB)
//   · 그 OBJ 의 mtllib 가 가리키는 .mtl
//   · 그 .mtl 의 map_* 가 가리키는 텍스처 이미지
//   · fitted.json 이 가리키는 구운 파일·묶음 기록 (fitted.json 의 source 가 지금 model_file 일 때만)
// fitted.json 이 예전 OBJ 로 구운 기록이면 그 구운 파일들과 fitted.json 도 지운다(앱에서 안 쓰이므로).
// 안전장치: model_file 이 이 폴더에 없거나 R2 에서 못 읽으면 아무것도 지우지 않는다.
// 업로드 때 safeName 으로 이름을 바꾸고 mtllib·map_* 도 같은 이름으로 고쳐 적으므로 파일 이름으로 비교한다.
// ============================================================================

type Bucket = AssetsBucket & { delete?: (keys: string | string[]) => Promise<unknown> }

const MODEL_KEY_RE = /^products\/([A-Za-z0-9_-]{1,80})\/model\/[^/]+$/

async function readText(bucket: Bucket, key: string): Promise<string | null> {
  const o = await bucket.get(key)
  return o ? await new Response(o.body).text() : null
}

const fileOf = (p: string) => p.trim().replace(/^["']|["']$/g, "").split(/[\\/]/).pop()?.toLowerCase() ?? ""

function mtlRefs(objText: string): string[] {
  const out: string[] = []
  for (const m of objText.matchAll(/^mtllib[ \t]+(.+?)[ \t]*$/gm)) {
    const toks = m[1].trim().split(/\s+/)
    for (const t of toks.every((x) => /\.mtl$/i.test(x)) ? toks : [m[1].trim()]) out.push(fileOf(t))
  }
  return out
}

function textureRefs(mtlText: string): string[] {
  const out: string[] = []
  for (const m of mtlText.matchAll(/^[ \t]*(?:map_\w+|bump|disp|decal|refl|norm)[ \t]+(.+?)[ \t]*$/gim)) {
    const mm = m[1].match(/^((?:-\w+(?:[ \t]+-?[\d.]+)*[ \t]+)*)(.+)$/)
    out.push(fileOf(mm ? mm[2] : m[1]))
  }
  return out
}

async function listAll(bucket: Bucket, prefix: string): Promise<string[]> {
  const keys: string[] = []
  let cursor: string | undefined
  do {
    const res = await bucket.list({ prefix, cursor, limit: 1000 })
    keys.push(...res.objects.map((o) => o.key))
    cursor = res.truncated ? res.cursor : undefined
  } while (cursor)
  return keys
}

async function remove(bucket: Bucket, keys: string[]) {
  if (!keys.length || !bucket.delete) return
  for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000))
}

/** 상품 저장 뒤 호출 — 지운 파일 키 목록을 돌려준다 */
export async function cleanupModelFolder(bucket: Bucket, modelFile: string): Promise<string[]> {
  const modelKey = String(modelFile || "").split("?")[0].replace(/^.*?(products\/)/, "$1")
  const m = modelKey.match(MODEL_KEY_RE)
  if (!m || !bucket.delete) return []
  const folder = m[1]
  const dir = `products/${folder}/model/`

  const keys = await listAll(bucket, dir)
  if (!keys.includes(modelKey)) return [] // 상품이 가리키는 파일이 없으면 손대지 않음

  const keep = new Set<string>([modelKey])
  const byName = new Map(keys.map((k) => [k.slice(dir.length).toLowerCase(), k]))

  if (/\.obj$/i.test(modelKey)) {
    const objText = await readText(bucket, modelKey)
    if (objText === null) return []
    for (const name of mtlRefs(objText)) {
      const mk = byName.get(name)
      if (!mk) continue
      keep.add(mk)
      const mtlText = await readText(bucket, mk)
      for (const t of mtlText ? textureRefs(mtlText) : []) {
        const tk = byName.get(t)
        if (tk) keep.add(tk)
      }
    }
  }

  // 구운 파일 — 지금 OBJ 로 구운 기록일 때만 남김
  const manifestKey = `products/${folder}/fitted.json`
  const mText = await readText(bucket, manifestKey)
  let staleManifest = false
  if (mText) {
    try {
      const man = JSON.parse(mText) as { source?: string; male?: string; female?: string; bind?: Record<string, string> }
      if (man.source === modelKey) {
        for (const k of [man.male, man.female, ...Object.values(man.bind ?? {})]) if (k) keep.add(k)
      } else {
        staleManifest = true
      }
    } catch {
      /* 못 읽는 기록은 그대로 둠 */
    }
  }

  const drop = keys.filter((k) => !keep.has(k))
  await remove(bucket, drop)
  if (staleManifest) {
    await remove(bucket, [manifestKey])
    drop.push(manifestKey)
  }
  return drop
}

/** 굽기 저장 뒤 호출 — 이번에 바꾼 몸의 예전 구운 파일·묶음 기록을 지운다 */
export async function removeOldBakes(bucket: Bucket, oldKeys: (string | undefined)[], folder: string) {
  const dir = `products/${folder}/model/`
  await remove(bucket, oldKeys.filter((k): k is string => !!k && k.startsWith(dir) && /\.(fitted\.[a-z0-9]+\.obj|bind\.[a-z0-9]+\.json)$/.test(k)))
}
