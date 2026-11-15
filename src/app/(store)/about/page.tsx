import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import Link from "next/link"
import { useL } from "@/i18n/use-l"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("소개", "About"),
    description:
      L("Next.js Ecommerce Starter 템플릿과 이를 만든 Epic Design Labs를 소개합니다.", "Learn about the Next.js Ecommerce Starter template and Epic Design Labs, the team behind it."),
  }
}

export default function AboutPage() {
  const { L } = useL()
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{L("이 템플릿 소개", "About This Starter")}</h1>
      <div className="mt-8 space-y-6 text-muted-foreground">
        <p>
          {L("Next.js Ecommerce Starter는 개발자와 사업자가 현대적인 온라인 상점을 바로 운영 수준으로 만들 수 있게 해 주는 무료 오픈소스 템플릿입니다. Next.js, Tailwind CSS, shadcn/ui로 만들었고, 어떤 결제 시스템과도 연결할 수 있게 설계했습니다.", "The Next.js Ecommerce Starter is a free, open-source template designed to give developers and businesses a production-ready foundation for building modern online stores. It's built with Next.js, Tailwind CSS, and shadcn/ui — and it's designed to connect to any checkout or payment system.")}
        </p>
        <p>
          {L("깔끔한 출발점이 필요한 개발자든, 맞춤 상점이 필요한 사업자든 이 템플릿이 기본을 갖춰 드립니다: 상품 목록, 장바구니, 결제, 검색, 로그인, 찜 목록 등 — 모두 접근성, 검색 엔진 최적화, 성능을 생각해 만들었습니다.", "Whether you're a developer looking for a clean starting point or a business that needs a custom storefront, this template covers the essentials: product catalog, cart, checkout, search, authentication, wishlist, and more — all built with accessibility, SEO, and performance in mind.")}
        </p>

        <h2 className="!mt-12 text-xl font-semibold text-foreground">
          {L("Epic Design Labs가 만들었습니다", "Built by Epic Design Labs")}
        </h2>
        <p>
          {L("이 템플릿은 ", "This starter was created by")}{" "}
          <a
            href="https://epicdesignlabs.com"
            target="_blank"
            rel="noopener"
            className="underline hover:text-foreground"
          >
            Epic Design Labs
          </a>
          {L("가 만들었습니다. 기업이 성과 좋은 온라인 쇼핑 경험을 만들도록 돕는 디자인·개발 스튜디오로, 크고 작은 브랜드와 함께 매출로 이어지는 온라인 상점을 디자인하고 개발하고 다듬습니다.", ", a design and development studio that helps businesses build high-performing ecommerce experiences. We work with brands of all sizes to design, develop, and optimize online stores that convert.")}
        </p>

        <h2 className="!mt-12 text-xl font-semibold text-foreground">
          {L("들어 있는 것", "What's Included")}
        </h2>
        <ul className="list-inside list-disc space-y-2">
          <li>{L("화면 크기에 맞춰지는 30개 이상의 페이지", "30+ pages with responsive layouts")}</li>
          <li>{L("카테고리·세부 카테고리·브랜드가 있는 상품 목록", "Product catalog with categories, subcategories, and brands")}</li>
          <li>{L("옆에서 열리는 장바구니", "Shopping cart with slide-out drawer")}</li>
          <li>{L("바꿔 끼울 수 있는 결제 연동 (어떤 결제 시스템이든 연결)", "Pluggable checkout provider (connect any payment system)")}</li>
          <li>{L("바로 결과가 나오는 검색 창", "Search modal with instant results")}</li>
          <li>{L("찜 목록과 최근 본 상품", "Wishlist and recently viewed products")}</li>
          <li>{L("로그인과 보호된 페이지", "Authentication with protected routes")}</li>
          <li>{L("검색 엔진 최적화 설정 (메타데이터, 구조화 데이터, 사이트맵)", "Full SEO setup (metadata, structured data, sitemap)")}</li>
          <li>{L("접근성 기준 준수 (WCAG 권장 사항)", "Accessibility compliant (WCAG best practices)")}</li>
          <li>{L("다국어 지원 (next-intl, 한국어/영어)", "Internationalization ready (next-intl with EN/ES)")}</li>
          <li>{L("쉽게 브랜드를 바꿀 수 있는 테마 변수", "Theme variables for easy rebranding")}</li>
        </ul>

        <h2 className="!mt-12 text-xl font-semibold text-foreground">
          {L("개발자가 필요하신가요?", "Need a Developer?")}
        </h2>
        <p>
          {L(
            "이 템플릿은 자유롭게 쓰고, 고치고, 배포할 수 있습니다. 내 상점에 맞게 고치거나, 결제 서비스를 연동하거나, 더 복잡한 기능이 필요하면 저희 팀이 도와드립니다.",
            "This template is free to use, modify, and deploy. If you need help customizing it, integrating a payment provider, or building something more complex, our team is here to help."
          )}{" "}
          <Link href="/contact" className="underline hover:text-foreground">
            {L("문의하기", "Get in touch")}
          </Link>{" "}
          {L("하거나", "or visit")}{" "}
          <a
            href="https://epicdesignlabs.com"
            target="_blank"
            rel="noopener"
            className="underline hover:text-foreground"
          >
            epicdesignlabs.com
          </a>
          {L("에 방문해 주세요.", ".")}
        </p>
      </div>
    </div>
  )
}
