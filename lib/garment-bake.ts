// ============================================================================
// 3D 옷 굽기 — 판매자가 올린 OBJ를 GYEOL 표준 몸(남/여)에 맞춰 둔다
// ============================================================================
// 1) 맞춤: 크기·위치를 몸 좌표로 옮김 (상의=목 아래 · 하의=허리 · 전신=목~발목)
// 2) 굽기: 몸을 뚫고 들어간 정점만 몸 표면 법선 방향으로 밀고, 그 변위를
//    옷 메쉬 위에서 부드럽게 퍼뜨린다 (GYEOL tools/conform.py 와 같은 방식).
//    옷의 주름·실루엣은 그대로 두고 몸이 비어져 나오지 않게 한다.
// 브라우저·Node 어디서든 돌도록 DOM·three.js 에 의존하지 않는다.
// ============================================================================

export type GarmentKind = "auto" | "upper" | "lower" | "outer" | "full"
export type BodyGender = "male" | "female"

export const BODY_FILES: Record<BodyGender, { url: string; neckCutFrac: number }> = {
  male: { url: "/bodies/body_male.obj", neckCutFrac: 0.9474 },
  female: { url: "/bodies/body_female.obj", neckCutFrac: 0.9427 },
}

// ---------------------------------------------------------------------------
// OBJ 읽기/쓰기 — 정점(v) 줄만 바꿔 쓰고 vt·vn·f·usemtl 등은 원본 그대로 둔다
// ---------------------------------------------------------------------------
export interface ParsedObj {
  lines: string[]
  vLine: number[] // 정점 i 가 있는 줄 번호
  pos: Float32Array
  faces: number[][] // 0-based 정점 번호
}

export function parseObj(text: string): ParsedObj {
  const lines = text.split(/\r?\n/)
  const vLine: number[] = []
  const p: number[] = []
  const faces: number[][] = []
  for (let li = 0; li < lines.length; li++) {
    const l = lines[li]
    if (l.startsWith("v ")) {
      const t = l.trim().split(/\s+/)
      p.push(+t[1], +t[2], +t[3])
      vLine.push(li)
    } else if (l.startsWith("f ")) {
      const t = l.trim().split(/\s+/).slice(1)
      const n = vLine.length
      const f: number[] = []
      for (const tok of t) {
        const k = parseInt(tok.split("/")[0], 10)
        if (!Number.isFinite(k)) continue
        f.push(k < 0 ? n + k : k - 1)
      }
      if (f.length >= 3) faces.push(f)
    }
  }
  return { lines, vLine, pos: new Float32Array(p), faces }
}

export function writeObj(obj: ParsedObj, pos: Float32Array, header?: string): string {
  const out = obj.lines.slice()
  for (let i = 0; i < obj.vLine.length; i++) {
    const old = out[obj.vLine[i]].trim().split(/\s+/)
    const extra = old.length > 4 ? " " + old.slice(4).join(" ") : "" // 정점색 등 보존
    out[obj.vLine[i]] =
      `v ${pos[3 * i].toFixed(5)} ${pos[3 * i + 1].toFixed(5)} ${pos[3 * i + 2].toFixed(5)}${extra}`
  }
  return (header ? header + "\n" : "") + out.join("\n")
}

// ---------------------------------------------------------------------------
// 몸
// ---------------------------------------------------------------------------
interface Box {
  minX: number; minY: number; minZ: number
  maxX: number; maxY: number; maxZ: number
}

export interface BodyFigure {
  gender: BodyGender
  obj: ParsedObj
  box: Box
  cutY: number
  neckCx: number
  neckCz: number
  // 표면 표본(정점·면 중심·모서리 중점)과 법선 — 최근접 탐색용 격자
  sp: Float32Array
  sn: Float32Array
  grid: Map<string, number[]>
  cell: number
}

function boxOf(pos: Float32Array): Box {
  const b: Box = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity }
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2]
    if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x
    if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y
    if (z < b.minZ) b.minZ = z; if (z > b.maxZ) b.maxZ = z
  }
  return b
}

