"use client"

import Link from "next/link"
import { ShoppingBag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { CartItem } from "./cart-item"
import { CartSummary } from "./cart-summary"
import { useCartStore } from "@/store/cart"
import { formatPrice } from "@/lib/utils"
import { useL } from "@/i18n/use-l"

export function CartDrawer() {
  const { L } = useL()
  const items = useCartStore((s) => s.items)
  const isOpen = useCartStore((s) => s.isOpen)
  const closeCart = useCartStore((s) => s.closeCart)
  const getSubtotal = useCartStore((s) => s.getSubtotal)

  const subtotal = getSubtotal()

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="right" className="flex !w-full flex-col !gap-0 sm:!w-3/4 sm:max-w-md" showCloseButton={false}>
        <SheetHeader>
          <div className="flex items-center justify-between">
            <button
              onClick={closeCart}
              className="text-sm text-muted-foreground hover:text-foreground sm:hidden"
            >
              &larr; {L("뒤로", "Back")}
            </button>
            <button
              onClick={closeCart}
              className="hidden rounded-md p-1 text-muted-foreground hover:text-foreground sm:block sm:ml-auto"
              aria-label={L("장바구니 닫기", "Close cart")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <SheetTitle className="mt-2 text-2xl font-bold tracking-tight">
            {L(`장바구니 (${items.length}개)`, `Cart (${items.length} ${items.length === 1 ? "item" : "items"})`)}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium">{L("장바구니가 비어 있어요", "Your cart is empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {L("상품을 담아 보세요", "Add items to get started")}
            </p>
            <Button className="mt-6" onClick={closeCart} asChild>
              <Link href="/shop">{L("계속 쇼핑하기", "Continue Shopping")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4">
              <div className="divide-y">
                {items.map((item) => (
                  <CartItem key={item.variantId} item={item} />
                ))}
              </div>
            </div>

            <SheetFooter className="!mt-0 shrink-0 border-t !px-4 !pt-4 !pb-8">
              <div className="w-full space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span>{L("상품 금액", "Subtotal")}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {L("배송비와 세금은 결제 단계에서 계산됩니다.", "Shipping and taxes calculated at checkout.")}
                </p>
                <Button className="w-full" size="lg" asChild onClick={closeCart}>
                  <Link href="/checkout">{L("결제하기", "Checkout")}</Link>
                </Button>
                <button
                  className="mb-4 w-full py-2 text-center text-sm text-muted-foreground underline hover:text-foreground sm:mb-0 sm:hidden"
                  onClick={closeCart}
                >
                  {L("계속 쇼핑하기", "Continue Shopping")}
                </button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
