---
title: 프레임워크 없이 다크모드 만들기
date: 2026-10-02
tags: [css, javascript]
summary: CSS 변수와 data-theme 속성만으로 구현한 다크모드 메모.
---

다크모드는 생각보다 단순합니다. 색상을 **CSS 변수**로 모으고, `data-theme` 속성으로 값을 바꾸면 됩니다.

## 핵심 아이디어

1. 모든 색상을 `:root`의 변수로 정의한다.
2. `[data-theme="dark"]`에서 같은 변수를 덮어쓴다.
3. 저장된 선택이 없으면 `prefers-color-scheme`을 따른다.

```css
:root { --bg: #fff; --text: #111; }
:root[data-theme="dark"] { --bg: #121315; --text: #eee; }
```

## 깜빡임 방지

CSS가 로드되기 전에 `<head>`의 작은 스크립트로 저장된 테마를 먼저 적용하면 화면이 번쩍이지 않습니다.
