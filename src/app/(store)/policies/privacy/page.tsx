import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import { useL } from "@/i18n/use-l"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("개인정보 처리방침", "Privacy Policy"),
    description: L("개인정보를 어떻게 수집·이용·보호하는지 안내합니다.", "How we collect, use, and protect your personal information."),
  }
}

export default function PrivacyPolicyPage() {
  const { L } = useL()
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{L("개인정보 처리방침", "Privacy Policy")}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        {L("마지막 수정: 2025년 1월 1일", "Last updated: January 1, 2025")}
      </p>
      <div className="mt-8 space-y-6 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">
          {L("수집하는 정보", "Information We Collect")}
        </h2>
        <p>
          {L("구매할 때 직접 입력하시는 이름, 이메일 주소, 배송지, 결제 정보를 수집합니다. 또한 기기와 이용 기록에 관한 일부 정보를 자동으로 수집합니다.", "We collect information you provide directly, such as your name, email address, shipping address, and payment information when you make a purchase. We also automatically collect certain information about your device and browsing activity.")}
        </p>

        <h2 className="text-xl font-semibold text-foreground">
          {L("정보의 이용", "How We Use Your Information")}
        </h2>
        <ul className="list-inside list-disc space-y-2">
          <li>{L("주문을 처리하고 배송하기 위해", "To process and fulfill your orders")}</li>
          <li>{L("주문에 관해 연락하기 위해", "To communicate with you about your orders")}</li>
          <li>{L("홍보 이메일을 보내기 위해 (동의한 경우)", "To send promotional emails (with your consent)")}</li>
          <li>{L("웹사이트와 서비스를 개선하기 위해", "To improve our website and services")}</li>
          <li>{L("부정 이용을 찾아내고 막기 위해", "To detect and prevent fraud")}</li>
        </ul>

        <h2 className="text-xl font-semibold text-foreground">
          {L("정보 보호", "Data Protection")}
        </h2>
        <p>
          {L("업계 표준 보안 조치로 개인정보를 보호합니다. 결제 정보는 안전하게 처리되며 저희 서버에 저장되지 않습니다.", "We implement industry-standard security measures to protect your personal information. Your payment data is processed securely and never stored on our servers.")}
        </p>

        <h2 className="text-xl font-semibold text-foreground">{L("이용자의 권리", "Your Rights")}</h2>
        <p>
          {L("언제든지 개인정보를 열람·수정·삭제할 권리가 있습니다. 요청은 privacy@store.com 으로 보내 주세요.", "You have the right to access, update, or delete your personal information at any time. Contact us at privacy@store.com with any requests.")}
        </p>
      </div>
    </div>
  )
}
