# CLAUDE.md

이 파일은 이 저장소에서 작업할 때 Claude Code가 따라야 할 가이드입니다.

## 프로젝트 개요

마크다운(`.md`) 파일을 읽어 블로그 웹사이트로 변환하는 프로젝트입니다.

- **프레임워크 없음**: 순수 HTML, CSS, JavaScript(ES Modules)만 사용합니다.
- **빌드 도구 없음(기본)**: 번들러/트랜스파일러 없이 정적 파일 서버만으로 동작해야 합니다.
- **다크모드 지원**: 시스템 설정을 따르고, 사용자가 수동으로 전환할 수 있습니다.
- **디자인 목표**: 깔끔하고 읽기 좋은 타이포그래피 중심의 디자인.

## 기술 제약 (반드시 지킬 것)

- React, Vue, Svelte, Tailwind, Bootstrap 등 프레임워크/UI 라이브러리를 도입하지 않는다.
- npm 의존성을 추가하지 않는다. 마크다운 파싱이 필요하면 직접 작성한 작은 파서(`js/markdown.js`)를 사용한다.
  - 파서가 감당하기 어려운 경우에만 단일 파일 라이브러리를 `vendor/`에 복사해 사용하고, 이유를 이 문서에 기록한다.
- 외부 CDN에 의존하지 않는다 (폰트 포함). 시스템 폰트 스택을 기본으로 한다.
- ES Modules(`<script type="module">`)를 사용한다. 전역 변수 오염을 피한다.
- 최신 브라우저(Chrome/Safari/Firefox 최신 2개 버전)를 대상으로 한다. 폴리필은 넣지 않는다.

## 디렉터리 구조 (목표)

```
my-blog/
├── CLAUDE.md
├── index.html          # 글 목록 페이지
├── post.html           # 글 상세 페이지 (?slug=... 로 접근)
├── css/
│   ├── base.css        # 리셋, CSS 변수(테마 토큰), 타이포그래피
│   ├── layout.css      # 헤더, 푸터, 컨테이너, 목록 레이아웃
│   └── markdown.css    # 본문(.prose) 스타일: 제목, 코드, 인용, 표 등
├── js/
│   ├── app.js          # 진입점, 라우팅
│   ├── markdown.js     # 마크다운 → HTML 변환기
│   ├── frontmatter.js  # YAML 프론트매터 파싱
│   ├── theme.js        # 다크/라이트 모드 전환
│   └── posts.js        # 글 목록(posts/index.json) 로드 및 렌더링
├── posts/
│   ├── index.json      # 글 메타데이터 목록 (slug, title, date, tags, summary)
│   └── *.md            # 블로그 글 원본
└── assets/             # 이미지 등 정적 리소스
```

구조를 바꿀 때는 이 문서도 함께 갱신한다.

## 글(포스트) 형식

각 글은 `posts/<slug>.md`이며 상단에 YAML 프론트매터를 둔다.

```markdown
---
title: 글 제목
date: 2026-10-04
tags: [javascript, 블로그]
summary: 목록에 표시될 한두 줄 요약
draft: false
---

본문 시작...
```

- `slug`는 파일명(확장자 제외)과 같고, 영문 소문자·숫자·하이픈을 권장한다.
- `draft: true`인 글은 목록에 노출하지 않는다.
- 날짜는 `YYYY-MM-DD` 형식이며 목록은 최신순으로 정렬한다.

### 글 목록 인덱스

브라우저는 디렉터리를 나열할 수 없으므로 `posts/index.json`이 글 목록의 기준이다.
새 글을 추가하면 이 파일에도 항목을 추가해야 한다. (선택 사항: `scripts/build-index.mjs`로 프론트매터에서 자동 생성하는 Node 스크립트를 둘 수 있으나, 런타임 동작은 이 스크립트에 의존하면 안 된다.)

## 마크다운 지원 범위

`js/markdown.js`가 최소한 다음을 지원해야 한다.

- 제목(`#`~`######`), 문단, 줄바꿈
- 강조(`*`, `**`, `~~`), 인라인 코드
- 링크, 이미지
- 순서/비순서 목록(중첩 포함), 체크박스 목록
- 인용(`>`), 수평선
- 펜스 코드블록(언어 표시 클래스 `language-xxx` 부여)
- 표(GFM)
- 제목에 자동 `id` 부여 (앵커 링크용)

