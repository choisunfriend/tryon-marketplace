import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import { useL } from "@/i18n/use-l"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("배송 정책", "Shipping Policy"),
    description: L("배송 방법, 요금, 배송 기간을 안내합니다.", "Learn about our shipping options, rates, and delivery times."),
  }
}

export default function ShippingPolicyPage() {
  const { L } = useL()
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{L("배송 정책", "Shipping Policy")}</h1>
      <div className="mt-8 space-y-6 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">
          {L("국내 배송", "Domestic Shipping")}
        </h2>
        <ul className="list-inside list-disc space-y-2">
          <li>{L("일반 배송 (영업일 5~7일): $5.99", "Standard Shipping (5-7 business days): $5.99")}</li>
          <li>{L("빠른 배송 (영업일 2~3일): $12.99", "Express Shipping (2-3 business days): $12.99")}</li>
          <li>{L("익일 배송 (영업일 1일): $24.99", "Overnight Shipping (1 business day): $24.99")}</li>
          <li>{L("$75 이상 주문 시 무료 배송", "Free shipping on all orders over $75")}</li>
        </ul>

        <h2 className="text-xl font-semibold text-foreground">
          {L("해외 배송", "International Shipping")}
        </h2>
        <p>
          {L("전 세계 대부분의 나라로 배송합니다. 해외 배송비는 결제할 때 도착지와 무게에 따라 계산되며, 보통 영업일 7~14일이 걸립니다.", "We ship to most countries worldwide. International shipping rates are calculated at checkout based on destination and package weight. Delivery typically takes 7-14 business days.")}
        </p>

        <h2 className="text-xl font-semibold text-foreground">
          {L("주문 처리", "Order Processing")}
        </h2>
        <p>
          {L("영업일 오후 2시(미국 동부 시간) 전에 들어온 주문은 당일 처리합니다. 오후 2시 이후나 주말 주문은 다음 영업일에 처리합니다.", "Orders placed before 2:00 PM EST on business days are processed the same day. Orders placed after 2:00 PM EST or on weekends will be processed the next business day.")}
        </p>

        <h2 className="text-xl font-semibold text-foreground">{L("배송 조회", "Tracking")}</h2>
        <p>
          {L("상품이 출발하면 운송장 번호가 담긴 배송 확인 이메일을 보내 드립니다. 내 계정 화면에서도 배송을 조회할 수 있어요.", "You will receive a shipping confirmation email with a tracking number once your order has shipped. You can also track your order from your account dashboard.")}
        </p>
      </div>
    </div>
  )
}
