"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useL } from "@/i18n/client"
import { bi } from "@/i18n/l"
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

export const KIND_LABEL: Record<GarmentKind, { ko: string; en: string }> = {
  auto: { ko: "자동", en: "Auto" },
  upper: { ko: "상의", en: "Top" },
  outer: { ko: "아우터", en: "Outerwear" },
  lower: { ko: "하의", en: "Bottoms" },
  full: { ko: "전신(목~발목)", en: "Full body (neck to ankle)" },
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
          if (!r.ok) throw new Error(bi(`몸 파일을 못 받았습니다 (${r.status})`, `Couldn't load the body file (${r.status})`))
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
  const { L, loc, lang } = useL()
  const kindLabel = (k: string) => (KIND_LABEL[k as GarmentKind] ? L(KIND_LABEL[k as GarmentKind].ko, KIND_LABEL[k as GarmentKind].en) : k)
  const bodyName = (g: BodyGender) => (g === "male" ? L("남자", "Man") : L("여자", "Woman"))
  const [garment, setGarment] = useState<ParsedObj | null>(null)
  const [loadMsg, setLoadMsg] = useState("")
  const [targets, setTargets] = useState<BodyGender[]>(["male"])
  const [kind, setKind] = useState<GarmentKind>("auto")
  const [scaleMul, setScaleMul] = useState(1)
  const [yShift, setYShift] = useState(0)
  const [clearance, setClearance] = useState<number | null>(null)
  const [keepAsIs, setKeepAsIs] = useState(true)

  const [baking, setBaking] = useState(false)
  const [results, setResults] = useState<Partial<Record<BodyGender, BakeResult>>>({})
  const [bodies, setBodies] = useState<Partial<Record<BodyGender, BodyFigure>>>({})
  const [view, setView] = useState<BodyGender>("male")
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<BakeManifest | null>(null)

  // 지금 R2 에 저장된 굽기 기록 — 언제 무엇으로 구웠는지 패널에 보여 준다
  useEffect(() => {
    let cancelled = false
    fetch(assetUrl(`products/${folder}/fitted.json`), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => !cancelled && setSaved(m))
      .catch(() => !cancelled && setSaved(null))
    return () => {
      cancelled = true
    }
  }, [folder])

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
      setLoadMsg(L("OBJ 파일만 구울 수 있습니다 (GLB/GLTF는 앱에서도 아직 못 입힙니다)", "Only OBJ files can be baked (the app can't wear GLB/GLTF yet)"))
      return
    }
    setLoadMsg(L("원본 3D 파일 받는 중…", "Loading the original 3D file…"))
    fetch(assetUrl(source), { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(L(`원본 파일이 R2에 없습니다 (${r.status})`, `The original file isn't in R2 (${r.status})`))
        return r.text()
      })
      .then((txt) => {
        if (cancelled) return
        const g = parseObj(txt)
        if (!g.pos.length) throw new Error(L("OBJ에 정점이 없습니다", "The OBJ has no vertices"))
        setGarment(g)
        setLoadMsg(L(`원본 ${(g.pos.length / 3).toLocaleString()}정점 · 면 ${g.faces.length.toLocaleString()}개`, `Original: ${(g.pos.length / 3).toLocaleString()} vertices · ${g.faces.length.toLocaleString()} faces`))
      })
      .catch((e) => !cancelled && setLoadMsg(e instanceof Error ? loc(e.message) : String(e)))
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
        setLoadMsg(L(`${bodyName(g)} 몸에 굽는 중…`, `Baking on the ${bodyName(g)} body…`))
        await nextFrame()
        const body = await loadBody(g)
        setBodies((s) => ({ ...s, [g]: body }))
        out[g] = bakeGarment(garment, body, { kind, scaleMul, yShift, clearance: effClearance, keepAsIs })
        setResults({ ...out })
      }
      setView(targets[0])
      setLoadMsg(L("굽기 완료 — 저장 중…", "Baked — saving…"))
      await save(out)
    } catch (e) {
      setLoadMsg(L("굽기 실패: ", "Bake failed: ") + (e instanceof Error ? loc(e.message) : String(e)))
    } finally {
      setBaking(false)
    }
  }

  async function save(res0: Partial<Record<BodyGender, BakeResult>> = results) {
    const results = res0
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
            genders.map((g) => [g, { kind: results[g]!.place.kind, scaleMul, yShift, clearance: effClearance, keepAsIs }])
          ),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
      onSaved?.(data.manifest)
      setSaved(data.manifest)
      setLoadMsg(L("굽기 완료", "Baked"))
      setSaveMsg({ ok: true, text: L("구워서 저장했습니다. GYEOL 앱에서 이 옷은 이제 이 파일로 입혀집니다.", "Baked and saved. The GYEOL app now dresses this item with this file.") })
    } catch (e) {
      setLoadMsg(L("굽기는 됐지만 저장 실패 — 아래 빨간 글씨를 확인하세요", "Baked, but saving failed — see the red message below"))
      setSaveMsg({ ok: false, text: L("저장 실패: ", "Save failed: ") + (e instanceof Error ? loc(e.message) : String(e)) })
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
          <label className="text-xs text-muted-foreground">{L("구울 몸", "Bodies to bake")}</label>
          <div className="mt-1 flex gap-4 text-sm">
            {(["male", "female"] as BodyGender[]).map((g) => (
              <label key={g} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={targets.includes(g)}
                  onChange={(e) => setTargets((t) => (e.target.checked ? [...t, g] : t.filter((x) => x !== g)))}
                />
                {bodyName(g)}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{L("옷 종류", "Garment type")}</label>
          <select
            className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as GarmentKind)}
          >
            {(Object.keys(KIND_LABEL) as GarmentKind[]).map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{L("크기", "Size")} ×{scaleMul.toFixed(2)}</label>
          <input className={slider} type="range" min={0.6} max={1.5} step={0.01}
            value={scaleMul} onChange={(e) => setScaleMul(+e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            {L("높이", "Height")} {yShift >= 0 ? "+" : ""}{(yShift * 100).toFixed(0)}% {L("(몸 키 대비)", "(of body height)")}
          </label>
          <input className={slider} type="range" min={-0.15} max={0.15} step={0.005}
            value={yShift} onChange={(e) => setYShift(+e.target.value)} />
        </div>
        <label className="flex items-start gap-2 text-sm md:col-span-2">
          <input type="checkbox" className="mt-1" checked={keepAsIs} onChange={(e) => setKeepAsIs(e.target.checked)} />
          <span>
            {L("블렌더에서 GYEOL 몸에 맞춰 만든 옷이면 원본 크기 그대로 두기", "Keep the original size if the garment was made on the GYEOL body in Blender")}
            <span className="block text-xs text-muted-foreground">
              {L(
                "끄면 어깨폭(하의는 허리폭) 기준으로 크기를 자동으로 다시 맞춥니다. 원본이 몸과 다른 위치·크기면 켜 둬도 자동 맞춤합니다.",
                "When off, the size is refit by shoulder width (waist width for bottoms). If the original isn't positioned on the body, it's refit even when on."
              )}
            </span>
          </span>
        </label>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">
            {L("몸과의 여유", "Clearance from body")} {effClearance.toFixed(3)} {clearance === null && L("(종류 기본값)", "(type default)")}
          </label>
          <input className={slider} type="range" min={0} max={0.25} step={0.005}
            value={effClearance} onChange={(e) => setClearance(+e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <button
            type="button"
            onClick={bake}
            disabled={!garment || baking || saving || !targets.length}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {baking ? L("굽는 중…", "Baking…") : saving ? L("저장 중…", "Saving…") : Object.keys(results).length ? L("다시 굽고 저장", "Re-bake and save") : L("굽고 저장", "Bake and save")}
          </button>
          {saveMsg && (
            <span className={`text-sm ${saveMsg.ok ? "text-green-700" : "rounded bg-red-50 px-2 py-1 font-medium text-red-600"}`}>{saveMsg.text}</span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {L("지금 저장된 굽기", "Saved bake")}:{" "}
        {saved && (saved.male || saved.female) ? (
          <>
            {[saved.male && L("남", "M"), saved.female && L("여", "F")].filter(Boolean).join("·")} ·{" "}
            {saved.bakedAt ? new Date(saved.bakedAt).toLocaleString(lang === "ko" ? "ko-KR" : "en-US") : L("시간 모름", "unknown time")}
            {saved.source !== source && (
              <b className="text-amber-700">
                {" · "}
                {L("지금 OBJ와 다른 파일로 구운 기록이라 앱에서 안 쓰입니다 — 다시 구워 주세요", "Baked from a different OBJ, so the app won't use it — bake again")}
              </b>
            )}
          </>
        ) : (
          L("없음 (앱이 원본을 자동으로 맞춰 입힙니다)", "None (the app fits the original automatically)")
        )}
      </p>

      {Object.keys(results).length > 0 && (
        <div className="flex gap-2">
          {(Object.keys(results) as BodyGender[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setView(g)}
              className={`rounded-md px-3 py-1 text-sm ${view === g ? "bg-black text-white" : "border"}`}
            >
              {L(`${bodyName(g)} 몸`, `${bodyName(g)} body`)}
            </button>
          ))}
        </div>
      )}

      <BakePreview body={bodyMesh} garment={garMesh} />

      {r && (
        <p className="text-xs text-muted-foreground">
          {r.place.kind === "asis"
            ? L("이미 몸에 맞춰진 옷 — 원본 크기 기준", "Already fitted to the body — original size")
            : L(`${kindLabel(r.place.kind)}로 맞춤`, `Fitted as ${kindLabel(r.place.kind)}`)}{" "}
          · {L("배율", "Scale")} {r.place.scale.toFixed(3)}
          {r.place.rotatedZUp && L(" · Z-위 파일을 세움", " · Stood up a Z-up file")}
          {r.place.note && ` · ${loc(r.place.note)}`} · {L("몸을 뚫은 정점", "Vertices inside the body")}{" "}
          {r.conform.insideBefore.toLocaleString()} → {r.conform.insideAfter.toLocaleString()}
          {L("개", "")} ({L("가장 깊이", "deepest")} {r.conform.worstBefore.toFixed(2)} → {r.conform.worstAfter.toFixed(3)}) ·{" "}
          {L("몸 묶음 기록", "Body binding")} {r.binding.count.toLocaleString()}
          {L("정점", " vertices")} ({L("되풀이 오차", "round-trip error")}{" "}
          {r.bindError < 1e-4 ? L("없음", "none") : r.bindError.toFixed(4)})
        </p>
      )}
      <p className="text-xs text-muted-foreground">{L("드래그로 돌리고, 휠로 확대합니다.", "Drag to rotate, scroll to zoom.")}</p>
    </div>
  )
}
