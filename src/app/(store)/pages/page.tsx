import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { pageRepository } from "@/lib/repositories"
import { formatDate } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("페이지", "Pages"),
    description: L("도움이 되는 페이지와 자료를 둘러보세요.", "Browse helpful pages and resources."),
  }
}

export default async function PagesIndex() {
  const { L, lang } = await getL()
  const pages = await pageRepository.list()

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader title={L("페이지", "Pages")} description={L(`페이지 ${pages.length}개`, `${pages.length} pages`)} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <Link key={page.id} href={`/pages/${page.slug}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold">{page.title}</h2>
                {page.excerpt && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {page.excerpt}
                  </p>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  {L("수정", "Updated")} {formatDate(page.updatedAt ?? page.publishedAt, lang)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
