// (2026-11-28) 약관·방침 초안 — 사업자 정보 반영됨
// ⚠ 초안입니다. 정식 시행 전에 법률 검토(또는 공정위 표준약관 대조)를 받으세요.
//   - 이용약관: 공정위 「전자상거래(인터넷사이버몰) 표준약관」·통신판매중개 구조(쿠팡 제33조 등) 참고
//   - 개인정보: 개인정보보호법 제15·17·22조, 정보통신망법 제50조(광고성 정보)
// 화면: /policies/terms · /policies/privacy · 로그인 창 ">" 팝업이 모두 이 내용을 씁니다.

export type Bi = [string, string] // [한국어, English]
export interface Article { h: Bi; p: Bi[] }
export interface PolicyDoc { title: Bi; effective: Bi; intro?: Bi; articles: Article[] }

export const BIZ: Bi = [
  "상호 YL Company · 대표 이영조 · 사업자등록번호 484-21-02064 · 통신판매업신고 제2025-경북구미-0728호 · 주소 경북 구미시 신시로16길 141, 101동 1006호 (39277) · 이메일 choisunfriend@gmail.com",
  "YL Company · CEO Lee Youngjo · Business reg. No. 484-21-02064 · Mail-order reg. No. 2025-경북구미-0728 (Gumi, Gyeongsangbuk-do) · 101-1006, 141 Sinsi-ro 16-gil, Gumi-si, Gyeongsangbuk-do 39277, Republic of Korea · choisunfriend@gmail.com",
]
export const BROKER: Bi = [
  "YL Company는 통신판매중개자로서 거래 당사자가 아니며, 입점 판매자가 등록한 상품·서비스 정보와 거래에 대한 책임은 각 판매자에게 있습니다.",
  "YL Company is a mail-order broker, not a party to transactions; each listed seller is responsible for its products, services and transactions.",
]
const EFF: Bi = ["시행일: 2026년 12월 1일", "Effective: December 1, 2026"]

