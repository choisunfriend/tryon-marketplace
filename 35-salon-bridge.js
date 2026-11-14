// ============================================================================
// 35-salon-bridge.js (2026-11-01) — 마켓플레이스 "미용실 지도" ↔ GYEOL 헤어스타일 입어 보기
// ============================================================================
// · 3D 화면 아래 옷장 줄(bodyGarmentRack)에 「미용실」 버튼을 붙임 → 쇼핑몰 패널(iframe)을 /salons 로 엶
// · 지도에서 미용실의 스타일을 고르면 마켓플레이스가 보냄:
//     { type: "gyeol-style", id, name, gender, salon: { id, name }, spec }
//   spec 은 STYLE_SPECS 와 같은 형식(cut·perm·styling·color …). 순수 데이터만 통과시킨 뒤
//   STYLE_SPECS["salon_<id>"] 로 등록하고 applyStyleSpecAndRender 로 3D 머리에 입힘.
// · 결과를 돌려줌: { type: "gyeol-style-result", id, ok, pending?, error? }  (보낸 창·출처로만)
// · 끄기: SALON_BRIDGE.on = false
// 21-body-base.js(BODY_SHOP·openShopPanel·closeShopPanel·buildBodyGarmentRack),
// 16-style-spec-diag.js(STYLE_SPECS), 17a-mannequin.js(applyStyleSpecAndRender) 다음에 불러야 함.
// ============================================================================
const SALON_BRIDGE = { on: true, path: '/salons', closeAfterApply: true, maxBytes: 512 * 1024 }; // (2026-11-01) 앱이 원본을 재서 만든 스타일은 수십 KB — 넉넉히
// 앱 언어(uiLang)를 따름 — 영어: en · 한국어: ko
function salonL(ko, en) { try { return typeof uiLang !== 'undefined' && uiLang === 'en' ? en : ko; } catch (e) { return ko; } }

