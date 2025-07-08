// getData2.js
const fs = require('fs'); // Node.jsのfsモジュールをインポート

// MarkdownをHTMLに変換する関数 (単一ノードのcontent/note用)
// リスト構造は含まない、純粋なマークダウンテキストの変換に専念
function markdownToHTML(markdown) {
    if (!markdown) return '';

    let html = '';
    const lines = markdown.split('\n');

    lines.forEach(line => {
        // コメントをスキップする
        if (line.startsWith('// ')) {
            return;
        }

        const trimmedLine = line.trim(); // 行頭の空白をトリム

        // 引用（blockquote）
        if (trimmedLine.startsWith('> ')) {
            html += `<blockquote><p>${trimmedLine.replace(/^> /, '')}</p></blockquote>`;
        }
        // 見出し
        else if (trimmedLine.startsWith('#')) {
            const level = trimmedLine.match(/^#+/)[0].length;
            const text = trimmedLine.replace(/^#+\s*/, '');
            html += `<h${level}>${text}</h${level}>`;
        }
        // 水平線
        else if (trimmedLine === '---') {
            html += '<hr>';
        }
        // コードブロック (簡易的な処理。複数行対応はより複雑なパーサーが必要)
        else if (trimmedLine.startsWith('```')) {
            html += `<pre><code>${trimmedLine.replace(/```/g, '')}</code></pre>`;
        }
        // 画像
        else if (/\!\[.*?\]\((.*?)\)/.test(trimmedLine)) {
            html += trimmedLine.replace(/\!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
                if (!alt) alt = 'Image';
                return `<img src="${url}" alt="${alt}">`;
            });
        }
        // リンク (インライン) - 基本的なHTMLリンク変換
        else if (/\[.*?\]\((.*?)\)/.test(trimmedLine)) {
            html += trimmedLine.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
                // Dynalistの内部リンクかどうかはreplaceDynalistUrlsで別途処理される
                return `<a href="${url}">${text}</a>`;
            });
        }
        // 太字、コード、イタリックなどのインラインマークダウンと、通常の段落
        else if (trimmedLine !== '') {
            let processedLine = trimmedLine;
            processedLine = processedLine
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // 太字
                .replace(/\`(.*?)\`/g, '<code>$1</code>')       // コードスニペット
                .replace(/\*(.*?)\*/g, '<em>$1</em>');          // イタリック

            html += `<p>${processedLine}</p>`;
        }
    });

    return html;
}

// DynalistのURLを置換する関数
function replaceDynalistUrls(body) {
    const dynalistUrlPattern = /https:\/\/dynalist\.io\/d\/[a-zA-Z0-9-_]+#z=([a-zA-Z0-9-_]+)/g;
    const siteUrl = 'https://morvra.github.io/article?id='; // あなたのサイトのベースURL
    return body.replace(dynalistUrlPattern, (match, itemId) => {
        return `${siteUrl}${itemId}`;
    });
}

// 指定した色のノードを取得する関数
function getNodesByColor(nodes, num) {
    if (!nodes) {
        console.warn("getNodesByColor: 'nodes' is undefined. Returning empty array.");
        return [];
    }
    return nodes.filter(obj => obj.color && obj.color === num);
}

// メタデータを取得する関数
function getMetadata(note) {
    if (!note) return { date: '' };

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
    if (!note) return [];

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


// ノードIDのリストからHTMLを構築する再帰関数
// リスト（`・`で始まる）とそれ以外のブロック要素を適切に処理
function buildHtmlFromNodes(allNodes, nodeIds) {
    let html = '';
    let inListContext = false; // 現在<ul>の中にいるかどうかを追跡

    nodeIds.forEach(nodeId => {
        const node = allNodes.find(n => n.id === nodeId);
        if (!node) return; // ノードが見つからない場合はスキップ

        // ノードのcontentが中黒で始まるかチェック
        const isListItem = node.content && node.content.trimStart().startsWith('・');
        // リストアイテムの場合、中黒を除去してmarkdownToHTMLに渡す
        const nodeContentToProcess = isListItem ? node.content.trimStart().substring(1) : node.content;
        const nodeContentHtml = markdownToHTML(nodeContentToProcess);

        if (isListItem) {
            // リストアイテムの場合
            if (!inListContext) {
                html += '<ul>'; // まだ<ul>の中にいなければ、新しく開始
                inListContext = true;
            }
            html += '<li>';
            html += nodeContentHtml; // 変換されたコンテンツを追加

            // 子ノードがあり、さらにネストされたリストやブロック要素がある可能性
            if (node.children && node.children.length > 0) {
                html += buildHtmlFromNodes(allNodes, node.children); // 再帰的に処理
            }
            html += '</li>';
        } else {
            // リストアイテムではない場合（通常のブロック要素）
            if (inListContext) {
                html += '</ul>'; // 現在<ul>の中にいれば、それを閉じる
                inListContext = false;
            }
            html += nodeContentHtml; // 変換されたコンテンツを通常のブロックとして追加

            // 子ノードがあり、さらにネストされたリストやブロック要素がある可能性
            if (node.children && node.children.length > 0) {
                html += buildHtmlFromNodes(allNodes, node.children); // 再帰的に処理
            }
        }
    });

    // このレベルのすべてのノードを処理し終えた後、もし<ul>が開いたままなら閉じる
    if (inListContext) {
        html += '</ul>';
    }

    return html;
}

// 本文（ネストされたHTML構造）を構築する関数
// Dynalistのchildrenプロパティを使って再帰的にリストやブロックを構築
function getBody(allNodes, parentNode) {
    if (!parentNode.children || parentNode.children.length === 0) {
        return ''; // 子ノードがなければ空文字列を返す
    }
    // 親ノードの全ての子IDを渡し、HTMLを構築
    return buildHtmlFromNodes(allNodes, parentNode.children);
}

// RSSフィードを生成する関数 (変更なし)
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

// Dynalistからデータを取得する部分 (変更なし)
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
            return response.text().then(text => {
                throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data._code && data._code !== 'OK') {
            throw new Error(`Dynalist API Error: ${data._msg || 'Unknown error'}`);
        }

        if (!data.nodes || !Array.isArray(data.nodes)) {
            throw new Error("Dynalist API response does not contain a valid 'nodes' array.");
        }

        const articleNodes = getNodesByColor(data.nodes, 1);
        const pieceNodes = getNodesByColor(data.nodes, 5);

        const articles = articleNodes.map(obj => {
            const id = obj.id;
            const title = obj.content;
            const { date } = getMetadata(obj.note);
            const tags = getTags(obj.note);
            const body = replaceDynalistUrls(getBody(data.nodes, obj)); // getBodyの呼び出しは変更なし
            return { id, title, date, tags, body };
        });

        const pieces = pieceNodes.map(obj => {
            const id = obj.id;
            const title = obj.content;
            const { date } = getMetadata(obj.note);
            const tags = getTags(obj.note);
            const body = replaceDynalistUrls(getBody(data.nodes, obj)); // getBodyの呼び出しは変更なし
            return { id, title, date, tags, body };
        });

        const output = {
            articles: articles,
            pieces: pieces
        };

        fs.writeFileSync('data.json', JSON.stringify(output, null, '\t'));
        console.log('data.json generated.');

        const rssFeed = generateRSS(articles);
        fs.writeFileSync('rss.xml', rssFeed);
        console.log('rss.xml generated.');
    })
    .catch(error => console.error('Error fetching data:', error));
