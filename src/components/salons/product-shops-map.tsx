"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { Map as MlMap } from "maplibre-gl"
import { MapPin } from "lucide-react"
import { MAP_STYLE_URL } from "@/lib/map"
import { localizeMapLabels } from "@/lib/browser-locale"
import { useL } from "@/i18n/client"

// ============================================================================
// (2026-11-22) 상품 페이지의 작은 지도 — 이 상품을 파는 오프라인 매장(옷가게 지점)
//   /api/shops?product=<id> 로 그 상품 입점사의 매장들을 받아 점으로 표시.
//   지도(또는 매장 이름)를 누르면 큰 지도 /salons?shop=<id> 로 — 큰 지도가 그 매장 메뉴판을 바로 엶.
//   매장이 없으면 아무것도 그리지 않음.
// ============================================================================

interface ShopPin {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
}

export function ProductShopsMap({ productId }: { productId: string }) {
  const { L, lang } = useL()
  const boxRef = useRef<HTMLDivElement>(null)
  const [shops, setShops] = useState<ShopPin[]>([])
  const [mapOk, setMapOk] = useState(true)

  useEffect(() => {
    let alive = true
    fetch(`/api/shops?product=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((d) => alive && d?.success && setShops(d.shops ?? []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [productId])

  useEffect(() => {
    if (!shops.length) return
    let map: MlMap | null = null
    let cancelled = false
    ;(async () => {
      const maplibregl = await import("maplibre-gl")
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs") // salon-map.tsx 와 같은 이유
      if (cancelled || !boxRef.current) return
      try {
        map = new maplibregl.Map({
          container: boxRef.current,
          style: MAP_STYLE_URL,
          center: [shops[0].lng, shops[0].lat],
          zoom: 13,
          interactive: false, // 작은 지도는 보기만 — 누르면 큰 지도로
          attributionControl: { compact: true },
        })
      } catch {
        setMapOk(false)
        return
      }
      map.on("load", () => {
        if (!map) return
        localizeMapLabels(map, lang)
        for (const s of shops) {
          const el = document.createElement("span")
          el.style.cssText = "display:block;width:16px;height:16px;border-radius:50%;background:#1b1816;border:3px solid #4a74a8;box-shadow:0 1px 3px rgba(0,0,0,.3)"
          new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map)
        }
        if (shops.length > 1) {
          const b = new maplibregl.LngLatBounds()
          for (const s of shops) b.extend([s.lng, s.lat])
          map.fitBounds(b, { padding: 30, maxZoom: 14, duration: 0 })
        }
      })
    })()
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [shops, lang])

  if (!shops.length) return null
  const big = (id: string) => `/salons?shop=${encodeURIComponent(id)}`

  return (
    <section className="mt-6 rounded-lg border p-3">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <MapPin className="h-4 w-4" /> {L("매장에서 보기", "See it in store")} {shops.length}
      </h3>
      {mapOk && (
        <Link href={big(shops[0].id)} className="relative block h-40 overflow-hidden rounded-md" aria-label={L("큰 지도에서 보기", "Open the big map")}>
          <div ref={boxRef} style={{ position: "absolute", inset: 0 }} />
          <span className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-0.5 text-xs shadow">{L("큰 지도 열기", "Open map")}</span>
        </Link>
      )}
      <ul className="mt-2 space-y-1 text-sm">
        {shops.slice(0, 5).map((s) => (
          <li key={s.id}>
            <Link href={big(s.id)} className="hover:underline">
              <span className="font-medium">{s.name}</span>
              {s.address && <span className="text-muted-foreground"> · {s.address}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
