"use client"

import Link from "next/link"
import { Search, User, Menu, Heart, ChevronDown } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { SearchModal } from "@/components/search/search-modal"
import { cn } from "@/lib/utils"
import { shopLinks, mobileMenuSections } from "@/lib/navigation"
import { useL } from "@/i18n/use-l"
import { catName } from "@/i18n/catalog"
import { siteConfig } from "@/lib/config"
import { useTranslations } from "next-intl"
import { useState, useEffect } from "react"
import type { Category } from "@/types"
import { useCustomer } from "@/store/customer"
import { useRequireLogin } from "@/components/auth/login-prompt"
import { useRouter } from "next/navigation"

// (2026-11-15) 손님 로그인은 아직 없음 — 진짜 로그인을 붙이면 true 로

interface HeaderProps {
  /** All categories (top-level + subcategories) from the repository layer */
  categories?: Category[]
}

export function Header({ categories = [] }: HeaderProps) {
  const allCategories = categories
  const t = useTranslations("nav")
  const tCommon = useTranslations("common")
  const { L } = useL()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const me = useCustomer((s) => s.me)
  const requireLogin = useRequireLogin()
  const router = useRouter()


  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Mobile menu */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger
            className="inline-flex items-center justify-center rounded-md p-2 text-foreground/60 hover:bg-accent hover:text-foreground lg:hidden"
            aria-label={t("openMenu")}
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="!w-full !gap-0 sm:!w-80" showCloseButton={false}>
            <div className="shrink-0 px-6 pt-5 pb-2">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                &larr; {tCommon("close")}
              </button>
            </div>

            <nav className="flex flex-1 flex-col overflow-y-auto px-6 pb-8">
              {mobileMenuSections.map((section, sectionIdx) => (
                <div key={section.label}>
                  {sectionIdx > 0 && <div className="my-4 border-t" />}
                  <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {L(section.ko ?? section.label, section.label)}
                  </p>
                  <div className="ml-3">
                  {section.items.map((item) => {
                    const slug = item.href.replace("/", "")
                    const parentCat = allCategories.find((c) => c.slug === slug)
                    const subcats = parentCat
                      ? allCategories.filter((c) => c.parentId === parentCat.id)
                      : []
                    const hasSubcats = subcats.length > 0
                    const isExpanded = expandedCategory === item.name

                    return (
                      <div key={item.name}>
                        <div className="flex items-center">
                          <Link
                            href={item.href}
                            className="flex-1 py-2.5 text-sm font-medium text-foreground transition-colors hover:text-foreground/70"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {L(item.ko ?? item.name, item.name)}
                          </Link>
                          {hasSubcats && (
                            <button
                              onClick={() => setExpandedCategory(isExpanded ? null : item.name)}
                              className="p-2 text-muted-foreground hover:text-foreground"
                              aria-label={isExpanded ? L(`${item.ko ?? item.name} 접기`, `Collapse ${item.name}`) : L(`${item.ko ?? item.name} 펼치기`, `Expand ${item.name}`)}
                              aria-expanded={isExpanded}
                            >
                              <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                            </button>
                          )}
                        </div>
                        {hasSubcats && isExpanded && (
                          <div className="mb-2 ml-4 flex flex-col border-l pl-4">
                            {subcats.map((sub) => (
                              <Link
                                key={sub.id}
                                href={`/${sub.slug}`}
                                className="py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                {catName(L, sub)}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  </div>
                </div>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/" className="text-xl font-semibold tracking-tight">
          {siteConfig.name}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex lg:gap-6">
          {shopLinks.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-foreground transition-colors hover:text-foreground/70"
            >
              {L(item.ko ?? item.name, item.name)}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center">
          <button
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent"
            aria-label={t("searchProducts")}
          >
            <Search className="h-5 w-5" />
          </button>

          <Link
            href="/wishlist"
            className="hidden h-10 w-10 items-center justify-center rounded-md hover:bg-accent lg:inline-flex"
            aria-label={t("wishlist")}
          >
            <Heart className="h-5 w-5" />
          </Link>

          {/* (2026-11-28) 내 계정 — 모바일(앱)에서도 보임 · 로그인 안 돼 있으면 로그인 창 */}
          <button
            onClick={() => (me?.kind === "member" ? router.push("/account") : requireLogin(() => router.push("/account")))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent"
            aria-label={me?.kind === "member" ? L("내 계정", "My Account") : tCommon("signIn")}
          >
            {me?.kind === "member" ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">
                {(me.displayName || me.email || "U").slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <User className="h-5 w-5" />
            )}
          </button>
          {/* 장바구니는 결제를 붙일 때 다시 켭니다 (2026-11-28 · 지금은 예약만) */}
        </div>
      </div>
    </header>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
