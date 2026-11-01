import type { Metadata } from "next"
import { SalonMap } from "@/components/salons/salon-map"

// (2026-11-01) 미용실 세계 지도 — 위치 기반으로 미용실을 찾고, 그 미용실의 헤어스타일을 GYEOL 에서 3D 로 입어 봄
export const metadata: Metadata = {
  title: "Salons",
  description: "Find salons near you and try their hairstyles in 3D.",
}

export default function SalonsPage() {
  return <SalonMap />
}
