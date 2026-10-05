import { createGame, move, continueGame, SIZE } from './game.js';

const BEST_KEY = '2048:best';
const SWIPE_MIN = 30;
const SWIPE_RATIO = 1.5;
const MOVE_MS = 120;

const KEY_DIRECTIONS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
};

const el = {
  board: document.getElementById('board'),
  tiles: document.getElementById('tiles'),
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  live: document.getElementById('live'),
  newGame: document.getElementById('new-game'),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlayText: document.getElementById('overlay-text'),
  overlayPrimary: document.getElementById('overlay-primary'),
  overlaySecondary: document.getElementById('overlay-secondary'),
};

let state = createGame();
let best = loadBest();
let renderQueued = false;
let pendingMerges = [];
let pendingSpawned = null;
let overlayMode = null; // null | 'over' | 'won'
const tileEls = new Map();

function loadBest() {
  try {
    const n = Number.parseInt(localStorage.getItem(BEST_KEY), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) {
    return 0;
  }
}

function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch (e) {
    // 저장 실패 시 메모리에서만 유지
  }
}

function announce(message) {
  // 같은 문구가 반복돼도 낭독되도록 비운 뒤 설정
  el.live.textContent = '';
  el.live.textContent = message;
}

function createTileEl(id) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.setAttribute('aria-hidden', 'true');
  const inner = document.createElement('div');
  inner.className = 'tile__inner';
  tile.append(inner);
  tileEls.set(id, tile);
  el.tiles.append(tile);
  return tile;
}

function placeTile(tile, r, c) {
  tile.style.setProperty('--x', String(c));
  tile.style.setProperty('--y', String(r));
}

function renderTiles() {
  const alive = new Set();
  const positions = new Map();
  const mergedIds = new Set(pendingMerges.map((m) => m.id));
  const spawnedId = pendingSpawned ? pendingSpawned.id : null;

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const cell = state.grid[r][c];
      if (!cell) continue;
      alive.add(cell.id);
      positions.set(cell.id, [r, c]);
      let tile = tileEls.get(cell.id);
      if (!tile) {
        tile = createTileEl(cell.id);
        placeTile(tile, r, c);
        if (cell.id === spawnedId) tile.classList.add('tile--new');
        if (mergedIds.has(cell.id)) tile.classList.add('tile--merged');
      } else {
        placeTile(tile, r, c);
      }
      tile.dataset.value = String(cell.value);
      tile.dataset.digits = String(String(cell.value).length);
      tile.firstElementChild.textContent = String(cell.value);
    }
  }

  // 병합되어 사라지는 타일은 합쳐진 위치로 이동한 뒤 제거
  const target = new Map();
  pendingMerges.forEach((m) => m.from.forEach((id) => target.set(id, m.id)));
  for (const [id, tile] of tileEls) {
    if (alive.has(id)) continue;
    tileEls.delete(id);
    const dest = positions.get(target.get(id));
    if (dest) placeTile(tile, dest[0], dest[1]);
    window.setTimeout(() => tile.remove(), dest ? MOVE_MS : 0);
  }
}

function showOverlay(mode) {
  overlayMode = mode;
  if (mode === 'over') {
    el.overlayTitle.textContent = '게임 오버';
    el.overlayText.textContent = `최종 점수 ${state.score}점`;
    el.overlayPrimary.textContent = '다시 시작';
    el.overlaySecondary.hidden = true;
  } else {
    el.overlayTitle.textContent = '2048 달성!';
    el.overlayText.textContent = `현재 점수 ${state.score}점`;
    el.overlayPrimary.textContent = '계속하기';
    el.overlaySecondary.hidden = false;
  }
  el.overlay.hidden = false;
  el.overlayPrimary.focus();
}

function hideOverlay() {
  const wasOpen = overlayMode !== null;
  overlayMode = null;
  el.overlay.hidden = true;
  if (wasOpen) el.newGame.focus();
}

function syncOverlay() {
  const wanted = state.over ? 'over' : state.won && !state.keepPlaying ? 'won' : null;
  if (wanted === overlayMode) return;
  if (wanted) {
    showOverlay(wanted);
    announce(wanted === 'over' ? `게임 오버. 최종 점수 ${state.score}점` : '2048 타일을 만들었습니다');
  } else {
    hideOverlay();
  }
}

function render() {
  renderQueued = false;
  el.score.textContent = String(state.score);
  el.best.textContent = String(best);
  renderTiles();
  pendingMerges = [];
  pendingSpawned = null;
  syncOverlay();
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  window.requestAnimationFrame(render);
}

function handleMove(direction) {
  if (overlayMode !== null) return;
  const result = move(state, direction);
  if (!result.moved) return;
  state = result.state;
  pendingMerges.push(...result.merges);
  pendingSpawned = result.spawned || pendingSpawned;

  let message = '';
  if (result.gained > 0) {
    message = `점수 ${state.score}점`;
    if (state.score > best) {
      best = state.score;
      saveBest();
      message += '. 최고 점수 갱신';
    }
  }
  // 게임 오버/2048 오버레이가 뜨는 경우에는 오버레이 안내를 우선한다
  const overlayPending = state.over || (state.won && !state.keepPlaying);
  if (message && !overlayPending) announce(message);
  scheduleRender();
}

function startNewGame() {
  state = createGame();
  pendingMerges = [];
  pendingSpawned = null;
  for (const tile of tileEls.values()) tile.remove();
  tileEls.clear();
  // 새 게임의 시작 타일은 애니메이션 없이 배치
  hideOverlay();
  announce('새 게임을 시작했습니다');
  scheduleRender();
}

function onKeyDown(event) {
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const direction = KEY_DIRECTIONS[key];
  if (!direction) return;
  event.preventDefault();
  handleMove(direction);
}

let touchStart = null;
let multiTouch = false;

function onTouchStart(event) {
  if (event.touches.length > 1) {
    multiTouch = true;
    touchStart = null;
    return;
  }
  multiTouch = false;
  const t = event.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}

function onTouchEnd(event) {
  if (event.touches.length > 0) return;
  if (multiTouch || !touchStart) {
    multiTouch = false;
    touchStart = null;
    return;
  }
  const t = event.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const major = Math.max(ax, ay);
  const minor = Math.min(ax, ay);
  if (major < SWIPE_MIN || major < minor * SWIPE_RATIO) return;
  if (ax > ay) handleMove(dx > 0 ? 'right' : 'left');
  else handleMove(dy > 0 ? 'down' : 'up');
}

function onTouchCancel() {
  touchStart = null;
  multiTouch = false;
}

document.addEventListener('keydown', onKeyDown);
el.board.addEventListener('touchstart', onTouchStart, { passive: true });
el.board.addEventListener('touchend', onTouchEnd);
el.board.addEventListener('touchcancel', onTouchCancel);
el.newGame.addEventListener('click', startNewGame);
el.overlaySecondary.addEventListener('click', startNewGame);
el.overlayPrimary.addEventListener('click', () => {
  if (overlayMode === 'won') {
    state = continueGame(state);
    scheduleRender();
  } else {
    startNewGame();
  }
});

render();
