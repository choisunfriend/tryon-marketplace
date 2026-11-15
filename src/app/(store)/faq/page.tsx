import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useL } from "@/i18n/use-l"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("자주 묻는 질문", "FAQ"),
    description: L("주문, 배송, 반품 등에 대해 자주 묻는 질문입니다.", "Frequently asked questions about orders, shipping, returns, and more."),
  }
}

const faqs = [
  {
    question: "How long does shipping take?",
    questionKo: "배송은 얼마나 걸리나요?",
    answerKo:
      "일반 배송은 보통 영업일 5~7일이 걸립니다. 결제할 때 빠른 배송을 고르면 영업일 2~3일 안에 받을 수 있어요.",
    answer:
      "Standard shipping typically takes 5-7 business days. Express shipping is available at checkout and delivers within 2-3 business days.",
  },
  {
    question: "What is your return policy?",
    questionKo: "반품 정책은 어떻게 되나요?",
    answerKo:
      "모든 상품은 30일 안에 반품할 수 있어요. 택이 붙은 원래 상태여야 합니다. 자세한 내용은 반품 페이지를 확인하세요.",
    answer:
      "We offer a 30-day return policy on all items. Products must be in their original condition with tags attached. Visit our returns page for more details.",
  },
  {
    question: "Do you ship internationally?",
    questionKo: "해외 배송도 되나요?",
    answerKo:
      "네, 전 세계 대부분의 나라로 배송합니다. 해외 배송비와 기간은 도착지에 따라 다르며, 결제할 때 정확한 금액을 볼 수 있어요.",
    answer:
      "Yes, we ship to most countries worldwide. International shipping rates and delivery times vary by destination. You can see the exact cost at checkout.",
  },
  {
    question: "How can I track my order?",
    questionKo: "주문은 어떻게 조회하나요?",
    answerKo:
      "상품이 출발하면 운송장 번호가 담긴 확인 이메일을 보내 드립니다. 내 계정 화면에서도 조회할 수 있어요.",
    answer:
      "Once your order ships, you'll receive a confirmation email with a tracking number. You can also track your order from your account dashboard.",
  },
  {
    question: "What payment methods do you accept?",
    questionKo: "어떤 결제 수단을 쓸 수 있나요?",
    answerKo:
      "주요 신용카드(Visa, Mastercard, American Express), PayPal, Apple Pay를 받습니다. 모든 결제는 SSL로 암호화됩니다.",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and Apple Pay. All transactions are secured with SSL encryption.",
  },
  {
    question: "How do I contact customer support?",
    questionKo: "고객센터에는 어떻게 연락하나요?",
    answerKo:
      "문의 페이지를 이용하거나 support@store.com 으로 메일을 보내거나 (555) 123-4567 로 전화해 주세요. 고객센터는 평일 오전 9시~오후 5시(미국 동부 시간)에 운영합니다.",
    answer:
      "You can reach us via our contact page, email us at support@store.com, or call (555) 123-4567. Our support team is available Monday through Friday, 9am to 5pm EST.",
  },
  {
    question: "Can I change or cancel my order?",
    questionKo: "주문을 바꾸거나 취소할 수 있나요?",
    answerKo:
      "주문 후 1시간 안에는 바꾸거나 취소할 수 있어요. 그 뒤에는 고객센터에 연락해 주시면 최대한 맞춰 드릴게요.",
    answer:
      "You can modify or cancel your order within 1 hour of placing it. After that, please contact our support team and we'll do our best to accommodate your request.",
  },
  {
    question: "Do you offer gift cards?",
    questionKo: "기프트 카드가 있나요?",
    answerKo:
      "네! $25, $50, $100, $200 디지털 기프트 카드가 있어요. 이메일로 바로 보내지고 유효기간이 없습니다.",
    answer:
      "Yes! Digital gift cards are available in denominations of $25, $50, $100, and $200. They're delivered instantly via email and never expire.",
  },
]

export default function FAQPage() {
  const { L } = useL()
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">
        {L("자주 묻는 질문", "Frequently Asked Questions")}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {L("상품, 배송, 정책에 대해 자주 묻는 질문의 답을 찾아보세요.", "Find answers to common questions about our products, shipping, and policies.")}
      </p>

      <Accordion className="mt-8">
        {faqs.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left">
              {L(faq.questionKo, faq.question)}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {L(faq.answerKo, faq.answer)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-12 rounded-lg border bg-neutral-50 p-6 text-center">
        <h2 className="text-lg font-semibold">{L("더 궁금한 점이 있으신가요?", "Still have questions?")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {L("찾는 답이 없나요? 고객센터가 기꺼이 도와드릴게요.", "Can’t find what you’re looking for? Our support team is happy to help.")}
        </p>
        <a
          href="/contact"
          className="mt-4 inline-block text-sm font-medium underline hover:text-foreground"
        >
          {L("고객센터 문의", "Contact Support")}
        </a>
      </div>
    </div>
  )
}
