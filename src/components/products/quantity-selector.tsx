"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useL } from "@/i18n/use-l"

interface QuantitySelectorProps {
  quantity: number
  onQuantityChange: (quantity: number) => void
  min?: number
  max?: number
}

export function QuantitySelector({
  quantity,
  onQuantityChange,
  min = 1,
  max = 99,
}: QuantitySelectorProps) {
  const { L } = useL()
  return (
    <div className="flex items-center">
      <button
        onClick={() => onQuantityChange(Math.max(min, quantity - 1))}
        disabled={quantity <= min}
        aria-label={L("수량 줄이기", "Decrease quantity")}
        className="flex h-10 w-10 items-center justify-center rounded-l-md border text-sm transition-colors hover:bg-accent disabled:opacity-50"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="flex h-10 w-10 items-center justify-center border-y text-sm font-medium tabular-nums">
        {quantity}
      </span>
      <button
        onClick={() => onQuantityChange(Math.min(max, quantity + 1))}
        disabled={quantity >= max}
        aria-label={L("수량 늘리기", "Increase quantity")}
        className="flex h-10 w-10 items-center justify-center rounded-r-md border text-sm transition-colors hover:bg-accent disabled:opacity-50"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  )
}