function vertexNormals(pos: Float32Array, faces: number[][]): Float32Array {
  const n = new Float32Array(pos.length)
  for (const f of faces) {
    for (let k = 1; k + 1 < f.length; k++) {
      const a = f[0] * 3, b = f[k] * 3, c = f[k + 1] * 3
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      for (const v of [a, b, c]) { n[v] += nx; n[v + 1] += ny; n[v + 2] += nz }
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l
  }
  return n
}

const key3 = (x: number, y: number, z: number) => `${x},${y},${z}`

export function buildBody(gender: BodyGender, text: string): BodyFigure {
  const obj = parseObj(text)
  const box = boxOf(obj.pos)
  const cutY = box.minY + BODY_FILES[gender].neckCutFrac * (box.maxY - box.minY)
  // 목 중심: 절단선 바로 위 띠의 평균
  let sx = 0, sz = 0, n = 0
  for (let i = 0; i < obj.pos.length; i += 3) {
    const y = obj.pos[i + 1]
    if (y >= cutY && y <= cutY + 0.25) { sx += obj.pos[i]; sz += obj.pos[i + 2]; n++ }
  }
  const neckCx = n ? sx / n : 0, neckCz = n ? sz / n : 0

  const vn = vertexNormals(obj.pos, obj.faces)
  const P: number[] = [], N: number[] = []
  const push = (x: number, y: number, z: number, a: number, b: number, c: number) => {
    const l = Math.hypot(a, b, c) || 1
    P.push(x, y, z); N.push(a / l, b / l, c / l)
  }
  for (let i = 0; i < obj.pos.length; i += 3) push(obj.pos[i], obj.pos[i + 1], obj.pos[i + 2], vn[i], vn[i + 1], vn[i + 2])
  for (const f of obj.faces) {
    let cx = 0, cy = 0, cz = 0, nx = 0, ny = 0, nz = 0
    for (const v of f) { cx += obj.pos[3 * v]; cy += obj.pos[3 * v + 1]; cz += obj.pos[3 * v + 2]; nx += vn[3 * v]; ny += vn[3 * v + 1]; nz += vn[3 * v + 2] }
    push(cx / f.length, cy / f.length, cz / f.length, nx, ny, nz)
    for (let k = 0; k < f.length; k++) {
      const a = f[k], b = f[(k + 1) % f.length]
      if (a > b) continue // 모서리는 한 번만
      push((obj.pos[3 * a] + obj.pos[3 * b]) / 2, (obj.pos[3 * a + 1] + obj.pos[3 * b + 1]) / 2, (obj.pos[3 * a + 2] + obj.pos[3 * b + 2]) / 2,
        vn[3 * a] + vn[3 * b], vn[3 * a + 1] + vn[3 * b + 1], vn[3 * a + 2] + vn[3 * b + 2])
    }
  }
  const sp = new Float32Array(P), sn = new Float32Array(N)
  const cell = (box.maxY - box.minY) / 60
  const grid = new Map<string, number[]>()
  for (let i = 0; i < sp.length / 3; i++) {
    const k = key3(Math.floor(sp[3 * i] / cell), Math.floor(sp[3 * i + 1] / cell), Math.floor(sp[3 * i + 2] / cell))
    let arr = grid.get(k)
    if (!arr) grid.set(k, (arr = []))
    arr.push(i)
  }
  return { gender, obj, box, cutY, neckCx, neckCz, sp, sn, grid, cell }
}

function nearest(body: BodyFigure, x: number, y: number, z: number, maxR = 6): number {
  const c = body.cell
  const gx = Math.floor(x / c), gy = Math.floor(y / c), gz = Math.floor(z / c)
  let best = -1, bd = Infinity
  for (let r = 0; r <= maxR; r++) {
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
      if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue
      const arr = body.grid.get(key3(gx + i, gy + j, gz + k))
      if (!arr) continue
      for (const s of arr) {
        const dx = body.sp[3 * s] - x, dy = body.sp[3 * s + 1] - y, dz = body.sp[3 * s + 2] - z
        const d = dx * dx + dy * dy + dz * dz
        if (d < bd) { bd = d; best = s }
      }
    }
    if (best >= 0 && Math.sqrt(bd) <= r * c) break
  }
  return best
}

