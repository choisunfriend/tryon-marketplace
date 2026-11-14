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
// (2026-11-14) 3D 옷 업로드 칸 — 파일 최대 3개 + 바로 옆 「굽기」
// ============================================================================
// 블렌더에서 OBJ로 내보내면 .obj + .mtl(색) 두 개, 이미지 텍스처를 썼으면 이미지까지 세 개가 나온다.
// 예전엔 .obj 하나만 받아서 앱에서 옷이 전부 같은 색으로 나왔다.
//   · 파일 고르기에서 세 개를 한 번에 고른다 (.obj 꼭 1개 · .mtl · 텍스처 이미지)
//   · 모두 같은 R2 폴더 products/{folder}/model/ 에 올린다 — MTL·텍스처는 OBJ 옆에 있어야 찾힌다
//   · 입력칸 값(= 상품의 model_file)은 OBJ 의 R2 키
//   · 「굽기」: 올린 OBJ를 이 화면에서 바로 남/여 표준 몸에 맞춰 구워 저장(fitted.json).
//     성별·옷 종류는 폼의 Model Gender / Body Part 값을 읽는다. 세밀한 조정은 3D 굽기 화면에서.
//     구워도 vt·mtllib·usemtl 줄은 그대로 남으므로(garment-bake.writeObj) 색도 그대로다.
// ============================================================================

const MAX_FILES = 3

interface Uploaded {
  name: string // 저장된 파일 이름
  key: string
  refs: string[]
  ext: string
}

const extOf = (n: string) => (n.split(".").pop() ?? "").toLowerCase()
const IMG = ["png", "jpg", "jpeg", "webp"]

const assetUrl = (key: string) => "/api/assets/" + key.split("/").map(encodeURIComponent).join("/")

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
    // 실패한 약속은 남기지 않음 — 다음에 다시 받기
    bodyCache.get(g)!.catch(() => bodyCache.delete(g))
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
  const [value, setValue] = useState(initialValue)
  const [files, setFiles] = useState<Uploaded[]>([])
  const [status, setStatus] = useState("")
  const [warn, setWarn] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [bakeMsg, setBakeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setValue(initialValue)
    setFiles([])
    setStatus("")
    setWarn([])
    setBakeMsg(null)
  }, [resetSignal, initialValue])

  // 빠진 짝 알려 주기 — OBJ 가 가리키는 MTL, MTL 이 가리키는 텍스처
  function checkPairs(list: Uploaded[]): string[] {
    const have = new Set(list.map((f) => f.name.toLowerCase()))
    const out: string[] = []
    for (const f of list) {
      for (const r of f.refs) {
        if (!have.has(r.toLowerCase())) {
          out.push(
            f.ext === "obj"
              ? `OBJ가 색 파일 ${r} 을(를) 찾습니다 — 같이 올리지 않으면 앱에서 회색으로 나옵니다`
              : `MTL이 텍스처 ${r} 을(를) 찾습니다 — 같이 올리지 않으면 무늬 없이 색만 나옵니다`
          )
        }
      }
    }
    return out
  }

  async function handleFiles(list: FileList | null) {
    if (!list || !list.length || !folder) return
    const picked = Array.from(list)
    setBakeMsg(null)
    if (picked.length > MAX_FILES) {
      setStatus(`한 번에 ${MAX_FILES}개까지 고를 수 있습니다 (.obj + .mtl + 텍스처 이미지)`)
      return
    }
    const objs = picked.filter((f) => extOf(f.name) === "obj")
    const glbs = picked.filter((f) => ["glb", "gltf"].includes(extOf(f.name)))
    if (objs.length + glbs.length !== 1) {
      setStatus("3D 파일(.obj)을 꼭 1개 골라 주세요 — .mtl·텍스처 이미지와 함께 고르면 됩니다")
      return
    }
    const bad = picked.find((f) => !["obj", "mtl", "glb", "gltf", ...IMG].includes(extOf(f.name)))
    if (bad) {
      setStatus(`올릴 수 없는 파일: ${bad.name} (.obj · .mtl · png/jpg/webp 만)`)
      return
    }

    setBusy(true)
    const done: Uploaded[] = []
    try {
      // 3D 파일을 마지막에 올려, 입력칸 값이 바뀌는 시점에 짝 파일이 이미 R2 에 있게 한다
      const order = picked.sort((a, b) => Number(["obj", "glb", "gltf"].includes(extOf(a.name))) - Number(["obj", "glb", "gltf"].includes(extOf(b.name))))
      for (const [i, file] of order.entries()) {
        setStatus(`업로드 중… (${i + 1}/${order.length}) ${file.name}`)
        const body = new FormData()
        body.append("file", file)
        body.append("kind", "model")
        body.append("folder", folder)
        const res = await fetch("/api/assets/upload", { method: "POST", body })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) throw new Error(`${file.name}: ${data.error ?? "업로드 실패"}`)
        done.push({ name: data.name, key: data.key, refs: Array.isArray(data.refs) ? data.refs : [], ext: extOf(data.name) })
      }
      const main = done.find((f) => ["obj", "glb", "gltf"].includes(f.ext))!
      setValue(main.key)
      setFiles(done)
      setWarn(checkPairs(done))
      setStatus(`올림 · ${done.map((f) => f.name).join(" + ")}`)
    } catch (e) {
      setFiles(done)
      setStatus(e instanceof Error ? e.message : "업로드 실패")
    } finally {
      setBusy(false)
    }
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
      setBakeMsg({ ok: false, text: "이 상품 폴더에 올린 OBJ만 구울 수 있습니다 — 파일을 다시 올려 주세요" })
      return
    }
    const targets = targetsFor(formValue("avatar_gender"))
    const kind = kindFor(formValue("body_part"))
    const clearance = DEFAULT_CLEARANCE[kind === "auto" ? "upper" : kind]
    setBusy(true)
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
      setBusy(false)
    }
  }

  const canBake = !!folder && /\.obj(\?|$)/i.test(value.trim()) && !busy

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
          {busy && bakeMsg ? "굽는 중…" : "굽기"}
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          type="file"
          multiple
          accept=".obj,.mtl,.glb,.gltf,image/png,image/jpeg,image/webp"
          disabled={!folder || busy}
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ""
          }}
          className="text-xs"
        />
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        .obj 와 .mtl(색), 텍스처 이미지가 있으면 그것까지 <b>최대 3개를 한 번에</b> 고르세요. 블렌더 OBJ 내보내기에서 텍스처를 썼다면
        Path Mode 를 Copy 로 두면 이미지가 옆에 같이 나옵니다.
      </p>
      {files.length > 0 && warn.length === 0 && files.some((f) => f.ext === "obj") && !files.some((f) => f.ext === "mtl") && (
        <p className="mt-1 text-xs text-amber-700">MTL 없이 OBJ만 올렸습니다 — 앱에서 회색 단색으로 나옵니다.</p>
      )}
      {warn.map((w) => (
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
