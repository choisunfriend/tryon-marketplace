# 보안 설정 (tryon-marketplace-web)

## 1. Cloudflare 비밀값 (필수)
대시보드 → Workers & Pages → `tryon-marketplace-web` → 설정 → 변수 및 비밀 → **비밀(Secret)** 로 추가

| 이름 | 내용 |
|---|---|
| `ADMIN_PASSWORD` | 관리자 비밀번호, 12자 이상 |
| `ADMIN_SESSION_SECRET` | 쿠키 서명 키, 32자 이상 무작위 문자열 (비밀번호와 다르게) |
| `BACKEND_ADMIN_TOKEN` | 백엔드 API Worker 쓰기용 토큰 (상품 등록 프록시에서만 씀) |

비밀값은 코드·레포·채팅에 절대 넣지 않습니다. 셋 중 하나라도 없으면 관리자 로그인·쓰기가 꺼집니다.

## 2. 접근 규칙
- 매장 화면(/shop, 상품 페이지 등)은 **GYEOL 앱 안(iframe)** 에서만 열립니다. 주소창·새 탭으로 열면 안내 화면(403).
- iframe 으로 띄울 수 있는 앱 주소: `wrangler.jsonc` 의 `vars.FRAME_ANCESTORS` (https 만, 와일드카드 불가).
- 관리자 화면(/admin…)은 서명 쿠키가 있어야 열리고, 어떤 사이트에도 iframe 으로 들어가지 않습니다.
- 쓰기 API(/api/admin/*, /api/assets/upload, /api/bake)는 관리자 쿠키 + 같은 출처 요청만 받습니다.
- 3D·이미지 파일(/api/assets/products/…)은 앱 주소에만 CORS 를 엽니다.

## 3. 대시보드에서 권장 (코드 밖)
- Security → WAF → Rate limiting rule: `/api/admin/login` 분당 5회, `/api/*` 분당 120회 정도.
- 백엔드 API Worker(`tryon-marketplace`): 쓰기(POST/PUT/DELETE)는 `Authorization: Bearer <BACKEND_ADMIN_TOKEN>` 없으면 거절,
  CORS 는 앱 주소와 이 마켓 주소만 허용 — 이 레포에 코드가 없어 별도로 확인 필요.
