"use client"

import { useEffect, useMemo, useState } from "react"
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
// (2026-11-14) 3D 굽기 패널 — 「3D 굽기」 메뉴 화면과 상품 등록 화면이 같이 쓴다
// ============================================================================
// folder·source(R2 키)만 있으면 되므로, 아직 저장 안 한 새 상품도 OBJ만 올렸으면 구울 수 있다.
// ============================================================================

export const KIND_LABEL: Record<GarmentKind, string> = {
  auto: "자동",
  upper: "상의",
  outer: "아우터",
  lower: "하의",
  full: "전신(목~발목)",
}

export const assetUrl = (key: string) => "/api/assets/" + key.split("/").map(encodeURIComponent).join("/")

export interface BakeManifest {
  source?: string
  male?: string
  female?: string
  bakedAt?: string
}

export function defaultTargets(gender: string): BodyGender[] {
  const g = gender.toLowerCase()
  if (/^(female|woman|women)$/.test(g)) return ["female"]
  if (/^(male|man|men)$/.test(g)) return ["male"]
  return ["male", "female"]
}

export function defaultKind(bodyPart: string): GarmentKind {
  if (bodyPart === "lower_body") return "lower"
  if (bodyPart === "outer") return "outer"
  if (bodyPart === "full_body") return "full"
  if (bodyPart === "upper_body") return "upper"
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
    bodyCache.get(g)!.catch(() => bodyCache.delete(g))
  }
  return bodyCache.get(g)!
}

const nextFrame = () => new Promise((r) => setTimeout(r, 30))

export function BakePanel({
  folder,
  source,
  gender,
  bodyPart,
  title,
  onSaved,
}: {
  folder: string
  source: string // R2 키 (products/{folder}/model/xxx.obj)
  gender: string
  bodyPart: string
  title?: string
  onSaved?: (manifest: BakeManifest) => void
}) {
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

  // 원본 받기 + 기본값 (원본·성별·옷 종류가 바뀌면 다시)
  useEffect(() => {
    let cancelled = false
    setGarment(null)
    setResults({})
    setSaveMsg(null)
    const t = defaultTargets(gender)
    setTargets(t)
    setView(t[0])
    setKind(defaultKind(bodyPart))
    setScaleMul(1)
    setYShift(0)
    setClearance(null)
    if (!/\.obj$/i.test(source)) {
      setLoadMsg("OBJ 파일만 구울 수 있습니다 (GLB/GLTF는 앱에서도 아직 못 입힙니다)")
      return
    }
    setLoadMsg("원본 3D 파일 받는 중…")
    fetch(assetUrl(source), { cache: "no-store" })
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
    for (const g of t) loadBody(g).then((b) => !cancelled && setBodies((s) => ({ ...s, [g]: b }))).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [source, gender, bodyPart])

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
        out[g] = bakeGarment(garment, body, { kind, scaleMul, yShift, clearance: effClearance })
        setResults({ ...out })
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
    const genders = (Object.keys(results) as BodyGender[]).filter((g) => results[g])
    if (!genders.length) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch("/api/bake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder,
          source,
          results: Object.fromEntries(genders.map((g) => [g, results[g]!.text])),
          binds: Object.fromEntries(genders.map((g) => [g, serializeBinding(results[g]!.binding)])),
          params: Object.fromEntries(
            genders.map((g) => [g, { kind: results[g]!.place.kind, scaleMul, yShift, clearance: effClearance }])
          ),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
      onSaved?.(data.manifest)
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
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
                  onChange={(e) => setTargets((t) => (e.target.checked ? [...t, g] : t.filter((x) => x !== g)))}
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
          <label className="text-xs text-muted-foreground">크기 ×{scaleMul.toFixed(2)}</label>
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
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
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
            <span className={`text-sm ${saveMsg.ok ? "text-green-700" : "font-medium text-red-600"}`}>{saveMsg.text}</span>
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
          {r.place.kind === "asis" ? "이미 몸에 맞춰진 옷 — 위치·크기 그대로" : `${KIND_LABEL[r.place.kind as GarmentKind] ?? r.place.kind}로 맞춤`} · 배율 {r.place.scale.toFixed(3)}
          {r.place.rotatedZUp && " · Z-위 파일을 세움"}
          {r.place.note && ` · ${r.place.note}`} · 몸을 뚫은 정점{" "}
          {r.conform.insideBefore.toLocaleString()} → {r.conform.insideAfter.toLocaleString()}개
          (가장 깊이 {r.conform.worstBefore.toFixed(2)} → {r.conform.worstAfter.toFixed(3)}) · 몸 묶음 기록{" "}
          {r.binding.count.toLocaleString()}정점 (되풀이 오차 {r.bindError < 1e-4 ? "없음" : r.bindError.toFixed(4)})
        </p>
      )}
      <p className="text-xs text-muted-foreground">드래그로 돌리고, 휠로 확대합니다.</p>
    </div>
  )
}