// ---------------------------------------------------------------------------
// 1) 맞춤 — 크기·위치
// ---------------------------------------------------------------------------
export interface PlaceOptions {
  kind: GarmentKind
  scaleMul: number // 손 조절 배율 (1 = 자동값 그대로)
  yShift: number // 몸 키 대비 위아래 이동 (+ = 위)
}

export interface PlaceReport {
  kind: Exclude<GarmentKind, "auto"> | "asis"
  scale: number
  rotatedZUp: boolean
  note: string
}

function bandWidth(pos: Float32Array, y0: number, y1: number, cx0: number): { w: number; cx: number; cz: number; n: number } | null {
  const xs: number[] = [], zs: number[] = []
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1]
    if (y < y0 || y > y1) continue
    xs.push(pos[i]); zs.push(pos[i + 2])
  }
  if (!xs.length) return null
  let mn = Infinity, mx = -Infinity
  for (const x of xs) { if (x < mn) mn = x; if (x > mx) mx = x }
  const NB = Math.max(6, Math.min(80, Math.floor(xs.length / 6)))
  const bw = (mx - mn) / NB || 1
  const occ = new Uint8Array(NB)
  for (const x of xs) occ[Math.min(NB - 1, Math.floor((x - mn) / bw))] = 1
  let k = Math.max(0, Math.min(NB - 1, Math.floor((cx0 - mn) / bw)))
  if (!occ[k]) { let d = 1; while (d < NB && !(occ[k + d] || occ[k - d])) d++; k = occ[k + d] ? k + d : k - d }
  let a = k, b = k
  while (a > 0 && (occ[a - 1] || (a > 1 && occ[a - 2]))) a--
  while (b < NB - 1 && (occ[b + 1] || (b < NB - 2 && occ[b + 2]))) b++
  const L = mn + a * bw, R = mn + (b + 1) * bw
  let sz = 0, n = 0
  for (let i = 0; i < xs.length; i++) if (xs[i] >= L && xs[i] <= R) { sz += zs[i]; n++ }
  return { w: R - L, cx: (L + R) / 2, cz: n ? sz / n : 0, n }
}

export function isInBodySpace(gb: Box, body: BodyFigure): boolean {
  const bb = body.box
  const bH = bb.maxY - bb.minY, bW = bb.maxX - bb.minX
  return (
    gb.minY >= bb.minY - 0.05 * bH && gb.maxY <= bb.maxY + 0.05 * bH &&
    gb.minX >= bb.minX - 0.1 * bW && gb.maxX <= bb.maxX + 0.1 * bW &&
    gb.maxY - gb.minY >= 0.15 * bH && gb.maxX - gb.minX >= 0.25 * bW &&
    Math.abs((gb.minX + gb.maxX) / 2 - (bb.minX + bb.maxX) / 2) < 0.05 * bW
  )
}

