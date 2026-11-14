"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

// 구운 옷 + 표준 몸 미리보기 — 드래그로 돌리고 휠로 확대
// positions: Float32Array(xyz…) · faces: 다각형 정점 번호 (0-based)

export interface MeshData {
  pos: Float32Array
  faces: number[][]
}

function toGeometry(m: MeshData): THREE.BufferGeometry {
  const idx: number[] = []
  for (const f of m.faces) for (let k = 1; k + 1 < f.length; k++) idx.push(f[0], f[k], f[k + 1])
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(m.pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export function BakePreview({
  body,
  garment,
  height = 520,
}: {
  body: MeshData | null
  garment: MeshData | null
  height?: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    pivot: THREE.Group
    bodyMesh?: THREE.Mesh
    garMesh?: THREE.Mesh
    raf: number
    dist: number
  } | null>(null)

  // 장면 한 번 만들기
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setSize(host.clientWidth, height)
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.6))
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(4, 8, 10)
    scene.add(key)
    const camera = new THREE.PerspectiveCamera(30, host.clientWidth / height, 0.1, 500)
    const pivot = new THREE.Group()
    scene.add(pivot)

    const st = { renderer, scene, camera, pivot, raf: 0, dist: 34 }
    stateRef.current = st

    let dragging = false, lx = 0, ly = 0
    const el = renderer.domElement
    el.style.touchAction = "none"
    el.style.cursor = "grab"
    const down = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      pivot.rotation.y += (e.clientX - lx) * 0.01
      pivot.rotation.x = Math.max(-0.8, Math.min(0.8, pivot.rotation.x + (e.clientY - ly) * 0.005))
      lx = e.clientX; ly = e.clientY
    }
    const up = () => { dragging = false }
    const wheel = (e: WheelEvent) => { e.preventDefault(); st.dist = Math.max(8, Math.min(80, st.dist * (e.deltaY > 0 ? 1.1 : 0.9))) }
    el.addEventListener("pointerdown", down)
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("wheel", wheel, { passive: false })

    const onResize = () => {
      renderer.setSize(host.clientWidth, height)
      camera.aspect = host.clientWidth / height
      camera.updateProjectionMatrix()
    }
    window.addEventListener("resize", onResize)

    const tick = () => {
      camera.position.set(0, 0, st.dist)
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      st.raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener("resize", onResize)
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("wheel", wheel)
      renderer.dispose()
      host.removeChild(el)
      stateRef.current = null
    }
  }, [height])

  // 몸
  useEffect(() => {
    const st = stateRef.current
    if (!st) return
    if (st.bodyMesh) { st.pivot.remove(st.bodyMesh); st.bodyMesh.geometry.dispose() }
    st.bodyMesh = undefined
    if (!body) return
    const g = toGeometry(body)
    g.computeBoundingBox()
    const c = new THREE.Vector3()
    g.boundingBox!.getCenter(c)
    st.pivot.position.set(0, 0, 0)
    st.pivot.userData.center = c
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc2a489, roughness: 0.85 }))
    m.position.set(-c.x, -c.y, -c.z)
    st.pivot.add(m)
    st.bodyMesh = m
    if (st.garMesh) st.garMesh.position.copy(m.position)
  }, [body])

  // 옷
  useEffect(() => {
    const st = stateRef.current
    if (!st) return
    if (st.garMesh) { st.pivot.remove(st.garMesh); st.garMesh.geometry.dispose() }
    st.garMesh = undefined
    if (!garment) return
    const g = toGeometry(garment)
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color: 0x4f6b8a, roughness: 0.7, side: THREE.DoubleSide })
    )
    const c = st.pivot.userData.center as THREE.Vector3 | undefined
    if (c) m.position.set(-c.x, -c.y, -c.z)
    st.pivot.add(m)
    st.garMesh = m
  }, [garment])

  return <div ref={hostRef} style={{ width: "100%", height }} className="rounded-lg bg-gradient-to-b from-neutral-100 to-neutral-300" />
}
