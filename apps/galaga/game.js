/*
 * game.js - 갤러그 순수 로직 (DOM/canvas 의존 없음)
 *
 * 노출 방식(둘 다 지원):
 *  - 브라우저: 클래식 <script src="game.js">로 로드하면 globalThis.GalagaGame 이 생긴다. (ui.js 에서 사용)
 *  - Node: const GalagaGame = require('./game.js');  (module.exports)
 * 난수는 createGame({ rng }) 로 주입 가능 (기본 Math.random).
 */
(function (root) {
  'use strict';

  // ---- 상수 ----
  const INITIAL_LIVES = 5; // 기본 목숨. 다른 곳에서 숫자를 직접 쓰지 않는다. 추가 목숨 없음.
  const W = 480;
  const H = 640;
  const STEP = 1 / 60;
  const MAX_FRAME = 0.1;

  const PLAYER_Y = 560;
  const PLAYER_HALF_W = 16;
  const PLAYER_HALF_H = 12;
  const PLAYER_SPEED = 240;
  const SHOT_SPEED = 480;
  const SHOT_COOLDOWN = 0.35;
  const MAX_SHOTS = 3;
  const INVULN_TIME = 2.0;
  const ENEMY_LINE_Y = 520;

  const COLS = 8;
  const ROWS = 5;
  const CELL_W = 36;
  const CELL_H = 30;
  const GRID_LEFT = (W - COLS * CELL_W) / 2;
  const GRID_TOP = 60;
  const DESCEND = 24;
  const ENEMY_HALF_W = 12;
  const ENEMY_HALF_H = 10;
  const DIVE_SPEED = 150;
  const RETURN_SPEED = 220;
  const ENTRY_TIME = 1.4;
  const STAGE_INTRO_TIME = 1.5;
  const GAMEOVER_LOCK = 0.5;
  const WALL_MARGIN = 12;

  // 줄 0: 보스, 1-2: 나비, 3-4: 벌레
  const ENEMY_TYPES = {
    boss: { hp: 2, score: 150, diveScore: 300 },
    butterfly: { hp: 1, score: 80, diveScore: 160 },
    bee: { hp: 1, score: 50, diveScore: 100 },
  };
  const ROW_TYPES = ['boss', 'butterfly', 'butterfly', 'bee', 'bee'];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function difficulty(stage) {
    const n = Math.max(1, stage) - 1;
    return {
      formationSpeed: Math.min(100, 40 + 4 * n),
      diveInterval: Math.max(0.7, 2.0 - 0.15 * n),
      maxDivers: Math.min(5, 2 + Math.floor(n / 2)),
      fireInterval: Math.max(0.5, 1.5 - 0.1 * n),
      bulletSpeed: Math.min(320, 200 + 15 * n),
      maxBullets: Math.min(8, 3 + n),
    };
  }

  function createGame(opts) {
    opts = opts || {};
    const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
    const s = {
      W: W, H: H,
      phase: 'ready', // ready | stageIntro | playing | paused | gameover
      prevPhase: 'playing',
      score: 0,
      best: Math.max(0, opts.best | 0),
      lives: INITIAL_LIVES,
      stage: 1,
      time: 0,
      player: { x: W / 2, y: PLAYER_Y, invuln: 0, cool: 0 },
      shots: [],
      ebullets: [],
      enemies: [],
      fx: { ox: 0, oy: 0, dir: 1 },
      diveTimer: 0,
      fireTimer: 0,
      introTimer: 0,
      lockTimer: 0,
      lostLife: false,
      nextId: 1,
      events: [],
    };

    function emit(type, data) {
      const ev = data || {};
      ev.type = type;
      s.events.push(ev);
    }

    function addScore(n) {
      s.score += n;
      if (s.score > s.best) s.best = s.score;
    }

    function slotOf(e) {
      return {
        x: GRID_LEFT + e.col * CELL_W + CELL_W / 2 + s.fx.ox,
        y: GRID_TOP + e.row * CELL_H + CELL_H / 2 + s.fx.oy,
      };
    }

    function spawnStage(entering) {
      s.enemies = [];
      s.fx = { ox: 0, oy: 0, dir: 1 };
      let i = 0;
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const type = ROW_TYPES[row];
          const e = {
            id: s.nextId++, type: type, row: row, col: col,
            hp: ENEMY_TYPES[type].hp, state: 'formation',
            x: 0, y: 0, dead: false,
            delay: 0, t: 0, sx: 0, sy: 0, dive: null,
          };
          const slot = slotOf(e);
          e.x = slot.x; e.y = slot.y;
          if (entering) {
            e.state = 'entry';
            e.delay = i * 0.05;
            e.sx = i % 2 ? -30 : W + 30;
            e.sy = -30;
            e.x = e.sx; e.y = e.sy;
          }
          s.enemies.push(e);
          i++;
        }
      }
    }

    function resetRun() {
      s.score = 0;
      s.lives = INITIAL_LIVES;
      s.stage = 1;
      s.time = 0;
      s.player = { x: W / 2, y: PLAYER_Y, invuln: 0, cool: 0 };
      s.shots = [];
      s.ebullets = [];
      s.enemies = [];
      s.lostLife = false;
      s.lockTimer = 0;
    }

    function beginStageIntro() {
      s.phase = 'stageIntro';
      s.introTimer = STAGE_INTRO_TIME;
      s.shots = [];
      s.ebullets = [];
      s.enemies = [];
      s.lostLife = false;
      s.diveTimer = difficulty(s.stage).diveInterval;
      s.fireTimer = difficulty(s.stage).fireInterval;
      emit('stage', { stage: s.stage });
    }

    function applyHit() {
      s.lives -= 1;
      s.lostLife = true;
      emit('hit', { x: s.player.x, y: s.player.y, lives: s.lives });
      s.ebullets = [];
      if (s.lives <= 0) {
        s.lives = 0;
        s.phase = 'gameover';
        s.lockTimer = GAMEOVER_LOCK;
        emit('gameover', { score: s.score });
        return;
      }
      s.player.x = W / 2;
      s.player.invuln = INVULN_TIME;
    }

    function movePlayer(dt, input) {
      const dir = (input && input.right ? 1 : 0) - (input && input.left ? 1 : 0);
      s.player.x = clamp(s.player.x + dir * PLAYER_SPEED * dt, PLAYER_HALF_W, W - PLAYER_HALF_W);
    }

    function startDive(e, offsetBase) {
      e.state = 'dive';
      e.dive = {
        t: 0,
        baseX: e.x + (offsetBase || 0),
        amp: 40 + rng() * 40,
        freq: 2 + rng(),
        fired: false,
        fireY: 160 + rng() * 240,
      };
    }

    function pickFormation(filter) {
      const list = s.enemies.filter(function (e) { return e.state === 'formation' && !e.dead && (!filter || filter(e)); });
      if (!list.length) return null;
      return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
    }

    function updateEnemies(dt, d) {
      let entering = false;
      for (const e of s.enemies) if (e.state === 'entry') { entering = true; break; }

      // 편대 좌우 이동 (진입이 끝난 뒤)
      if (!entering && s.enemies.length) {
        let minCol = COLS, maxCol = -1;
        for (const e of s.enemies) { if (e.col < minCol) minCol = e.col; if (e.col > maxCol) maxCol = e.col; }
        s.fx.ox += s.fx.dir * d.formationSpeed * dt;
        const left = GRID_LEFT + minCol * CELL_W + s.fx.ox;
        const right = GRID_LEFT + (maxCol + 1) * CELL_W + s.fx.ox;
        if (left < WALL_MARGIN) {
          s.fx.ox += WALL_MARGIN - left; s.fx.dir = 1; s.fx.oy += DESCEND;
        } else if (right > W - WALL_MARGIN) {
          s.fx.ox -= right - (W - WALL_MARGIN); s.fx.dir = -1; s.fx.oy += DESCEND;
        }
      }

      let lineHit = false;
      for (const e of s.enemies) {
        if (e.dead) continue;
        const slot = slotOf(e);
        if (e.state === 'entry') {
          if (e.delay > 0) { e.delay -= dt; continue; }
          e.t += dt / ENTRY_TIME;
          if (e.t >= 1) { e.state = 'formation'; e.x = slot.x; e.y = slot.y; continue; }
          const k = e.t * e.t * (3 - 2 * e.t);
          e.x = e.sx + (slot.x - e.sx) * k + Math.sin(e.t * Math.PI) * (e.sx < 0 ? 60 : -60);
          e.y = e.sy + (slot.y - e.sy) * k;
        } else if (e.state === 'formation') {
          e.x = slot.x; e.y = slot.y;
          if (e.y >= ENEMY_LINE_Y) {
            e.dead = true;
            lineHit = true;
            emit('explode', { x: e.x, y: e.y, kind: e.type });
          }
        } else if (e.state === 'dive') {
          const dv = e.dive;
          dv.t += dt;
          dv.baseX += clamp(s.player.x - dv.baseX, -35 * dt, 35 * dt);
          e.y += DIVE_SPEED * dt;
          e.x = clamp(dv.baseX + dv.amp * Math.sin(dv.t * dv.freq), ENEMY_HALF_W, W - ENEMY_HALF_W);
          if (!dv.fired && e.y >= dv.fireY && s.ebullets.length < d.maxBullets) {
            dv.fired = true;
            s.ebullets.push({ x: e.x, y: e.y + 10, vy: d.bulletSpeed });
          }
          if (e.y > H + 20) { e.state = 'return'; e.x = slot.x; e.y = -30; e.dive = null; }
        } else if (e.state === 'return') {
          const dx = slot.x - e.x, dy = slot.y - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const stepLen = RETURN_SPEED * dt;
          if (dist <= stepLen) { e.state = 'formation'; e.x = slot.x; e.y = slot.y; }
          else { e.x += dx / dist * stepLen; e.y += dy / dist * stepLen; }
        }
      }

      if (entering) return lineHit;

      // 급강하 시작
      s.diveTimer -= dt;
      if (s.diveTimer <= 0) {
        s.diveTimer = d.diveInterval;
        let divers = 0;
        for (const e of s.enemies) if (e.state === 'dive' && !e.dead) divers++;
        if (divers < d.maxDivers) {
          const lead = pickFormation();
          if (lead) {
            startDive(lead, 0);
            if (lead.type === 'boss' && s.stage >= 3 && divers + 1 < d.maxDivers) { // 호위 포함해도 동시 급강하 상한을 넘기지 않는다
              const esc = pickFormation(function (e) { return e.type === 'butterfly'; });
              if (esc) startDive(esc, 0);
            }
          }
        }
      }

      // 편대 사격
      s.fireTimer -= dt;
      if (s.fireTimer <= 0) {
        s.fireTimer = d.fireInterval * (0.5 + rng());
        if (s.ebullets.length < d.maxBullets) {
          const shooter = pickFormation();
          if (shooter) s.ebullets.push({ x: shooter.x, y: shooter.y + 10, vy: d.bulletSpeed });
        }
      }
      return lineHit;
    }

    function step(dt) {
      if (s.phase === 'gameover') {
        if (s.lockTimer > 0) s.lockTimer = Math.max(0, s.lockTimer - dt);
        return;
      }
      if (s.phase === 'stageIntro') {
        s.time += dt;
        movePlayer(dt, s.input);
        s.player.invuln = Math.max(0, s.player.invuln - dt);
        s.introTimer -= dt;
        if (s.introTimer <= 0) {
          s.phase = 'playing';
          spawnStage(true);
        }
        return;
      }
      if (s.phase !== 'playing') return;

      s.time += dt;
      const d = difficulty(s.stage);
      const p = s.player;
      const input = s.input || {};
      p.invuln = Math.max(0, p.invuln - dt);
      p.cool = Math.max(0, p.cool - dt);
      movePlayer(dt, input);
      if (input.fire && p.cool <= 0 && s.shots.length < MAX_SHOTS) {
        s.shots.push({ x: p.x, y: p.y - 16 });
        p.cool = SHOT_COOLDOWN;
        emit('shoot', { x: p.x, y: p.y });
      }

      for (const sh of s.shots) sh.y -= SHOT_SPEED * dt;
      s.shots = s.shots.filter(function (sh) { return sh.y > -16; });

      let hit = updateEnemies(dt, d);
      if (hit && p.invuln > 0) hit = false; // 무적 중 라인 접촉은 적만 제거

      for (const b of s.ebullets) b.y += b.vy * dt;
      s.ebullets = s.ebullets.filter(function (b) { return b.y < H + 16; });

      // 자기 탄환 vs 적 (탄환 하나는 적 하나만, 죽은 적은 다시 맞지 않음)
      for (let i = s.shots.length - 1; i >= 0; i--) {
        const sh = s.shots[i];
        for (const e of s.enemies) {
          if (e.dead || (e.state === 'entry' && e.delay > 0)) continue;
          if (Math.abs(sh.x - e.x) <= ENEMY_HALF_W + 2 && Math.abs(sh.y - e.y) <= ENEMY_HALF_H + 6) {
            s.shots.splice(i, 1);
            e.hp -= 1;
            if (e.hp > 0) {
              emit('bossHit', { x: e.x, y: e.y });
            } else {
              e.dead = true;
              const info = ENEMY_TYPES[e.type];
              const pts = (e.state === 'dive' || e.state === 'return') ? info.diveScore : info.score;
              addScore(pts);
              emit('kill', { x: e.x, y: e.y, kind: e.type, points: pts });
            }
            break;
          }
        }
      }

      // 적 vs 자기 기체 (무적 중에는 판정 없음)
      if (p.invuln <= 0) {
        s.ebullets = s.ebullets.filter(function (b) {
          if (Math.abs(b.x - p.x) <= PLAYER_HALF_W + 3 && Math.abs(b.y - p.y) <= PLAYER_HALF_H + 4) {
            hit = true;
            return false;
          }
          return true;
        });
        for (const e of s.enemies) {
          if (e.dead || e.state !== 'dive') continue;
          if (Math.abs(e.x - p.x) <= ENEMY_HALF_W + PLAYER_HALF_W - 4 && Math.abs(e.y - p.y) <= ENEMY_HALF_H + PLAYER_HALF_H - 2) {
            e.dead = true;
            hit = true;
            emit('explode', { x: e.x, y: e.y, kind: e.type });
          }
        }
      }

      s.enemies = s.enemies.filter(function (e) { return !e.dead; });

      if (hit) applyHit(); // 한 스텝에 한 번만
      if (s.phase === 'gameover') return;

      if (s.enemies.length === 0) {
        let bonus = 1000 * s.stage;
        if (!s.lostLife) bonus += 500;
        addScore(bonus);
        emit('clear', { stage: s.stage, bonus: bonus });
        s.stage += 1;
        beginStageIntro();
      }
    }

    const api = {
      state: s,
      INITIAL_LIVES: INITIAL_LIVES,

      // 시작 전 정지 화면용: 편대를 격자에 배치만 한다.
      setupPreview: function () {
        if (s.phase !== 'ready') return;
        spawnStage(false);
      },
      start: function () {
        resetRun();
        beginStageIntro();
      },
      // 게임 오버 직후 500ms 동안은 재시작을 거부한다.
      restart: function () {
        if (s.phase === 'gameover' && s.lockTimer > 0) return false;
        resetRun();
        beginStageIntro();
        return true;
      },
      pause: function () {
        if (s.phase === 'playing' || s.phase === 'stageIntro') {
          s.prevPhase = s.phase;
          s.phase = 'paused';
          return true;
        }
        return false;
      },
      resume: function () {
        if (s.phase === 'paused') { s.phase = s.prevPhase; return true; }
        return false;
      },
      togglePause: function () {
        return s.phase === 'paused' ? api.resume() : api.pause();
      },
      update: function (dt, input) {
        s.input = input || {};
        if (!(dt > 0)) return;
        if (s.phase === 'ready' || s.phase === 'paused') return;
        dt = Math.min(dt, MAX_FRAME);
        const n = Math.max(1, Math.ceil(dt / STEP - 1e-9));
        const sub = dt / n;
        for (let i = 0; i < n; i++) step(sub);
      },
      drainEvents: function () {
        const ev = s.events;
        s.events = [];
        return ev;
      },
      setBest: function (v) { if (v > s.best) s.best = v | 0; },
      difficulty: difficulty,
    };
    return api;
  }

  const GalagaGame = {
    createGame: createGame,
    difficulty: difficulty,
    INITIAL_LIVES: INITIAL_LIVES,
    W: W, H: H, STEP: STEP,
    PLAYER_Y: PLAYER_Y, PLAYER_HALF_W: PLAYER_HALF_W, PLAYER_HALF_H: PLAYER_HALF_H,
    ENEMY_HALF_W: ENEMY_HALF_W, ENEMY_HALF_H: ENEMY_HALF_H,
    INVULN_TIME: INVULN_TIME, SHOT_COOLDOWN: SHOT_COOLDOWN, MAX_SHOTS: MAX_SHOTS,
    STAGE_INTRO_TIME: STAGE_INTRO_TIME, ENEMY_TYPES: ENEMY_TYPES,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GalagaGame;
  root.GalagaGame = GalagaGame;
})(typeof globalThis !== 'undefined' ? globalThis : this);
