import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { TranslateGuard } from "@/components/translate-guard"
import { getLocale, getMessages } from "next-intl/server"
import { Toaster } from "sonner"
import { siteConfig } from "@/lib/config"
import "./globals.css"
import { getL } from "@/i18n/server"
import { ldJson } from "@/lib/json-ld"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export async function generateMetadata(): Promise<Metadata> {
  const { L, lang } = await getL()
  return {
    title: {
      default: `${siteConfig.name} — ${L(siteConfig.taglineKo, siteConfig.tagline)}`,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    metadataBase: new URL(siteConfig.url),
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      locale: lang === "ko" ? "ko_KR" : siteConfig.locale.replace("-", "_"),
    },
  }
}

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  url: siteConfig.url,
}

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteConfig.url,
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteConfig.url}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: ldJson([organizationJsonLd, websiteJsonLd]),
          }}
        />
        {/* (2026-11-14) 브라우저 자동 번역 중에 React 화면이 멈추지 않게 (번역은 이제 사이트가 직접 함) */}
        <TranslateGuard />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
