# 고객 계정 (손님 앱) — 2026-11-15

입점사·미용실 관리자 계정(`store_users`, 웹 관리자 화면)과는 **완전히 따로**입니다.
고객 앱(조정 화면을 뺀 GYEOL 손님용 앱)만 씁니다.

## 1. 처음 한 번 — 데이터베이스 표 만들기

대시보드 → Storage & Databases → D1 → `tryon-marketplace-db` → Console 에
`migrations/0004_customers.sql` 내용을 붙여 넣고 실행. (또는 아래 명령)

```
npx wrangler d1 execute tryon-marketplace-db --remote --file=migrations/0004_customers.sql
```

## 2. 흐름

1. **앱 첫 실행** → `POST /api/customer/start` → 가입 없는 고객 + `token`
   - 앱은 `token` 을 iOS 키체인 / Android 암호화 저장소에 보관 (localStorage 금지)
   - 이후 모든 요청: `Authorization: Bearer <token>`
2. **로그인 버튼** (주문·결제할 때, 또는 기기를 옮길 때)
   - 앱이 애플·구글·카카오 SDK 로 로그인 → **ID 토큰** 받음
   - `POST /api/customer/login` 에 `{ provider, idToken, nonce }` + 지금 Bearer 토큰
   - 처음 쓰는 로그인 수단이면: 지금 고객이 그대로 정식 회원이 됨(찜 등 유지)
   - 이미 다른 폰에서 가입한 계정이면: 그 계정으로 들어가고, 이 폰의 찜 목록을 옮겨 붙임
   - 응답의 새 `token` 으로 바꿔 저장 (예전 토큰은 서버에서 끝남)
3. **쇼핑몰(iframe)** — 앱이 iframe 에 토큰을 postMessage 로 넘겨주고, 쇼핑몰은 Bearer 로 API 를 부름
   (쿠키를 안 써서 아이폰 사파리 iframe 쿠키 차단과 상관없음) ※ 쇼핑몰 화면 쪽 연결은 다음 단계
4. **로그아웃** `POST /api/customer/logout` (`{ all: true }` 면 모든 기기)
5. **탈퇴** `DELETE /api/customer/me` body `{ "confirm": "DELETE" }`
   - 앱스토어·플레이스토어 규정: 앱 안에 탈퇴 버튼이 있어야 함
   - 애플 로그인 계정은 앱이 애플 토큰 철회(revoke)도 해야 함 → 애플 개발자 키(.p8) 필요, 앱 출시 단계에서 추가

## 3. API 목록

| 주소 | 방법 | 설명 |
|---|---|---|
| `/api/customer/config` | GET | 켜진 로그인 방식 `{ providers: { apple, google, kakao } }` |
| `/api/customer/start` | POST | 가입 없이 시작 `{ platform?, deviceId? }` |
| `/api/customer/login` | POST | `{ provider, idToken, nonce?, name?, platform?, deviceId? }` |
| `/api/customer/me` | GET · PATCH · DELETE | 내 정보 / `{ displayName?, lang? }` / 탈퇴 |
| `/api/customer/logout` | POST | 로그아웃 |
| `/api/customer/identities/{provider}` | DELETE | 로그인 수단 끊기(마지막 하나는 불가) |
| `/api/customer/wishlist` | GET · POST · DELETE | 찜 목록 / `{ productId }` / `?productId=` |

## 4. 로그인 방식 켜기 (Cloudflare → Worker → 설정 → 변수)

값이 비어 있으면 그 로그인은 꺼진 상태입니다. 일반 텍스트 변수로 넣어도 됩니다(비밀 아님).

| 변수 | 넣을 값 | 어디서 |
|---|---|---|
| `APPLE_CLIENT_IDS` | iOS 앱 번들 ID (예: `com.gyeol.app`) | Apple Developer → Identifiers (Sign in with Apple 켜기) |
| `GOOGLE_CLIENT_IDS` | OAuth 클라이언트 ID (iOS·Android·웹, 공백으로 여러 개) | Google Cloud Console → 사용자 인증 정보 |
| `KAKAO_CLIENT_IDS` | 카카오 앱 **REST API 키** | Kakao Developers → 내 애플리케이션 → 카카오 로그인 → **OpenID Connect 활성화** |
| `CUSTOMER_APP_ORIGINS` | (선택) 앱 껍데기 주소. 기본 `capacitor://localhost https://localhost` | Capacitor 기본값이면 안 넣어도 됨 |

아이폰 앱에 구글·카카오 로그인을 넣으면 **애플 로그인도 같이 넣어야** 심사를 통과합니다.

## 5. 보안 메모

- 토큰은 DB 에 SHA-256 값만 저장 → DB 가 새도 토큰으로 로그인 불가
- 로그인 증표(ID 토큰)는 서버가 각 회사 공개 키로 서명·발급자·대상 앱·만료·nonce 를 확인
- 기기 아이디(`deviceId`)는 구분용 이름표일 뿐, 그것만으로는 로그인되지 않음
- 시작·로그인은 IP 당 1분 20번으로 제한 (`CUSTOMER_LIMITER`)
- 세션 유효기간 180일, 한 고객당 세션 최대 20개(오래된 것부터 정리)
