const KEY = 'theme';
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

function currentTheme() {
  return root.dataset.theme || (media.matches ? 'dark' : 'light');
}

function save(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch (e) {
    // 저장소를 쓸 수 없어도 현재 세션에서는 동작한다
  }
}

function renderButton(button) {
  const dark = currentTheme() === 'dark';
  button.textContent = dark ? '☀️' : '🌙';
  button.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
}

export function initTheme() {
  const button = document.querySelector('.theme-toggle');
  if (!button) return;

  renderButton(button);

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    save(next);
    renderButton(button);
  });

  // 사용자가 직접 고르지 않았다면 시스템 설정 변화를 따라간다
  media.addEventListener('change', () => {
    if (!root.dataset.theme) renderButton(button);
  });
}
