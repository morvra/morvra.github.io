// getNews.js
// #newsタグのWorkflowyノードを取得し、news.json / news-latest.json / newslist.html を生成する

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
 *   1. Workflowyネイティブリンク: <a href="URL">テキスト</a> #news #AI
 *   2. Markdownリンク:           [テキスト](URL) #news #AI
 */
function extractNewsLink(rawName) {
    const name = unescapeHtml(rawName);

    // 1. WorkflowyネイティブHTMLリンク
    const htmlMatch = name.match(/<a\s+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/i);
    if (htmlMatch) {
        const url   = htmlMatch[1];
        const title = htmlMatch[2].replace(/#[\p{L}\p{N}\-_]+/gu, '').trim();
        return { title, url };
    }

    // 2. Markdownリンク
    const mdMatch = name.match(/\[([^\]]+)\]\(([^\)]+)\)/);
    if (mdMatch) {
        return { title: mdMatch[1], url: mdMatch[2] };
    }

    // 3. リンクなし
    const title = name.replace(/#[\p{L}\p{N}\-_]+/gu, '').trim();
    return { title, url: null };
}

/**
 * 子ノードをコメントとしてHTMLに変換する
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

function generateNewsListHtml(newsItems) {
    const currentYearMonth = new Date().toISOString().slice(0, 7);

    const sorted = [...newsItems].sort((a, b) => new Date(b.date) - new Date(a.date));

    const groupedByMonth = {};
    sorted.forEach(item => {
        const month = item.date.slice(0, 7);
        if (!groupedByMonth[month]) groupedByMonth[month] = [];
        groupedByMonth[month].push(item);
    });

    const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

    // 広告HTML (最新日付と次の日付の間に1回だけ挿入)
    const adHtml = `<li class="news-ad">
<div id="ad">
スポンサードリンク
<script async src="//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-3575252598876356"
     data-ad-slot="6223968026"
     data-ad-format="rectangle"></ins>
<script>
(adsbygoogle = window.adsbygoogle || []).push({});
</script>
</div>
</li>
`;

    let html = '';
    let adInserted = false;

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
        const byDate = {};
        groupedByMonth[month].forEach(item => {
            if (!byDate[item.date]) byDate[item.date] = [];
            byDate[item.date].push(item);
        });

        const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
        sortedDates.forEach((date, dateIndex) => {
            const dateSlug = date.replace(/-/g, '');
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
            // 最初の日付グループの直後に広告を1回だけ挿入
            if (!adInserted && dateIndex === 0) {
                html += adHtml;
                adInserted = true;
            }
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

function generateNewsDayPages(newsItems) {
    const outputDir = 'news';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created directory: ${outputDir}/`);
    }

    const byDate = {};
    newsItems.forEach(item => {
        if (!byDate[item.date]) byDate[item.date] = [];
        byDate[item.date].push(item);
    });

    let count = 0;
    Object.keys(byDate).forEach(date => {
        const items = byDate[date];
        const dateSlug = date.replace(/-/g, '');
        const [year, mon, day] = date.split('-');
        const dateLabel = `${year}年${parseInt(mon)}月${parseInt(day)}日`;

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

        <div id="ad">
            スポンサードリンク
            <script async src="//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
            <ins class="adsbygoogle"
                 style="display:block"
                 data-ad-client="ca-pub-3575252598876356"
                 data-ad-slot="6223968026"
                 data-ad-format="rectangle"></ins>
            <script>
            (adsbygoogle = window.adsbygoogle || []).push({});
            </script>
        </div>
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
// news-latest.json 生成 (トップページ用)
// ============================================================

/**
 * 最新日付分のニュースアイテムのみを news-latest.json として出力する。
 * トップページでの fetch 用に最小限のサイズに絞る。
 *
 * @param {Array} newsItems - ソート済み（新しい順）のニュースアイテム配列
 */
function generateNewsLatestJson(newsItems) {
    if (newsItems.length === 0) return;

    const latestDate = newsItems[0].date; // ソート済みなので先頭が最新
    const latest = newsItems.filter(i => i.date === latestDate);

    fs.writeFileSync(
        'news-latest.json',
        JSON.stringify({ date: latestDate, news: latest }, null, '\t'),
        'utf8'
    );
    console.log(`news-latest.json generated. (${latest.length} items for ${latestDate})`);
}

