---
title: Promise와 async/await 한눈에 정리
date: 2026-10-04
tags: [javascript, 비동기]
summary: 콜백 지옥에서 Promise, async/await까지 자바스크립트 비동기 처리의 흐름을 정리했습니다.
---

자바스크립트는 싱글 스레드라서 네트워크 요청처럼 오래 걸리는 작업을 **기다리는 동안 다른 일을 처리**할 수 있어야 합니다. 이를 위한 도구가 콜백, Promise, 그리고 `async/await`입니다.

## 콜백의 한계

```js
getUser(1, (user) => {
  getPosts(user.id, (posts) => {
    getComments(posts[0].id, (comments) => {
      console.log(comments); // 들여쓰기가 계속 깊어진다
    });
  });
});
```

단계가 늘어날수록 코드가 오른쪽으로 밀리고, 에러 처리도 곳곳에 흩어집니다.

## Promise

Promise는 **아직 끝나지 않은 작업의 결과**를 나타내는 객체이며, 세 가지 상태를 가집니다.

| 상태 | 의미 |
| :--- | :--- |
| pending | 진행 중 |
| fulfilled | 성공, 결과값을 가짐 |
| rejected | 실패, 이유를 가짐 |

```js
getUser(1)
  .then((user) => getPosts(user.id))
  .then((posts) => getComments(posts[0].id))
  .then((comments) => console.log(comments))
  .catch((err) => console.error(err));
```

`then`을 이어 붙이면 흐름이 위에서 아래로 읽히고, `catch` 하나로 에러를 모을 수 있습니다.

## async/await

`async/await`는 Promise를 **동기 코드처럼** 읽히게 해 주는 문법입니다.

```js
async function load() {
  try {
    const user = await getUser(1);
    const posts = await getPosts(user.id);
    const comments = await getComments(posts[0].id);
    console.log(comments);
  } catch (err) {
    console.error(err);
  }
}
```

- `async` 함수는 항상 Promise를 반환한다.
- `await`는 Promise가 끝날 때까지 **그 함수 안에서만** 기다린다. 다른 코드는 계속 실행된다.
- 에러는 `try...catch`로 처리한다.

## 병렬로 실행하기

서로 의존하지 않는 작업을 하나씩 `await` 하면 불필요하게 느려집니다.

```js
// 느림: 순서대로 기다린다 (약 2초)
const a = await fetchA(); // 1초
const b = await fetchB(); // 1초

// 빠름: 동시에 시작한다 (약 1초)
const [a2, b2] = await Promise.all([fetchA(), fetchB()]);
```

> 하나라도 실패하면 `Promise.all`은 전체가 실패합니다. 일부 실패를 허용하려면 `Promise.allSettled`를 쓰세요.

## 자주 하는 실수

1. `await`를 빼먹어서 Promise 객체를 값처럼 사용한다.
2. `forEach` 안에서 `await`를 쓴다. `forEach`는 Promise를 기다려 주지 않으므로 `for...of`나 `Promise.all`을 사용한다.
3. 에러 처리를 하지 않아 실패가 조용히 사라진다.

## 정리

- 콜백보다 **Promise**, Promise보다 **async/await**가 읽기 쉽다.
- 독립적인 작업은 `Promise.all`로 **병렬 실행**한다.
- 에러 처리는 `try...catch`를 잊지 않는다.