export function placeGarment(src: Float32Array, body: BodyFigure, opt: PlaceOptions): { pos: Float32Array; report: PlaceReport } {
  const pos = new Float32Array(src)
  let gb = boxOf(pos)
  // 이미 이 몸 좌표에 맞춰 만든 옷(GYEOL conform.py·MakeHuman 의상 등)은 옮기지 않는다
  if (opt.kind === "auto" && opt.scaleMul === 1 && opt.yShift === 0 && isInBodySpace(gb, body)) {
    return { pos, report: { kind: "asis", scale: 1, rotatedZUp: false, note: "이미 몸 좌표에 있는 옷 — 그대로 둠" } }
  }
  let rotatedZUp = false
  if (gb.maxZ - gb.minZ > 1.5 * (gb.maxY - gb.minY)) {
    for (let i = 0; i < pos.length; i += 3) { const y = pos[i + 1]; pos[i + 1] = pos[i + 2]; pos[i + 2] = -y }
    gb = boxOf(pos); rotatedZUp = true
  }
  const gh = gb.maxY - gb.minY || 1
  const gw = gb.maxX - gb.minX || 1
  const bodyH = body.cutY - body.box.minY
  const floor = body.box.minY
  const notes: string[] = []

  // 종류 정하기
  let kind: Exclude<GarmentKind, "auto">
  const lowerTop = floor + 0.77 * bodyH
  const upperTop = body.cutY + 0.02 * bodyH
  const bodyShoulder = bandWidth(body.obj.pos, body.cutY - 0.13 * bodyH, body.cutY - 0.06 * bodyH, body.neckCx)
  const garTop = (() => {
    for (const k of [1, 2, 3]) {
      const b = bandWidth(pos, gb.maxY - 0.14 * k * gh, gb.maxY - 0.06 * gh, (gb.minX + gb.maxX) / 2)
      if (b && b.n >= 12) return b
    }
    return bandWidth(pos, gb.maxY - 0.4 * gh, gb.maxY, (gb.minX + gb.maxX) / 2)
  })()
  const sWidth = bodyShoulder && garTop && garTop.w > 0 ? (bodyShoulder.w / garTop.w) * 1.02 : NaN
  if (opt.kind !== "auto") {
    kind = opt.kind
  } else if (gh / gw > 2.2) {
    kind = "full"; notes.push("세로로 긴 옷 → 전신")
  } else {
    const impliedH = sWidth * gh // 폭으로 맞췄을 때 옷 높이
    const r = impliedH / bodyH
    if (Number.isFinite(r) && r > 1.05) {
      kind = "full"; notes.push(`어깨폭으로 맞추면 몸의 ${r.toFixed(2)}배 → 전신`)
    } else {
      kind = "upper"
      if (Number.isFinite(r)) notes.push(`어깨폭 기준 길이 ${r.toFixed(2)}×몸`)
    }
  }

  // 배율
  const top = kind === "lower" ? lowerTop : upperTop
  let s: number
  if (kind === "full") {
    s = (0.97 * (top - floor)) / gh
  } else if (kind === "lower") {
    const waist = bandWidth(body.obj.pos, top - 0.05 * bodyH, top, body.neckCx)
    const gWaist = bandWidth(pos, gb.maxY - 0.06 * gh, gb.maxY, (gb.minX + gb.maxX) / 2)
    s = waist && gWaist && gWaist.w > 0 ? (waist.w / gWaist.w) * 1.04 : (0.5 * bodyH) / gh
    const r = (s * gh) / bodyH
    if (!(r > 0.15 && r < 0.85)) { s = (0.5 * bodyH) / gh; notes.push("허리폭 측정 불가 → 길이 기준") }
  } else {
    s = sWidth
    const r = (s * gh) / bodyH
    if (!(r > 0.15 && r < 1.0) || !Number.isFinite(s)) { s = (0.4 * bodyH) / gh; notes.push("어깨폭 측정 불가 → 길이 기준") }
  }
  const sFloor = ((top - floor) * 0.99) / gh
  if (s > sFloor) { s = sFloor; notes.push("바닥 아래로 내려가 줄임") }
  s *= opt.scaleMul

  const gcx = garTop ? garTop.cx : (gb.minX + gb.maxX) / 2
  const gcz = garTop ? garTop.cz : (gb.minZ + gb.maxZ) / 2
  const tz = bodyShoulder ? bodyShoulder.cz : body.neckCz
  const ty = top + opt.yShift * bodyH
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (pos[i] - gcx) * s + body.neckCx
    pos[i + 1] = (pos[i + 1] - gb.maxY) * s + ty
    pos[i + 2] = (pos[i + 2] - gcz) * s + tz
  }
  return { pos, report: { kind, scale: s, rotatedZUp, note: notes.join(" · ") } }
}

