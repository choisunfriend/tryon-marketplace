"use client"

import { useCallback, useEffect, useState } from "react"
import { BakePanel, assetUrl, type BakeManifest as Manifest } from "@/components/admin/bake-panel"

// ============================================================================
// 3D 굽기 — 상품 OBJ를 GYEOL 표준 몸에 맞춰 구워 R2에 저장
// ============================================================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://tryon-marketplace.choisunfriend.workers.dev"

interface ApiProduct {
  id: string
  name: string
  gender?: string
  model_path?: string
  media?: { model_file?: string; images?: { url: string }[] } | null
  avatar?: { gender?: string; body_part?: string } | null
}

interface Item {
  id: string
  name: string
  gender: string
  bodyPart: string
  source: string // R2 키
  folder: string
  image?: string
}

// (2026-11-14) D1 JSON 컬럼(media·avatar)은 문자열로 올 수도, 객체로 올 수도 있다
// (json-product-repository.ts 와 같은 처리). 예전엔 객체로만 읽어서, 문자열로 온 상품은
// 3D 파일·성별·옷 종류·썸네일을 못 읽었다.
function asObj<T>(v: unknown): T | null {
  if (v && typeof v === "object") return v as T
  if (typeof v === "string" && v.trim().startsWith("{")) {
    try {
      return JSON.parse(v) as T
    } catch {
      return null
    }
  }
  return null
}

function toItem(p0: ApiProduct): Item | null {
  const p = { ...p0, media: asObj<ApiProduct["media"]>(p0.media), avatar: asObj<ApiProduct["avatar"]>(p0.avatar) }
  const raw = String(p.media?.model_file || p.model_path || "")
  const m = raw.match(/products\/([A-Za-z0-9_-]+)\/.+/)
  if (!m) return null
  const source = m[0].split("?")[0]
  return {
    id: p.id,
    name: p.name,
    gender: String(p.avatar?.gender || p.gender || "unisex").toLowerCase(),
    bodyPart: String(p.avatar?.body_part || ""),
    source,
    folder: m[1],
    image: p.media?.images?.[0]?.url,
  }
}

export default function AdminBakePage() {
  const [items, setItems] = useState<Item[]>([])
  const [manifests, setManifests] = useState<Record<string, Manifest | null>>({})
  const [listError, setListError] = useState("")
  const [selId, setSelId] = useState<string>("")

  const sel = items.find((i) => i.id === selId) || null

  // 상품 목록 + 구운 상태
  const loadList = useCallback(async () => {
    setListError("")
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, { cache: "no-store" })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
      const list = (data.products as ApiProduct[]).map(toItem).filter(Boolean) as Item[]
      setItems(list)
      const pairs = await Promise.all(
        list.map(async (it) => {
          try {
            const r = await fetch(assetUrl(`products/${it.folder}/fitted.json`), { cache: "no-store" })
            return [it.id, r.ok ? ((await r.json()) as Manifest) : null] as const
          } catch {
            return [it.id, null] as const
          }
        })
      )
      setManifests(Object.fromEntries(pairs))
      const q = new URLSearchParams(window.location.search).get("product")
      if (q && list.some((i) => i.id === q)) setSelId((cur) => cur || q)
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-2 text-2xl font-semibold">3D 굽기</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        상품의 3D 옷을 GYEOL 표준 몸에 맞춰 미리 구워 둡니다. 구운 옷은 앱에서 바로 입혀지고,
        굽지 않은 옷은 앱이 매번 자동으로 맞춥니다(정확도가 떨어질 수 있음). 저장할 때 옷을 몸에 묶은
        기록도 함께 남겨서, 나중에 손님 체형에 맞춰 옷이 따라가게 합니다.
      </p>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* 상품 목록 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">상품</span>
            <button type="button" onClick={loadList} className="text-xs underline">
              새로고침
            </button>
          </div>
          {listError && <p className="text-sm text-red-600">{listError}</p>}
          {items.map((it) => {
            const m = manifests[it.id]
            const done = m && m.source === it.source && (m.male || m.female)
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => setSelId(it.id)}
                className={`flex w-full items-center gap-3 rounded-md border p-2 text-left text-sm ${
                  selId === it.id ? "border-black bg-neutral-50" : ""
                }`}
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-neutral-100">
                  {it.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {it.source.split("/").pop()}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                    done ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {done ? `구움 ${[m!.male && "남", m!.female && "여"].filter(Boolean).join("·")}` : "안 구움"}
                </span>
              </button>
            )
          })}
        </div>

        {/* 굽기 */}
        <div>
          {!sel ? (
            <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
              왼쪽에서 상품을 고르세요.
            </div>
          ) : (
            <BakePanel
              key={sel.id}
              title={sel.name}
              folder={sel.folder}
              source={sel.source}
              gender={sel.gender}
              bodyPart={sel.bodyPart}
              onSaved={(m) => setManifests((ms) => ({ ...ms, [sel.id]: m }))}
            />
          )}
        </div>
      </div>
    </div>
  )
}