(function () {
  if (typeof window === 'undefined' || typeof BODY_SHOP === 'undefined') return;

  let shopOrigin = '';
  let shopUrl = '';
  try {
    const u = new URL(BODY_SHOP.pageUrl, location.href);
    shopOrigin = u.origin;
    shopUrl = u.href;
  } catch (e) { return; }
  const salonUrl = shopOrigin + SALON_BRIDGE.path;
  let salonOpen = false;

  // ---- 스펙 정리: 마켓플레이스 src/lib/salons-db.ts cleanSpec 과 같은 규칙 --------------------
  const BAD = new Set(['__proto__', 'prototype', 'constructor']);
  function clean(v, depth) {
    if (depth > 10) throw new Error('too deep');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') { if (!isFinite(v)) throw new Error('bad number'); return v; }
    if (typeof v === 'string') { if (v.length > 500000) throw new Error('long string'); return v; }
    if (Array.isArray(v)) { if (v.length > 20000) throw new Error('long array'); return v.map(x => clean(x, depth + 1)); }
    if (typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v)) {
        if (BAD.has(k) || !/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) throw new Error('bad key ' + k);
        out[k] = clean(v[k], depth + 1);
      }
      return out;
    }
    throw new Error('not data');
  }
  // spec.groom(빗질·지우기 명령, 37-groom-recipe.js)은 base64 덩어리라 일반 규칙(글자 120자) 대신 따로 검사
  const B64 = /^[A-Za-z0-9+/]*={0,2}$/;
  function cleanGroom(g) {
    if (!g || typeof g !== 'object' || Array.isArray(g)) return undefined;
    const out = { v: typeof g.v === 'number' ? g.v : 1 };
    if (typeof g.comb === 'string' && g.comb.length <= 260000 && B64.test(g.comb)) out.comb = g.comb;
    if (typeof g.erase === 'string' && g.erase.length <= 4000 && B64.test(g.erase)) out.erase = g.erase;
    return out.comb || out.erase ? out : undefined;
  }
  function cleanSpec(raw) {
    let groom;
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'groom' in raw) {
      groom = cleanGroom(raw.groom);
      raw = Object.assign({}, raw); delete raw.groom;
    }
    const spec = clean(raw, 0);
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('스펙이 객체가 아닙니다');
    if (!spec.cut || typeof spec.cut !== 'object') throw new Error('스펙에 cut 이 없습니다');
    if (spec.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(String(spec.color))) delete spec.color;
    if (JSON.stringify(spec).length > SALON_BRIDGE.maxBytes) throw new Error('스펙이 너무 큽니다');
    if (groom) spec.groom = groom;
    return spec;
  }

  function reply(ev, msg) {
    try { if (ev.source) ev.source.postMessage(Object.assign({ type: 'gyeol-style-result' }, msg), ev.origin); } catch (e) { /* 창이 닫힘 */ }
  }

  function toast(t) { if (typeof bodyToast === 'function') bodyToast(t); }

  // ---- 메시지 받기 ----------------------------------------------------------------------------
  window.addEventListener('message', ev => {
    if (!SALON_BRIDGE.on || ev.origin !== shopOrigin) return;
    let d = ev.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (!d || d.type !== 'gyeol-style') return;

    const rawId = String(d.id || '');
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(rawId)) return reply(ev, { id: rawId, ok: false, error: salonL('잘못된 스타일 id', 'Invalid style id') });
    let spec;
    try { spec = cleanSpec(d.spec); } catch (e) { return reply(ev, { id: rawId, ok: false, error: salonL('스타일 스펙을 읽지 못했어요: ', 'Could not read the style: ') + e.message }); }

    const salonName = d.salon && typeof d.salon.name === 'string' ? d.salon.name.slice(0, 80) : '';
    const styleName = typeof d.name === 'string' ? d.name.slice(0, 80) : (spec.name || salonL('미용실 스타일', 'Salon style'));
    spec.name = salonName ? salonName + ' · ' + styleName : styleName;

    const key = 'salon_' + rawId.replace(/-/g, '_');
    if (typeof STYLE_SPECS === 'undefined' || typeof applyStyleSpecAndRender !== 'function') {
      return reply(ev, { id: rawId, ok: false, error: salonL('이 버전의 GYEOL 은 스타일 입어 보기를 지원하지 않아요', 'This GYEOL version cannot try on styles') });
    }
    STYLE_SPECS[key] = spec;
    if (SALON_BRIDGE.closeAfterApply) closeShopPanel();

    // 앱의 정석 순서를 그대로 타되, 중간 화면은 안 보이고 바로 3D 전신으로:
    //   ① 미용실 스타일을 스타일 목록에 카드로 넣음(이번 실행 동안만 · 저장 안 함 · 「미용실에 올리기」 대상 아님)
    //   ② selectStyle = 손님이 스타일 화면에서 카드를 누른 것과 같은 준비(섹션 초기화 · 마네킹 · 스펙 예약)
    //   ③ 조정 화면 들어갈 때 하던 "예약 스펙 입히기"를 화면 이동 없이 실행
    //   ④ 입혀지면 3D 화면(model3d)을 열어 전신을 새로 그림 → 조정 화면 · 3D 가 같은 머리
    try {
      const card = {
        id: key, specId: key, spec: spec, name: styleName,
        tags: salonName ? salonL('미용실 · ', 'Salon · ') + salonName : salonL('미용실 스타일', 'Salon style'),
        isSalon: true,
        colorHex: spec.color || '#6B4A2E',
        length: 50, curl: spec.perm && typeof spec.perm.curl === 'number' ? spec.perm.curl : 0, volume: 50,
      };
      const at = STYLES.findIndex(x => x && x.id === key);
      if (at >= 0) STYLES[at] = card; else STYLES.push(card);
      if (typeof buildStyleGrid === 'function') buildStyleGrid();
      selectStyle(key);            // 스타일 화면에서 카드를 누른 것과 같은 준비(화면은 안 바뀜) → pendingSpecId 예약
      // 조정 화면에 들어갈 때 하던 "예약 스펙 입히기"를 화면 이동 없이 여기서 (05 navTo 와 같은 순서)
      const pend = state.pendingSpecId || key;
      state.pendingSpecId = null;
      state.specAppliedId = null;  // 같은 id 면 적용 함수가 "벗기기"로 동작하므로 비움
      let res = null;
      try { res = applyStyleSpecAndRender(pend); } catch (e) { console.warn('[미용실] 스펙 적용 실패', e); }
      // 바로 입혀졌거나(res), 3D 머리를 만드는 중이면(17a 가 다 만든 뒤 스스로 다시 입힘) 끝날 때까지 기다렸다가
      // 3D 전신 화면을 새로 그림 — 중간 화면(스타일·조정)은 안 보임
      const t0 = Date.now();
      (function waitThen3D() {
        if (state.specAppliedId === pend) {
          try {
            if (typeof currentScreen !== 'undefined' && currentScreen === 'model3d') setupModel3DScreen();
            else navTo('model3d');
          } catch (e) { console.warn('[미용실] 3D 화면 열기 실패', e); }
          toast(salonL(spec.name + ' 입혔어요', 'Applied ' + spec.name));
          return;
        }
        if (Date.now() - t0 < 20000) return setTimeout(waitThen3D, 150);
        // 20초 안에 못 입혔으면(사진·3D 머리가 없는 경우 등) 원래 흐름으로 — 조정 화면에서 입힘
        console.warn('[미용실] 바로 입히지 못해 조정 화면으로 넘깁니다');
        state.pendingSpecId = pend;
        try { navTo('adjust'); } catch (e) { /* 무시 */ }
        toast(salonL('3D 머리를 먼저 준비해야 해요 — 조정 화면에서 입힐게요', 'The 3D head needs preparing first — applying in Adjust'));
      })();
      if (!res) toast(salonL(spec.name + ' 을(를) 입히는 중…', 'Applying ' + spec.name + '…'));
      return reply(ev, { id: rawId, ok: true, pending: true });
    } catch (e) {
      console.warn('[미용실] 스타일 고르기 실패', e);
      return reply(ev, { id: rawId, ok: false, error: salonL('스타일을 입히지 못했어요 — 먼저 사진을 찍거나 마네킹으로 시작해 주세요', 'Could not apply — take a photo or start with the mannequin first') });
    }
  });

  // ---- 「미용실」 버튼 · 지도 패널 --------------------------------------------------------------
  function openSalonMap() {
    if (typeof openShopPanel !== 'function') return false;
    if (document.getElementById('bbShopPanel')) closeShopPanel();
    BODY_SHOP.pageUrl = salonUrl; // openShopPanel 이 iframe src 로 씀
    salonOpen = true;
    const ok = openShopPanel();
    const fr = document.getElementById('bbShopFrame');
    if (fr) fr.title = salonL('미용실 지도', 'Salon map');
    const bar = document.querySelector('#bbShopPanel .bb-shop-bar span');
    if (bar) bar.textContent = salonL('미용실 지도', 'Salon map');
    if (typeof buildBodyGarmentRack === 'function') buildBodyGarmentRack();
    return ok;
  }
  window.openSalonMap = openSalonMap;

  if (typeof closeShopPanel === 'function') {
    const _close = closeShopPanel;
    closeShopPanel = function () { // eslint-disable-line no-global-assign
      salonOpen = false;
      BODY_SHOP.pageUrl = shopUrl; // 「옷 고르기」는 다시 /shop
      return _close.apply(this, arguments);
    };
  }

  if (typeof buildBodyGarmentRack === 'function') {
    const _build = buildBodyGarmentRack;
    buildBodyGarmentRack = function () { // eslint-disable-line no-global-assign
      const r = _build.apply(this, arguments);
      try {
        const rack = document.getElementById('bodyGarmentRack');
        if (SALON_BRIDGE.on && rack && !rack.querySelector('.bb-salon-btn')) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'bb-salon-btn' + (salonOpen ? ' on' : '');
          b.textContent = salonOpen ? salonL('미용실 닫기', 'Close salons') : salonL('미용실', 'Salons');
          b.title = salonL('근처 미용실 지도에서 헤어스타일을 골라 입어 봅니다', 'Find salons nearby and try their hairstyles');
          b.addEventListener('click', () => (salonOpen ? closeShopPanel() : openSalonMap()));
          rack.appendChild(b);
          // 지도가 열려 있을 땐 「옷 닫기」 대신 「옷 고르기」로 보이게
          if (salonOpen) {
            for (const x of rack.querySelectorAll('button')) {
              if (x === b || !/^(옷 닫기|Close clothes)$/.test(x.textContent.trim())) continue;
              const n = x.cloneNode(false); // 원래 「닫기」 동작을 떼어 내고 「옷 고르기」로 바꿈
              n.textContent = salonL('옷 고르기', 'Browse clothes');
              n.classList.remove('on');
              n.addEventListener('click', () => { closeShopPanel(); openShopPanel(); });
              x.replaceWith(n);
            }
          }
        }
      } catch (e) { /* 버튼만 못 붙임 */ }
      return r;
    };
  }
})();

