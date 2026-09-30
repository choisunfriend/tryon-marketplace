import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { redirects as redirectRules } from "./src/lib/redirects";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Cloudflare Workers에는 Next.js 기본 이미지 최적화 서버가 없어 원본을 그대로 씁니다
    // (R2 이미지는 /api/assets/... 로 같은 도메인에서 나옵니다)
    unoptimized: true,
    // Add remote image domains here when using real product images
    // remotePatterns: [
    //   { protocol: "https", hostname: "cdn.example.com" },
    // ],
  },

  // Redirects are defined in src/lib/redirects.ts — edit there.
  async redirects() {
    return redirectRules;
  },
};

export default withNextIntl(nextConfig);
