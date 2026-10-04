---
title: Hello, World! 마크다운 블로그 시작하기
date: 2026-10-04
tags: [블로그, markdown]
summary: 지원하는 모든 마크다운 요소를 한 번에 확인할 수 있는 샘플 글입니다.
draft: false
---

이 글은 **마크다운 → HTML 변환기**가 지원하는 요소를 모두 보여주는 샘플입니다. *기울임*, ~~취소선~~, `인라인 코드`, 그리고 [링크](https://developer.mozilla.org)를 쓸 수 있습니다.

## 제목 위계

### 세 번째 단계

#### 네 번째 단계

## 목록

- 첫 번째 항목
- 두 번째 항목
  - 중첩된 항목 A
  - 중첩된 항목 B
- 세 번째 항목

1. 순서가 있는 목록
2. 두 번째
3. 세 번째

- [x] 완료한 일
- [ ] 아직 안 한 일

## 인용

> 읽기 좋은 글은 여백에서 시작한다.
>
> 인용문 안에서도 **서식**을 쓸 수 있습니다.

## 코드

```js
function greet(name) {
  return `안녕하세요, ${name}!`;
}
console.log(greet('블로그'));
```

## 표

| 이름 | 역할 | 비고 |
| :--- | :---: | ---: |
| markdown.js | 파서 | 직접 작성 |
| theme.js | 다크모드 | localStorage |
| posts.js | 목록 | index.json |

---

## 링크

외부 링크는 새 탭에서 열립니다: [MDN](https://developer.mozilla.org). 위험한 스킴의 링크 [클릭](javascript:void) 는 `#`으로 치환됩니다.