// ---------------------------------------------------------------------------
// 2) 굽기 — 몸 밖으로 밀고 부드럽게 퍼뜨리기 (conform.py 이식)
// ---------------------------------------------------------------------------
export interface ConformReport {
  insideBefore: number
  insideAfter: number
  worstBefore: number
  worstAfter: number
  rounds: number
}

export function conformGarment(
  pos: Float32Array, faces: number[][], body: BodyFigure,
  clearance: number, rounds = 6, smoothIters = 14
): ConformReport {
  const n = pos.length / 3
  // 인접(CSR)
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set<number>())
  for (const f of faces) for (let k = 0; k < f.length; k++) {
    const a = f[k], b = f[(k + 1) % f.length]
    if (a < n && b < n && a !== b) { nb[a].add(b); nb[b].add(a) }
  }
  const off = new Int32Array(n + 1)
  for (let i = 0; i < n; i++) off[i + 1] = off[i] + nb[i].size
  const adj = new Int32Array(off[n])
  for (let i = 0; i < n; i++) { let j = off[i]; for (const v of nb[i]) adj[j++] = v }

  const signed = (out?: { inside: number; worst: number }) => {
    const need = new Float32Array(n)
    const nrm = new Float32Array(3 * n)
    let inside = 0, worst = 0
    for (let i = 0; i < n; i++) {
      const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2]
      const s = nearest(body, x, y, z)
      if (s < 0) continue
      const nx = body.sn[3 * s], ny = body.sn[3 * s + 1], nz = body.sn[3 * s + 2]
      const d = (x - body.sp[3 * s]) * nx + (y - body.sp[3 * s + 1]) * ny + (z - body.sp[3 * s + 2]) * nz
      const nd = clearance - d
      if (d < 0) { inside++; if (-d > worst) worst = -d }
      if (nd > 0) { need[i] = nd; nrm[3 * i] = nx; nrm[3 * i + 1] = ny; nrm[3 * i + 2] = nz }
    }
    if (out) { out.inside = inside; out.worst = worst }
    return { need, nrm }
  }

  const before = { inside: 0, worst: 0 }
  let r = 0
  let D = new Float32Array(3 * n), T = new Float32Array(3 * n)
  for (; r < rounds; r++) {
    const { need, nrm } = signed(r === 0 ? before : undefined)
    let any = false
    for (let i = 0; i < n; i++) {
      D[3 * i] = need[i] * nrm[3 * i]; D[3 * i + 1] = need[i] * nrm[3 * i + 1]; D[3 * i + 2] = need[i] * nrm[3 * i + 2]
      if (need[i] > 0) any = true
    }
    if (!any) break
    const w = 0.65
    for (let it = 0; it < smoothIters; it++) {
      for (let i = 0; i < n; i++) {
        const deg = off[i + 1] - off[i]
        if (!deg) { T[3 * i] = D[3 * i]; T[3 * i + 1] = D[3 * i + 1]; T[3 * i + 2] = D[3 * i + 2]; continue }
        let ax = 0, ay = 0, az = 0
        for (let j = off[i]; j < off[i + 1]; j++) { const v = adj[j]; ax += D[3 * v]; ay += D[3 * v + 1]; az += D[3 * v + 2] }
        T[3 * i] = (1 - w) * D[3 * i] + (w * ax) / deg
        T[3 * i + 1] = (1 - w) * D[3 * i + 1] + (w * ay) / deg
        T[3 * i + 2] = (1 - w) * D[3 * i + 2] + (w * az) / deg
      }
      const tmp = D; D = T; T = tmp
    }
    // 스무딩이 꼭 필요한 양을 깎아 먹지 않도록 정점별로 최소 need 는 보장
    for (let i = 0; i < n; i++) {
      if (need[i] > 0) {
        const along = D[3 * i] * nrm[3 * i] + D[3 * i + 1] * nrm[3 * i + 1] + D[3 * i + 2] * nrm[3 * i + 2]
        if (along < need[i]) { const add = need[i] - along; D[3 * i] += add * nrm[3 * i]; D[3 * i + 1] += add * nrm[3 * i + 1]; D[3 * i + 2] += add * nrm[3 * i + 2] }
      }
      pos[3 * i] += D[3 * i]; pos[3 * i + 1] += D[3 * i + 1]; pos[3 * i + 2] += D[3 * i + 2]
    }
  }
  const after = { inside: 0, worst: 0 }
  signed(after)
  return { insideBefore: before.inside, insideAfter: after.inside, worstBefore: before.worst, worstAfter: after.worst, rounds: r }
}

