import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import { useL } from "@/i18n/use-l"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("이용약관", "Terms of Service"),
    description: L("웹사이트와 서비스 이용 약관입니다.", "Terms and conditions for using our website and services."),
  }
}

export default function TermsPage() {
  const { L } = useL()
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{L("이용약관", "Terms of Service")}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        {L("마지막 수정: 2025년 1월 1일", "Last updated: January 1, 2025")}
      </p>
      <div className="mt-8 space-y-6 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">
          {L("약관 동의", "Acceptance of Terms")}
        </h2>
        <p>
          {L("이 웹사이트에 접속해 이용하면 이 이용약관에 동의한 것으로 봅니다. 동의하지 않으면 서비스를 이용하지 마세요.", "By accessing and using this website, you accept and agree to be bound by these Terms of Service. If you do not agree, please do not use our services.")}
        </p>

        <h2 className="text-xl font-semibold text-foreground">
          {L("서비스 이용", "Use of Service")}
        </h2>
        <p>
          {L("서비스를 합법적인 목적과 이 약관에 따라서만 이용하기로 동의합니다. 계정 정보를 안전하게 관리할 책임은 이용자에게 있습니다.", "You agree to use our services only for lawful purposes and in accordance with these terms. You are responsible for maintaining the confidentiality of your account credentials.")}
        </p>

        <h2 className="text-xl font-semibold text-foreground">
          {L("상품과 가격", "Products and Pricing")}
        </h2>
        <p>
          {L("정확한 상품 정보와 가격을 보여 드리려고 노력하지만 오류가 있을 수 있습니다. 오류는 바로잡을 수 있으며, 잘못된 가격으로 들어온 주문은 취소할 수 있습니다.", "We strive to display accurate product information and pricing. However, errors may occur. We reserve the right to correct any errors and to cancel orders placed at incorrect prices.")}
        </p>

        <h2 className="text-xl font-semibold text-foreground">
          {L("지식재산권", "Intellectual Property")}
        </h2>
        <p>
          {L("이 웹사이트의 글, 이미지, 로고 등 모든 콘텐츠는 지식재산권법의 보호를 받습니다. 서면 허락 없이 복제하거나 배포할 수 없습니다.", "All content on this website, including text, images, and logos, is protected by intellectual property laws. You may not reproduce or distribute any content without our written permission.")}
        </p>

        <h2 className="text-xl font-semibold text-foreground">
          {L("책임의 한계", "Limitation of Liability")}
        </h2>
        <p>
          {L("법이 허용하는 범위에서, 서비스 이용으로 생긴 간접적·부수적·결과적 손해에 대해 책임지지 않습니다.", "To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising from your use of our services.")}
        </p>

        <h2 className="text-xl font-semibold text-foreground">{L("문의", "Contact")}</h2>
        <p>
          {L("약관에 관한 문의는 legal@store.com 으로 보내 주세요.", "For questions about these terms, contact us at legal@store.com.")}
        </p>
      </div>
    </div>
  )
}
