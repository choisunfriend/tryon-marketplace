"use client"

import { useCallback, useEffect, useState } from "react"

// ============================================================================
// R2 동기화 — R2에는 파일이 있는데 DB(상품 목록)에는 없는 폴더를 찾아 등록
// ============================================================================
// 관리자 상품 등록은 "파일 업로드(R2)"와 "상품 저장(DB)" 두 단계라서,
// 저장 단계가 실패하면 파일만 R2에 남습니다. 이 화면이 그 폴더들을 모아
// 최소 정보(이름·성별·착용 부위·가격)만 넣고 한 번에 등록하게 해 줍니다.
// ============================================================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://tryon-marketplace.choisunfriend.workers.dev"

interface Folder {
  folder: string
  images: string[]
  models: string[]
  uploaded: string | null
}

interface Draft {
  name: string
  gender: "male" | "female" | "unisex"
  body_part: "upper_body" | "lower_body" | "outer"
  subcategory: string
  price: string
  currency: string
  model: string
  image: string
  state: "idle" | "saving" | "done" | "error"
  message: string
}

const SUBCATS = [
  "jacket", "coat", "blazer", "shirt", "tshirt", "hoodie",
  "sweater", "jeans", "shorts", "skirt", "dress",
]

function guessName(f: Folder): string {
  const file = (f.models[0] ?? f.images[0] ?? f.folder).split("/").pop() ?? f.folder
  return file
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\bcloth\b/i, "")
    .trim() || f.folder
}

function pickModel(models: string[]): string {
  // 앱(GYEOL)은 OBJ만 입히므로 OBJ를 먼저, 없으면 GLB/GLTF
  return (
    models.find((m) => /\.obj$/i.test(m)) ??
    models.find((m) => /\.(glb|gltf)$/i.test(m)) ??
    ""
  )
}