export const POLICIES: Record<string, PolicyDoc> = {
  // ─────────────────────────────────────────────── 이용약관
  terms: {
    title: ["Today's Stylepeek 이용약관", "Today's Stylepeek Terms of Service"],
    effective: EFF,
    articles: [
      { h: ["제1조 (목적)", "1. Purpose"], p: [[
        "이 약관은 YL Company(이하 \"회사\")가 운영하는 Today's Stylepeek 앱과 웹사이트(이하 \"서비스\")에서 제공하는 헤어스타일 미리보기, 미용실 찾기·예약, 상품 중개 서비스의 이용 조건과 절차, 회사와 회원의 권리·의무를 정합니다.",
        "These Terms govern your use of the Today's Stylepeek app and website (the \"Service\") operated by YL Company (\"we\"), including hairstyle preview, salon search and booking, and the product marketplace.",
      ]] },
      { h: ["제2조 (정의)", "2. Definitions"], p: [
        ["1. \"회원\"이란 Apple 등 외부 계정으로 로그인해 이 약관에 동의하고 서비스를 이용하는 사람을 말합니다.", "1. \"Member\" means a person who signs in with an external account such as Apple and accepts these Terms."],
        ["2. \"미용실\"이란 서비스에 매장 정보와 예약 가능 시간을 등록한 사업자를 말합니다.", "2. \"Salon\" means a business that lists its shop and available times on the Service."],
        ["3. \"판매자\"란 서비스에 상품을 등록해 판매하는 사업자를 말합니다.", "3. \"Seller\" means a business that lists and sells products on the Service."],
      ] },
      { h: ["제3조 (약관의 게시와 변경)", "3. Posting and changes"], p: [
        ["① 회사는 이 약관과 회사 정보(상호, 대표자, 주소, 사업자등록번호, 통신판매업신고번호, 연락처)를 서비스 화면에 게시합니다.", "① We post these Terms and our business details in the Service."],
        ["② 회사는 관련 법령을 어기지 않는 범위에서 약관을 바꿀 수 있으며, 바꾸면 시행일 7일 전(회원에게 불리한 변경은 30일 전)부터 공지합니다. 회원이 시행일까지 거부하지 않으면 동의한 것으로 봅니다. 동의하지 않으면 탈퇴할 수 있습니다.", "② We may update these Terms. We will give notice 7 days before the effective date (30 days for changes unfavourable to you). If you do not object by then, you are deemed to accept; otherwise you may delete your account."],
      ] },
      { h: ["제4조 (회원가입과 계정)", "4. Account"], p: [
        ["① 회원가입은 만 14세 이상인 사람이 외부 계정으로 로그인하고 필수 항목에 동의하면 완료됩니다.", "① You may join if you are 14 or older, by signing in with an external account and accepting the required items."],
        ["② 회원은 계정을 다른 사람에게 넘기거나 빌려줄 수 없으며, 계정 관리 책임은 회원에게 있습니다.", "② You may not transfer or lend your account and are responsible for keeping it secure."],
        ["③ 회원은 언제든지 앱의 [내 계정 > 계정 삭제]에서 탈퇴할 수 있으며, 회사는 즉시 처리합니다.", "③ You may delete your account at any time in Account > Delete account; we process it immediately."],
      ] },
      { h: ["제5조 (헤어스타일 미리보기)", "5. Hairstyle preview"], p: [
        ["① 미리보기는 사진을 바탕으로 기기 안에서 만든 예상 이미지이며, 실제 시술 결과와 다를 수 있습니다.", "① Previews are estimates generated on your device from your photo and may differ from actual results."],
        ["② 미리보기에 쓰인 얼굴 사진은 회원의 기기에만 저장되며 회사 서버로 전송되지 않습니다.", "② Face photos used for previews stay on your device and are not sent to our servers."],
      ] },
      { h: ["제6조 (미용실 예약)", "6. Salon booking"], p: [
        ["① 회원은 미용실의 빈 시간을 골라 예약을 신청할 수 있습니다. 예약은 미용실이 확인하면 확정되며, 현재 서비스에서는 예약금·결제를 받지 않습니다.", "① You can request a free time slot at a salon. A booking is confirmed when the salon accepts it. No deposit or payment is taken at this time."],
        ["② 회원은 앱의 [내 계정 > 내 예약]에서 예약을 취소할 수 있습니다. 노쇼가 반복되면 예약 기능 이용이 제한될 수 있습니다.", "② You may cancel in Account > My bookings. Repeated no-shows may lead to booking restrictions."],
        ["③ 시술 내용·가격·결과에 대한 책임은 시술을 제공하는 미용실에 있습니다.", "③ The salon is responsible for the service it provides, its price and its result."],
      ] },
      { h: ["제7조 (통신판매중개)", "7. Marketplace"], p: [
        ["① 회사는 통신판매중개자로서 회원과 판매자·미용실 사이의 거래를 위한 시스템을 제공할 뿐, 거래 당사자가 아닙니다. 상품 정보와 거래에 대한 책임은 판매자에게 있습니다.", "① We act as an intermediary and are not a party to transactions between you and Sellers or Salons. Sellers are responsible for their listings and sales."],
        ["② 결제 기능이 열리면 주문·결제·청약철회에 관한 사항을 이 약관에 추가하고 사전에 공지합니다.", "② When payments become available, we will add ordering, payment and cancellation terms with prior notice."],
      ] },
      { h: ["제8조 (회원의 의무)", "8. Your obligations"], p: [[
        "회원은 다른 사람의 정보를 도용하거나, 허위 예약을 반복하거나, 서비스 운영을 방해하거나, 다른 사람의 사진을 동의 없이 사용해서는 안 됩니다. 이를 어기면 회사는 이용을 제한하거나 계정을 정지할 수 있습니다.",
        "You must not impersonate others, make repeated fake bookings, disrupt the Service, or use other people's photos without consent. We may restrict or suspend accounts that do.",
      ]] },
      { h: ["제9조 (서비스 변경·중단)", "9. Changes and interruptions"], p: [[
        "회사는 설비 점검, 장애, 천재지변 등으로 서비스를 잠시 중단할 수 있으며, 가능하면 미리 공지합니다.",
        "We may suspend the Service temporarily for maintenance, outages or force majeure, with notice where possible.",
      ]] },
      { h: ["제10조 (책임 제한)", "10. Limitation of liability"], p: [[
        "회사는 고의 또는 중대한 과실이 없는 한 미리보기 결과와 실제 시술의 차이, 회원과 미용실·판매자 사이의 분쟁, 회원의 귀책으로 생긴 손해에 대해 책임지지 않습니다.",
        "Except for our wilful misconduct or gross negligence, we are not liable for differences between previews and actual results, disputes between you and Salons or Sellers, or losses caused by you.",
      ]] },
      { h: ["제11조 (준거법과 관할)", "11. Governing law"], p: [[
        "이 약관은 대한민국 법률에 따르며, 분쟁은 「민사소송법」에 따른 관할법원에서 해결합니다. 다만 거주 국가의 소비자 보호 법률이 회원에게 더 유리한 권리를 보장하면 그 권리는 유지됩니다.",
        "These Terms are governed by the laws of the Republic of Korea. Nothing here limits mandatory consumer rights you have under the laws of your country of residence.",
      ]] },
      { h: ["회사 정보", "Business information"], p: [BIZ] },
    ],
  },

  // ─────────────────────────────────────────────── 로그인 창: 개인정보 수집·이용 동의(필수)
  "privacy-consent": {
    title: ["개인정보 수집 및 이용 동의", "Collection and use of personal information"],
    effective: EFF,
    articles: [
      { h: ["1. 수집 항목과 목적", "1. What we collect and why"], p: [
        ["· 회원 식별·로그인: 로그인 계정 고유번호(Apple 등), 이메일(제공 시), 이름(제공 시)", "· Sign-in and identification: account ID from Apple etc., email and name if provided"],
        ["· 미용실 예약: 예약자 이름, 휴대전화번호, 요청사항, 예약 일시, 선택한 스타일", "· Salon bookings: name, phone number, notes, date/time, chosen style"],
        ["· 서비스 운영·부정 이용 방지: 접속 기록, 기기·앱 버전, 언어 설정", "· Operation and abuse prevention: access logs, device/app version, language"],
      ] },
      { h: ["2. 보유 기간", "2. Retention"], p: [
        ["회원 탈퇴 시 바로 지웁니다. 다만 지난 예약 기록은 이름·연락처를 지운 상태로 미용실 영업 기록에 남으며, 법령이 정한 경우(전자상거래법: 소비자 불만·분쟁 기록 3년, 통신비밀보호법: 접속 기록 3개월)에는 그 기간 동안 보관합니다.", "Deleted when you delete your account. Past bookings remain in the salon's records with your name and phone removed. Records required by law are kept for the legal period (e.g. complaint records 3 years, access logs 3 months)."],
      ] },
      { h: ["3. 동의를 거부할 권리", "3. Right to refuse"], p: [
        ["동의를 거부할 수 있습니다. 다만 위 항목은 서비스 제공에 꼭 필요하므로, 거부하면 로그인·예약을 할 수 없습니다. 로그인 없이도 헤어스타일 미리보기와 둘러보기는 이용할 수 있습니다.", "You may refuse, but these items are necessary, so you won't be able to sign in or book. You can still use previews and browse without signing in."],
      ] },
      { h: ["※ 얼굴 사진", "※ Face photos"], p: [
        ["헤어스타일 미리보기에 쓰는 사진과 얼굴 분석 결과는 회원의 기기 안에서만 처리·저장되며 회사가 수집하지 않습니다.", "Photos and face analysis used for previews are processed and stored only on your device; we do not collect them."],
      ] },
    ],
  },

  // ─────────────────────────────────────────────── 로그인 창: 예약 시 미용실 제공(필수)
  "salon-share": {
    title: ["예약 시 미용실에 개인정보 제공 동의", "Sharing booking details with the salon"],
    effective: EFF,
    articles: [
      { h: ["제공받는 자", "Recipient"], p: [["회원이 예약을 신청한 미용실", "The salon you book with"]] },
      { h: ["제공 항목", "Items shared"], p: [["예약자 이름, 휴대전화번호, 예약 일시, 선택한 스타일, 요청사항", "Your name, phone number, date/time, chosen style and notes"]] },
      { h: ["제공 목적", "Purpose"], p: [["예약 확인, 시술 준비, 예약 변경·취소 연락", "Confirming the booking, preparing the service and contacting you about changes"]] },
      { h: ["보유 기간", "Retention"], p: [["시술 완료 또는 예약 취소 후 3개월(분쟁 대응용). 회원 탈퇴 시 이름·연락처는 바로 지웁니다.", "3 months after the visit or cancellation (for dispute handling). Name and phone are removed immediately if you delete your account."]] },
      { h: ["동의 거부", "Refusal"], p: [["거부할 수 있으나, 거부하면 미용실 예약을 할 수 없습니다.", "You may refuse, but you won't be able to book a salon."]] },
    ],
  },

  // ─────────────────────────────────────────────── 로그인 창: 마케팅(선택)
  marketing: {
    title: ["이벤트·혜택 알림 수신 동의 (선택)", "Receive offers and event news (optional)"],
    effective: EFF,
    articles: [
      { h: ["내용", "What you'll receive"], p: [["새 스타일, 미용실 할인, 이벤트 소식을 앱 알림·이메일로 보내 드립니다.", "New styles, salon discounts and event news by push notification or email."]] },
      { h: ["이용 항목·기간", "Data and period"], p: [["이메일, 앱 알림 토큰 · 동의 철회 또는 탈퇴 시까지", "Email and push token · until you withdraw consent or delete your account"]] },
      { h: ["철회", "Withdrawal"], p: [["동의하지 않아도 서비스를 이용할 수 있으며, [내 계정]에서 언제든 끌 수 있습니다. 예약 확인처럼 거래에 꼭 필요한 알림은 동의와 관계없이 보내 드립니다.", "Not required to use the Service. You can turn it off any time in Account. Essential notices such as booking confirmations are sent regardless."]] },
    ],
  },

  // ─────────────────────────────────────────────── 개인정보처리방침(전문)
  privacy: {
    title: ["개인정보처리방침", "Privacy Policy"],
    effective: EFF,
    intro: ["YL Company(이하 \"회사\")는 「개인정보 보호법」 등 관련 법령을 지키며, 회원의 개인정보를 다음과 같이 처리합니다.", "YL Company (\"we\") processes your personal information as described below, in compliance with applicable laws including Korea's Personal Information Protection Act and, where applicable, the EU GDPR."],
    articles: [
      { h: ["1. 처리하는 개인정보와 목적", "1. Information and purposes"], p: [
        ["· 회원 관리: 로그인 계정 고유번호, 이메일·이름(제공 시)", "· Account: sign-in account ID; email and name if provided"],
        ["· 미용실 예약: 이름, 휴대전화번호, 예약 일시, 스타일, 요청사항", "· Bookings: name, phone, date/time, style, notes"],
        ["· 마케팅(동의한 경우): 이메일, 앱 알림 토큰", "· Marketing (if you opt in): email, push token"],
        ["· 자동 수집: 접속 기록, 기기·앱 버전, 언어 설정", "· Automatically: access logs, device/app version, language"],
        ["※ 헤어스타일 미리보기의 얼굴 사진·분석 결과는 기기 안에서만 처리되며 회사가 수집하지 않습니다. 사진 저장은 회원의 사진 앱에만 저장됩니다.", "※ Face photos and analysis for previews are processed only on your device and never collected by us. Saved images go only to your own photo library."],
      ] },
      { h: ["2. 보유 및 파기", "2. Retention and deletion"], p: [
        ["회원 탈퇴 또는 목적 달성 시 지체 없이 파기합니다. 법령에 따라 보관할 정보: 소비자 불만·분쟁 처리 기록 3년(전자상거래법), 접속 기록 3개월(통신비밀보호법). 결제가 열리면 계약·결제 기록 5년이 추가됩니다.", "Deleted without delay when you delete your account or the purpose is met. Kept where required by law: complaint records 3 years, access logs 3 months (contract/payment records 5 years once payments launch)."],
      ] },
      { h: ["3. 제3자 제공", "3. Sharing"], p: [
        ["회원이 동의한 경우에만, 예약한 미용실에 예약 정보(이름, 연락처, 일시, 스타일, 요청사항)를 제공합니다. 그 밖에는 법령에 따른 경우를 제외하고 제공하지 않습니다.", "With your consent, we share booking details with the salon you book. We do not otherwise share your data except as required by law."],
      ] },
      { h: ["4. 처리 위탁 및 국외 이전", "4. Processors and international transfer"], p: [
        ["· Cloudflare, Inc.(미국) — 서버·데이터베이스 운영, 회원 탈퇴 시까지", "· Cloudflare, Inc. (USA) — hosting and database, until account deletion"],
        ["· Apple Inc.(미국) — 로그인 인증", "· Apple Inc. (USA) — sign-in authentication"],
        ["· Google LLC(미국) · 주식회사 카카오(대한민국) — 로그인 인증(해당 방식으로 로그인한 경우)", "· Google LLC (USA) · Kakao Corp. (Korea) — sign-in authentication (if you use them)"],
        ["· Resend, Inc.(미국) — 예약 알림 메일(사용 시)", "· Resend, Inc. (USA) — booking emails (if used)"],
        ["정보는 서비스 이용 시점에 암호화된 통신으로 이전됩니다. 국외 이전을 원하지 않으면 탈퇴할 수 있으나, 이 경우 로그인·예약을 이용할 수 없습니다.", "Data is transferred over encrypted connections when you use the Service. If you object, you may delete your account, but sign-in and bookings will be unavailable."],
      ] },
      { h: ["5. 회원의 권리", "5. Your rights"], p: [
        ["회원은 언제든 자신의 정보 열람·정정·삭제·처리정지·동의 철회를 요구할 수 있습니다. 앱의 [내 계정]에서 직접 하거나 아래 연락처로 요청하면 지체 없이 처리합니다. 탈퇴는 [내 계정 > 계정 삭제]에서 바로 할 수 있습니다.", "You may access, correct, delete, restrict or withdraw consent at any time — in Account, or by contacting us. Delete your account any time in Account > Delete account. EU/UK residents may also lodge a complaint with their supervisory authority."],
      ] },
      { h: ["6. 만 14세 미만", "6. Children"], p: [
        ["회사는 만 14세 미만 아동의 회원가입을 받지 않습니다.", "We do not allow sign-up by children under 14 (or under the age of digital consent in your country)."],
      ] },
      { h: ["7. 안전성 확보 조치", "7. Security"], p: [
        ["접속 토큰 암호화 저장, 통신 구간 암호화(HTTPS), 관리자 접근 권한 제한, 접속 기록 보관을 시행합니다.", "We use encrypted tokens, HTTPS, restricted admin access and access logging."],
      ] },
      { h: ["8. 개인정보 보호책임자", "8. Privacy officer"], p: [
        ["성명 이영조 · 이메일 choisunfriend@gmail.com. 개인정보 침해 신고: 개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118), 개인정보분쟁조정위원회(kopico.go.kr, 1833-6972).", "Lee Youngjo · choisunfriend@gmail.com."],
      ] },
      { h: ["9. 변경", "9. Changes"], p: [
        ["이 방침이 바뀌면 시행 7일 전(중요한 변경은 30일 전)에 서비스 안에서 알립니다.", "We will notify you in the Service 7 days before changes take effect (30 days for material changes)."],
      ] },
      { h: ["회사 정보", "Business information"], p: [BIZ] },
    ],
  },
}
