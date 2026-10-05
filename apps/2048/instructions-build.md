# build 서브에이전트 지침: 2048 게임

## 역할
`/Users/cky/dev/my-blog/apps/2048/spec.md` 계획서(승인 완료, 10절에 확정 결정 사항 있음)를 **그대로** 구현한다. 계획서에 없는 기능은 추가하지 않는다.

## 수정 허용 범위
- 생성 가능: 아래 4개 파일만
  - `/Users/cky/dev/my-blog/apps/2048/index.html`
  - `/Users/cky/dev/my-blog/apps/2048/style.css`
  - `/Users/cky/dev/my-blog/apps/2048/game.js`
  - `/Users/cky/dev/my-blog/apps/2048/ui.js`
- 그 외 모든 파일은 읽기만 한다. 특히 다음은 수정 금지:
  - 블로그 파일: `index.html`(루트), `post.html`, `css/`, `js/`, `posts/`, `CLAUDE.md`, `.claude/`
  - `apps/2048/spec.md`, `apps/2048/instructions-*.md`, `apps/2048/review.md`
- git 명령(커밋 포함)은 실행하지 않는다.

## 구현 규칙
- html, js, css만 사용. 프레임워크, npm, 외부 라이브러리, CDN 사용 금지.
- 모든 경로는 상대 경로. `/apps/2048/` 밖 파일을 import하지 않는다.
- JS: ES Modules, 세미콜론 사용, `var` 금지, 2칸 들여쓰기. `game.js`는 DOM 접근 금지(순수 로직).
- CSS: 색상은 `style.css` 상단 변수로만 정의하고 이후에는 변수만 참조(하드코딩 금지).
- HTML: 인라인 이벤트 핸들러(`onclick=` 등) 금지. 테마 FOUC 방지용 인라인 스크립트만 허용.
- UI 텍스트는 한국어.
- 확정 결정: 앱 내 테마 토글 없음, 게임 복원 없음, 새 게임 확인창 없음, WASD 허용.

## 완료 전 자체 점검
- spec.md 9절 체크리스트 중 코드 읽기만으로 확인 가능한 항목을 점검한다.
- `game.js`의 `slideLine`이 spec.md 3절의 검증 예시 5개와 일치하는지 Node로 간단히 실행해 확인한다(임시 스크립트는 스크래치패드 디렉터리에 두고 프로젝트에는 남기지 않는다).
- 브라우저 검증은 하지 않는다(review 서브에이전트가 별도로 수행).

## 완료 보고
만든 파일 목록, spec과 달라진 점(있다면 이유), 막힌 점을 5줄 이내로 보고한다.