export default function AdminSyncPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [missing, setMissing] = useState<Folder[]>([])
  const [registered, setRegistered] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [r2Res, dbRes] = await Promise.all([
        fetch("/api/assets/list", { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/products`, { cache: "no-store" }),
      ])
      const r2 = await r2Res.json()
      const db = await dbRes.json()
      if (!r2.success) throw new Error(`R2 목록 실패: ${r2.error ?? r2Res.status}`)
      if (!db.success) throw new Error(`상품 목록 실패: ${db.error ?? dbRes.status}`)

      // DB 상품이 쓰는 R2 폴더 = model_file / model_path / 이미지 주소에 들어 있는 products/{folder}/
      const used = new Set<string>()
      const text = JSON.stringify(db.products ?? [])
      for (const m of text.matchAll(/products\/([A-Za-z0-9_-]+)\//g)) used.add(m[1])

      const folders: Folder[] = r2.folders ?? []
      const notInDb = folders.filter((f) => !used.has(f.folder))
      setRegistered(folders.length - notInDb.length)
      setMissing(notInDb)
      setDrafts((prev) => {
        const next: Record<string, Draft> = {}
        for (const f of notInDb) {
          next[f.folder] = prev[f.folder] ?? {
            name: guessName(f),
            gender: "male",
            body_part: "upper_body",
            subcategory: "shirt",
            price: "0",
            currency: "USD",
            model: pickModel(f.models),
            image: f.images[0] ?? "",
            state: "idle",
            message: "",
          }
        }
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function update(folder: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [folder]: { ...d[folder], ...patch } }))
  }

  async function register(folder: string): Promise<boolean> {
    const d = drafts[folder]
    if (!d) return false
    if (!d.name.trim()) {
      update(folder, { state: "error", message: "이름을 입력하세요" })
      return false
    }
    update(folder, { state: "saving", message: "" })
    const images = (missing.find((f) => f.folder === folder)?.images ?? []).map(
      (url) => ({ url, alt: d.name, type: url === d.image ? "main" : "detail" })
    )
    const payload = {
      name: d.name.trim(),
      brand: "",
      description: "",
      gender: d.gender,
      product_code: "",
      status: "active",
      category: "clothing",
      subcategory: d.subcategory,
      price: Number(d.price) || 0,
      currency: d.currency,
      details: {},
      media: { images, model_file: d.model },
      avatar: { gender: d.gender, body_part: d.body_part, size_compatibility: "" },
      image_url: d.image,
      model_path: d.model,
      featured: false,
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      let data: { success?: boolean; error?: string } = {}
      try {
        data = await res.json()
      } catch {
        /* 본문이 JSON이 아닐 때 */
      }
      if (!res.ok || data.success === false) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      update(folder, { state: "done", message: "등록됨" })
      return true
    } catch (e) {
      update(folder, {
        state: "error",
        message: `저장 실패: ${e instanceof Error ? e.message : String(e)}`,
      })
      return false
    }
  }

  async function registerAll() {
    for (const f of missing) {
      if (drafts[f.folder]?.state !== "done") await register(f.folder)
    }
  }

  const input = "w-full rounded-md border px-2 py-1 text-sm"

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-2 text-2xl font-semibold">R2 동기화</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        R2에 파일은 올라갔는데 상품 목록(DB)에 없는 폴더입니다. 정보를 확인하고
        등록하면 쇼핑몰과 GYEOL 앱에 바로 나옵니다.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={load}
          className="rounded-md border px-3 py-1.5 text-sm"
          disabled={loading}
        >
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
        {missing.length > 0 && (
          <button
            type="button"
            onClick={registerAll}
            className="rounded-md bg-black px-3 py-1.5 text-sm text-white"
          >
            전부 등록 ({missing.length})
          </button>
        )}
        {!loading && !error && (
          <span className="text-sm text-muted-foreground">
            이미 등록된 폴더 {registered}개 · 등록 안 된 폴더 {missing.length}개
          </span>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && missing.length === 0 && (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          R2의 모든 상품 폴더가 이미 등록돼 있습니다.
        </div>
      )}

      <div className="space-y-4">
        {missing.map((f) => {
          const d = drafts[f.folder]
          if (!d) return null
          const noObj = !/\.obj$/i.test(d.model)
          return (
            <div key={f.folder} className="flex gap-4 rounded-lg border p-4">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                {d.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    이미지 없음
                  </div>
                )}
              </div>

              <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">이름</label>
                  <input
                    className={input}
                    value={d.name}
                    onChange={(e) => update(f.folder, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">성별</label>
                  <select
                    className={input}
                    value={d.gender}
                    onChange={(e) => update(f.folder, { gender: e.target.value as Draft["gender"] })}
                  >
                    <option value="male">남자</option>
                    <option value="female">여자</option>
                    <option value="unisex">공용</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">착용 부위</label>
                  <select
                    className={input}
                    value={d.body_part}
                    onChange={(e) => update(f.folder, { body_part: e.target.value as Draft["body_part"] })}
                  >
                    <option value="upper_body">상의</option>
                    <option value="lower_body">하의</option>
                    <option value="outer">아우터</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">종류</label>
                  <select
                    className={input}
                    value={d.subcategory}
                    onChange={(e) => update(f.folder, { subcategory: e.target.value })}
                  >
                    {SUBCATS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">가격</label>
                  <input
                    className={input}
                    type="number"
                    value={d.price}
                    onChange={(e) => update(f.folder, { price: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">3D 파일</label>
                  <select
                    className={input}
                    value={d.model}
                    onChange={(e) => update(f.folder, { model: e.target.value })}
                  >
                    <option value="">(없음)</option>
                    {f.models.map((m) => (
                      <option key={m} value={m}>{m.split("/").pop()}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground md:col-span-4">
                  폴더 {f.folder} · 이미지 {f.images.length}장 · 3D {f.models.length}개
                  {d.model && noObj && (
                    <span className="ml-2 text-amber-600">
                      OBJ가 아니라 쇼핑몰에만 나오고 앱에서는 입혀지지 않습니다
                    </span>
                  )}
                  {!d.model && (
                    <span className="ml-2 text-amber-600">3D 파일이 없어 앱에서는 입혀지지 않습니다</span>
                  )}
                </div>
              </div>

              <div className="flex w-32 shrink-0 flex-col items-end justify-between">
                <button
                  type="button"
                  onClick={() => register(f.folder)}
                  disabled={d.state === "saving" || d.state === "done"}
                  className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-40"
                >
                  {d.state === "saving" ? "저장 중…" : d.state === "done" ? "등록됨" : "등록"}
                </button>
                {d.message && (
                  <p
                    className={`text-right text-xs ${
                      d.state === "error" ? "font-medium text-red-600" : "text-green-700"
                    }`}
                  >
                    {d.message}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
