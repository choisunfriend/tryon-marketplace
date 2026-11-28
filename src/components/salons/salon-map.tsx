"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { GeoJSONSource, Map as MlMap, MapGeoJSONFeature } from "maplibre-gl"
import { LocateFixed, MapPin, Phone, Clock, Scissors, Search, X, ExternalLink, Shirt } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SalonBooking } from "@/components/salons/salon-booking"
import { listenForAppHello, parentAppOrigin, postToApp } from "@/lib/app-bridge"
import { distanceKm, formatMinor, geocode, MAP_STYLE_URL } from "@/lib/map"
import { browserMapView, localizeMapLabels } from "@/lib/browser-locale"
import { useL } from "@/i18n/client"

// ============================================================================
// (2026-11-01) 미용실 세계 지도
// ============================================================================
// · 화면에 보이는 범위의 미용실만 /api/salons?bbox= 로 가져와 묶음(cluster) 점으로 표시
// · 점을 누르면 그 미용실의 헤어스타일 목록 → "입어 보기" 를 누르면 Today's Stylepeek 앱에
//   { type: "gyeol-style", id, name, salon, spec } 를 보냄 → 앱(js/35-salon-bridge.js)이 3D 머리에 적용
// · 내 위치는 앱 iframe 에 allow="geolocation" 이 있어야 물어볼 수 있음(없으면 검색·드래그로 이동)
// (2026-11-22) 옷가게 지점(/api/shops)도 같은 지도에 — 미용실은 갈색 점, 옷가게는 파란 점 · 위쪽 칩으로 걸러 봄
//   옷가게 점 → 메뉴판(그 입점사 상품) → 「입어 보기」는 상품 페이지와 같은 gyeol-wear 메시지 · 「상품 보기」는 /{slug}
//   주소 ?shop=<id> · ?salon=<id> 로 들어오면 그 매장을 바로 엶 (상품 페이지의 작은 지도가 이 주소로 보냄)
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
  color: string | null // 썸네일이 없을 때 견본 색 (스펙은 「입어 보기」 때 따로 받음)
}

interface SalonDetail extends SalonPin {
  phone: string | null
  hours: string | null
  booking_url: string | null
  description: string | null
}

interface ShopPin {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
  cover_url: string | null
  store_name: string
  product_count: number
}

interface ShopDetail extends ShopPin {
  phone: string | null
  hours: string | null
  link_url: string | null
  description: string | null
}

interface MenuItem {
  id: string
  name: string
  slug: string
  price: number | null
  currency: string | null
  image_url: string | null
  model_file: string | null
  gender: string | null
  body_part: string | null
}

type Kind = "all" | "salon" | "shop"
const SALON_LAYERS = ["salon-clusters", "salon-cluster-count", "salon-points", "salon-hit", "salon-labels"]
const SHOP_LAYERS = ["shop-clusters", "shop-cluster-count", "shop-points", "shop-hit", "shop-labels"]

const WORLD = { center: [127.0, 30.0] as [number, number], zoom: 1.6 }
const GENDER_LABEL = {
  male: { ko: "남성", en: "Men" },
  female: { ko: "여성", en: "Women" },
  both: { ko: "공용", en: "Unisex" },
}

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

function shopsGeoJSON(list: ShopPin[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: list.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: { id: s.id, name: s.name, products: s.product_count },
    })),
  }
}

