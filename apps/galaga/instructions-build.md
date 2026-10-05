# build 서브에이전트 지침: 갤러그 게임

## 역할
`/Users/cky/dev/my-blog/apps/galaga/spec.md`(확정본)를 그대로 구현한다. spec.md를 먼저 끝까지 읽는다.

## 수정 허용 범위
- 생성/수정 가능: `/Users/cky/dev/my-blog/apps/galaga/` 안의 `index.html`, `style.css`, `game.js`, `ui.js` 네 파일만.
- 그 외 모든 파일은 읽기만 한다. spec.md, 블로그 파일(`index.html`(루트), `post.html`, `css/`, `js/`, `posts/`, `CLAUDE.md`, `.claude/`)은 수정 금지. 블로그 메인 카드 추가는 embed 단계에서 따로 한다.
- git 명령은 실행하지 않는다.

## 프로젝트 규칙
- html, js, css만. 프레임워크·외부 라이브러리·이미지/오디오 파일 없음.
- 완전히 자체 완결. 모바일에서 사용 가능해야 한다.
- 참고: `/apps/2048/`의 테마 처리(FOUC 방지 스크립트, CSS 변수 구조, `data-theme`)와 스타일 규칙을 따른다. 색상은 style.css 상단 변수에서만 정의한다.

## 핵심 요구 (반드시 지킬 것)
- 기본 목숨 5개: `INITIAL_LIVES = 5` 상수 하나로 정의, 재시작 시 5로 복구. 추가 목숨 없음.
- `game.js`는 DOM/canvas에 의존하지 않는 순수 로직이며 Node에서 로드·테스트 가능해야 한다(ES module export 또는 `globalThis` 노출 중 `ui.js`와 Node 양쪽에서 쓸 수 있는 방식 택일, 파일 상단 주석에 명시). 난수는 주입 가능.
- 효과음은 WebAudio 합성, 토글 버튼, `galaga:sound`로 저장(기본 켜짐), 실패해도 정상 동작.
- iframe 안에서 사용자 입력 전 루프를 돌리지 않고, 포커스 전 방향키/스페이스 preventDefault 금지.
- 최고 점수 키는 `galaga:best`.

## 완료 전 자체 점검
- `node --check`로 문법 확인, game.js 로직을 Node로 간단 실행해 목숨 5개 → 5번 피격 시 게임 오버 확인.
- 로컬 서버(`http://localhost:8000/apps/galaga/`)가 이미 실행 중이다. 새로 띄우지 않는다.

## 완료 보고
만든 파일, 자체 점검 결과, spec과 달라진 점(없으면 "없음")을 5줄 이내로 보고한다.
