import { getRequestConfig } from "next-intl/server"
import { getLang } from "./server"

export default getRequestConfig(async () => {
  const locale = await getLang()

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
