import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import Link from "next/link"
import { useL } from "@/i18n/use-l"
import { BIZ } from "@/lib/policy-text"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("소개", "About"),
    description: L("Today's Stylepeek 소개", "About Today's Stylepeek"),
  }
}

export default function AboutPage() {
  const { L } = useL()
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Today&apos;s Stylepeek</h1>
      <div className="mt-8 space-y-6 text-muted-foreground">
        <p>
          {L(
            "Today's Stylepeek은 사진 몇 장으로 내 두상을 3D로 만들고, 헤어스타일과 옷을 입혀 돌려 보며 확인하는 서비스입니다. 마음에 드는 스타일을 하는 미용실을 지도에서 찾아 바로 예약하고, 어울리는 옷도 둘러볼 수 있어요.",
            "Today's Stylepeek turns a few photos into a 3D model of your head so you can try on hairstyles and outfits and see them from every side. Find a salon that does the style on the map, book it right away, and browse outfits that go with it."
          )}
        </p>
        <p>
          {L(
            "사진과 얼굴 분석은 기기 안에서만 처리되고 서버로 보내지지 않습니다.",
            "Photos and face analysis are processed only on your device and are never uploaded."
          )}
        </p>

        <h2 className="!mt-12 text-xl font-semibold text-foreground">{L("할 수 있는 것", "What you can do")}</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>{L("내 3D 두상에 헤어스타일·컬러 입혀 보기", "Try hairstyles and hair colors on your 3D head")}</li>
          <li>{L("미용실 찾기와 예약(예약금 없음)", "Find salons and book (no deposit)")}</li>
          <li>{L("입점 판매자의 옷을 3D로 입어 보기", "Try on outfits from listed sellers in 3D")}</li>
        </ul>

        <h2 className="!mt-12 text-xl font-semibold text-foreground">{L("문의", "Contact")}</h2>
        <p>
          <Link href="/contact" className="underline hover:text-foreground">{L("문의하기", "Get in touch")}</Link>
        </p>
        <p className="text-xs">{L(...BIZ)}</p>
      </div>
    </div>
  )
}
