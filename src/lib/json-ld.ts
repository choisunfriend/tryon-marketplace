// (2026-11-15 보안) <script type="application/ld+json"> 안에 넣을 JSON.
// 상품·카테고리 이름은 입점사가 쓰는 글이라 "</script>" 같은 글자가 들어오면
// 스크립트 밖으로 빠져나가 화면을 조작할 수 있습니다. <, >, & 와 줄 구분 문자를 \u 로 바꿔 막습니다.
const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  " ": "\\u2028",
  " ": "\\u2029",
}

const ESCAPE_RE = new RegExp("[<>&\\u2028\\u2029]", "g")

export function ldJson(value: unknown): string {
  return JSON.stringify(value).replace(ESCAPE_RE, (c) => ESCAPES[c] ?? c)
}
