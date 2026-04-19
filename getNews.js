// getNews.js
// #newsタグのWorkflowyノードを取得し、news.json と newslist.html を生成する

const fs = require('fs');
const fetch = globalThis.fetch || require('node-fetch').default;

// ============================================================
// 共通ヘルパー関数 (getDataWf.js と同様のロジック)
// ============================================================

function unescapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeHtmlForCode(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function stripParagraphTags(html) {
    const trimmed = html.trim();
    if (trimmed.startsWith('<p>') && trimmed.endsWith('</p>')) {
        const inner = trimmed.slice(3, -4);
        if (!inner.includes('<p>')) return inner;
    }
    return html;
}

function markdownToHTML(markdown) {
    const decoded = unescapeHtml(markdown);
    const lines = decoded.split('\n');
    let html = '';
    let inBlockquote = false;
    let inList = false;
    let listItems = [];

    const extractUrl = (url) => {
        const m = url.match(/<a href="(.+?)">.+?<\/a>/);
        return m ? m[1] : url;
    };

    lines.forEach((line, index) => {
        if (line.startsWith('// ')) return;

        if (line.startsWith('> ')) {
            if (inList) { html += '</ul>'; inList = false; listItems = []; }
            if (!inBlockquote) { html += '<blockquote>'; inBlockquote = true; }
            html += `<p>${line.replace(/^> /, '')}</p>`;
        } else {
            if (inBlockquote) { html += '</blockquote>'; inBlockquote = false; }

            if (line.startsWith('・')) {
                if (!inList) { html += '<ul>'; inList = true; }
                const content = line.replace(/^・/, '').replace(/\[(.*?)\]\((.*?)\)/g, (m, t, u) => {
                    const fu = extractUrl(u);
                    return fu.includes('https://workflowy.com/')
                        ? `<a href="${fu}">${t}</a>`
                        : `<a href="${fu}" target="_blank">${t}</a>`;
                });
                listItems.push(content);
                if (!lines[index + 1] || !lines[index + 1].startsWith('・')) {
                    html += '<li>' + listItems.join('</li><li>') + '</li></ul>';
                    inList = false; listItems = [];
                }
            } else {
                if (inList) { html += '</ul>'; inList = false; listItems = []; }

                if (line.trim().startsWith('<')) {
                    html += `<p>${line.replace(/\[(.*?)\]\((.*?)\)/g, (m, t, u) => u)}</p>`;
                } else if (line.startsWith('#')) {
                    const level = line.match(/^#+/)[0].length;
                    html += `<h${level}>${line.replace(/^#+\s*/, '')}</h${level}>`;
                } else if (line === '---') {
                    html += '<hr>';
                } else if (line.startsWith('```')) {
                    let code = '';
                    let i = index + 1;
                    while (i < lines.length && !lines[i].startsWith('```')) {
                        code += lines[i] + '\n'; i++;
                    }
                    html += `<pre><code>${escapeHtmlForCode(code.trim())}</code></pre>`;
                } else if (/!\[.*?\]\((.*?)\)/.test(line)) {
                    html += `<p>${line.replace(/!\[(.*?)\]\((.*?)\)/g, (m, a, u) =>
                        `<img src="${extractUrl(u)}" alt="${a || 'Image'}">`)}</p>`;
                } else if (/\[.*?\]\((.*?)\)/.test(line)) {
                    html += `<p>${line.replace(/\[(.*?)\]\((.*?)\)/g, (m, t, u) => {
                        const fu = extractUrl(u);
                        return fu.includes('https://workflowy.com/')
                            ? `<a href="${fu}">${t}</a>`
                            : `<a href="${fu}" target="_blank">${t}</a>`;
                    })}</p>`;
                } else if (/\*\*|`|\*|_/.test(line)) {
                    html += `<p>${line
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/`(.*?)`/g, '<code>$1</code>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`;
                } else if (line.trim() !== '') {
                    html += `<p>${line}</p>`;
                }
            }
        }
    });

    if (inBlockquote) html += '</blockquote>';
    if (inList) html += '</ul>';
    return html;
}

function getTags(note) {
    if (!note) return [];
    const decoded = unescapeHtml(note);
    const regex = /#([\p{L}\p{N}\-_]+)/gu;
    const tags = [];
    let m;
    while ((m = regex.exec(decoded)) !== null) tags.push(m[1]);
    return [...new Set(tags)].filter(t => t !== 'news');
}

function getChildren(nodeId, allNodes) {
    return allNodes
        .filter(n => n.parent_id === nodeId)
        .sort((a, b) => a.priority - b.priority);
}

function getNodesByTag(nodes, tagName) {
    return nodes.filter(n =>
        (n.name && n.name.includes(`#${tagName}`)) ||
        (n.note && n.note.includes(`#${tagName}`))
    );
}

// ============================================================
// ニュース固有のヘルパー
// ============================================================

/**
 * ノードのnameからタイトルとURLを抽出する
 *
 * 対応する2つの形式:
 *   1. Workflowyネイティブリンク (UI上でリンク設定した場合):
 *      `<a href="https://example.com">記事タイトル</a> #news #AI`
 *   2. Markdownリンク (手書きの場合):
 *      `[記事タイトル](https://example.com) #news #AI`
 *
 * どちらも → { title: "記事タイトル", url: "https://example.com" }
 */
function extractNewsLink(rawName) {
    // APIレスポンスのnameはHTMLエンティティがエスケープされている場合があるのでデコード
    const name = unescapeHtml(rawName);

    // 1. WorkflowyネイティブHTMLリンク: <a href="URL">テキスト</a>
    const htmlMatch = name.match(/<a\s+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/i);
    if (htmlMatch) {
        const url   = htmlMatch[1];
        // タグ (#news 等) を除去してタイトルをクリーンにする
        const title = htmlMatch[2].replace(/#[\p{L}\p{N}\-_]+/gu, '').trim();
        return { title, url };
    }

    // 2. Markdownリンク: [テキスト](URL)
    const mdMatch = name.match(/\[([^\]]+)\]\(([^\)]+)\)/);
    if (mdMatch) {
        return { title: mdMatch[1], url: mdMatch[2] };
    }

    // 3. リンクなし: タグを除去してタイトルのみ
    const title = name.replace(/#[\p{L}\p{N}\-_]+/gu, '').trim();
    return { title, url: null };
}

/**
 * 子ノードをコメントとしてHTMLに変換する
 * (シンプルに各子ノードのnameを段落として返す)
 */
function renderComments(node, allNodes) {
    const children = getChildren(node.id, allNodes);
    if (children.length === 0) return '';
    let html = '<div class="news-comment">';
    children.forEach(child => {
        html += markdownToHTML(child.name);
        if (child.note) {
            const note = child.note.split('\n')
                .filter(l => !l.startsWith('date:') && !l.startsWith('tag:'))
                .join('\n').trim();
            if (note) html += markdownToHTML(note);
        }
        // さらに深い孫ノードも処理
        const grandChildren = getChildren(child.id, allNodes);
        grandChildren.forEach(gc => {
            html += markdownToHTML(gc.name);
        });
    });
    html += '</div>';
    return html;
}

// ============================================================
// newslist.html フラグメント生成
// ============================================================

/**
 * ニュース一覧を月単位で折りたたみ可能なHTMLフラグメントとして生成する
 */
function generateNewsListHtml(newsItems) {
    const currentYearMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    // 日付の新しい順にソート
    const sorted = [...newsItems].sort((a, b) => new Date(b.date) - new Date(a.date));

    // 月ごとにグループ化
    const groupedByMonth = {};
    sorted.forEach(item => {
        const month = item.date.slice(0, 7); // "YYYY-MM"
        if (!groupedByMonth[month]) groupedByMonth[month] = [];
        groupedByMonth[month].push(item);
    });

    const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

    let html = '';
    sortedMonths.forEach(month => {
        const isCurrentMonth = month === currentYearMonth;
        const [year, mon] = month.split('-');
        const label = `${year}年${parseInt(mon)}月`;
        const collapseClass = isCurrentMonth ? '' : 'collapsed';
        const iconClass    = isCurrentMonth ? 'fa-chevron-down' : 'fa-chevron-right';

        html += `<li class="month-group">
<h3 class="month-header${isCurrentMonth ? ' active-month' : ''}" data-month="${month}">
${label} <i class="fa ${iconClass}"></i>
</h3>
<ul class="news-sub-list ${collapseClass}">
`;
        // 同じ月の中で日付ごとにグループ化
        const byDate = {};
        groupedByMonth[month].forEach(item => {
            if (!byDate[item.date]) byDate[item.date] = [];
            byDate[item.date].push(item);
        });

        Object.keys(byDate).sort((a, b) => b.localeCompare(a)).forEach(date => {
            const dateSlug = date.replace(/-/g, ''); // "2026-04-19" → "20260419"
            html += `<li class="news-date-group">
<div class="news-date"><a href="/news/${dateSlug}.html">${date}</a></div>
<ul class="news-items">
`;
            byDate[date].forEach(item => {
                const titleHtml = item.url
                    ? `<a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title)}</a>`
                    : escapeHtml(item.title);

                const tagsHtml = item.tags.length > 0
                    ? `<span class="news-tags">${item.tags.map(t =>
                        `<a href="/news?tag=${escapeHtml(t)}">#${escapeHtml(t)}</a>`).join(' ')}</span>`
                    : '';

                html += `<li class="news-item">
<div class="news-item-header">${titleHtml}${tagsHtml ? ' ' + tagsHtml : ''}</div>
${item.comment}
</li>
`;
            });

            html += `</ul>
</li>
`;
        });

        html += `</ul>
</li>
`;
    });

    fs.writeFileSync('newslist.html', html, 'utf8');
    console.log('newslist.html generated.');
}

// ============================================================
// 日付別静的HTMLページ生成
// ============================================================

/**
 * 日付ごとに news/YYYYMMDD.html を生成する
 * 例: news/20260419.html
 */
function generateNewsDayPages(newsItems) {
    const outputDir = 'news';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created directory: ${outputDir}/`);
    }

    // 日付ごとにグループ化
    const byDate = {};
    newsItems.forEach(item => {
        if (!byDate[item.date]) byDate[item.date] = [];
        byDate[item.date].push(item);
    });

    let count = 0;
    Object.keys(byDate).forEach(date => {
        const items = byDate[date];
        const dateSlug = date.replace(/-/g, ''); // "20260419"
        const [year, mon, day] = date.split('-');
        const dateLabel = `${year}年${parseInt(mon)}月${parseInt(day)}日`;

        // ニュースアイテムのHTML
        let itemsHtml = '';
        items.forEach(item => {
            const titleHtml = item.url
                ? `<a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title)}</a>`
                : escapeHtml(item.title);

            const tagsHtml = item.tags.length > 0
                ? `<span class="news-tags">${item.tags.map(t =>
                    `<a href="/news?tag=${escapeHtml(t)}">#${escapeHtml(t)}</a>`).join(' ')}</span>`
                : '';

            itemsHtml += `<li class="news-item">
<div class="news-item-header">${titleHtml}${tagsHtml ? ' ' + tagsHtml : ''}</div>
${item.comment}
</li>
`;
        });

        const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${dateLabel}のニュース - morvra lists</title>
    <meta name="description" content="${dateLabel}にmorvraが気になったリンク集">
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/news.css">
    <link href='/bullet_icon.png' rel='icon' type='image/x-icon'/>
    <link rel="stylesheet" type="text/css" href="//netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3575252598876356" crossorigin="anonymous"></script>
    <meta name="google-adsense-account" content="ca-pub-3575252598876356">
</head>
<body>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-0G0NP5Z9M9"></script>
    <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-0G0NP5Z9M9');
    </script>

    <div id="header"></div>

    <main>
        <div id="article-title"><h1>${dateLabel}のニュース</h1></div>
        <p class="news-back"><a href="/news">&laquo; ニュース一覧に戻る</a></p>

        <ul class="news-items news-day-list">
${itemsHtml}        </ul>
    </main>

    <div id="footer"></div>

    <script>
        fetch("/header.html").then(r => r.text()).then(d => document.querySelector("#header").innerHTML = d);
        fetch("/footer.html").then(r => r.text()).then(d => document.querySelector("#footer").innerHTML = d);
    </script>
</body>
</html>`;

        fs.writeFileSync(`${outputDir}/${dateSlug}.html`, html, 'utf8');
        count++;
    });

    console.log(`Generated ${count} day page(s) in news/`);
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
    const WORKFLOWY_API_KEY = process.env.WORKFLOWY_API_KEY;

    if (!WORKFLOWY_API_KEY) {
        console.error('Error: WORKFLOWY_API_KEY environment variable is not set.');
        process.exit(1);
    }

    try {
        const response = await fetch('https://workflowy.com/api/v1/nodes-export', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${WORKFLOWY_API_KEY}` },
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        // #newsタグを持つノードを取得
        const newsNodes = getNodesByTag(data.nodes, 'news');

        const newsItems = newsNodes.map(node => {
            const { title, url } = extractNewsLink(node.name);

            // createdAt (Unixタイムスタンプ秒) から日付を生成
            // JST (UTC+9) に変換して日付を取得
            const createdDate = new Date((node.createdAt + 9 * 3600) * 1000)
                .toISOString()
                .slice(0, 10);

            // noteからタグを取得 (nameにあるタグも拾う)
            const tagsFromNote = getTags(node.note || '');
            const tagsFromName = (() => {
                // HTMLタグ (<a href="...">) を除去してからタグ (#xxx) を抽出
                const plainName = unescapeHtml(node.name).replace(/<[^>]*>/g, '');
                const regex = /#([\p{L}\p{N}\-_]+)/gu;
                const tags = [];
                let m;
                while ((m = regex.exec(plainName)) !== null) tags.push(m[1]);
                return [...new Set(tags)].filter(t => t !== 'news');
            })();
            const tags = [...new Set([...tagsFromName, ...tagsFromNote])];

            // 子ノード = コメント・参照元
            const comment = renderComments(node, data.nodes);

            return {
                id: node.id,
                title,
                url,
                date: createdDate,
                tags,
                comment,
            };
        });

        // 日付の新しい順にソート
        newsItems.sort((a, b) => new Date(b.date) - new Date(a.date));

        // news.json を出力
        fs.writeFileSync('news.json', JSON.stringify({ news: newsItems }, null, '\t'), 'utf8');
        console.log(`news.json generated. (${newsItems.length} items)`);

        // newslist.html フラグメントを生成
        generateNewsListHtml(newsItems);

        // 日付別静的ページを生成
        generateNewsDayPages(newsItems);

        console.log('News generation complete.');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();