// ============================================================================
// (2026-11-01) 「미용실에 올리기」 — 스타일 화면 아래쪽(← 촬영 · 삭제 · 조정하기 →) 줄의 버튼
// ============================================================================
// · 디자이너가 앱에서 등록한 스타일(isCustom · spec 있음)을 고르면 켜짐 → 누르면 마켓플레이스에 올림
//   (스타일 등록은 원래 기능 registerCurrentAsStyle → buildSpecFromCurrent 가 cm 스펙을 만듦)
// · 새 창: 마켓플레이스 /admin/salons/upload#d=<base64url JSON { spec, thumb }>
//   (#뒤는 서버로 안 감 · 로그인 전이면 로그인 거쳐 그대로 돌아옴)
// · spec.gyeol = { app:'gyeol', v:1, at } — 마켓플레이스는 이 표시가 있는 스펙만 받음
// · 앱 기본 스타일(레이어드 보브 등)은 못 올림 — 디자이너가 직접 만든 것만
// ============================================================================
const SALON_UPLOAD = { path: '/admin/salons/upload', thumbPx: 320, thumbQuality: 0.72 };

function _salonUploadable(st) {
  return !!(st && st.isCustom && st.spec && typeof st.spec === 'object' && st.spec.cut);
}

function syncSalonUploadBtn() {
  const btn = document.getElementById('salonUploadBtn');
  if (!btn) return;
  const st = typeof state !== 'undefined' ? state.selectedStyle : null;
  btn.disabled = !_salonUploadable(st);
  btn.textContent = salonL('✂ 미용실에 올리기', '✂ Upload to salon');
  btn.title = st && !st.isCustom
    ? salonL('앱 기본 스타일은 올릴 수 없어요 — 직접 만들어 등록한 스타일을 골라 주세요', 'Built-in styles cannot be uploaded — pick a style you made and saved')
    : st && !st.spec
      ? salonL('3D 준비 전에 등록한 스타일이라 올릴 수 없어요 — 3D 화면을 연 뒤 다시 등록해 주세요', 'This style was saved before 3D was ready — open 3D and save it again')
      : salonL('고른 내 스타일을 내 미용실 헤어스타일로 올립니다 (미용실 관리자 로그인 필요)', 'Upload the selected style to your salon (salon admin login needed)');
}

