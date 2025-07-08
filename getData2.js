// getData2.js
const fs = require('fs'); // Node.jsのfsモジュールをインポート

// MarkdownをHTMLに変換する関数
function markdownToHTML(markdown) {
    const lines = markdown.split('\n');
    let html = '';

    let inBlockquote = false;
    let inList = false;
    let listItems = [];

    lines.forEach((line, index) => {
        // コメントをスキップする
        if (line.startsWith('// ')) {
            return;
        }
        // 引用（blockquote）
        if (line.startsWith('> ')) {
            if (!inBlockquote) {
                html += '<blockquote>';
                inBlockquote = true;
            }
            html += `<p>${line.replace(/^> /, '')}</p>`;
        } else {
            if (inBlockquote) {
                html += '</blockquote>';
                inBlockquote = false;
            }

            if (line.startsWith('・')) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                listItems.push(line.replace(/^・/, ''));
                if (!lines[index + 1] || !lines[index + 1].startsWith('・')) {
                    html += '<li>' + listItems.map(item => {
                        if (/\[.*?\]\((.*?)\)/.test(item)) {
                            return item.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
                                return `<a href="${url}">${text}</a>`;
                            });
                        } else {
                            return item;
                        }
                    }).join('</li><li>') + '</li>';
                    listItems = [];
                }
            } else {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }

                // 他のマークダウンの処理
                if (line.startsWith('#')) {
                    const level = line.match(/^#+/)[0].length;
                    const text = line.replace(/^#+\s*/, '');
                    html += `<h${level}>${text}</h${level}>`;
                } else if (line === '---') {
                    html += '<hr>';
                } else if (/\*\*|\`|\*|_/.test(line)) {
                    html += `<p>${line
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\`(.*?)\`/g, '<code>$1</code>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`;
                } else if (line.startsWith('```')) {
                    html += '<pre><code>';
                    const codeLines = lines.slice(index + 1);
                    const endIndex = codeLines.findIndex((l) => l.startsWith('```'));
                    codeLines.slice(0, endIndex).forEach((l) => {
                        html += `${l}\n`;
                    });
                    html += '</code></pre>';
                } else if (/\!\[.*?\]\((.*?)\)/.test(line)) {
                    const replacedLine = line.replace(/\!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
                        if (!alt) alt = 'Image';
                        return `<img src="${url}" alt="${alt}">`;
                    });
                    html += `<p>${replacedLine}</p>`;
                } else if (/\[.*?\]\((.*?)\)/.test(line)) {
                    html += `<p>${line.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
                        if (!url.includes('https://dynalist.io/d/ihr-nPYa3LhA5ETZ9F0NS9Im')) {
                            return `<a href="${url}" target="_blank">${text}</a>`;
                        } else {
                            return `<a href="${url}">${text}</a>`;
                        }
                    })}</p>`;
                } else {
                    html += `<p>${line}</p>`;
                }
            }
        }
    });

    if (inBlockquote) {
        html += '</blockquote>';
    }

    if (inList) {
        html += '</ul>';
    }

    return html;
}

// DynalistのURLを置換する関数
function replaceDynalistUrls(body) {
    const dynalistUrlPattern = /https:\/\/dynalist\.io\/d\/[a-zA-Z0-9-_]+#z=([a-zA-Z0-9-_]+)/g;
    const siteUrl = 'https://morvra.github.io/article?id=';
    return body.replace(dynalistUrlPattern, (match, itemId) => {
        return `${siteUrl}${itemId}`;
    });
}

// 指定した色のノードを取得する関数
function getNodesByColor(nodes, num) {
    return nodes.filter(obj => obj.color && obj.color === num);
}

// メタデータを取得する関数
function getMetadata(note) {
    const lines = note.split('\n');
    let date = '';

    lines.forEach(line => {
        if (line.startsWith('date:')) {
            date = line.replace('date:', '').trim();
        }
    });

    return { date };
}

// タグを取得する関数
function getTags(note) {
    const lines = note.split('\n');
    let tags = [];

    lines.forEach(line => {
        if (line.startsWith('tag:')) {
            const tagsStr = line.replace('tag:', '').trim();
            tags = tagsStr.split(',').map(tag => tag.trim().replace(/^#/, ''));
        }
    });

    return tags;
}

// 本文を取得する関数
function getBody(nodes, parent) {
    const result = [];
    roop(parent);

    function roop(node) {
        if (!node.children) return;

        node.children.forEach((id) => {
            const find = nodes.find((obj) => obj.id === id);
            if (find) {
                const html = markdownToHTML(find.content);
                result.push(html);
                roop(find);
            }
        });
    }

    return result.join('\n').replace(/<\/ul>\n<ul>/g, '');
}

// RSSフィードを生成する関数
function generateRSS(articles) {
    let rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>morvra lists</title>
        <link>https://morvra.github.io/</link>
        <description>morvraが何でも書く場所</description>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <language>ja-jp</language>`;

    articles.forEach(article => {
        rssFeed += `
        <item>
          <title>${article.title}</title>
          <link>https://morvra.github.io/article?id=${article.id}</link>
          <description><![CDATA[${article.body}]]></description>
          <pubDate>${new Date(article.date).toUTCString()}</pubDate>
          <guid isPermaLink="true">https://morvra.github.io/article?id=${article.id}</guid>
        </item>`;
    });

    rssFeed += `
      </channel>
    </rss>`;

    return rssFeed;
}

// Dynalistからデータを取得する部分
fetch('https://dynalist.io/api/v1/doc/read', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        token: process.env.DYNALIST_TOKEN, // 環境変数からトークンを取得
        'file_id': 'ihr-nPYa3LhA5ETZ9F0NS9Im', // 対象のファイルID
    }),
})
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // データ処理のロジックを追加
        const articleNodes = getNodesByColor(data.nodes, 1);
        const pieceNodes = getNodesByColor(data.nodes, 5);
        
        const articles = articleNodes.map(obj => {
            const id = obj.id;
            const title = obj.content;
            const { date } = getMetadata(obj.note);
            const tags = getTags(obj.note);
            const body = replaceDynalistUrls(getBody(data.nodes, obj));
            return { id, title, date, tags, body };
        });

        const pieces = pieceNodes.map(obj => {
            const id = obj.id;
            const title = obj.content;
            const { date } = getMetadata(obj.note);
            const tags = getTags(obj.note);
            const body = replaceDynalistUrls(getBody(data.nodes, obj));
            return { id, title, date, tags, body };
        });

        const output = {
            articles: articles,
            pieces: pieces
        };

        // JSONとRSSをファイルに書き込む
        fs.writeFileSync('data.json', JSON.stringify(output, null, '\t'));
        console.log('data.json generated.');

        const rssFeed = generateRSS(articles);
        fs.writeFileSync('rss.xml', rssFeed);
        console.log('rss.xml generated.');
    })
    .catch(error => console.error('Error fetching data:', error));