보안: 마크다운에서 생성되는 HTML은 반드시 이스케이프하고, `javascript:` 등 위험한 URL 스킴은 차단한다. 원본 HTML 삽입은 기본적으로 허용하지 않는다.

## 디자인 가이드

### 원칙
- 본문 가독성이 최우선. 장식은 최소화한다.
- 본문 폭은 `max-width: 42rem`(약 680px) 내외, 줄 간격 `1.75` 이상.
- 본문 글자 크기는 `17~18px`, 한글 가독성을 위해 `word-break: keep-all`, `overflow-wrap: anywhere`를 사용한다.
- 충분한 여백, 낮은 시각적 노이즈, 한 개의 강조 색(accent)만 사용한다.

### 폰트
시스템 폰트 스택을 사용한다.
```css
font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard",
  "Noto Sans KR", "Segoe UI", Roboto, sans-serif;
```
코드는 `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.

### 테마(다크모드)
- 모든 색상은 `css/base.css`의 CSS 변수로만 정의하고, 다른 파일에서는 변수만 참조한다. 색상 하드코딩 금지.
- 기본값은 `prefers-color-scheme`을 따른다.
- 헤더의 토글 버튼으로 수동 전환하며, 선택은 `localStorage`(`theme` 키: `light` | `dark`)에 저장한다. 저장값이 없으면 시스템 설정을 따른다.
- `<html data-theme="light|dark">` 속성으로 제어한다.
- **FOUC 방지**: `<head>` 안에서 CSS 로드 전에 실행되는 작은 인라인 스크립트로 `data-theme`를 먼저 설정한다.
- 라이트/다크 모두 본문 텍스트 대비 WCAG AA(4.5:1) 이상을 유지한다.
- `<meta name="color-scheme" content="light dark">`를 포함한다.

### 반응형 / 접근성
- 모바일 우선. 360px 폭에서도 가로 스크롤이 생기지 않아야 한다(코드블록/표는 자체 스크롤).
- 시맨틱 태그(`header`, `main`, `article`, `nav`, `time`)를 사용한다.
- 키보드 포커스 표시를 유지하고, 토글 버튼에는 `aria-label`을 둔다.
- `prefers-reduced-motion`을 존중한다.

## 라우팅

서버 설정 없이 동작하도록 해시 또는 쿼리 기반 라우팅을 사용한다.

- 목록: `index.html`
- 상세: `post.html?slug=<slug>` (또는 `#/posts/<slug>`)

페이지 이동 시 `document.title`을 글 제목으로 갱신한다. 존재하지 않는 slug는 404 안내를 보여준다.

## 개발 / 실행

`fetch()`로 마크다운을 불러오므로 `file://`로는 동작하지 않는다. 로컬 정적 서버를 사용한다.

```bash
python3 -m http.server 8000
# 또는
npx serve .
```

브라우저에서 `http://localhost:8000` 접속.

## 코딩 컨벤션

- JS: 세미콜론 사용, `const`/`let`만 사용(`var` 금지), 2칸 들여쓰기, 작은 함수 단위로 분리.
- CSS: 클래스 기반(BEM 비슷한 단순 네이밍), 선택자 중첩 최소화, 매직 넘버 대신 변수 사용.
- HTML: 시맨틱 마크업, 인라인 스타일/이벤트 핸들러(`onclick=`) 금지. (FOUC 방지용 테마 스크립트만 인라인 허용)
- 주석은 "왜"가 필요한 곳에만 한국어로 간결하게 작성한다.
- 사용자 대면 문구(UI 텍스트)는 한국어를 기본으로 한다.

## 작업 시 주의사항

- 새 기능을 추가하기 전에 "프레임워크 없이 순수 JS/CSS로 단순하게 해결 가능한가?"를 먼저 고려한다.
- 파일을 늘리기보다 기존 모듈의 책임을 명확히 유지한다.
- UI를 변경한 뒤에는 라이트/다크 두 모드와 모바일 폭(≈375px)에서 모두 확인한다.
- 샘플 글(`posts/hello-world.md` 등)은 지원하는 모든 마크다운 요소를 포함하도록 유지해 시각 검증에 활용한다.
