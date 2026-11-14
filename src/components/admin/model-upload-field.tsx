"use client"

import { useEffect, useRef, useState } from "react"
import { BakePanel } from "@/components/admin/bake-panel"

// ============================================================================
// (2026-11-14) 3D 옷 업로드 칸 — OBJ 칸 · MTL 칸 따로 + 바로 옆 「3D 굽기」
// ============================================================================
// 블렌더에서 OBJ로 내보내면 .obj + .mtl(색), 이미지 텍스처를 썼으면 이미지까지 나온다.
//   · 「3D 파일」 칸: .obj (또는 .glb/.gltf) 1개 → 입력칸 값(= 상품의 model_file)이 그 R2 키
//   · 「MTL / 텍스처」 칸: .mtl 1개 + 텍스처 이미지(png/jpg/webp) 여러 장
//   · 둘 다 같은 R2 폴더 products/{folder}/model/ 에 올린다 — MTL·텍스처는 OBJ 옆에 있어야 찾힌다
//   · 「3D 굽기」: 관리자 「3D 굽기」 메뉴와 같은 패널(크기·높이·여유 조절 + 3D 미리보기 + 저장)을
//     이 칸 바로 아래에 펼친다. 성별·옷 종류는 폼의 Model Gender / Body Part 값을 따라간다.
// ============================================================================

interface Uploaded {
  name: string // 저장된 파일 이름
  key: string
  refs: string[]
  ext: string
}

const extOf = (n: string) => (n.split(".").pop() ?? "").toLowerCase()
const IMG = ["png", "jpg", "jpeg", "webp"]
const MODEL = ["obj", "glb", "gltf"]
const MAX_TEXTURES = 8

