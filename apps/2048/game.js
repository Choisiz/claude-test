// 2048 순수 로직. DOM 접근 금지.
export const SIZE = 4;
export const DIRECTIONS = ['left', 'right', 'up', 'down'];

let nextId = 1;

function newId() {
  const id = nextId;
  nextId += 1;
  return id;
}

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

// 한 줄을 왼쪽으로 민다. sources[i]는 결과 i번 칸을 만든 입력 인덱스 목록(병합이면 2개).
function slideCore(values) {
  const items = [];
  values.forEach((value, index) => {
    if (value !== 0) items.push({ value, index });
  });
  const line = [];
  const sources = [];
  let gained = 0;
  for (let i = 0; i < items.length; i += 1) {
    const cur = items[i];
    const next = items[i + 1];
    if (next && next.value === cur.value) {
      const merged = cur.value * 2;
      line.push(merged);
      sources.push([cur.index, next.index]);
      gained += merged;
      i += 1;
    } else {
      line.push(cur.value);
      sources.push([cur.index]);
    }
  }
  while (line.length < SIZE) line.push(0);
  const moved = line.some((v, i) => v !== values[i]);
  return { line, sources, gained, moved };
}

export function slideLine(line) {
  const { line: result, gained, moved } = slideCore(line);
  return { line: result, gained, moved };
}

// 방향별로 줄을 구성하는 좌표 목록(밀리는 쪽이 앞)
function linePositions(direction, n) {
  const positions = [];
  for (let k = 0; k < SIZE; k += 1) {
    const i = direction === 'left' || direction === 'up' ? k : SIZE - 1 - k;
    positions.push(direction === 'left' || direction === 'right' ? [n, i] : [i, n]);
  }
  return positions;
}

export function canMove(grid) {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const cell = grid[r][c];
      if (!cell) return true;
      const right = c + 1 < SIZE ? grid[r][c + 1] : null;
      const down = r + 1 < SIZE ? grid[r + 1][c] : null;
      if ((right && right.value === cell.value) || (down && down.value === cell.value)) return true;
    }
  }
  return false;
}

function spawnTile(grid, random) {
  const empty = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (!grid[r][c]) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return null;
  const [r, c] = empty[Math.floor(random() * empty.length)];
  const tile = { id: newId(), value: random() < 0.9 ? 2 : 4 };
  grid[r][c] = tile;
  return tile;
}

export function createGame(random = Math.random) {
  const grid = emptyGrid();
  spawnTile(grid, random);
  spawnTile(grid, random);
  return { grid, score: 0, won: false, over: false, keepPlaying: false };
}

export function continueGame(state) {
  return { ...state, keepPlaying: true };
}

// 입력 상태는 변경하지 않는다. info.merges: 병합 정보, info.spawned: 새로 생긴 타일
export function move(state, direction, random = Math.random) {
  const unchanged = { state, moved: false, gained: 0, merges: [], spawned: null };
  if (state.over || !DIRECTIONS.includes(direction)) return unchanged;

  const grid = emptyGrid();
  const merges = [];
  let gained = 0;
  let moved = false;
  let reached2048 = false;

  for (let n = 0; n < SIZE; n += 1) {
    const positions = linePositions(direction, n);
    const cells = positions.map(([r, c]) => state.grid[r][c]);
    const result = slideCore(cells.map((cell) => (cell ? cell.value : 0)));
    gained += result.gained;
    if (result.moved) moved = true;
    result.line.forEach((value, i) => {
      if (value === 0) return;
      const [r, c] = positions[i];
      const src = result.sources[i];
      if (src.length === 1) {
        grid[r][c] = cells[src[0]];
      } else {
        const tile = { id: newId(), value };
        grid[r][c] = tile;
        merges.push({ id: tile.id, from: src.map((s) => cells[s].id) });
        if (value === 2048) reached2048 = true;
      }
    });
  }

  if (!moved) return unchanged;

  const spawned = spawnTile(grid, random);
  const over = !canMove(grid);
  const won = state.won || reached2048;
  const next = { grid, score: state.score + gained, won, over, keepPlaying: state.keepPlaying };
  return { state: next, moved: true, gained, merges, spawned };
}