// ============================================================
// rss.xml にニュース日付ページをマージ
// ============================================================

/**
 * 既存の rss.xml を読み込み、ニュース日付ページのエントリをマージして書き直す。
 * - 記事エントリはそのまま保持する
 * - ニュースエントリは guid を基準に重複を除外してから追加する
 */
function mergeNewsIntoRss(newsItems) {
    const RSS_PATH = 'rss.xml';
    const BASE_URL = 'https://morvra.github.io';

    const byDate = {};
    newsItems.forEach(item => {
        if (!byDate[item.date]) byDate[item.date] = [];
        byDate[item.date].push(item);
    });

    const newsRssItems = Object.keys(byDate)
        .sort((a, b) => b.localeCompare(a))
        .map(date => {
            const [year, mon, day] = date.split('-');
            const dateLabel = `${year}年${parseInt(mon)}月${parseInt(day)}日`;
            const dateSlug  = date.replace(/-/g, '');
            const link      = `${BASE_URL}/news/${dateSlug}.html`;
            const pubDate   = new Date(`${date}T00:00:00+09:00`).toUTCString();

            const summary = byDate[date]
                .map(i => `・${i.title}`)
                .join('\n');

            return {
                guid: link,
                xml: `        <item>
          <title>${dateLabel}のニュース</title>
          <link>${link}</link>
          <description><![CDATA[${summary}]]></description>
          <pubDate>${pubDate}</pubDate>
          <guid isPermaLink="true">${link}</guid>
        </item>`,
            };
        });

    let existingArticleItems = '';
    if (fs.existsSync(RSS_PATH)) {
        const existing = fs.readFileSync(RSS_PATH, 'utf8');
        const itemRegex = /<item>[\s\S]*?<\/item>/g;
        const matches = existing.match(itemRegex) || [];
        existingArticleItems = matches
            .filter(item => !item.includes(`${BASE_URL}/news/`))
            .join('\n');
    }

    const newsGuids = new Set(newsRssItems.map(i => i.guid));

    const cleanedArticleItems = existingArticleItems
        .replace(/<item>[\s\S]*?<\/item>/g, match =>
            newsGuids.has(match.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '')
                ? ''
                : match
        );

    const newsXml = newsRssItems.map(i => i.xml).join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>morvra lists</title>
        <link>${BASE_URL}/</link>
        <description>morvraが何でも書く場所</description>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <language>ja-jp</language>
${newsXml}
${cleanedArticleItems}
      </channel>
    </rss>`;

    fs.writeFileSync(RSS_PATH, rss, 'utf8');
    console.log(`rss.xml updated. (${newsRssItems.length} news day entries merged)`);
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

            // createdAt (Unixタイムスタンプ秒) から日付を生成 (JST: UTC+9)
            const createdDate = new Date((node.createdAt + 9 * 3600) * 1000)
                .toISOString()
                .slice(0, 10);

            // noteからタグを取得 (nameにあるタグも拾う)
            const tagsFromNote = getTags(node.note || '');
            const tagsFromName = (() => {
                const plainName = unescapeHtml(node.name).replace(/<[^>]*>/g, '');
                const regex = /#([\p{L}\p{N}\-_]+)/gu;
                const tags = [];
                let m;
                while ((m = regex.exec(plainName)) !== null) tags.push(m[1]);
                return [...new Set(tags)].filter(t => t !== 'news');
            })();
            const tags = [...new Set([...tagsFromName, ...tagsFromNote])];

            const comment = renderComments(node, data.nodes);

            return { id: node.id, title, url, date: createdDate, tags, comment };
        });

        // 日付の新しい順にソート
        newsItems.sort((a, b) => new Date(b.date) - new Date(a.date));

        // news.json を出力
        fs.writeFileSync('news.json', JSON.stringify({ news: newsItems }, null, '\t'), 'utf8');
        console.log(`news.json generated. (${newsItems.length} items)`);

        // news-latest.json を出力 (トップページ用)
        generateNewsLatestJson(newsItems);

        // newslist.html フラグメントを生成
        generateNewsListHtml(newsItems);

        // 日付別静的ページを生成
        generateNewsDayPages(newsItems);

        // rss.xml にニュース日付ページをマージ
        mergeNewsIntoRss(newsItems);

        console.log('News generation complete.');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();