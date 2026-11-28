// ============================================================================
// Store Configuration — Single source of truth for all store-wide settings.
// Edit this file to customize the store name, contact info, social links, etc.
// ============================================================================

export const siteConfig = {
  // Branding
  name: "Today's Stylepeek",
  tagline: "Try hairstyles and outfits on your own 3D look.",
  taglineKo: "내 3D 모습에 헤어와 옷을 입어 보세요.",
  description:
    "Today's Stylepeek — try hairstyles on a 3D model of your head, find salons and book, and shop outfits.",

  // Announcement bar (set to "" to hide)
  announcement: "",
  announcementKo: "",

  // URLs
  url: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",

  // Contact
  contact: {
    email: "choisunfriend@gmail.com" /* TODO: 회사 고객센터 이메일 */,
    phone: "",
    address: {
      street: "",
      suite: "",
      city: "",
      state: "",
      zip: "",
    },
  },

  // Social links (set to "" to hide)
  social: {
    twitter: "",
    instagram: "",
    facebook: "",
    youtube: "",
    tiktok: "",
  },

  // Shipping
  freeShippingThreshold: 7500, // in cents ($75.00)
  taxRate: 0.08, // 8%

  // Currency & locale
  currency: "USD",
  locale: "en-US",

  // Legal
  copyrightYear: new Date().getFullYear(),
} as const

export type SiteConfig = typeof siteConfig