async function uploadOne(file: File, folder: string): Promise<Uploaded> {
  const body = new FormData()
  body.append("file", file)
  body.append("kind", "model")
  body.append("folder", folder)
  const res = await fetch("/api/assets/upload", { method: "POST", body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.success) throw new Error(`${file.name}: ${data.error ?? "업로드 실패"}`)
  return { name: data.name, key: data.key, refs: Array.isArray(data.refs) ? data.refs : [], ext: extOf(data.name) }
}

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
  const [model, setModel] = useState<Uploaded | null>(null)
  const [mats, setMats] = useState<Uploaded[]>([]) // .mtl + 텍스처
  const [modelStatus, setModelStatus] = useState("")
  const [matStatus, setMatStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [bakeOpen, setBakeOpen] = useState(false)
  const [formVals, setFormVals] = useState({ gender: "unisex", bodyPart: "" })
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setValue(initialValue)
    setModel(null)
    setMats([])
    setModelStatus("")
    setMatStatus("")
    setBakeOpen(false)
  }, [resetSignal, initialValue])

  // 폼의 Model Gender / Body Part — 이 칸 아래에 있어 상태로 못 받으므로 폼에서 직접 읽고, 바뀌면 따라간다
  useEffect(() => {
    const form = wrap.current?.closest("form")
    if (!form) return
    const read = () => {
      const g = form.elements.namedItem("avatar_gender") as HTMLSelectElement | null
      const b = form.elements.namedItem("body_part") as HTMLSelectElement | null
      setFormVals({ gender: g?.value || "unisex", bodyPart: b?.value || "" })
    }
    read()
    form.addEventListener("change", read)
    return () => form.removeEventListener("change", read)
  }, [])

  // 빠진 짝 알려 주기 — OBJ 가 가리키는 MTL, MTL 이 가리키는 텍스처
  const have = new Set(mats.map((f) => f.name.toLowerCase()))
  const warn: string[] = []
  for (const r of model?.refs ?? [])
    if (!have.has(r.toLowerCase())) warn.push(`OBJ가 색 파일 ${r} 을(를) 찾습니다 — 오른쪽 MTL 칸에 올려 주세요`)
  for (const m of mats)
    for (const r of m.refs)
      if (!have.has(r.toLowerCase())) warn.push(`MTL이 텍스처 ${r} 을(를) 찾습니다 — MTL 칸에 이미지도 같이 올려 주세요`)

  async function handleModel(list: FileList | null) {
    const file = list?.[0]
    if (!file || !folder) return
    if (!MODEL.includes(extOf(file.name))) {
      setModelStatus("3D 파일은 .obj (또는 .glb/.gltf) 만 올릴 수 있습니다 — .mtl 은 오른쪽 칸에")
      return
    }
    setBusy(true)
    try {
      setModelStatus(`업로드 중… ${file.name}`)
      const up = await uploadOne(file, folder)
      setModel(up)
      setValue(up.key)
      setModelStatus(`올림 · ${up.name}`)
    } catch (e) {
      setModelStatus(e instanceof Error ? e.message : "업로드 실패")
    } finally {
      setBusy(false)
    }
  }

  async function handleMats(list: FileList | null) {
    if (!list || !list.length || !folder) return
    const picked = Array.from(list)
    const mtls = picked.filter((f) => extOf(f.name) === "mtl")
    const bad = picked.find((f) => !["mtl", ...IMG].includes(extOf(f.name)))
    if (bad) {
      setMatStatus(`올릴 수 없는 파일: ${bad.name} (.mtl · png/jpg/webp 만)`)
      return
    }
    if (mtls.length > 1) {
      setMatStatus(".mtl 은 1개만 골라 주세요")
      return
    }
    if (picked.length - mtls.length > MAX_TEXTURES) {
      setMatStatus(`텍스처 이미지는 ${MAX_TEXTURES}장까지 올릴 수 있습니다`)
      return
    }
    setBusy(true)
    const done: Uploaded[] = []
    try {
      for (const [i, file] of picked.entries()) {
        setMatStatus(`업로드 중… (${i + 1}/${picked.length}) ${file.name}`)
        done.push(await uploadOne(file, folder))
      }
      setMatStatus("")
    } catch (e) {
      setMatStatus(e instanceof Error ? e.message : "업로드 실패")
    } finally {
      // 새 MTL 을 올리면 예전 MTL 은 목록에서 뺀다 (이미지는 이름이 같을 때만 바꿈)
      setMats((cur) => {
        const newMtl = done.some((f) => f.ext === "mtl")
        const names = new Set(done.map((f) => f.name.toLowerCase()))
        return [...cur.filter((f) => !(newMtl && f.ext === "mtl") && !names.has(f.name.toLowerCase())), ...done]
      })
      setBusy(false)
    }
  }

  const source = value.trim().split("?")[0]
  const isObj = /\.obj$/i.test(source)
  const inFolder = !!folder && source.startsWith(`products/${folder}/`)
  const canBake = isObj && inFolder && !busy
  const bakeTitle = !isObj
    ? "먼저 .obj 파일을 올려 주세요"
    : !inFolder
      ? "이 상품 폴더에 올린 OBJ만 구울 수 있습니다 — 파일을 다시 올려 주세요"
      : "GYEOL 표준 몸에 맞춰 굽기 (크기·높이·여유 조절 + 미리보기)"

  const box = "rounded-lg border p-3"

  return (
    <div ref={wrap} className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        {/* 3D 파일 (.obj) */}
        <div className={box}>
          <div className="mb-1 text-xs font-medium">① 3D 파일 (.obj)</div>
          <input
            name={name}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded border p-2 text-sm"
          />
          <input
            type="file"
            accept=".obj,.glb,.gltf"
            disabled={!folder || busy}
            onChange={(e) => {
              void handleModel(e.target.files)
              e.target.value = ""
            }}
            className="mt-2 block text-xs"
          />
          {modelStatus && <p className="mt-1 text-xs text-muted-foreground">{modelStatus}</p>}
        </div>

        {/* MTL + 텍스처 */}
        <div className={box}>
          <div className="mb-1 text-xs font-medium">② 색 파일 (.mtl) + 텍스처 이미지</div>
          <input
            type="file"
            multiple
            accept=".mtl,image/png,image/jpeg,image/webp"
            disabled={!folder || busy}
            onChange={(e) => {
              void handleMats(e.target.files)
              e.target.value = ""
            }}
            className="block text-xs"
          />
          {mats.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {mats.map((f) => (
                <li key={f.key} className="truncate">
                  {f.ext === "mtl" ? "🎨" : "🖼"} {f.name}
                </li>
              ))}
            </ul>
          )}
          {matStatus && <p className="mt-1 text-xs text-muted-foreground">{matStatus}</p>}
          <p className="mt-1 text-[11px] text-muted-foreground">
            .mtl 1개와 텍스처 이미지를 함께 고르세요. 블렌더 OBJ 내보내기에서 Path Mode 를 Copy 로 두면 이미지가 같이 나옵니다.
          </p>
        </div>

        {/* 3D 굽기 */}
        <div className="flex md:items-start">
          <button
            type="button"
            onClick={() => setBakeOpen((o) => !o)}
            disabled={!canBake && !bakeOpen}
            title={bakeTitle}
            className="w-full rounded-lg bg-black px-5 py-3 text-sm text-white disabled:opacity-40 md:w-auto"
          >
            {bakeOpen ? "3D 굽기 닫기" : "3D 굽기"}
          </button>
        </div>
      </div>

      {model?.ext === "obj" && !mats.some((f) => f.ext === "mtl") && warn.length === 0 && (
        <p className="text-xs text-amber-700">MTL 없이 OBJ만 올렸습니다 — 앱에서 회색 단색으로 나옵니다.</p>
      )}
      {warn.map((w) => (
        <p key={w} className="text-xs text-amber-700">
          {w}
        </p>
      ))}
      {!folder && <p className="text-xs text-muted-foreground">상품 이름(폴더)을 먼저 정하면 파일을 올릴 수 있습니다.</p>}

      {bakeOpen && canBake && (
        <div className="rounded-lg border bg-neutral-50/50 p-4">
          <BakePanel folder={folder} source={source} gender={formVals.gender} bodyPart={formVals.bodyPart} />
        </div>
      )}
    </div>
  )
}
