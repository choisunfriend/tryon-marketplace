"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { useCallback, useEffect, useRef, useState } from "react"
import type { GeoJSONSource, Map as MlMap, MapGeoJSONFeature } from "maplibre-gl"
import { LocateFixed, MapPin, Phone, Clock, Scissors, Search, X, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { listenForAppHello, parentAppOrigin, postToApp } from "@/lib/app-bridge"
import { distanceKm, formatMinor, geocode, MAP_STYLE_URL } from "@/lib/map"

// ============================================================================
// (2026-11-01) 미용실 세계 지도
// ============================================================================
// · 화면에 보이는 범위의 미용실만 /api/salons?bbox= 로 가져와 묶음(cluster) 점으로 표시
// · 점을 누르면 그 미용실의 헤어스타일 목록 → "입어 보기" 를 누르면 GYEOL 앱에
//   { type: "gyeol-style", id, name, salon, spec } 를 보냄 → 앱(js/35-salon-bridge.js)이 3D 머리에 적용
// · 내 위치는 앱 iframe 에 allow="geolocation" 이 있어야 물어볼 수 있음(없으면 검색·드래그로 이동)
// ============================================================================

interface SalonPin {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
  cover_url: string | null
  store_name: string
  style_count: number
}

interface Style {
  id: string
  name: string
  gender: "male" | "female" | "both"
  price_minor: number | null
  currency: string | null
  duration_min: number | null
  thumbnail_url: string | null
  spec: Record<string, unknown> & { color?: string }
}

interface SalonDetail extends SalonPin {
  phone: string | null
  hours: string | null
  booking_url: string | null
  description: string | null
}

const WORLD = { center: [127.0, 30.0] as [number, number], zoom: 1.6 }
const GENDER_LABEL = { male: "남성", female: "여성", both: "공용" }

function toGeoJSON(list: SalonPin[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: list.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: { id: s.id, name: s.name, styles: s.style_count },
    })),
  }
}

