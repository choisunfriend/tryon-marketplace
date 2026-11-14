"use client"

import { useEffect } from "react"

// ============================================================================
// (2026-11-14) 브라우저 자동 번역(크롬·구글 번역, 엣지, 사파리)과 React 가 부딪혀 화면이 멈추지 않게
// ============================================================================
// 화면 글자는 따로 번역 파일을 만들지 않고 브라우저 자동 번역에 맡긴다(사용자 결정).
// 그런데 구글 번역은 글자 덩어리를 <font> 로 바꿔 끼우고, 그 뒤 React 가 원래 글자 노드를
// 지우거나 그 앞에 끼우려 하면 "Failed to execute 'removeChild' on 'Node'" 로 화면 전체가 하얗게 멈춘다
// (React·Next 사이트에서 널리 알려진 문제 — facebook/react#11538).
// 부모가 이미 바뀐 노드는 조용히 건너뛰게 removeChild·insertBefore 를 한 번 감싼다.
// 번역을 안 쓰는 사람에게는 아무 영향이 없다(부모가 맞으면 원래 함수 그대로).
//
// lang: 이 화면 글자의 실제 언어. 브라우저는 <html lang> 을 보고 "번역할까요?"를 띄울지 정하는데,
// 루트가 lang="en" 이라 한국어인 관리자 화면에서 영어 사용자에게 번역 제안이 안 뜰 수 있었다.
// ============================================================================

let patched = false

function patchDom() {
  if (patched || typeof Node === "undefined") return
  patched = true
  const origRemove = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      // 번역기가 이미 옮긴 노드 — 지울 게 없다
      return child
    }
    return origRemove.call(this, child) as T
  }
  const origInsert = Node.prototype.insertBefore
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      // 기준 노드가 번역기에 바뀌어 없어짐 — 끝에 붙인다
      return origInsert.call(this, node, null) as T
    }
    return origInsert.call(this, node, ref) as T
  }
}

export function TranslateGuard({ lang }: { lang?: string }) {
  useEffect(() => {
    patchDom()
  }, [])
  useEffect(() => {
    if (!lang) return
    const el = document.documentElement
    const prev = el.lang
    el.lang = lang
    return () => {
      el.lang = prev
    }
  }, [lang])
  return null
}