// ---------------------------------------------------------------------------
// 한 번에
// ---------------------------------------------------------------------------
export interface BakeOptions extends PlaceOptions {
  clearance: number // 몸과 옷 사이 여유 (몸 좌표 단위, 키 ≈ 15)
}

export interface BakeResult {
  pos: Float32Array
  place: PlaceReport
  conform: ConformReport
  text: string
  binding: GarmentBinding
  bindError: number // 바인딩을 다시 풀었을 때 원위치와의 최대 차이
}

export function bakeGarment(garment: ParsedObj, body: BodyFigure, opt: BakeOptions): BakeResult {
  const { pos, report } = placeGarment(garment.pos, body, opt)
  const conform = conformGarment(pos, garment.faces, body, opt.clearance)
  const header = `# GYEOL baked for body_${body.gender} · kind ${report.kind} · scale ${report.scale.toFixed(4)} · clearance ${opt.clearance}`
  const binding = bindGarment(pos, body)
  const back = applyBinding(binding, body.obj.pos)
  let bindError = 0
  for (let i = 0; i < pos.length; i++) bindError = Math.max(bindError, Math.abs(back[i] - pos[i]))
  return { pos, place: report, conform, text: writeObj(garment, pos, header), binding, bindError }
}

export const DEFAULT_CLEARANCE: Record<Exclude<GarmentKind, "auto">, number> = {
  upper: 0.05, outer: 0.08, full: 0.06, lower: 0.025,
}

// ============================================================================
// 3) 몸 묶음 기록(바인딩) — 옷 정점을 몸 삼각형에 묶어 둔다
// ============================================================================
// MakeHuman 의상(proxy)의 ref_vIdxs·weights·offsets 와 같은 생각이다.
// 옷 정점마다 가장 가까운 몸 삼각형 (a,b,c), 그 위 가장 가까운 점의 무게중심
// 좌표 (wa,wb,wc), 그리고 그 점에서 옷 정점까지의 차이를 삼각형 자체 좌표계
// (모서리 방향 e1 · 면 안 수직 e2 · 법선 n)로 적어 둔다.
// 몸이 같은 정점·면 구성을 유지한 채 모양만 바뀌면(손님 체형) 이 기록을 다시 풀어
// 옷이 그 자리로 따라간다 → applyBinding().
// ============================================================================

export interface GarmentBinding {
  format: "gyeol-bind-v1"
  body: BodyGender
  bodyVerts: number // 이 수가 다른 몸에는 풀 수 없다(구성이 달라서)
  bodyFaces: number
  count: number // 옷 정점 수
  tri: number[] // 정점마다 몸 정점 번호 3개
  w: number[] // 무게중심 3개
  off: number[] // [e1, e2, n] 성분 — 삼각형 크기 비율로 늘고 준다
  size: number[] // 묶을 때 삼각형 크기(√면적) — 풀 때 비율 계산용
}

interface Tri { a: number; b: number; c: number }

function bodyTriangles(body: BodyFigure): Tri[] {
  const t: Tri[] = []
  for (const f of body.obj.faces) for (let k = 1; k + 1 < f.length; k++) t.push({ a: f[0], b: f[k], c: f[k + 1] })
  return t
}

