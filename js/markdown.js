// 의존성 없는 작은 마크다운 → HTML 변환기.
// 원본 HTML은 허용하지 않고 모두 이스케이프한다.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// 스킴이 있는 URL은 http(s)/mailto만 허용한다. 상대 경로와 앵커는 통과.
function safeUrl(url) {
  const compact = url.replace(/[\u0000- ]/g, '');
  if (/^[a-z][a-z0-9+.-]*:/i.test(compact) && !/^(https?:|mailto:)/i.test(compact)) {
    return '#';
  }
  return url;
}

/* ---------- 인라인 ---------- */

function formatInline(text) {
  const stash = [];
  const hold = (html) => `\u0001${stash.push(html) - 1}\u0002`;

  let s = text;

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, alt, src) =>
    hold(`<img src="${safeUrl(src)}" alt="${alt}" loading="lazy">`)
  );

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, href) => {
    const external = /^https?:/i.test(href);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return hold(`<a href="${safeUrl(href)}"${attrs}>${formatInline(label)}</a>`);
  });

  s = s.replace(/\*\*(?!\s)(.+?)(?<!\s)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\p{L}\p{N}_])__(?!\s)(.+?)(?<!\s)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>');
  s = s.replace(/(^|[^*])\*(?![\s*])(.+?)(?<![\s*])\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\p{L}\p{N}_])_(?![\s_])(.+?)(?<![\s_])_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');
  s = s.replace(/~~(?!\s)(.+?)(?<!\s)~~/g, '<del>$1</del>');

  s = s.replace(/ {2,}\n/g, '<br>\n');

  // 보관해둔 조각 복원 (중첩 대비 반복)
  while (/\u0001\d+\u0002/.test(s)) {
    s = s.replace(/\u0001(\d+)\u0002/g, (_, n) => stash[Number(n)]);
  }
  return s;
}

function inline(src) {
  const codes = [];
  // 코드 스팬을 먼저 빼두어 안쪽이 서식 처리되지 않게 한다
  let s = src.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_, __, code) => {
    codes.push(`<code>${escapeHtml(code.trim())}</code>`);
    return `\u0003${codes.length - 1}\u0004`;
  });
  s = formatInline(escapeHtml(s));
  return s.replace(/\u0003(\d+)\u0004/g, (_, n) => codes[Number(n)]);
}

/* ---------- 블록 ---------- */

const RE = {
  fence: /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)/,
  heading: /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/,
  hr: /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/,
  quote: /^\s{0,3}>/,
  list: /^(\s*)([-*+]|\d+[.)])\s+(.*)$/,
  tableSep: /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
};

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'section'
  );
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function isBlockStart(line, next) {
  return (
    RE.fence.test(line) ||
    RE.heading.test(line) ||
    RE.hr.test(line) ||
    RE.quote.test(line) ||
    RE.list.test(line) ||
    (line.includes('|') && next !== undefined && RE.tableSep.test(next) && next.includes('-'))
  );
}

function parseTable(lines, i) {
  const header = splitRow(lines[i]);
  const aligns = splitRow(lines[i + 1]).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    return left && right ? 'center' : right ? 'right' : left ? 'left' : '';
  });

  const cell = (tag, content, idx) => {
    const style = aligns[idx] ? ` style="text-align:${aligns[idx]}"` : '';
    return `<${tag}${style}>${inline(content ?? '')}</${tag}>`;
  };

  let html = '<div class="table-wrap"><table><thead><tr>';
  html += header.map((c, idx) => cell('th', c, idx)).join('');
  html += '</tr></thead><tbody>';

  let j = i + 2;
  while (j < lines.length && lines[j].trim() && lines[j].includes('|')) {
    const cells = splitRow(lines[j]);
    html += '<tr>' + header.map((_, idx) => cell('td', cells[idx], idx)).join('') + '</tr>';
    j++;
  }
  html += '</tbody></table></div>';
  return { html, next: j };
}