// 손질 화면 캔버스를 작은 JPEG 로 — 지금 그 스타일이 걸려 있을 때만 (아니면 null → 머리색 견본으로 표시)
function _styleThumb(st) {
  try {
    if (!st || !state.specAppliedId || state.specAppliedId !== st.specId) return null;
    const src = document.getElementById('adjustCanvas');
    if (!src || !src.width || !src.height) return null;
    const px = SALON_UPLOAD.thumbPx, side = Math.min(src.width, src.height);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.fillStyle = '#1b1816'; g.fillRect(0, 0, px, px);
    g.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, px, px);
    const url = c.toDataURL('image/jpeg', SALON_UPLOAD.thumbQuality);
    return url.length < 120000 ? url : null;
  } catch (e) { return null; }
}

function _b64url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _salonNotice(msg) {
  if (typeof showToast === 'function') showToast(msg); else alert(msg);
}

function uploadStyleToSalon() {
  const st = typeof state !== 'undefined' ? state.selectedStyle : null;
  if (!_salonUploadable(st)) { _salonNotice(salonL('직접 만들어 등록한 스타일을 먼저 골라 주세요', 'Pick a style you made and saved first')); return false; }
  const spec = JSON.parse(JSON.stringify(st.spec));
  spec.name = String(st.name || spec.name || '').slice(0, 80);
  if (!spec.color && typeof st.colorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(st.colorHex)) spec.color = st.colorHex.toUpperCase();
  spec.gyeol = { app: 'gyeol', v: 1, at: new Date().toISOString() };
  const _noGroom = Object.assign({}, spec); delete _noGroom.groom;
  if (JSON.stringify(_noGroom).length > SALON_BRIDGE.maxBytes) { _salonNotice(salonL('스타일 정보가 너무 커서 올릴 수 없어요', 'This style is too large to upload')); return false; }
  let origin = '';
  try { origin = new URL(BODY_SHOP.pageUrl, location.href).origin; } catch (e) { return false; }
  // 썸네일: 등록할 때 찍어 둔 다듬은 3D 화면(37) → 없으면 지금 손질 화면
  const thumb = typeof st.thumb === 'string' && /^data:image\/jpeg;base64,/.test(st.thumb) ? st.thumb : _styleThumb(st);
  const payload = _b64url(JSON.stringify({ spec: spec, thumb: thumb }));
  const w = window.open(origin + SALON_UPLOAD.path + '#d=' + payload, '_blank');
  if (!w) { _salonNotice(salonL('팝업이 막혔어요 — 팝업을 허용하고 다시 눌러 주세요', 'Pop-up blocked — allow pop-ups and try again')); return false; }
  try { w.opener = null; } catch (e) { /* 무시 */ }
  return true;
}
window.uploadStyleToSalon = uploadStyleToSalon;

