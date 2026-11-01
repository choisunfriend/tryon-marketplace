"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { useEffect, useRef } from "react"
import type { Map as MlMap, Marker } from "maplibre-gl"
import { MAP_STYLE_URL } from "@/lib/map"

// (2026-11-01) 관리자용 위치 고르기 — 지도를 누르거나 핀을 끌어 위도·경도를 정함
export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null
  lng: number | null
  onChange: (p: { lat: number; lng: number }) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const changeRef = useRef(onChange)
  changeRef.current = onChange

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const maplibregl = (await import("maplibre-gl")).default
      if (cancelled || !boxRef.current) return
      const has = lat != null && lng != null
      const map = new maplibregl.Map({
        container: boxRef.current,
        style: MAP_STYLE_URL,
        center: has ? [lng!, lat!] : [127.0, 37.55],
        zoom: has ? 15 : 10,
        attributionControl: { compact: true },
      })
      mapRef.current = map
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
      const marker = new maplibregl.Marker({ color: "#c98b52", draggable: true })
      markerRef.current = marker
      if (has) marker.setLngLat([lng!, lat!]).addTo(map)
      const set = (p: { lng: number; lat: number }) => {
        marker.setLngLat(p).addTo(map)
        changeRef.current({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 })
      }
      map.on("click", (e) => set(e.lngLat))
      marker.on("dragend", () => set(marker.getLngLat()))
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // 지도는 한 번만 만들고, 바깥 값 변화는 아래 effect 가 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 주소 검색 등으로 바깥에서 좌표가 바뀌면 핀·화면 이동
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker || lat == null || lng == null) return
    const cur = marker.getLngLat?.()
    if (cur && Math.abs(cur.lat - lat) < 1e-7 && Math.abs(cur.lng - lng) < 1e-7) return
    marker.setLngLat([lng, lat]).addTo(map)
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15) })
  }, [lat, lng])

  return <div ref={boxRef} className="h-72 w-full overflow-hidden rounded-md border" aria-label="위치 고르기 지도" />
}
