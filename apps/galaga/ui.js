/* ui.js - 렌더, 입력, 루프, HUD, 저장소, 효과음. 로직은 game.js (globalThis.GalagaGame)에 있다. */
(function () {
  'use strict';

  const G = window.GalagaGame;
  const W = G.W, H = G.H, STEP = G.STEP;

  // ---------- 저장소 (실패 시 메모리) ----------
  const mem = {};
  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) { mem[key] = v; return v; }
    } catch (e) { /* 무시 */ }
    return key in mem ? mem[key] : fallback;
  }
  function save(key, value) {
    mem[key] = String(value);
    try { localStorage.setItem(key, String(value)); } catch (e) { /* 메모리만 사용 */ }
  }

  const BEST_KEY = 'galaga:best';
  const SOUND_KEY = 'galaga:sound';

  let savedBest = parseInt(load(BEST_KEY, '0'), 10);
  if (!(savedBest > 0)) savedBest = 0;
  let soundOn = load(SOUND_KEY, '1') !== '0';

  // ---------- DOM ----------
  const $ = function (id) { return document.getElementById(id); };
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const stageBox = $('stage-box');
  const overlay = $('overlay');
  const ovTitle = $('overlay-title');
  const ovText = $('overlay-text');
  const ovPrimary = $('overlay-primary');
  const ovSecondary = $('overlay-secondary');
  const pauseBtn = $('pause-btn');
  const soundBtn = $('sound-btn');
  const live = $('live');
  const hud = {
    score: $('score'), best: $('best'), lives: $('lives'), icons: $('lives-icons'), stage: $('stage'),
  };

  const game = G.createGame({ best: savedBest });
  const state = game.state;
  game.setupPreview();

  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(reducedQuery && reducedQuery.matches); }

  // ---------- 색상 (CSS 변수에서 읽기) ----------
  let C = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = function (n) { return cs.getPropertyValue(n).trim(); };
    C = {
      bg: v('--canvas-bg'), star: v('--canvas-star'), text: v('--canvas-text'), muted: v('--canvas-muted'),
      player: v('--sprite-player'), playerAccent: v('--sprite-player-accent'),
      bee: v('--sprite-bee'), butterfly: v('--sprite-butterfly'),
      boss: v('--sprite-boss'), bossHurt: v('--sprite-boss-hurt'), eye: v('--sprite-eye'),
      shot: v('--sprite-shot'), eshot: v('--sprite-enemy-shot'), spark: v('--sprite-spark'),
    };
  }
  readColors();
  try {
    new MutationObserver(function () { readColors(); render(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onMq = function () { readColors(); render(); };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
    }
  } catch (e) { /* 무시 */ }

  // ---------- 효과음 (WebAudio 합성) ----------
  let actx = null;
  function initAudio() {
    if (actx) {
      try { if (actx.state === 'suspended') actx.resume(); } catch (e) { /* 무시 */ }
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
  }
  function tone(f0, f1, dur, type, vol, delay) {
    if (!soundOn || !actx) return;
    try {
      const t0 = actx.currentTime + (delay || 0);
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t0);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* 소리 없이 계속 */ }
  }
  const SFX = {
    shoot: function () { tone(880, 330, 0.08, 'square', 0.05); },
    kill: function () { tone(320, 70, 0.18, 'sawtooth', 0.08); },
    bossHit: function () { tone(220, 160, 0.08, 'triangle', 0.1); },
    hit: function () { tone(180, 40, 0.5, 'sawtooth', 0.12); },
    stage: function () { tone(440, 440, 0.12, 'square', 0.06, 0); tone(554, 554, 0.12, 'square', 0.06, 0.12); tone(659, 659, 0.2, 'square', 0.06, 0.24); },
    gameover: function () { tone(330, 330, 0.25, 'triangle', 0.1, 0); tone(262, 262, 0.25, 'triangle', 0.1, 0.25); tone(196, 98, 0.6, 'triangle', 0.1, 0.5); },
  };

  function renderSoundBtn() {
    soundBtn.textContent = soundOn ? '소리 켜짐' : '소리 꺼짐';
    soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  }
  soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    save(SOUND_KEY, soundOn ? '1' : '0');
    if (soundOn) initAudio();
    renderSoundBtn();
  });
  renderSoundBtn();

  // ---------- 입력 ----------
  const keys = new Set();
  const pads = { left: new Set(), right: new Set(), fire: new Set() };

  function getInput() {
    return {
      left: keys.has('ArrowLeft') || keys.has('KeyA') || pads.left.size > 0,
      right: keys.has('ArrowRight') || keys.has('KeyD') || pads.right.size > 0,
      fire: keys.has('Space') || pads.fire.size > 0,
    };
  }
  function clearInput() {
    keys.clear();
    pads.left.clear(); pads.right.clear(); pads.fire.clear();
    ['btn-left', 'btn-right', 'btn-fire'].forEach(function (id) { $(id).classList.remove('is-down'); });
  }
  function isActive() { return state.phase === 'playing' || state.phase === 'stageIntro'; }

  const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD'];

  // 스페이스를 누른 시점의 포커스 요소. 누르는 동안 포커스가 버튼으로 옮겨간 경우(게임 오버/일시정지로 오버레이 버튼에 포커스)
  // 뗄 때 버튼이 클릭되어 즉시 재시작/재개되는 것을 막는다.
  let spaceDownEl = null;

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && !e.repeat) spaceDownEl = document.activeElement;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (code === 'Enter') {
      if (e.target && e.target.tagName === 'BUTTON') return; // 버튼의 기본 클릭에 맡김
      primaryAction();
      return;
    }
    if (code === 'KeyP' || code === 'Escape') {
      if (isActive() || state.phase === 'paused') { e.preventDefault(); togglePause(true); }
      return;
    }
    if (GAME_KEYS.indexOf(code) === -1) return;
    if (isActive()) {
      e.preventDefault(); // 플레이 중에만 스크롤/버튼 클릭 방지
      keys.add(code);
    }
  });
  window.addEventListener('keyup', function (e) {
    if (GAME_KEYS.indexOf(e.code) === -1) return;
    keys.delete(e.code);
    if (e.code === 'Space') {
      const ae = document.activeElement;
      // 포커스된 버튼의 스페이스 클릭 방지 (플레이 중이거나, 누른 뒤 포커스가 버튼으로 옮겨진 경우)
      if (isActive() || (ae && ae.tagName === 'BUTTON' && spaceDownEl !== ae)) e.preventDefault();
      spaceDownEl = null;
    }
  });

  function bindPad(id, set) {
    const el = $(id);
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      set.add(e.pointerId);
      el.classList.add('is-down');
    });
    const up = function (e) {
      set.delete(e.pointerId);
      if (!set.size) el.classList.remove('is-down');
    };
    ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach(function (n) { el.addEventListener(n, up); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('keydown', function (e) { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); });
    el.addEventListener('keyup', function (e) { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); });
  }
  bindPad('btn-left', pads.left);
  bindPad('btn-right', pads.right);
  bindPad('btn-fire', pads.fire);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- 액션 ----------
  function announce(msg) {
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 30);
  }

  function startRun(isRestart) {
    initAudio();
    clearInput();
    particles.length = 0;
    if (isRestart) { if (!game.restart()) return; } else game.start();
    afterChange(false);
  }
  function togglePause(focusBtn) {
    clearInput();
    const ok = game.togglePause();
    if (!ok) return;
    if (state.phase === 'paused') persistBest();
    afterChange(focusBtn && state.phase === 'paused');
  }
  function autoPause() {
    if (isActive()) { clearInput(); game.pause(); persistBest(); afterChange(false); }
  }
  function primaryAction() {
    const p = state.phase;
    if (p === 'ready') startRun(false);
    else if (p === 'paused') togglePause(false);
    else if (p === 'gameover') startRun(true);
  }
  ovPrimary.addEventListener('click', function () {
    primaryAction();
    if (document.activeElement && document.activeElement.blur && isActive()) document.activeElement.blur();
  });
  ovSecondary.addEventListener('click', function () {
    startRun(true);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });
  pauseBtn.addEventListener('click', function () {
    togglePause(true);
    if (isActive() && document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });

  document.addEventListener('visibilitychange', function () { if (document.hidden) autoPause(); });
  window.addEventListener('blur', autoPause);
  window.addEventListener('pagehide', persistBest);

  function persistBest() {
    if (state.best > savedBest) { savedBest = state.best; save(BEST_KEY, savedBest); }
  }

  // ---------- 오버레이/HUD ----------
  const hudCache = {};
  function setText(el, key, val) {
    if (hudCache[key] !== val) { hudCache[key] = val; el.textContent = val; }
  }
  function updateHud() {
    setText(hud.score, 'score', String(state.score));
    setText(hud.best, 'best', String(state.best));
    setText(hud.lives, 'lives', String(state.lives));
    setText(hud.stage, 'stage', String(state.stage));
    setText(hud.icons, 'icons', '▲'.repeat(state.lives));
  }

  function syncOverlay(focusBtn) {
    const p = state.phase;
    const show = p === 'ready' || p === 'paused' || p === 'gameover';
    overlay.hidden = !show;
    ovSecondary.hidden = true;
    if (p === 'ready') {
      ovTitle.textContent = '갤러그';
      ovText.textContent = '적 편대를 전멸시키세요. 목숨은 ' + G.INITIAL_LIVES + '개입니다.';
      ovPrimary.textContent = '시작';
    } else if (p === 'paused') {
      ovTitle.textContent = '일시정지';
      ovText.textContent = 'P 또는 Esc 키로도 계속할 수 있습니다.';
      ovPrimary.textContent = '계속';
      ovSecondary.hidden = false;
    } else if (p === 'gameover') {
      ovTitle.textContent = '게임 오버';
      ovText.textContent = '점수 ' + state.score + (state.score >= state.best && state.score > 0 ? ' (최고 점수!)' : ' / 최고 ' + state.best);
      ovPrimary.textContent = '다시 시작';
    }
    pauseBtn.disabled = !(isActive() || p === 'paused');
    pauseBtn.textContent = p === 'paused' ? '계속' : '일시정지';
    if (show && focusBtn) { try { ovPrimary.focus(); } catch (e) { /* 무시 */ } }
  }

  function afterChange(focusBtn) {
    syncOverlay(focusBtn);
    updateHud();
    handleEvents();
    resetClock();
    render();
    if (needsLoop()) schedule();
  }

  // ---------- 효과/파티클 ----------
  const particles = [];
  let shake = 0;
  function burst(x, y, color, n) {
    if (reduced()) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, max: 0.8, color: color });
    }
  }
  function colorOfKind(k) { return k === 'boss' ? C.boss : k === 'butterfly' ? C.butterfly : C.bee; }

  function handleEvents() {
    const evs = game.drainEvents();
    const played = {};
    let msg = null;
    for (const ev of evs) {
      if (ev.type === 'kill') burst(ev.x, ev.y, colorOfKind(ev.kind), 12);
      else if (ev.type === 'explode') burst(ev.x, ev.y, colorOfKind(ev.kind), 10);
      else if (ev.type === 'hit') {
        burst(ev.x, ev.y, C.player, 22);
        if (!reduced()) shake = 0.3;
        msg = ev.lives > 0 ? '목숨 ' + ev.lives + '개 남음' : msg;
      } else if (ev.type === 'stage') msg = '스테이지 ' + ev.stage + ' 시작';
      else if (ev.type === 'gameover') { msg = '게임 오버, 점수 ' + ev.score; persistBest(); syncOverlay(true); }
      const name = ev.type === 'explode' ? 'kill' : ev.type === 'clear' ? null : ev.type;
      if (name && SFX[name] && !played[name]) { played[name] = true; SFX[name](); }
    }
    if (msg) announce(msg);
  }

  // ---------- 렌더 ----------
  const stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, v: 15 + Math.random() * 45, r: Math.random() < 0.2 ? 1.6 : 1 });
  }

  const SPR = {
    bee: [
      ['..x.....x..', '...x...x...', '..xxxxxxx..', '.xxexxxexx.', 'xxxxxxxxxxx', 'x.xxxxxxx.x', 'x.x.....x.x', '...xx.xx...'],
      ['..x.....x..', '...x...x...', '..xxxxxxx..', '.xxexxxexx.', 'xxxxxxxxxxx', '.xxxxxxxxx.', '..x.....x..', '...xx.xx...'],
    ],
    butterfly: [
      ['x...x.x...x', 'xx.xxxxx.xx', 'xxxxxxxxxxx', 'xxxexxxexxx', 'xxxxxxxxxxx', '.xx.xxx.xx.', '..x..x..x..', '.....x.....'],
      ['.x..x.x..x.', 'xx.xxxxx.xx', 'xxxxxxxxxxx', 'xxxexxxexxx', '.xxxxxxxxx.', '..x.xxx.x..', '...x.x.x...', '.....x.....'],
    ],
    boss: [
      ['..x.x.x.x..', '..xxxxxxx..', '.xxxxxxxxx.', 'xxexxxxxexx', 'xxxxxxxxxxx', 'x.xxxxxxx.x', 'x..xx.xx..x', '...x...x...'],
      ['..x.x.x.x..', '..xxxxxxx..', '.xxxxxxxxx.', 'xxexxxxxexx', 'xxxxxxxxxxx', '.xxxxxxxxx.', '.x.xx.xx.x.', '...x...x...'],
    ],
    bossHurt: [
      ['..x.x.x.x..', '..x.xxx.x..', '.xx.xxx.xx.', 'xxexx.xxexx', 'xx.xxxxx.xx', 'x.xx.x.xx.x', 'x..xx.xx..x', '...x...x...'],
      ['..x.x.x.x..', '..x.xxx.x..', '.xx.xxx.xx.', 'xxexx.xxexx', 'xx.xxxxx.xx', '.xxx.x.xxx.', '.x.xx.xx.x.', '...x...x...'],
    ],
  };

  function drawSprite(rows, cx, cy, px, color) {
    const w = rows[0].length * px, h = rows.length * px;
    const x0 = cx - w / 2, y0 = cy - h / 2;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row.charAt(c);
        if (ch === '.') continue;
        ctx.fillStyle = ch === 'e' ? C.eye : color;
        ctx.fillRect(x0 + c * px, y0 + r * px, px, px);
      }
    }
  }

  function drawEnemy(e) {
    const frame = reduced() ? 0 : (Math.floor(state.time * 3 + e.col * 0.5) % 2);
    let rows, color;
    if (e.type === 'boss') {
      if (e.hp < 2) { rows = SPR.bossHurt[frame]; color = C.bossHurt; } else { rows = SPR.boss[frame]; color = C.boss; }
    } else if (e.type === 'butterfly') { rows = SPR.butterfly[frame]; color = C.butterfly; }
    else { rows = SPR.bee[frame]; color = C.bee; }
    drawSprite(rows, e.x, e.y, 2, color);
  }

  function drawPlayer() {
    const p = state.player;
    if (state.phase === 'gameover') return;
    let alpha = 1;
    if (p.invuln > 0) alpha = reduced() ? 0.5 : (Math.floor(p.invuln * 10) % 2 ? 0.3 : 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 16);
    ctx.lineTo(p.x + 5, p.y - 2);
    ctx.lineTo(p.x + 16, p.y + 8);
    ctx.lineTo(p.x + 16, p.y + 12);
    ctx.lineTo(p.x + 6, p.y + 8);
    ctx.lineTo(p.x - 6, p.y + 8);
    ctx.lineTo(p.x - 16, p.y + 12);
    ctx.lineTo(p.x - 16, p.y + 8);
    ctx.lineTo(p.x - 5, p.y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.playerAccent;
    ctx.fillRect(p.x - 2, p.y - 6, 4, 10);
    ctx.globalAlpha = 1;
  }

  function render() {
    if (!C.bg) return;
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = C.star;
    for (const st of stars) {
      ctx.globalAlpha = st.r > 1 ? 0.9 : 0.5;
      ctx.fillRect(st.x, st.y, st.r, st.r);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    if (shake > 0 && !reduced()) ctx.translate((Math.random() - 0.5) * 8 * (shake / 0.3), (Math.random() - 0.5) * 8 * (shake / 0.3));

    for (const e of state.enemies) {
      if (e.state === 'entry' && e.delay > 0) continue;
      drawEnemy(e);
    }
    ctx.fillStyle = C.shot;
    for (const s of state.shots) ctx.fillRect(s.x - 2, s.y - 8, 4, 14);
    ctx.fillStyle = C.eshot;
    for (const b of state.ebullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    drawPlayer();
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (state.phase === 'stageIntro') {
      ctx.fillStyle = C.text;
      ctx.font = '700 40px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STAGE ' + state.stage, W / 2, H / 2 - 40);
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    render();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stageBox);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // ---------- 루프 ----------
  let raf = 0;
  let last = 0;
  let acc = 0;

  function resetClock() { last = performance.now(); acc = 0; }
  function needsLoop() {
    const p = state.phase;
    if (p === 'playing' || p === 'stageIntro') return true;
    if (p === 'gameover') return state.lockTimer > 0 || particles.length > 0 || shake > 0;
    return false;
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }

  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    const input = getInput();
    let n = 0;
    while (acc >= STEP && n < 6) { game.update(STEP, input); acc -= STEP; n++; }
    if (n === 6) acc = 0;

    // 파티클/별/흔들림은 실제 시간 기준
    if (!reduced()) {
      for (const st of stars) { st.y += st.v * dt; if (st.y > H) { st.y -= H; st.x = Math.random() * W; } }
      shake = Math.max(0, shake - dt);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }

    handleEvents();
    updateHud();
    render();
    if (state.phase === 'gameover') syncOverlay(false);
    if (needsLoop()) schedule();
  }

  // ---------- 초기화 ----------
  updateHud();
  syncOverlay(false);
  resize();
  // 사용자 입력 전에는 루프를 돌리지 않는다 (정지 화면 한 장만 그림)
})();