// 스타일을 고를 때마다(삭제 버튼과 같은 때) 같이 켜고 끔 · 언어를 바꿔도 다시 그림
(function () {
  if (typeof syncStyleDeleteBtn === 'function') {
    const _sync = syncStyleDeleteBtn;
    syncStyleDeleteBtn = function () { // eslint-disable-line no-global-assign
      const r = _sync.apply(this, arguments);
      try { syncSalonUploadBtn(); } catch (e) { /* 무시 */ }
      return r;
    };
  }
  if (typeof buildStyleGrid === 'function') {
    const _grid = buildStyleGrid;
    buildStyleGrid = function () { // eslint-disable-line no-global-assign
      const r = _grid.apply(this, arguments);
      try { syncSalonUploadBtn(); } catch (e) { /* 무시 */ }
      return r;
    };
  }
  document.addEventListener('click', e => {
    if (e.target && e.target.closest && e.target.closest('[onclick*="setLang"], [onclick*="toggleLang"], #langToggle, .lang-btn')) setTimeout(() => {
      syncSalonUploadBtn();
      if (document.getElementById('bodyGarmentRack') && typeof buildBodyGarmentRack === 'function') buildBodyGarmentRack();
    }, 0);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncSalonUploadBtn); else syncSalonUploadBtn();
})();
