import { initTheme } from './theme.js';
import { parseFrontmatter } from './frontmatter.js';
import { renderMarkdown, escapeHtml } from './markdown.js';
import { loadPosts, renderPostList, renderMeta } from './posts.js';

const SITE_TITLE = 'My Blog';
const app = document.getElementById('app');

function showNotice(message, withBackLink = true) {
  const back = withBackLink ? '<p><a href="index.html">← 목록으로</a></p>' : '';
  app.innerHTML = `<div class="notice"><p>${escapeHtml(message)}</p>${back}</div>`;
}

async function showList() {
  const list = document.getElementById('post-list');
  try {
    renderPostList(await loadPosts(), list);
  } catch (err) {
    list.innerHTML = `<li class="notice">${escapeHtml(err.message)}</li>`;
  }
}

async function showPost() {
  const slug = new URLSearchParams(location.search).get('slug');

  // 경로 탈출 방지: 허용된 문자만 slug로 인정
  if (!slug || !/^[\w가-힣-]+$/.test(slug)) {
    document.title = `글을 찾을 수 없습니다 · ${SITE_TITLE}`;
    showNotice('글을 찾을 수 없습니다.');
    return;
  }

  try {
    const res = await fetch(`posts/${encodeURIComponent(slug)}.md`);
    if (!res.ok) throw new Error('not found');

    const { data, body } = parseFrontmatter(await res.text());
    const title = data.title || slug;
    document.title = `${title} · ${SITE_TITLE}`;

    app.innerHTML = `<article>
      <header class="post-header">
        <h1 class="post-title">${escapeHtml(title)}</h1>
        ${data.date ? renderMeta(data) : ''}
      </header>
      <div class="prose">${renderMarkdown(body)}</div>
      <a class="back-link" href="index.html">← 목록으로</a>
    </article>`;
  } catch (err) {
    document.title = `글을 찾을 수 없습니다 · ${SITE_TITLE}`;
    showNotice('글을 찾을 수 없습니다.');
  }
}

initTheme();

if (document.getElementById('post-list')) {
  showList();
} else {
  showPost();
}
