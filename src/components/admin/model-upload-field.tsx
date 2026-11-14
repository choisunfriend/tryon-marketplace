"use client"

import { useEffect, useRef, useState } from "react"
import {
  BODY_FILES,
  DEFAULT_CLEARANCE,
  bakeGarment,
  buildBody,
  parseObj,
  serializeBinding,
  type BodyFigure,
  type BodyGender,
  type GarmentKind,
} from "@/lib/garment-bake"

// ============================================================================
// (2026-11-14) 3D 옷 업로드 — 칸 3개(OBJ 필수 · MTL 선택 · 텍스처 이미지 선택) + 「굽기」
// ============================================================================
// 블렌더에서 OBJ로 내보내면 .obj + .mtl(색) 두 개, 이미지 텍스처를 썼으면 이미지까지 세 개가 나온다.
// 예전엔 .obj 하나만 받아서 앱에서 옷이 전부 같은 색으로 나왔다.
//   · 세 칸 모두 같은 R2 폴더 products/{folder}/model/ 에 올린다 — MTL·텍스처는 OBJ 옆에 있어야 찾힌다
//   · 칸마다 따로 올린다 — OBJ 를 먼저 올려 둔 뒤 MTL 만 나중에 올려도 된다
//   · OBJ 칸의 값(= 상품의 model_file)은 OBJ 의 R2 키. MTL·이미지는 이름으로만 이어지므로 따로 저장할 값이 없다
//   · 「굽기」: 올린 OBJ를 이 화면에서 바로 남/여 표준 몸에 맞춰 구워 저장(fitted.json).
//     성별·옷 종류는 폼의 Model Gender / Body Part 값을 읽는다.
//     구워도 vt·mtllib·usemtl 줄은 그대로 남으므로(garment-bake.writeObj) 색도 그대로다.
// ============================================================================

type Slot = "obj" | "mtl" | "tex"

interface Uploaded {
  name: string // 저장된 파일 이름 (서버가 safeName 으로 바꾼 이름)
  key: string
  refs: string[] // OBJ → mtllib 이름들 · MTL → map_Kd 이미지 이름들
}

const SLOT: Record<Slot, { label: string; accept: string; exts: string[]; hint: string }> = {
  obj: { label: "3D 파일 (.obj) · 필수", accept: ".obj", exts: ["obj"], hint: "옷 모양" },
  mtl: { label: "색 파일 (.mtl) · 선택", accept: ".mtl", exts: ["mtl"], hint: "없으면 회색" },
  tex: {
    label: "텍스처 이미지 · 선택",
    accept: "image/png,image/jpeg,image/webp",
    exts: ["png", "jpg", "jpeg", "webp"],
    hint: "MTL 이 이미지를 쓸 때만",
  },
}

const extOf = (n: string) => (n.split(".").pop() ?? "").toLowerCase()
const baseOf = (k: string) => k.split("?")[0].split("/").pop() ?? ""
const assetUrl = (key: string) => "/api/assets/" + key.split("/").map(encodeURIComponent).join("/")

const bodyCache = new Map<BodyGender, Promise<BodyFigure>>()
function loadBody(g: BodyGender): Promise<BodyFigure> {
  if (!bodyCache.has(g)) {
    const p = fetch(BODY_FILES[g].url)
      .then((r) => {
        if (!r.ok) throw new Error(`몸 파일을 못 받았습니다 (${r.status})`)
        return r.text()
      })
      .then((t) => buildBody(g, t))
    p.catch(() => bodyCache.delete(g)) // 실패한 약속은 남기지 않음 — 다음에 다시 받기
    bodyCache.set(g, p)
  }
  return bodyCache.get(g)!
}

function targetsFor(gender: string): BodyGender[] {
  if (gender === "female") return ["female"]
  if (gender === "male") return ["male"]
  return ["male", "female"]
}

function kindFor(bodyPart: string): GarmentKind {
  if (bodyPart === "lower_body") return "lower"
  if (bodyPart === "outer") return "outer"
  if (bodyPart === "full_body") return "full"
  if (bodyPart === "upper_body") return "upper"
  return "auto"
}

const nextFrame = () => new Promise((r) => setTimeout(r, 30))

