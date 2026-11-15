import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import { useL } from "@/i18n/use-l"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("반품·환불", "Returns & Refunds"),
    description: L("반품·환불 정책입니다. 30일 간편 반품.", "Our return and refund policy. Easy 30-day returns."),
  }
}

export default function ReturnsPolicyPage() {
  const { L } = useL()
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">
        {L("반품·환불", "Returns & Refunds")}
      </h1>
      <div className="mt-8 space-y-6 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">
          {L("30일 반품 정책", "30-Day Return Policy")}
        </h2>
        <p>
          {L("구매에 만족하시길 바랍니다. 주문이 마음에 들지 않으면 받은 날부터 30일 안에 반품하고 전액 환불받을 수 있어요.", "We want you to be completely satisfied with your purchase. If you're not happy with your order, you can return it within 30 days of delivery for a full refund.")}
        </p>

        <h2 className="text-xl font-semibold text-foreground">
          {L("반품 조건", "Return Conditions")}
        </h2>
        <ul className="list-inside list-disc space-y-2">
          <li>{L("사용하지 않은 상품을 원래 포장 그대로 보내 주세요", "Items must be unused and in their original packaging")}</li>
          <li>{L("택이 붙어 있어야 해요", "Tags must be attached")}</li>
          <li>{L("세일 상품은 반품할 수 없어요", "Sale items are final sale and cannot be returned")}</li>
          <li>{L("기프트 카드는 환불되지 않아요", "Gift cards are non-refundable")}</li>
        </ul>

        <h2 className="text-xl font-semibold text-foreground">
          {L("반품 방법", "How to Return")}
        </h2>
        <ol className="list-inside list-decimal space-y-2">
          <li>{L("로그인한 뒤 주문 내역으로 가세요", "Log into your account and go to Order History")}</li>
          <li>{L("반품할 주문과 상품을 고르세요", "Select the order and items you wish to return")}</li>
          <li>{L("선불 반품 라벨을 출력하세요", "Print the prepaid return label")}</li>
          <li>{L("상품을 잘 포장해 가까운 택배 접수처에 맡기세요", "Pack items securely and drop off at any shipping location")}</li>
        </ol>

        <h2 className="text-xl font-semibold text-foreground">{L("환불", "Refunds")}</h2>
        <p>
          {L("반품 상품을 받은 뒤 영업일 5~7일 안에 환불하며, 처음 결제한 수단으로 돌려드립니다.", "Refunds are processed within 5-7 business days of receiving your return. The refund will be credited to your original payment method.")}
        </p>
      </div>
    </div>
  )
}