// 점 p 에서 삼각형 abc 위 가장 가까운 점의 무게중심 좌표 (Ericson, Real-Time Collision Detection)
function closestBary(px: number, py: number, pz: number, P: Float32Array, t: Tri): [number, number, number, number] {
  const ax = P[3 * t.a], ay = P[3 * t.a + 1], az = P[3 * t.a + 2]
  const bx = P[3 * t.b], by = P[3 * t.b + 1], bz = P[3 * t.b + 2]
  const cx = P[3 * t.c], cy = P[3 * t.c + 1], cz = P[3 * t.c + 2]
  const abx = bx - ax, aby = by - ay, abz = bz - az
  const acx = cx - ax, acy = cy - ay, acz = cz - az
  const apx = px - ax, apy = py - ay, apz = pz - az
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz
  let u: number, v: number, w: number
  if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0 }
  else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz
    if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0 }
    else {
      const vc = d1 * d4 - d3 * d2
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t1 = d1 / (d1 - d3); u = 1 - t1; v = t1; w = 0 }
      else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz
        if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1 }
        else {
          const vb = d5 * d2 - d1 * d6
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t2 = d2 / (d2 - d6); u = 1 - t2; v = 0; w = t2 }
          else {
            const va = d3 * d6 - d5 * d4
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t3 = (d4 - d3) / (d4 - d3 + (d5 - d6)); u = 0; v = 1 - t3; w = t3 }
            else { const den = 1 / (va + vb + vc); v = vb * den; w = vc * den; u = 1 - v - w }
          }
        }
      }
    }
  }
  const qx = u * ax + v * bx + w * cx, qy = u * ay + v * by + w * cy, qz = u * az + v * bz + w * cz
  const d = (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2
  return [u, v, w, d]
}

// 삼각형 좌표계 — e1(a→b 방향), n(법선), e2 = n × e1, 크기 √면적
function triFrame(P: Float32Array, t: Tri) {
  const ax = P[3 * t.a], ay = P[3 * t.a + 1], az = P[3 * t.a + 2]
  let e1x = P[3 * t.b] - ax, e1y = P[3 * t.b + 1] - ay, e1z = P[3 * t.b + 2] - az
  const fx = P[3 * t.c] - ax, fy = P[3 * t.c + 1] - ay, fz = P[3 * t.c + 2] - az
  let nx = e1y * fz - e1z * fy, ny = e1z * fx - e1x * fz, nz = e1x * fy - e1y * fx
  const nl = Math.hypot(nx, ny, nz) || 1e-12
  const size = Math.sqrt(nl / 2) || 1e-6
  nx /= nl; ny /= nl; nz /= nl
  const el = Math.hypot(e1x, e1y, e1z) || 1e-12
  e1x /= el; e1y /= el; e1z /= el
  const e2x = ny * e1z - nz * e1y, e2y = nz * e1x - nx * e1z, e2z = nx * e1y - ny * e1x
  return { e1: [e1x, e1y, e1z], e2: [e2x, e2y, e2z], n: [nx, ny, nz], size }
}