export function SalonMap() {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const loadSeq = useRef(0)
  const [salons, setSalons] = useState<SalonPin[]>([])
  const [center, setCenter] = useState({ lat: WORLD.center[1], lng: WORLD.center[0] })
  const [truncated, setTruncated] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ salon: SalonDetail; styles: Style[] } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [query, setQuery] = useState("")
  const [inGyeol, setInGyeol] = useState(false)
  const [tryingId, setTryingId] = useState<string | null>(null)

  // GYEOL 앱 안인지 (Try on 버튼 표시)
  useEffect(() => {
    const update = () => setInGyeol(parentAppOrigin() !== null)
    update()
    const stop = listenForAppHello()
    const t = setTimeout(update, 800)
    // 앱이 적용 결과를 돌려줌: { type: "gyeol-style-result", id, ok, error? }
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window.parent || e.origin !== parentAppOrigin()) return
      const d = e.data as { type?: string; ok?: boolean; error?: string } | null
      if (!d || d.type !== "gyeol-style-result") return
      setTryingId(null)
      if (d.ok) toast.success("GYEOL 에 스타일을 입혔어요")
      else toast.error(d.error || "스타일을 입히지 못했어요")
    }
    window.addEventListener("message", onMsg)
    return () => {
      stop()
      clearTimeout(t)
      window.removeEventListener("message", onMsg)
    }
  }, [])

  const loadVisible = useCallback(async () => {
    const map = mapRef.current
    if (!map) return
    const b = map.getBounds()
    const c = map.getCenter()
    setCenter({ lat: c.lat, lng: c.lng })
    const seq = ++loadSeq.current
    try {
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(",")
      const r = await fetch(`/api/salons?bbox=${bbox}`)
      const d = await r.json()
      if (seq !== loadSeq.current || !d.success) return
      setSalons(d.salons)
      setTruncated(!!d.truncated)
      ;(map.getSource("salons") as GeoJSONSource | undefined)?.setData(toGeoJSON(d.salons))
    } catch {
      /* 네트워크 오류 — 다음 이동 때 다시 */
    }
  }, [])

  const openSalon = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const r = await fetch(`/api/salons/${encodeURIComponent(id)}`)
      const d = await r.json()
      if (!d.success) throw new Error(d.error)
      setSelected({ salon: d.salon, styles: d.styles })
      mapRef.current?.easeTo({ center: [d.salon.lng, d.salon.lat], zoom: Math.max(mapRef.current.getZoom(), 14) })
    } catch {
      toast.error("미용실 정보를 불러오지 못했어요")
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  // 지도 만들기
  useEffect(() => {
    let cancelled = false
    let map: MlMap | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    ;(async () => {
      const maplibregl = (await import("maplibre-gl")).default
      if (cancelled || !boxRef.current) return
      try {
        map = new maplibregl.Map({
          container: boxRef.current,
          style: MAP_STYLE_URL,
          center: WORLD.center,
          zoom: WORLD.zoom,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        })
      } catch {
        setMapError("이 기기에서 지도를 그릴 수 없어요 (WebGL 꺼짐)")
        return
      }
      mapRef.current = map
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
      map.on("error", (e) => console.warn("[지도]", e?.error?.message ?? e))

      map.on("load", () => {
        if (!map) return
        map.addSource("salons", {
          type: "geojson",
          data: toGeoJSON([]),
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 13,
        })
        map.addLayer({
          id: "salon-clusters",
          type: "circle",
          source: "salons",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#c98b52",
            "circle-opacity": 0.9,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
            "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 30],
          },
        })
        map.addLayer({
          id: "salon-cluster-count",
          type: "symbol",
          source: "salons",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Bold"] },
          paint: { "text-color": "#fff" },
        })
        map.addLayer({
          id: "salon-points",
          type: "circle",
          source: "salons",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#1b1816",
            "circle-radius": 11,
            "circle-stroke-color": "#c98b52",
            "circle-stroke-width": 3,
          },
        })
        // 폰에서 손가락으로 누르기 쉽게 — 보이지 않는 큰 원(반지름 26px)을 누르는 자리로 씀
        map.addLayer({
          id: "salon-hit",
          type: "circle",
          source: "salons",
          filter: ["!", ["has", "point_count"]],
          paint: { "circle-radius": 26, "circle-opacity": 0 },
        })
        map.addLayer({
          id: "salon-labels",
          type: "symbol",
          source: "salons",
          filter: ["!", ["has", "point_count"]],
          minzoom: 12,
          layout: {
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-offset": [0, 1.3],
            "text-anchor": "top",
            "text-font": ["Noto Sans Regular"],
          },
          paint: { "text-color": "#1b1816", "text-halo-color": "#fff", "text-halo-width": 1.5 },
        })

        // 누른 자리 둘레 14px 안의 미용실·묶음을 찾음 (손가락이 조금 빗나가도 열림)
        map.on("click", async (e) => {
          if (!map) return
          const r = 14
          const feats = map.queryRenderedFeatures(
            [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]],
            { layers: ["salon-hit", "salon-points", "salon-clusters"] }
          )
          const point = feats.find((f) => f.layer.id !== "salon-clusters" && typeof f.properties?.id === "string")
          if (point) return openSalon(point.properties.id as string)
          const cluster = feats.find((f) => f.layer.id === "salon-clusters")
          if (cluster) {
            const src = map.getSource("salons") as GeoJSONSource
            const zoom = await src.getClusterExpansionZoom(cluster.properties.cluster_id as number)
            map.easeTo({ center: (cluster.geometry as GeoJSON.Point).coordinates as [number, number], zoom })
          }
        })
        for (const layer of ["salon-clusters", "salon-hit"]) {
          map.on("mouseenter", layer, () => map && (map.getCanvas().style.cursor = "pointer"))
          map.on("mouseleave", layer, () => map && (map.getCanvas().style.cursor = ""))
        }
        loadVisible()
      })
      map.on("moveend", () => {
        clearTimeout(timer)
        timer = setTimeout(loadVisible, 250)
      })
    })()
    return () => {
      cancelled = true
      clearTimeout(timer)
      map?.remove()
      mapRef.current = null
    }
  }, [loadVisible, openSalon])

  const locate = useCallback((quiet = false) => {
    if (!("geolocation" in navigator)) {
      if (!quiet) toast.error("이 기기에서는 위치를 쓸 수 없어요")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => mapRef.current?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 13 }),
      () => {
        if (!quiet) toast.error("위치 권한이 없어요 — 위 검색창에 동네 이름을 넣어 보세요")
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    )
  }, [])

  // 이미 허락된 경우에만 조용히 내 위치로 (처음부터 권한 창을 띄우지 않음)
  useEffect(() => {
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions
    perms
      ?.query({ name: "geolocation" as PermissionName })
      .then((s) => s.state === "granted" && setTimeout(() => locate(true), 600))
      .catch(() => {})
  }, [locate])

  async function onSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    try {
      const hit = await geocode(q)
      if (!hit) return toast.error("그 장소를 찾지 못했어요")
      mapRef.current?.flyTo({ center: [hit.lng, hit.lat], zoom: 13 })
    } catch {
      toast.error("검색하지 못했어요")
    }
  }

  function tryOn(style: Style) {
    if (!selected) return
    const sent = postToApp({
      type: "gyeol-style",
      id: style.id,
      name: style.name,
      gender: style.gender,
      salon: { id: selected.salon.id, name: selected.salon.name },
      spec: style.spec,
    })
    if (!sent) {
      toast.error("GYEOL 앱 안에서만 입어 볼 수 있어요")
      return
    }
    setTryingId(style.id)
    toast("GYEOL 에서 스타일을 입히는 중…")
    setTimeout(() => setTryingId((cur) => (cur === style.id ? null : cur)), 15000)
  }

  const nearby = [...salons]
    .map((s) => ({ ...s, km: distanceKm(center, s) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 30)

  return (
    <div className="relative flex h-[calc(100dvh-8rem)] min-h-[480px] flex-col lg:flex-row">
      {/* 지도 */}
      <div className="relative min-h-[55%] flex-1">
        {/* maplibre CSS 가 컨테이너에 position:relative 를 걸어 Tailwind absolute 를 덮으므로 인라인으로 고정 */}
        <div ref={boxRef} style={{ position: "absolute", inset: 0 }} aria-label="미용실 지도" />
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 p-6 text-center text-sm">{mapError}</div>
        )}
        <form onSubmit={onSearch} className="absolute left-3 right-14 top-3 flex gap-2 sm:right-auto sm:w-96">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="도시·동네·주소 검색 (예: 성수동, Shibuya)"
            className="bg-white/95 shadow"
            aria-label="장소 검색"
          />
          <Button type="submit" size="icon" variant="secondary" className="shrink-0 shadow" aria-label="검색">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute bottom-8 right-3 shadow"
          onClick={() => locate(false)}
          aria-label="내 위치"
        >
          <LocateFixed className="h-4 w-4" />
        </Button>
      </div>

      {/* 옆(아래) 패널: 고른 미용실 or 근처 목록 */}
      {/* 폰: 미용실을 고르면 지도 위에 아래서 올라오는 시트로 (앱 안 좁은 창에서 아래 목록이 화면 밖에 있어 안 보이던 문제) */}
      <aside
        className={
          selected || loadingDetail
            ? "absolute inset-x-0 bottom-0 z-20 max-h-[75%] overflow-y-auto rounded-t-xl border-t bg-background shadow-2xl lg:static lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none"
            : "max-h-[45%] w-full overflow-y-auto border-t bg-background lg:max-h-none lg:w-[380px] lg:border-l lg:border-t-0"
        }
      >
        {selected ? (
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{selected.salon.name}</h2>
                <p className="text-xs text-muted-foreground">{selected.salon.store_name}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelected(null)} aria-label="닫기">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {selected.salon.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.salon.cover_url} alt="" className="mb-3 aspect-video w-full rounded-md object-cover" />
            )}
            <ul className="mb-3 space-y-1 text-sm text-muted-foreground">
              {selected.salon.address && (
                <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{selected.salon.address}</li>
              )}
              {selected.salon.hours && (
                <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0" />{selected.salon.hours}</li>
              )}
              {selected.salon.phone && (
                <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0" />{selected.salon.phone}</li>
              )}
            </ul>
            {selected.salon.description && <p className="mb-3 whitespace-pre-line text-sm">{selected.salon.description}</p>}
            {selected.salon.booking_url && (
              <a
                href={selected.salon.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 inline-flex items-center gap-1 text-sm font-medium underline"
              >
                예약하기 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Scissors className="h-4 w-4" /> 헤어스타일 {selected.styles.length}
            </h3>
            {!selected.styles.length && <p className="text-sm text-muted-foreground">아직 올린 스타일이 없어요.</p>}
            <ul className="space-y-2">
              {selected.styles.map((st) => (
                <li key={st.id} className="flex items-center gap-3 rounded-md border p-2">
                  {st.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={st.thumbnail_url} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                  ) : (
                    <span
                      className="h-14 w-14 shrink-0 rounded"
                      style={{ background: typeof st.spec.color === "string" ? st.spec.color : "#6b5a4a" }}
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{st.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="mr-1 px-1 py-0 text-[10px]">{GENDER_LABEL[st.gender]}</Badge>
                      {formatMinor(st.price_minor, st.currency) ?? "가격 문의"}
                      {st.duration_min ? ` · ${st.duration_min}분` : ""}
                    </p>
                  </div>
                  {inGyeol && (
                    <Button size="sm" onClick={() => tryOn(st)} disabled={tryingId === st.id}>
                      {tryingId === st.id ? "입히는 중…" : "입어 보기"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {!inGyeol && selected.styles.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">GYEOL 앱에서 열면 내 얼굴에 바로 입어 볼 수 있어요.</p>
            )}
          </div>
        ) : loadingDetail ? (
          <p className="p-4 text-sm text-muted-foreground">미용실 정보를 불러오는 중…</p>
        ) : (
          <div className="p-4">
            <h2 className="mb-1 text-base font-semibold">이 근처 미용실</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              지도를 움직이면 그 지역 미용실이 나와요{truncated ? " · 너무 많아 일부만 보여요, 확대해 보세요" : ""}
            </p>
            {!nearby.length && <p className="text-sm text-muted-foreground">이 지역엔 아직 등록된 미용실이 없어요.</p>}
            <ul className="divide-y">
              {nearby.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => openSalon(s.id)} className="flex w-full items-center gap-3 py-2 text-left">
                    <Scissors className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.address ?? s.store_name}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {s.km < 1 ? `${Math.round(s.km * 1000)}m` : `${s.km.toFixed(s.km < 10 ? 1 : 0)}km`}
                      <br />
                      스타일 {s.style_count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}
