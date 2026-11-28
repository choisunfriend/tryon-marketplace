import type { Metadata } from "next"
import { getL } from "@/i18n/server"
import { POLICIES } from "@/lib/policy-text"
import { PolicyTitle } from "@/components/policies/policy-title"
import { PolicyBody } from "@/components/policies/policy-body"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return { title: L(...POLICIES["terms"].title) }
}

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <PolicyTitle doc="terms" />
      <div className="mt-8"><PolicyBody doc="terms" /></div>
    </div>
  )
}