export function bindGarment(pos: Float32Array, body: BodyFigure): GarmentBinding {
  const P = body.obj.pos
  const tris = bodyTriangles(body)
  // 삼각형 중심 격자
  const cell = body.cell
  const grid = new Map<string, number[]>()
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i]
    const k = key3(
      Math.floor((P[3 * t.a] + P[3 * t.b] + P[3 * t.c]) / 3 / cell),
      Math.floor((P[3 * t.a + 1] + P[3 * t.b + 1] + P[3 * t.c + 1]) / 3 / cell),
      Math.floor((P[3 * t.a + 2] + P[3 * t.b + 2] + P[3 * t.c + 2]) / 3 / cell)
    )
    let arr = grid.get(k)
    if (!arr) grid.set(k, (arr = []))
    arr.push(i)
  }
  const n = pos.length / 3
  const out: GarmentBinding = {
    format: "gyeol-bind-v1", body: body.gender, bodyVerts: P.length / 3, bodyFaces: body.obj.faces.length,
    count: n, tri: new Array(3 * n), w: new Array(3 * n), off: new Array(3 * n), size: new Array(n),
  }
  for (let i = 0; i < n; i++) {
    const px = pos[3 * i], py = pos[3 * i + 1], pz = pos[3 * i + 2]
    const gx = Math.floor(px / cell), gy = Math.floor(py / cell), gz = Math.floor(pz / cell)
    let best = -1, bd = Infinity, bw: [number, number, number] = [1, 0, 0]
    for (let r = 0; r <= 40; r++) {
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
        if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) !== r) continue
        const arr = grid.get(key3(gx + a, gy + b, gz + c))
        if (!arr) continue
        for (const ti of arr) {
          const [u, v, w, d] = closestBary(px, py, pz, P, tris[ti])
          if (d < bd) { bd = d; best = ti; bw = [u, v, w] }
        }
      }
      // 삼각형 중심이 한 칸 넘게 어긋날 수 있어 두 칸 여유를 두고 멈춘다
      if (best >= 0 && Math.sqrt(bd) < (r - 1) * cell) break
    }
    const t = tris[best]
    const fr = triFrame(P, t)
    const qx = bw[0] * P[3 * t.a] + bw[1] * P[3 * t.b] + bw[2] * P[3 * t.c]
    const qy = bw[0] * P[3 * t.a + 1] + bw[1] * P[3 * t.b + 1] + bw[2] * P[3 * t.c + 1]
    const qz = bw[0] * P[3 * t.a + 2] + bw[1] * P[3 * t.b + 2] + bw[2] * P[3 * t.c + 2]
    const rx = px - qx, ry = py - qy, rz = pz - qz
    out.tri[3 * i] = t.a; out.tri[3 * i + 1] = t.b; out.tri[3 * i + 2] = t.c
    out.w[3 * i] = bw[0]; out.w[3 * i + 1] = bw[1]; out.w[3 * i + 2] = bw[2]
    out.off[3 * i] = (rx * fr.e1[0] + ry * fr.e1[1] + rz * fr.e1[2]) / fr.size
    out.off[3 * i + 1] = (rx * fr.e2[0] + ry * fr.e2[1] + rz * fr.e2[2]) / fr.size
    out.off[3 * i + 2] = (rx * fr.n[0] + ry * fr.n[1] + rz * fr.n[2]) / fr.size
    out.size[i] = fr.size
  }
  return out
}

/** 같은 구성(정점·면 수)의 몸 정점 배열에 바인딩을 풀어 옷 정점 위치를 돌려준다. */
export function applyBinding(bind: GarmentBinding, bodyPos: Float32Array, bodyFaceCount?: number): Float32Array {
  if (bodyPos.length / 3 !== bind.bodyVerts || (bodyFaceCount !== undefined && bodyFaceCount !== bind.bodyFaces)) {
    throw new Error("몸 구성이 달라 바인딩을 풀 수 없습니다")
  }
  const out = new Float32Array(3 * bind.count)
  for (let i = 0; i < bind.count; i++) {
    const t = { a: bind.tri[3 * i], b: bind.tri[3 * i + 1], c: bind.tri[3 * i + 2] }
    const [u, v, w] = [bind.w[3 * i], bind.w[3 * i + 1], bind.w[3 * i + 2]]
    const fr = triFrame(bodyPos, t)
    const o1 = bind.off[3 * i] * fr.size, o2 = bind.off[3 * i + 1] * fr.size, o3 = bind.off[3 * i + 2] * fr.size
    for (let k = 0; k < 3; k++) {
      out[3 * i + k] =
        u * bodyPos[3 * t.a + k] + v * bodyPos[3 * t.b + k] + w * bodyPos[3 * t.c + k] +
        o1 * fr.e1[k] + o2 * fr.e2[k] + o3 * fr.n[k]
    }
  }
  return out
}

/** 저장용 — 소수 자릿수를 줄여 크기를 줄인다 */
export function serializeBinding(b: GarmentBinding): string {
  const r = (a: number[], d: number) => a.map((x) => +x.toFixed(d))
  return JSON.stringify({ ...b, w: r(b.w, 5), off: r(b.off, 4), size: r(b.size, 5) })
}
