import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import { SalonMap } from "@/components/salons/salon-map"
import { TranslateGuard } from "@/components/translate-guard"

// (2026-11-01) 미용실 세계 지도 — 위치 기반으로 미용실을 찾고, 그 미용실의 헤어스타일을 GYEOL 에서 3D 로 입어 봄
export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("미용실", "Salons"),
    description: L("가까운 미용실을 찾고 그 미용실의 헤어스타일을 3D로 입어 보세요.", "Find salons near you and try their hairstyles in 3D."),
  }
}

export default function SalonsPage() {
  // (2026-11-14) 지도 화면 글자는 사이트 언어(EN/한국어)를 따름 — src/i18n
  return (
    <>
      <TranslateGuard />
      <SalonMap />
    </>
  )
}
