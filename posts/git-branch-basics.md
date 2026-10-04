---
title: Git 브랜치 기본기: 만들고, 합치고, 정리하기
date: 2026-10-04
tags: [git, 개발도구]
summary: 협업의 기본이 되는 Git 브랜치 명령어와 merge, rebase의 차이를 정리했습니다.
---

브랜치는 **독립된 작업 공간**입니다. 메인 코드를 건드리지 않고 기능을 개발하거나 실험할 수 있고, 끝나면 하나로 합칩니다. Git에서 브랜치는 커밋을 가리키는 가벼운 포인터라서 만들고 지우는 비용이 거의 없습니다.

## 기본 명령어

```bash
git branch                    # 브랜치 목록
git switch -c feature/login   # 새 브랜치를 만들고 이동
git switch main               # 기존 브랜치로 이동
git branch -d feature/login   # 합쳐진 브랜치 삭제
```

> `git checkout`도 같은 일을 하지만, 역할이 여러 개라 헷갈립니다. 브랜치 이동은 `switch`, 파일 복원은 `restore`를 쓰면 의도가 분명해집니다.

## 작업 흐름

1. `main`에서 최신 코드를 받는다.
2. 기능 브랜치를 만들어 작업하고 커밋한다.
3. 원격에 푸시하고 Pull Request를 연다.
4. 리뷰를 거쳐 `main`에 합친다.
5. 합쳐진 브랜치를 삭제한다.

```bash
git switch main
git pull
git switch -c feature/dark-mode

# 작업 후
git add .
git commit -m "다크모드 토글 추가"
git push -u origin feature/dark-mode
```

## merge와 rebase

두 방식 모두 다른 브랜치의 변경을 가져오지만 **히스토리 모양**이 다릅니다.

| 구분 | merge | rebase |
| :--- | :--- | :--- |
| 방식 | 합치는 커밋을 새로 만든다 | 내 커밋을 최신 위에 다시 쌓는다 |
| 히스토리 | 갈라졌다 합쳐진 모습이 남는다 | 한 줄로 깔끔하다 |
| 기존 커밋 | 그대로 유지 | 해시가 바뀐다 |
| 안전성 | 높음 | 공유된 브랜치에서는 위험 |

```bash
# merge: main의 변경을 내 브랜치로
git switch feature/dark-mode
git merge main

# rebase: 내 커밋을 main 위로 옮기기
git switch feature/dark-mode
git rebase main
```

**이미 푸시해서 다른 사람이 쓰는 브랜치는 rebase 하지 않는다**는 규칙만 기억해도 사고를 크게 줄일 수 있습니다.

## 충돌 해결

같은 부분을 서로 다르게 고쳤다면 충돌이 납니다. 파일에는 이런 표시가 남습니다.

```text
<<<<<<< HEAD
내 브랜치의 내용
=======
합치려는 브랜치의 내용
>>>>>>> main
```

표시를 지우고 원하는 내용으로 정리한 뒤 마무리합니다.

```bash
git add <파일>
git merge --continue   # rebase 중이라면 git rebase --continue
```

중간에 포기하고 싶다면 `git merge --abort` 또는 `git rebase --abort`로 시작 전 상태로 돌아갈 수 있습니다.

## 습관 몇 가지

- 브랜치 이름에 목적을 담는다: `feature/`, `fix/`, `docs/`
- 브랜치는 **작게, 짧게** 유지한다. 오래 갈수록 충돌이 커진다.
- 커밋은 한 가지 변경만 담고, 메시지는 *무엇을 왜* 바꿨는지 쓴다.
- 합친 브랜치는 바로 삭제해 목록을 깨끗하게 둔다.

## 정리

브랜치는 부담 없이 만들고, 작게 나눠 작업하고, 합친 뒤에는 정리하는 도구입니다. 처음에는 `switch -c`, `merge`, `branch -d` 세 가지만 익혀도 충분합니다.
