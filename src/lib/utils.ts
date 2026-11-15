import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { siteConfig } from "@/lib/config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(
  priceInCents: number,
  currency?: string
): string {
  return new Intl.NumberFormat(siteConfig.locale, {
    style: "currency",
    currency: currency ?? siteConfig.currency,
  }).format(priceInCents / 100)
}

// (2026-11-14) lang: 화면 언어 ("ko" → 2026년 11월 14일 꼴)
export function formatDate(date: string | Date, lang: string = "en"): string {
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date))
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}
