import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/lib/config"
import { ProductGrid } from "@/components/products/product-grid"
import { NewsletterForm } from "@/components/layout/newsletter-form"
import { PLACEHOLDER_IMAGE } from "@/lib/constants"
import { productRepository, categoryRepository } from "@/lib/repositories"
import { getL } from "@/i18n/server"
import { catName } from "@/i18n/catalog"

export const metadata: Metadata = {
  title: "Today's Stylepeek — 3D hairstyle try-on, salons and outfits",
  description: siteConfig.description,
  alternates: { canonical: "/" },
  openGraph: { title: "Today's Stylepeek", description: siteConfig.description, type: "website", url: siteConfig.url },
}

export default async function HomePage() {
  const { L } = await getL()
  const categories = await categoryRepository.list()
  const featuredProducts = await productRepository.getFeatured(4)


  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative flex h-[650px] items-center justify-center bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Today&apos;s Stylepeek
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            {L("내 3D 모습에 헤어스타일과 옷을 입어 보고, 그 스타일을 하는 미용실을 찾아 바로 예약하세요.", "Try hairstyles and outfits on your own 3D look, then find a salon that does the style and book it.")}
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link href="/shop">
                {L("쇼핑하기", "Shop Now")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/salons">
                {L("미용실 찾기", "Find a salon")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            {L("카테고리별 쇼핑", "Shop by Category")}
          </h2>
          <Link
            href="/shop"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {L("전체 보기", "View all")}
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <Link key={category.id} href={`/${category.slug}`} className="group">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
                <Image
                  src={category.image?.url ?? PLACEHOLDER_IMAGE}
                  alt={catName(L, category)}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, 16vw"
                />
              </div>
              <div className="mt-3 text-center">
                <h3 className="text-sm font-medium group-hover:underline">
                  {catName(L, category)}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            {L("추천 상품", "Featured Products")}
          </h2>
          <Link
            href="/shop"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {L("전체 보기", "View all")}
          </Link>
        </div>
        <div className="mt-8">
          <ProductGrid products={featuredProducts} />
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="bg-neutral-900 text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {L("뉴스레터 구독", "Join our newsletter")}
          </h2>
          <p className="mt-4 text-neutral-400">
            {L("신상품과 특별 혜택 소식을 받아 보세요.", "Get updates on new arrivals and exclusive offers.")}
          </p>
          <NewsletterForm />
        </div>
      </section>
    </div>
  )
}
