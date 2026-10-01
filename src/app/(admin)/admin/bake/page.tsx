"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import {
  BODY_FILES,
  DEFAULT_CLEARANCE,
  bakeGarment,
  buildBody,
  parseObj,
  serializeBinding,
  type BakeResult,
  type BodyFigure,
  type BodyGender,
  type GarmentKind,
  type ParsedObj,
} from "@/lib/garment-bake"

const BakePreview = dynamic(
  () => import("@/components/admin/bake-preview").then((m) => m.BakePreview),
  { ssr: false, loading: () => <div className="h-[520px] rounded-lg bg-neutral-100" /> }
)

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

interface Manifest {
  source?: string
  male?: string
  female?: string
  bakedAt?: string
}

const KIND_LABEL: Record<GarmentKind, string> = {
  auto: "자동",
  upper: "상의",
  outer: "아우터",
  lower: "하의",
  full: "전신(목~발목)",
}

const assetUrl = (key: string) =>
  "/api/assets/" + key.split("/").map(encodeURIComponent).join("/")

function toItem(p: ApiProduct): Item | null {
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

function defaultTargets(gender: string): BodyGender[] {
  if (/^(female|woman|women)$/.test(gender)) return ["female"]
  if (/^(male|man|men)$/.test(gender)) return ["male"]
  return ["male", "female"]
}

function defaultKind(bodyPart: string): GarmentKind {
  if (bodyPart === "lower_body") return "lower"
  return "auto"
}

const bodyCache = new Map<BodyGender, Promise<BodyFigure>>()
function loadBody(g: BodyGender): Promise<BodyFigure> {
  if (!bodyCache.has(g)) {
    bodyCache.set(
      g,
      fetch(BODY_FILES[g].url)
        .then((r) => {
          if (!r.ok) throw new Error(`몸 파일을 못 받았습니다 (${r.status})`)
          return r.text()
        })
        .then((t) => buildBody(g, t))
    )
  }
  return bodyCache.get(g)!
}

const nextFrame = () => new Promise((r) => setTimeout(r, 30))

export default function AdminBakePage() {
  const [items, setItems] = useState<Item[]>([])
  const [manifests, setManifests] = useState<Record<string, Manifest | null>>({})
  const [listError, setListError] = useState("")
  const [selId, setSelId] = useState<string>("")

  const [garment, setGarment] = useState<ParsedObj | null>(null)
  const [loadMsg, setLoadMsg] = useState("")
  const [targets, setTargets] = useState<BodyGender[]>(["male"])
  const [kind, setKind] = useState<GarmentKind>("auto")
  const [scaleMul, setScaleMul] = useState(1)
  const [yShift, setYShift] = useState(0)
  const [clearance, setClearance] = useState<number | null>(null)

  const [baking, setBaking] = useState(false)
  const [results, setResults] = useState<Partial<Record<BodyGender, BakeResult>>>({})
  const [bodies, setBodies] = useState<Partial<Record<BodyGender, BodyFigure>>>({})
  const [view, setView] = useState<BodyGender>("male")
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

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

  // 상품 고르면 원본 받기 + 기본값
  useEffect(() => {
    if (!sel) return
    let cancelled = false
    setGarment(null)
    setResults({})
    setSaveMsg(null)
    const t = defaultTargets(sel.gender)
    setTargets(t)
    setView(t[0])
    setKind(defaultKind(sel.bodyPart))
    setScaleMul(1)
    setYShift(0)
    setClearance(null)
    if (!/\.obj$/i.test(sel.source)) {
      setLoadMsg("OBJ 파일만 구울 수 있습니다 (GLB/GLTF는 앱에서도 아직 못 입힙니다)")
      return
    }
    setLoadMsg("원본 3D 파일 받는 중…")
    fetch(assetUrl(sel.source))
      .then((r) => {
        if (!r.ok) throw new Error(`원본 파일이 R2에 없습니다 (${r.status})`)
        return r.text()
      })
      .then((txt) => {
        if (cancelled) return
        const g = parseObj(txt)
        if (!g.pos.length) throw new Error("OBJ에 정점이 없습니다")
        setGarment(g)
        setLoadMsg(`원본 ${(g.pos.length / 3).toLocaleString()}정점 · 면 ${g.faces.length.toLocaleString()}개`)
      })
      .catch((e) => !cancelled && setLoadMsg(e instanceof Error ? e.message : String(e)))
    // 몸도 미리 받아 둠
    for (const g of t) loadBody(g).then((b) => !cancelled && setBodies((s) => ({ ...s, [g]: b })))
    return () => {
      cancelled = true
    }
  }, [sel])

  const effClearance = clearance ?? DEFAULT_CLEARANCE[kind === "auto" ? "upper" : kind]

  async function bake() {
    if (!garment || !targets.length) return
    setBaking(true)
    setSaveMsg(null)
    const out: Partial<Record<BodyGender, BakeResult>> = {}
    try {
      for (const g of targets) {
        setLoadMsg(`${g === "male" ? "남자" : "여자"} 몸에 굽는 중…`)
        await nextFrame()
        const body = await loadBody(g)
        setBodies((s) => ({ ...s, [g]: body }))
        const t0 = performance.now()
        const r = bakeGarment(garment, body, { kind, scaleMul, yShift, clearance: effClearance })
        out[g] = r
        setResults({ ...out })
        console.log(`[3D 굽기] ${g} ${Math.round(performance.now() - t0)}ms`, r.place, r.conform)
      }
      setView(targets[0])
      setLoadMsg("굽기 완료 — 미리보기를 확인하고 저장하세요")
    } catch (e) {
      setLoadMsg(`굽기 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBaking(false)
    }
  }

  async function save() {
    if (!sel) return
    const genders = (Object.keys(results) as BodyGender[]).filter((g) => results[g])
    if (!genders.length) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch("/api/bake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: sel.folder,
          source: sel.source,
          results: Object.fromEntries(genders.map((g) => [g, results[g]!.text])),
          binds: Object.fromEntries(genders.map((g) => [g, serializeBinding(results[g]!.binding)])),
          params: Object.fromEntries(
            genders.map((g) => [g, { kind: results[g]!.place.kind, scaleMul, yShift, clearance: effClearance }])
          ),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
      setManifests((m) => ({ ...m, [sel.id]: data.manifest }))
      setSaveMsg({ ok: true, text: "저장했습니다. GYEOL 앱에서 이 옷은 이제 구운 파일로 입혀집니다." })
    } catch (e) {
      setSaveMsg({ ok: false, text: `저장 실패: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setSaving(false)
    }
  }

  const bodyMesh = useMemo(() => {
    const b = bodies[view]
    return b ? { pos: b.obj.pos, faces: b.obj.faces } : null
  }, [bodies, view])
  const garMesh = useMemo(() => {
    const r = results[view]
    return r && garment ? { pos: r.pos, faces: garment.faces } : null
  }, [results, view, garment])

  const r = results[view]
  const slider = "w-full accent-black"

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
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-lg font-semibold">{sel.name}</h2>
                <span className="text-xs text-muted-foreground">{loadMsg}</span>
              </div>

              <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">구울 몸</label>
                  <div className="mt-1 flex gap-4 text-sm">
                    {(["male", "female"] as BodyGender[]).map((g) => (
                      <label key={g} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={targets.includes(g)}
                          onChange={(e) =>
                            setTargets((t) => (e.target.checked ? [...t, g] : t.filter((x) => x !== g)))
                          }
                        />
                        {g === "male" ? "남자" : "여자"}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">옷 종류</label>
                  <select
                    className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as GarmentKind)}
                  >
                    {(Object.keys(KIND_LABEL) as GarmentKind[]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    크기 ×{scaleMul.toFixed(2)}
                  </label>
                  <input className={slider} type="range" min={0.6} max={1.5} step={0.01}
                    value={scaleMul} onChange={(e) => setScaleMul(+e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    높이 {yShift >= 0 ? "+" : ""}{(yShift * 100).toFixed(0)}% (몸 키 대비)
                  </label>
                  <input className={slider} type="range" min={-0.15} max={0.15} step={0.005}
                    value={yShift} onChange={(e) => setYShift(+e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">
                    몸과의 여유 {effClearance.toFixed(3)} {clearance === null && "(종류 기본값)"}
                  </label>
                  <input className={slider} type="range" min={0} max={0.25} step={0.005}
                    value={effClearance} onChange={(e) => setClearance(+e.target.value)} />
                </div>
                <div className="flex items-center gap-3 md:col-span-2">
                  <button
                    type="button"
                    onClick={bake}
                    disabled={!garment || baking || !targets.length}
                    className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
                  >
                    {baking ? "굽는 중…" : Object.keys(results).length ? "다시 굽기" : "굽기"}
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!Object.keys(results).length || baking || saving}
                    className="rounded-md border px-4 py-2 text-sm disabled:opacity-40"
                  >
                    {saving ? "저장 중…" : "저장"}
                  </button>
                  {saveMsg && (
                    <span className={`text-sm ${saveMsg.ok ? "text-green-700" : "font-medium text-red-600"}`}>
                      {saveMsg.text}
                    </span>
                  )}
                </div>
              </div>

              {Object.keys(results).length > 0 && (
                <div className="flex gap-2">
                  {(Object.keys(results) as BodyGender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setView(g)}
                      className={`rounded-md px-3 py-1 text-sm ${view === g ? "bg-black text-white" : "border"}`}
                    >
                      {g === "male" ? "남자 몸" : "여자 몸"}
                    </button>
                  ))}
                </div>
              )}

              <BakePreview body={bodyMesh} garment={garMesh} />

              {r && (
                <p className="text-xs text-muted-foreground">
                  {r.place.kind === "asis" ? "이미 몸에 맞춰진 옷 — 위치·크기 그대로" : `${KIND_LABEL[r.place.kind]}로 맞춤`} · 배율 {r.place.scale.toFixed(3)}
                  {r.place.rotatedZUp && " · Z-위 파일을 세움"}
                  {r.place.note && ` · ${r.place.note}`} · 몸을 뚫은 정점{" "}
                  {r.conform.insideBefore.toLocaleString()} → {r.conform.insideAfter.toLocaleString()}개
                  (가장 깊이 {r.conform.worstBefore.toFixed(2)} → {r.conform.worstAfter.toFixed(3)}) · 몸 묶음 기록{" "}
                  {r.binding.count.toLocaleString()}정점 (되풀이 오차 {r.bindError < 1e-4 ? "없음" : r.bindError.toFixed(4)})
                </p>
              )}
              <p className="text-xs text-muted-foreground">드래그로 돌리고, 휠로 확대합니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
