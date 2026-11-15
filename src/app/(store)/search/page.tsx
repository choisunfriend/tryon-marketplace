import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { productRepository } from "@/lib/repositories"
import { ProductGrid } from "@/components/products/product-grid"
import { Pagination } from "@/components/products/pagination"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("검색", "Search"),
    description: L("상품을 검색하세요.", "Search our product catalog."),
  }
}

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { L } = await getL()
  const params = await searchParams
  const query = params.q ?? ""
  const page = Number(params.page) || 1

  const hasQuery = query.trim().length > 0
  const results = hasQuery
    ? await productRepository.search(query, { page, limit: 40 })
    : null

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{L("검색", "Search")}</h1>

      <form className="relative mt-8 max-w-lg" action="/search" method="get">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          placeholder={L("상품 검색...", "Search for products...")}
          defaultValue={query}
          className="pl-10 text-base"
        />
      </form>

      {hasQuery && results && (
        <div className="mt-8">
          <p className="text-sm text-muted-foreground">
            {L(
              `"${query}" 검색 결과 ${results.pagination.total}개`,
              `${results.pagination.total} ${results.pagination.total === 1 ? "result" : "results"} for "${query}"`
            )}
          </p>
          <div className="mt-6">
            <ProductGrid products={results.items} />
          </div>
          <div className="mt-12">
            <Pagination
              pagination={results.pagination}
              basePath="/search"
              searchParams={{ q: query }}
            />
          </div>
        </div>
      )}

      {!hasQuery && (
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            {L("상품 이름, 카테고리, 키워드로 검색해 보세요.", "Try searching for a product name, category, or keyword.")}
          </p>
        </div>
      )}

      {hasQuery && results && results.items.length === 0 && (
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            {L(
              `"${query}"에 대한 상품이 없어요. 다른 검색어로 찾아보세요.`,
              `No products found for "${query}". Try a different search term.`
            )}
          </p>
        </div>
      )}
    </div>
  )
}