function parseList(lines, i, ids) {
  const first = lines[i].match(RE.list);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  let loose = false;
  let j = i;

  while (j < lines.length) {
    const m = lines[j].match(RE.list);
    if (!m || m[1].length !== baseIndent || /\d/.test(m[2]) !== ordered) break;

    const contentIndent = baseIndent + m[2].length + 1;
    const itemLines = [m[3]];
    j++;

    while (j < lines.length) {
      const line = lines[j];
      if (!line.trim()) {
        // 빈 줄 뒤에 같은 항목에 속하는 들여쓴 줄이 이어지는지 확인
        let k = j;
        while (k < lines.length && !lines[k].trim()) k++;
        if (k >= lines.length) break;
        const indent = lines[k].match(/^\s*/)[0].length;
        const sibling = lines[k].match(RE.list);
        if (indent > baseIndent) {
          loose = true;
          for (; j < k; j++) itemLines.push('');
          continue;
        }
        if (sibling && sibling[1].length === baseIndent && /\d/.test(sibling[2]) === ordered) {
          loose = true;
        }
        break;
      }
      const indent = line.match(/^\s*/)[0].length;
      if (indent <= baseIndent) {
        // 같은 단계의 새 항목이거나 목록 밖의 줄이면 항목 종료
        if (RE.list.test(line) || isBlockStart(line, lines[j + 1])) break;
        itemLines.push(line.trim()); // 게으른 이어쓰기
        j++;
        continue;
      }
      itemLines.push(line.slice(Math.min(indent, contentIndent)));
      j++;
    }
    items.push(itemLines);

    // 항목 사이 빈 줄 건너뛰기 (다음이 형제 항목일 때만)
    let k = j;
    while (k < lines.length && !lines[k].trim()) k++;
    const next = lines[k] && lines[k].match(RE.list);
    if (k > j && next && next[1].length === baseIndent && /\d/.test(next[2]) === ordered) j = k;
  }

  const start = ordered && parseInt(first[2], 10) !== 1 ? ` start="${parseInt(first[2], 10)}"` : '';
  const tag = ordered ? 'ol' : 'ul';
  let html = `<${tag}${start}>`;

  for (const itemLines of items) {
    let task = null;
    const taskMatch = itemLines[0].match(/^\[( |x|X)\]\s+(.*)$/);
    if (taskMatch) {
      task = taskMatch[1] !== ' ';
      itemLines[0] = taskMatch[2];
    }

    let body = parseBlocks(itemLines, ids);
    if (!loose) body = body.replace(/^<p>([\s\S]*?)<\/p>/, '$1');

    if (task !== null) {
      const box = `<input type="checkbox" disabled${task ? ' checked' : ''}> `;
      html += `<li class="task-item">${box}${body}</li>`;
    } else {
      html += `<li>${body}</li>`;
    }
  }
  html += `</${tag}>`;
  return { html, next: j };
}

function parseBlocks(lines, ids) {
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = line.match(RE.fence);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2];
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        body.push(lines[i]);
        i++;
      }
      i++; // 닫는 펜스
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      html += `<pre><code${cls}>${escapeHtml(body.join('\n'))}</code></pre>`;
      continue;
    }

    const heading = line.match(RE.heading);
    if (heading) {
      const level = heading[1].length;
      let id = slugify(heading[2]);
      const count = ids.get(id) ?? 0;
      ids.set(id, count + 1);
      if (count) id += `-${count}`;
      html += `<h${level} id="${id}">${inline(heading[2])}</h${level}>`;
      i++;
      continue;
    }

    if (RE.hr.test(line)) {
      html += '<hr>';
      i++;
      continue;
    }

    if (RE.quote.test(line)) {
      const inner = [];
      while (i < lines.length && RE.quote.test(lines[i])) {
        inner.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
        i++;
      }
      html += `<blockquote>${parseBlocks(inner, ids)}</blockquote>`;
      continue;
    }

    if (line.includes('|') && lines[i + 1] !== undefined && RE.tableSep.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const table = parseTable(lines, i);
      html += table.html;
      i = table.next;
      continue;
    }

    if (RE.list.test(line)) {
      const list = parseList(lines, i, ids);
      html += list.html;
      i = list.next;
      continue;
    }

    // 문단
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i], lines[i + 1])) {
      para.push(lines[i]);
      i++;
    }
    html += `<p>${inline(para.map((l, idx) => (idx < para.length - 1 ? l.replace(/\s+$/, (sp) => (sp.length >= 2 ? '  ' : '')) : l.trim())).join('\n').trim())}</p>`;
  }

  return html;
}

export function renderMarkdown(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  return parseBlocks(lines, new Map());
}
