import { escapeHtml } from './markdown.js';

export async function loadPosts() {
  const res = await fetch('posts/index.json');
  if (!res.ok) throw new Error(`글 목록을 불러오지 못했습니다 (${res.status})`);
  const posts = await res.json();
  return posts
    .filter((post) => !post.draft)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function formatDate(date) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function renderTags(tags = []) {
  if (!tags.length) return '';
  const items = tags.map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`).join('');
  return `<ul class="tags">${items}</ul>`;
}

export function renderMeta(post) {
  const date = `<time datetime="${escapeHtml(String(post.date))}">${escapeHtml(formatDate(post.date))}</time>`;
  return `<div class="post-meta">${date}${renderTags(post.tags)}</div>`;
}

export function renderPostList(posts, container) {
  if (!posts.length) {
    container.innerHTML = '<li class="notice">아직 작성된 글이 없습니다.</li>';
    return;
  }
  container.innerHTML = posts
    .map((post) => {
      const href = `post.html?slug=${encodeURIComponent(post.slug)}`;
      const summary = post.summary
        ? `<p class="post-item__summary">${escapeHtml(post.summary)}</p>`
        : '';
      return `<li class="post-item">
        <article>
          <h2 class="post-item__title"><a href="${href}">${escapeHtml(post.title)}</a></h2>
          ${renderMeta(post)}
          ${summary}
        </article>
      </li>`;
    })
    .join('');
}