export function ModelUploadField({
  name,
  label,
  folder,
  placeholder,
  resetSignal,
  initialValue = "",
}: {
  name: string
  label: string
  folder: string
  placeholder?: string
  resetSignal: number
  initialValue?: string
}) {
  const [value, setValue] = useState(initialValue) // OBJ 의 R2 키 (폼에 model_file 로 들어감)
  const [up, setUp] = useState<Partial<Record<Slot, Uploaded>>>({})
  const [status, setStatus] = useState<Partial<Record<Slot, string>>>({})
  const [busy, setBusy] = useState<Slot | "bake" | null>(null)
  const [bakeMsg, setBakeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setValue(initialValue)
    setUp({})
    setStatus({})
    setBakeMsg(null)
  }, [resetSignal, initialValue])

  async function upload(slot: Slot, file: File | undefined) {
    if (!file || !folder) return
    if (!SLOT[slot].exts.includes(extOf(file.name))) {
      setStatus((s) => ({ ...s, [slot]: `이 칸에는 ${SLOT[slot].exts.join(" / ")} 파일만 올릴 수 있습니다` }))
      return
    }
    setBusy(slot)
    setBakeMsg(null)
    setStatus((s) => ({ ...s, [slot]: "업로드 중…" }))
    try {
      const body = new FormData()
      body.append("file", file)
      body.append("kind", "model")
      body.append("folder", folder)
      const res = await fetch("/api/assets/upload", { method: "POST", body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error ?? "업로드 실패")
      const u: Uploaded = { name: data.name, key: data.key, refs: Array.isArray(data.refs) ? data.refs : [] }
      setUp((s) => ({ ...s, [slot]: u }))
      if (slot === "obj") setValue(u.key)
      setStatus((s) => ({ ...s, [slot]: `올림 · ${u.name} · ${(file.size / 1024).toFixed(0)}KB` }))
    } catch (e) {
      setStatus((s) => ({ ...s, [slot]: e instanceof Error ? e.message : "업로드 실패" }))
    } finally {
      setBusy(null)
    }
  }

  // 짝 맞춤 안내 — OBJ 가 찾는 MTL 이름, MTL 이 찾는 이미지 이름이 이번에 올린 것과 맞는지
  const notes: string[] = []
  const objRefs = up.obj?.refs ?? []
  const mtlName = up.mtl?.name
  if (up.obj && objRefs.length && !mtlName) {
    notes.push(`OBJ가 색 파일 ${objRefs.join(", ")} 을(를) 찾습니다 — 색 파일 칸에 올리지 않으면 앱에서 회색으로 나옵니다`)
  }
  if (mtlName && up.obj && objRefs.length && !objRefs.some((r) => r.toLowerCase() === mtlName.toLowerCase())) {
    notes.push(`OBJ는 ${objRefs.join(", ")} 을(를) 찾는데 올린 색 파일은 ${mtlName} 입니다 — 이름이 같아야 이어집니다`)
  }
  if (mtlName && up.obj && !objRefs.length) {
    notes.push(`OBJ 안에 mtllib 줄이 없어 색 파일 ${mtlName} 과(와) 이어지지 않습니다 — 블렌더에서 Materials 를 켜고 다시 내보내세요`)
  }
  const texRefs = up.mtl?.refs ?? []
  if (texRefs.length && !up.tex) {
    notes.push(`색 파일이 텍스처 ${texRefs.join(", ")} 을(를) 씁니다 — 이미지 칸에 올리지 않으면 무늬 없이 색만 나옵니다`)
  }
  if (up.tex && texRefs.length && !texRefs.some((r) => r.toLowerCase() === up.tex!.name.toLowerCase())) {
    notes.push(`색 파일은 ${texRefs.join(", ")} 을(를) 찾는데 올린 이미지는 ${up.tex.name} 입니다 — 이름이 같아야 이어집니다`)
  }

  // 폼의 Model Gender / Body Part 값 — 이 칸 아래에 있어 상태로 못 받으므로 폼에서 직접 읽는다
  function formValue(field: string): string {
    const form = wrap.current?.closest("form")
    const el = form?.elements.namedItem(field) as HTMLSelectElement | HTMLInputElement | null
    return el?.value ?? ""
  }

  async function bake() {
    const source = value.trim().split("?")[0]
    if (!folder || !source) return
    setBakeMsg(null)
    if (!/\.obj$/i.test(source)) {
      setBakeMsg({ ok: false, text: "OBJ 파일만 구울 수 있습니다" })
      return
    }
    if (!source.startsWith(`products/${folder}/`)) {
      setBakeMsg({ ok: false, text: "이 상품 폴더에 올린 OBJ만 구울 수 있습니다 — OBJ를 다시 올려 주세요" })
      return
    }
    const targets = targetsFor(formValue("avatar_gender"))
    const kind = kindFor(formValue("body_part"))
    const clearance = DEFAULT_CLEARANCE[kind === "auto" ? "upper" : kind]
    setBusy("bake")
    try {
      setBakeMsg({ ok: true, text: "원본 받는 중…" })
      const r = await fetch(assetUrl(source), { cache: "no-store" })
      if (!r.ok) throw new Error(`원본 파일이 R2에 없습니다 (${r.status})`)
      const garment = parseObj(await r.text())
      if (!garment.pos.length) throw new Error("OBJ에 정점이 없습니다")

      const results: Partial<Record<BodyGender, ReturnType<typeof bakeGarment>>> = {}
      for (const g of targets) {
        setBakeMsg({ ok: true, text: `${g === "male" ? "남자" : "여자"} 몸에 굽는 중…` })
        await nextFrame() // 화면이 멈춘 것처럼 보이지 않게 한 번 그려 줌
        results[g] = bakeGarment(garment, await loadBody(g), { kind, scaleMul: 1, yShift: 0, clearance })
      }

      setBakeMsg({ ok: true, text: "저장 중…" })
      const res = await fetch("/api/bake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder,
          source,
          results: Object.fromEntries(targets.map((g) => [g, results[g]!.text])),
          binds: Object.fromEntries(targets.map((g) => [g, serializeBinding(results[g]!.binding)])),
          params: Object.fromEntries(
            targets.map((g) => [g, { kind: results[g]!.place.kind, scaleMul: 1, yShift: 0, clearance }])
          ),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
      const summary = targets
        .map((g) => {
          const c = results[g]!.conform
          return `${g === "male" ? "남" : "여"}: 몸 뚫은 정점 ${c.insideBefore.toLocaleString()}→${c.insideAfter.toLocaleString()}`
        })
        .join(" · ")
      setBakeMsg({ ok: true, text: `구워서 저장했습니다 (${summary}). 앱에서 이 옷은 구운 파일로 입혀집니다.` })
    } catch (e) {
      setBakeMsg({ ok: false, text: `굽기 실패: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(null)
    }
  }

  const hasObj = /\.obj(\?|$)/i.test(value.trim())
  const canBake = !!folder && hasObj && !busy

  function fileRow(slot: Slot) {
    const shown = slot === "obj" ? (hasObj ? baseOf(value) : "") : up[slot]?.name ?? ""
    return (
      <div key={slot} className="rounded border p-2">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium">{SLOT[slot].label}</span>
          <span className="text-[11px] text-muted-foreground">{SLOT[slot].hint}</span>
        </div>
        <input
          type="file"
          accept={SLOT[slot].accept}
          disabled={!folder || !!busy}
          onChange={(e) => {
            void upload(slot, e.target.files?.[0])
            e.target.value = ""
          }}
          className="w-full text-xs"
        />
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {busy === slot ? "업로드 중…" : status[slot] ?? (shown ? `현재: ${shown}` : " ")}
        </p>
      </div>
    )
  }

  return (
    <div ref={wrap}>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input
          name={name}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setBakeMsg(null)
          }}
          placeholder={placeholder}
          className="w-full rounded border p-2"
        />
        <button
          type="button"
          onClick={bake}
          disabled={!canBake}
          title="올린 OBJ를 GYEOL 표준 몸(Model Gender)에 맞춰 굽고 저장합니다"
          className="shrink-0 rounded bg-black px-4 text-sm text-white disabled:opacity-40"
        >
          {busy === "bake" ? "굽는 중…" : "굽기"}
        </button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">{(["obj", "mtl", "tex"] as Slot[]).map(fileRow)}</div>

      <p className="mt-1 text-xs text-muted-foreground">
        블렌더 OBJ 내보내기에서 나온 .obj 와 .mtl 을 각 칸에 올리세요. 텍스처 이미지를 썼다면 내보낼 때 Path Mode 를 Copy 로 두면 이미지가 옆에 같이 나옵니다.
      </p>
      {notes.map((w) => (
        <p key={w} className="mt-1 text-xs text-amber-700">
          {w}
        </p>
      ))}
      {bakeMsg && (
        <p className={`mt-1 text-xs ${bakeMsg.ok ? "text-green-700" : "font-medium text-red-600"}`}>{bakeMsg.text}</p>
      )}
    </div>
  )
}
