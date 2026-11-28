"use client"
import { useL } from "@/i18n/use-l"
import { POLICIES } from "@/lib/policy-text"
export function PolicyTitle({ doc }: { doc: string }) {
  const { L } = useL()
  return <h1 className="text-3xl font-bold tracking-tight">{L(...POLICIES[doc].title)}</h1>
}