// 같은 모양의 점 묶음(미용실·옷가게) 레이어 한 벌 — 색과 이름 앞머리만 다름
function addPinLayers(map: MlMap, src: string, prefix: string, color: string) {
  map.addLayer({
    id: `${prefix}-clusters`,
    type: "circle",
    source: src,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": color,
      "circle-opacity": 0.9,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
      "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 30],
    },
  })
  map.addLayer({
    id: `${prefix}-cluster-count`,
    type: "symbol",
    source: src,
    filter: ["has", "point_count"],
    layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Bold"] },
    paint: { "text-color": "#fff" },
  })
  map.addLayer({
    id: `${prefix}-points`,
    type: "circle",
    source: src,
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-color": "#1b1816", "circle-radius": 11, "circle-stroke-color": color, "circle-stroke-width": 3 },
  })
  // 폰에서 손가락으로 누르기 쉽게 — 보이지 않는 큰 원(반지름 26px)을 누르는 자리로 씀
  map.addLayer({
    id: `${prefix}-hit`,
    type: "circle",
    source: src,
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-radius": 26, "circle-opacity": 0 },
  })
  map.addLayer({
    id: `${prefix}-labels`,
    type: "symbol",
    source: src,
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
}

const SHOP_COLOR = "#4a74a8"

export function SalonMap() {
  const { L, lang } = useL()
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
  const [shops, setShops] = useState<ShopPin[]>([])
  const [shopSel, setShopSel] = useState<{ shop: ShopDetail; products: MenuItem[] } | null>(null)
  const [kind, setKind] = useState<Kind>("all")

  // Today's Stylepeek 앱 안인지 (Try on 버튼 표시)
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
      if (d.ok) toast.success(L("Today's Stylepeek 에 스타일을 입혔어요", "Style applied in Today's Stylepeek"))
      else toast.error(d.error || L("스타일을 입히지 못했어요", "Couldn't apply the style"))
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
      const [d, ds] = await Promise.all([
        fetch(`/api/salons?bbox=${bbox}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/shops?bbox=${bbox}`).then((r) => r.json()).catch(() => null),
      ])
      if (seq !== loadSeq.current) return
      if (d?.success) {
        setSalons(d.salons)
        ;(map.getSource("salons") as GeoJSONSource | undefined)?.setData(toGeoJSON(d.salons))
      }
      if (ds?.success) {
        setShops(ds.shops)
        ;(map.getSource("shops") as GeoJSONSource | undefined)?.setData(shopsGeoJSON(ds.shops))
      }
      setTruncated(!!(d?.truncated || ds?.truncated))
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
      setShopSel(null)
      setSelected({ salon: d.salon, styles: d.styles })
      mapRef.current?.easeTo({ center: [d.salon.lng, d.salon.lat], zoom: Math.max(mapRef.current.getZoom(), 14) })
    } catch {
      toast.error(L("미용실 정보를 불러오지 못했어요", "Couldn't load salon info"))
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const openShop = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const r = await fetch(`/api/shops/${encodeURIComponent(id)}`)
      const d = await r.json()
      if (!d.success) throw new Error(d.error)
      setSelected(null)
      setShopSel({ shop: d.shop, products: d.products })
      mapRef.current?.easeTo({ center: [d.shop.lng, d.shop.lat], zoom: Math.max(mapRef.current.getZoom(), 14) })
    } catch {
      toast.error(L("매장 정보를 불러오지 못했어요", "Couldn't load shop info"))
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  // 칩(전체·미용실·옷가게)에 맞춰 점 레이어를 켜고 끔
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const vis = (on: boolean) => (on ? "visible" : "none")
    for (const id of SALON_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis(kind !== "shop"))
    for (const id of SHOP_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis(kind !== "salon"))
  }, [kind])

  // 지도 만들기
  useEffect(() => {
    let cancelled = false
    let map: MlMap | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    ;(async () => {
      const maplibregl = await import("maplibre-gl")
      // (2026-11-15) MapLibre v6 는 지도 계산 파일(worker)을 자기 옆에서 찾는데, 빌드가 이름을 바꿔 못 찾음
      //   → public/maplibre/ 에 복사해 둔 것을 쓰게 함 (package.json 의 prebuild 가 버전에 맞춰 복사)
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")
      if (cancelled || !boxRef.current) return
      try {
        map = new maplibregl.Map({
          container: boxRef.current,
          style: MAP_STYLE_URL,
          // (2026-11-14) 브라우저 지역(ko-KR → 한국 등)에서 시작 — 모르는 지역이면 세계 지도
          center: browserMapView()?.center ?? WORLD.center,
          zoom: browserMapView()?.zoom ?? WORLD.zoom,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        })
      } catch {
        setMapError(L("이 기기에서 지도를 그릴 수 없어요 (WebGL 꺼짐)", "This device can't draw the map (WebGL is off)"))
        return
      }
      mapRef.current = map
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
      map.on("error", (e) => console.warn("[지도]", e?.error?.message ?? e))

      map.on("load", () => {
        if (!map) return
        localizeMapLabels(map, lang) // (2026-11-14) 지명을 화면 언어로 (지도 타일 글자는 따로 바꿔야 함)
        map.addSource("salons", {
          type: "geojson",
          data: toGeoJSON([]),
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 13,
        })
        addPinLayers(map, "salons", "salon", "#c98b52")
        map.addSource("shops", {
          type: "geojson",
          data: shopsGeoJSON([]),
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 13,
        })
        addPinLayers(map, "shops", "shop", SHOP_COLOR)

        // 누른 자리 둘레 14px 안의 미용실·묶음을 찾음 (손가락이 조금 빗나가도 열림)
        map.on("click", async (e) => {
          if (!map) return
          const r = 14
          const feats = map.queryRenderedFeatures(
            [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]],
            { layers: ["salon-hit", "salon-points", "salon-clusters", "shop-hit", "shop-points", "shop-clusters"].filter((id) => map?.getLayoutProperty(id, "visibility") !== "none") }
          )
          const point = feats.find((f) => !f.layer.id.endsWith("-clusters") && typeof f.properties?.id === "string")
          if (point) return point.layer.id.startsWith("shop") ? openShop(point.properties.id as string) : openSalon(point.properties.id as string)
          const cluster = feats.find((f) => f.layer.id.endsWith("-clusters"))
          if (cluster) {
            const src = map.getSource(cluster.layer.id.startsWith("shop") ? "shops" : "salons") as GeoJSONSource
            const zoom = await src.getClusterExpansionZoom(cluster.properties.cluster_id as number)
            map.easeTo({ center: (cluster.geometry as GeoJSON.Point).coordinates as [number, number], zoom })
          }
        })
        for (const layer of ["salon-clusters", "salon-hit", "shop-clusters", "shop-hit"]) {
          map.on("mouseenter", layer, () => map && (map.getCanvas().style.cursor = "pointer"))
          map.on("mouseleave", layer, () => map && (map.getCanvas().style.cursor = ""))
        }
        loadVisible()
        // 주소에 ?shop= · ?salon= 가 있으면 그 매장을 바로 엶 (상품 페이지 작은 지도에서 온 경우)
        try {
          const q = new URLSearchParams(window.location.search)
          const sh = q.get("shop")
          const sa = q.get("salon")
          if (sh) {
            setKind("all")
            void openShop(sh)
          } else if (sa) void openSalon(sa)
        } catch {
          /* 주소 못 읽음 — 그냥 지도만 */
        }
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
  }, [loadVisible, openSalon, openShop])

  const locate = useCallback((quiet = false) => {
    if (!("geolocation" in navigator)) {
      if (!quiet) toast.error(L("이 기기에서는 위치를 쓸 수 없어요", "Location isn't available on this device"))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => mapRef.current?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 13 }),
      () => {
        if (!quiet) toast.error(L("위치 권한이 없어요 — 위 검색창에 동네 이름을 넣어 보세요", "No location permission — try typing a neighborhood in the search box above"))
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
      if (!hit) return toast.error(L("그 장소를 찾지 못했어요", "Couldn't find that place"))
      mapRef.current?.flyTo({ center: [hit.lng, hit.lat], zoom: 13 })
    } catch {
      toast.error(L("검색하지 못했어요", "Search failed"))
    }
  }

  // 「입어 보기」: 이 스타일 하나의 스펙만 저장소에서 받아 앱에 넘김 (미용실 화면은 이름·가격·썸네일만)
  async function tryOn(style: Style) {
    if (!selected) return
    if (parentAppOrigin() === null) {
      toast.error(L("Today's Stylepeek 앱 안에서만 입어 볼 수 있어요", "You can only try it on inside the Today's Stylepeek app"))
      return
    }
    setTryingId(style.id)
    let spec: Record<string, unknown>
    try {
      const r = await fetch(`/api/salons/styles/${encodeURIComponent(style.id)}`)
      const d = await r.json()
      if (!d.success) throw new Error(d.error)
      spec = d.style.spec
    } catch {
      setTryingId(null)
      toast.error(L("스타일을 불러오지 못했어요", "Couldn't load the style"))
      return
    }
    const sent = postToApp({
      type: "gyeol-style",
      id: style.id,
      name: style.name,
      gender: style.gender,
      salon: { id: selected.salon.id, name: selected.salon.name },
      spec,
    })
    if (!sent) {
      setTryingId(null)
      toast.error(L("Today's Stylepeek 앱 안에서만 입어 볼 수 있어요", "You can only try it on inside the Today's Stylepeek app"))
      return
    }
    toast(L("Today's Stylepeek 에서 스타일을 입히는 중…", "Applying the style in Today's Stylepeek…"))
    setTimeout(() => setTryingId((cur) => (cur === style.id ? null : cur)), 15000)
  }


  // 옷 「입어 보기」: 상품 페이지(product-detail-view)와 같은 gyeol-wear 메시지 — 앱 어댑터(_fromMarketplace)가 읽는 모양
  function wear(p: MenuItem) {
    if (!p.model_file) return
    const sent = postToApp({
      type: "gyeol-wear",
      id: p.id,
      item: {
        id: p.id,
        name: p.name,
        gender: p.gender,
        price: p.price,
        currency: p.currency,
        status: "active",
        media: { model_file: new URL(p.model_file, window.location.origin).href },
        avatar: { gender: p.gender, body_part: p.body_part },
      },
    })
    if (sent) toast.success(L("Today's Stylepeek에서 입혀 보는 중…", "Trying it on in Today's Stylepeek…"))
    else toast.error(L("Today's Stylepeek 앱 안에서만 입어 볼 수 있어요", "You can only try it on inside the Today's Stylepeek app"))
  }

  type NearItem = { kind: "salon" | "shop"; id: string; name: string; sub: string; count: number; km: number }
  const nearby: NearItem[] = [
    ...(kind !== "shop" ? salons.map((s) => ({ kind: "salon" as const, id: s.id, name: s.name, sub: s.address ?? s.store_name, count: s.style_count, km: distanceKm(center, s) })) : []),
    ...(kind !== "salon" ? shops.map((s) => ({ kind: "shop" as const, id: s.id, name: s.name, sub: s.address ?? s.store_name, count: s.product_count, km: distanceKm(center, s) })) : []),
  ]
    .sort((a, b) => a.km - b.km)
    .slice(0, 30)
  const chip = (k: Kind, label: string) => (
    <button
      type="button"
      onClick={() => setKind(k)}
      className={`rounded-full border px-3 py-1 text-xs shadow ${kind === k ? "bg-black text-white" : "bg-white/95"}`}
    >
      {label}
    </button>
  )

  return (
    <div className="relative flex h-[calc(100dvh-8rem)] min-h-[480px] flex-col lg:flex-row">
      {/* 지도 */}
      <div className="relative min-h-[55%] flex-1">
        {/* maplibre CSS 가 컨테이너에 position:relative 를 걸어 Tailwind absolute 를 덮으므로 인라인으로 고정 */}
        <div ref={boxRef} style={{ position: "absolute", inset: 0 }} aria-label={L("미용실 지도", "Salon map")} />
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 p-6 text-center text-sm">{mapError}</div>
        )}
        <form onSubmit={onSearch} className="absolute left-3 right-14 top-3 flex gap-2 sm:right-auto sm:w-96">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={L("도시·동네·주소 검색 (예: 성수동, Shibuya)", "Search a city, neighborhood or address (e.g. Seongsu, Shibuya)")}
            className="bg-white/95 shadow"
            aria-label={L("장소 검색", "Search places")}
          />
          <Button type="submit" size="icon" variant="secondary" className="shrink-0 shadow" aria-label={L("검색", "Search")}>
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <div className="absolute left-3 top-14 flex gap-1.5">
          {chip("all", L("전체", "All"))}
          {chip("salon", L("미용실", "Salons"))}
          {chip("shop", L("옷가게", "Clothing"))}
        </div>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute bottom-8 right-3 shadow"
          onClick={() => locate(false)}
          aria-label={L("내 위치", "My location")}
        >
          <LocateFixed className="h-4 w-4" />
        </Button>
      </div>

      {/* 옆(아래) 패널: 고른 미용실 or 근처 목록 */}
      {/* 폰: 미용실을 고르면 지도 위에 아래서 올라오는 시트로 (앱 안 좁은 창에서 아래 목록이 화면 밖에 있어 안 보이던 문제) */}
      <aside
        className={
          selected || shopSel || loadingDetail
            ? "absolute inset-x-0 bottom-0 z-20 max-h-[75%] overflow-y-auto rounded-t-xl border-t bg-background shadow-2xl lg:static lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none"
            : "max-h-[45%] w-full overflow-y-auto border-t bg-background lg:max-h-none lg:w-[380px] lg:border-l lg:border-t-0"
        }
      >
        {shopSel ? (
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{shopSel.shop.name}</h2>
                <p className="text-xs text-muted-foreground">{shopSel.shop.store_name}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setShopSel(null)} aria-label={L("닫기", "Close")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {shopSel.shop.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shopSel.shop.cover_url} alt="" className="mb-3 aspect-video w-full rounded-md object-cover" />
            )}
            <ul className="mb-3 space-y-1 text-sm text-muted-foreground">
              {shopSel.shop.address && (
                <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{shopSel.shop.address}</li>
              )}
              {shopSel.shop.hours && (
                <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0" />{shopSel.shop.hours}</li>
              )}
              {shopSel.shop.phone && (
                <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0" />{shopSel.shop.phone}</li>
              )}
            </ul>
            {shopSel.shop.description && <p className="mb-3 whitespace-pre-line text-sm">{shopSel.shop.description}</p>}
            {shopSel.shop.link_url && (
              <a href={shopSel.shop.link_url} target="_blank" rel="noopener noreferrer" className="mb-4 inline-flex items-center gap-1 text-sm font-medium underline">
                {L("매장 안내", "Shop info")} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Shirt className="h-4 w-4" /> {L("이 매장 옷", "Clothes here")} {shopSel.products.length}
            </h3>
            {!shopSel.products.length && <p className="text-sm text-muted-foreground">{L("아직 올린 상품이 없어요.", "No products posted yet.")}</p>}
            <ul className="space-y-2">
              {shopSel.products.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-md border p-2">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-neutral-100" aria-hidden>
                      <Shirt className="h-5 w-5 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/${p.slug}`} className="block truncate text-sm font-medium hover:underline">{p.name}</Link>
                    <p className="text-xs text-muted-foreground">
                      {p.price != null ? new Intl.NumberFormat(undefined, { style: "currency", currency: p.currency || "USD" }).format(p.price) : L("가격 문의", "Price on request")}
                    </p>
                  </div>
                  {inGyeol && p.model_file && /\.obj(\?|#|$)/i.test(p.model_file) ? (
                    <Button size="sm" onClick={() => wear(p)}>{L("입어 보기", "Try it on")}</Button>
                  ) : (
                    <Link href={`/${p.slug}`} className="shrink-0 text-xs underline">{L("상품 보기", "View")}</Link>
                  )}
                </li>
              ))}
            </ul>
            {!inGyeol && shopSel.products.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">{L("Today's Stylepeek 앱에서 열면 내 몸에 바로 입어 볼 수 있어요.", "Open this in the Today's Stylepeek app to try it on your own body.")}</p>
            )}
          </div>
        ) : selected ? (
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{selected.salon.name}</h2>
                <p className="text-xs text-muted-foreground">{selected.salon.store_name}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelected(null)} aria-label={L("닫기", "Close")}>
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
                {L("미용실 예약 페이지", "Salon booking page")} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            <SalonBooking salonId={selected.salon.id} salonName={selected.salon.name} styles={selected.styles} />

            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Scissors className="h-4 w-4" /> {L("헤어스타일", "Hairstyles")} {selected.styles.length}
            </h3>
            {!selected.styles.length && <p className="text-sm text-muted-foreground">{L("아직 올린 스타일이 없어요.", "No styles posted yet.")}</p>}
            <ul className="space-y-2">
              {selected.styles.map((st) => (
                <li key={st.id} className="flex items-center gap-3 rounded-md border p-2">
                  {st.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={st.thumbnail_url} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                  ) : (
                    <span
                      className="h-14 w-14 shrink-0 rounded"
                      style={{ background: st.color && /^#[0-9A-Fa-f]{6}$/.test(st.color) ? st.color : "#6b5a4a" }}
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{st.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="mr-1 px-1 py-0 text-[10px]">{L(GENDER_LABEL[st.gender].ko, GENDER_LABEL[st.gender].en)}</Badge>
                      {formatMinor(st.price_minor, st.currency) ?? L("가격 문의", "Price on request")}
                      {st.duration_min ? L(` · ${st.duration_min}분`, ` · ${st.duration_min} min`) : ""}
                    </p>
                  </div>
                  {inGyeol && (
                    <Button size="sm" onClick={() => void tryOn(st)} disabled={tryingId === st.id}>
                      {tryingId === st.id ? L("입히는 중…", "Applying…") : L("입어 보기", "Try it on")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {!inGyeol && selected.styles.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">{L("Today's Stylepeek 앱에서 열면 내 얼굴에 바로 입어 볼 수 있어요.", "Open this in the Today's Stylepeek app to try it on your own face.")}</p>
            )}
          </div>
        ) : loadingDetail ? (
          <p className="p-4 text-sm text-muted-foreground">{L("매장 정보를 불러오는 중…", "Loading info…")}</p>
        ) : (
          <div className="p-4">
            <h2 className="mb-1 text-base font-semibold">
              {kind === "shop" ? L("이 근처 옷가게", "Clothing shops nearby") : kind === "salon" ? L("이 근처 미용실", "Salons nearby") : L("이 근처 매장", "Places nearby")}
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {L("지도를 움직이면 그 지역 매장이 나와요", "Move the map to see places in that area")}
              {truncated ? L(" · 너무 많아 일부만 보여요, 확대해 보세요", " · too many to show them all — zoom in") : ""}
            </p>
            {!nearby.length && <p className="text-sm text-muted-foreground">{L("이 지역엔 아직 등록된 매장이 없어요.", "Nothing registered in this area yet.")}</p>}
            <ul className="divide-y">
              {nearby.map((s) => (
                <li key={`${s.kind}-${s.id}`}>
                  <button type="button" onClick={() => (s.kind === "shop" ? openShop(s.id) : openSalon(s.id))} className="flex w-full items-center gap-3 py-2 text-left">
                    {s.kind === "shop" ? (
                      <Shirt className="h-4 w-4 shrink-0" style={{ color: SHOP_COLOR }} />
                    ) : (
                      <Scissors className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.sub}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {s.km < 1 ? `${Math.round(s.km * 1000)}m` : `${s.km.toFixed(s.km < 10 ? 1 : 0)}km`}
                      <br />
                      {s.kind === "shop" ? L("상품", "Items") : L("스타일", "Styles")} {s.count}
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
