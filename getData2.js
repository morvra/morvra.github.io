// getData2.js

const fs = require('fs'); // Node.jsのfsモジュールをインポート
// fetch関数をより堅牢に定義: Node.jsのネイティブfetchがあればそれを使用し、なければnode-fetchをフォールバックとして使用
// node-fetchのESM形式に対応するため、.defaultプロパティを参照するように変更
const fetch = globalThis.fetch || require('node-fetch').default; 

// HTMLエスケープ関数
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ヘルパー関数: HTML文字列から外側の<p>タグを除去
// リストアイテムのコンテンツが単一の<p>でラップされている場合に適用
function stripParagraphTags(html) {
    const trimmedHtml = html.trim();
    if (trimmedHtml.startsWith('<p>') && trimmedHtml.endsWith('</p>')) {
        const innerContent = trimmedHtml.substring(3, trimmedHtml.length - 4);
        // 内側のコンテンツが他のブロックレベル要素を含まない場合にのみ<p>を剥がす
        // これにより、リストアイテム内に複雑なMarkdownがあっても崩れにくい
        if (!/<[a-z][\s\S]*>/i.test(innerContent) || // 任意のHTMLタグが含まれていないか
            (innerContent.includes('<strong>') || innerContent.includes('<em>') || innerContent.includes('<code>') || innerContent.includes('<a>') || innerContent.includes('<img>')) && // インライン要素のみの場合
            !(innerContent.includes('<p>') || innerContent.includes('<ul>') || innerContent.includes('<ol>') || innerContent.includes('<blockquote>') || innerContent.includes('<pre>') || innerContent.includes('<h1>') || innerContent.includes('<h2>') || innerContent.includes('<h3>') || innerContent.includes('<hr>'))) { // 他のブロック要素が含まれていない
            return innerContent;
        }
    }
    return html;
}

// MarkdownをHTMLに変換する関数
function markdownToHTML(markdown) {
    const lines = markdown.split('\n');
    let html = '';

    let inBlockquote = false;
    let inList = false; // 「・」リスト用
    let listItems = []; // 「・」リスト用

    lines.forEach((line, index) => {
        // コメントをスキップする
        if (line.startsWith('// ')) {
            return;
        }
        // 引用（blockquote）
        if (line.startsWith('> ')) {
            // ブロッククォートが始まる前に開いているリストがあれば閉じる
            if (inList) {
                html += '</ul>';
                inList = false;
                listItems = [];
            }
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

            // 「・」によるリスト処理を再導入
            if (line.startsWith('・')) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                // リンクの処理をリストアイテム内で行う
                const listItemContent = line.replace(/^・/, '').replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
                    // Dynalist内部リンク以外のURLはtarget="_blank"を付ける
                    if (!url.includes('https://dynalist.io/d/ihr-nPYa3LhA5ETZ9F0NS9Im')) {
                        return `<a href="${url}" target="_blank">${text}</a>`;
                    } else {
                        return `<a href="${url}">${text}</a>`;
                    }
                });
                listItems.push(listItemContent);

                // 次の行がリストアイテムでない、または最終行の場合にリストを閉じる
                if (!lines[index + 1] || !lines[index + 1].startsWith('・')) {
                    html += '<li>' + listItems.join('</li><li>') + '</li>'; // 各アイテムを<li>でラップ
                    html += '</ul>';
                    inList = false;
                    listItems = []; // リストアイテムをリセット
                }
            } else { // リストアイテムではない場合
                // 開いているリストがあれば閉じる
                if (inList) {
                    html += '</ul>';
                    inList = false;
                    listItems = [];
                }

                // 他のマークダウンの処理
                if (line.startsWith('#')) {
                    const level = line.match(/^#+/)[0].length;
                    const text = line.replace(/^#+\s*/, '');
                    html += `<h${level}>${text}</h${level}>`;
                } else if (line === '---') {
                    html += '<hr>';
                } else if (line.startsWith('```')) {
                    let codeBlockContent = '';
                    let i = index + 1;
                    while (i < lines.length && !lines[i].startsWith('```')) {
                        codeBlockContent += lines[i] + '\n';
                        i++;
                    }
                    html += `<pre><code>${escapeHtml(codeBlockContent.trim())}</code></pre>`;
                    index = i; // ループのインデックスを更新してコードブロックをスキップ
                } else if (/\!\[.*?\]\((.*?)\)/.test(line)) {
                    const replacedLine = line.replace(/\!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
                        if (!alt) alt = 'Image';
                        return `<img src="${url}" alt="${alt}">`;
                    });
                    html += `<p>${replacedLine}</p>`;
                } else if (/\[.*?\]\((.*?)\)/.test(line)) {
                    html += `<p>${line.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
                        // Dynalist内部リンク以外のURLはtarget="_blank"を付ける
                        if (!url.includes('https://dynalist.io/d/ihr-nPYa3LhA5ETZ9F0NS9Im')) {
                            return `<a href="${url}" target="_blank">${text}</a>`;
                        } else {
                            return `<a href="${url}">${text}</a>`;
                        }
                    })}</p>`;
                } else if (/\*\*|\`|\*|_/.test(line)) { // 太字、コードスパン、イタリック
                    html += `<p>${line
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\`(.*?)\`/g, '<code>$1</code>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`;
                }
                // 通常のテキスト（空行でない場合）
                else if (line.trim() !== '') {
                    html += `<p>${line}</p>`;
                }
            }
        }
    });

    // 閉じタグの残りを処理
    if (inBlockquote) {
        html += '</blockquote>';
    }
    // 最後にリストがまだ開いていれば閉じる
    if (inList) { 
        html += '</ul>';
    }

    return html;
}

// DynalistのURLを適切なパスに変換する関数
function replaceDynalistUrls(body) {
    const dynalistUrlPattern = /https:\/\/dynalist\.io\/d\/[a-zA-Z0-9-_]+#z=([a-zA-Z0-9-_]+)/g;
    const siteUrl = 'https://morvra.github.io/article?id=';
    return body.replace(dynalistUrlPattern, (match, itemId) => {
        return `${siteUrl}${itemId}`;
    });
}

// 指定したタグを持つノードを取得する関数
function getNodesByTag(nodes, tagName) {
    return nodes.filter(node => {
        // contentまたはnoteにタグが含まれているかチェック
        const hasTagInContent = node.content && node.content.includes(`#${tagName}`);
        const hasTagInNote = node.note && node.note.includes(`#${tagName}`);
        return hasTagInContent || hasTagInNote;
    });
}

// ノードのnoteからメタデータを抽出する関数 (日付のみ)
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

// タグを取得する関数 (tag: #hoge1, #hoge2 形式)
function getTags(note) {
    if (!note) {
        return [];
    }
    // "tag: #hoge1, #hoge2" の形式をマッチ
    const tagLineMatch = note.match(/tag:\s*(.*)/); // "tag: " の後に続くすべての文字列をキャプチャ
    if (tagLineMatch && tagLineMatch[1]) {
        const tagString = tagLineMatch[1];
        // キャプチャした文字列から個々のタグを抽出
        // # の後に続く、文字、数字、ハイフン、アンダースコアの連続にマッチ
        // \p{L} は任意の言語の文字、\p{N} は任意の数字にマッチ (Unicodeプロパティエスケープ)
        // uフラグはUnicodeプロパティエスケープを有効にする
        const individualTags = [];
        const tagRegex = /#([\p{L}\p{N}\-_]+)/gu; // 個々の #タグ をマッチ
        let match;
        while ((match = tagRegex.exec(tagString)) !== null) {
            individualTags.push(match[1]); // キャプチャグループ1 (タグ名、#なし) を追加
        }
        
        // 'article' と 'piece' は分類用なので除外
        return individualTags.filter(tag => tag !== 'article' && tag !== 'piece');
    } else {
        return [];
    }
}

// 再帰ヘルパー関数: ネストされたHTMLリストを構築
// この関数は、liマーカーの子要素として呼び出され、<ul><li>構造を生成します
function buildNestedListHtml(node, allNodes) {
    // ノードのコンテンツをHTMLに変換し、不要な外側の<p>タグを除去
    let itemContentHtml = stripParagraphTags(markdownToHTML(node.content));

    let listItemHtml = `<li>${itemContentHtml}`;

    // 子ノードがあれば、さらにネストされた<ul>を生成
    if (node.children && node.children.length > 0) {
        listItemHtml += '<ul>';
        node.children.forEach(childId => {
            const childNode = allNodes.find(obj => obj.id === childId);
            if (childNode) {
                listItemHtml += buildNestedListHtml(childNode, allNodes); // 子ノードを再帰的に処理
            }
        });
        listItemHtml += '</ul>';
    }
    listItemHtml += '</li>';
    return listItemHtml;
}

// 本文を取得する関数（再帰的にDynalistの階層構造をHTMLに変換）
// この関数は、記事/pieceのルートノードの子要素から本文を構築する
function getBody(allNodes, rootNode) {
    let htmlOutput = '';

    // ルートノードの直接の子要素から処理を開始
    if (rootNode.children && rootNode.children.length > 0) {
        rootNode.children.forEach(childId => {
            const childNode = allNodes.find(node => node.id === childId);
            if (childNode) {
                // 各子ノードとそのサブツリーを処理するヘルパー関数
                htmlOutput += processNodeSubtree(childNode, allNodes);
            }
        });
    }
    return htmlOutput;
}

// ヘルパー関数: 個々のノードとそのサブツリーをHTMLに変換
function processNodeSubtree(currentNode, allNodes) {
    let nodeHtml = '';

    // 現在のノードが「li」マーカーの場合
    if (currentNode.content.trim().toLowerCase() === 'li') {
        if (currentNode.children && currentNode.children.length > 0) {
            nodeHtml += '<ul>';
            currentNode.children.forEach(childId => {
                const childNode = allNodes.find(node => node.id === childId);
                if (childNode) {
                    nodeHtml += buildNestedListHtml(childNode, allNodes); // buildNestedListHtmlでリストを構築
                }
            });
            nodeHtml += '</ul>';
        }
    } else {
        // 通常のノードの場合、そのコンテンツとノート（メタデータ部分を除く）をMarkdownとして処理
        nodeHtml += markdownToHTML(currentNode.content);
        
        if (currentNode.note) {
            // noteからdate:とtag:の行を除外した内容をMarkdown変換
            const noteContentToRender = currentNode.note
                .split('\n')
                .filter(line => !line.startsWith('date:') && !line.startsWith('tag:'))
                .join('\n')
                .trim();
            
            if (noteContentToRender !== '') {
                nodeHtml += markdownToHTML(noteContentToRender);
            }
        }

        // 現在のノードの子要素を再帰的に処理し、本文に追加
        // これにより、通常の階層構造が本文としてフラットに展開される
        if (currentNode.children && currentNode.children.length > 0) {
            currentNode.children.forEach(childId => {
                const childNode = allNodes.find(node => node.id === childId);
                if (childNode) {
                    nodeHtml += processNodeSubtree(childNode, allNodes); // 再帰呼び出し
                }
            });
        }
    }
    return nodeHtml;
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
async function main() {
    const DYNALIST_TOKEN = process.env.DYNALIST_TOKEN; // 環境変数からトークンを取得
    const DYNALIST_FILE_ID = 'ihr-nPYa3LhA5ETZ9F0NS9Im'; // 対象のファイルID

    if (!DYNALIST_TOKEN) {
        console.error('Error: DYNALIST_TOKEN environment variable is not set.');
        process.exit(1);
    }

    try {
        const response = await fetch('https://dynalist.io/api/v1/doc/read', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: DYNALIST_TOKEN,
                'file_id': DYNALIST_FILE_ID,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // #articleタグを持つノードを記事として取得
        const articleNodes = getNodesByTag(data.nodes, 'article');
        // #pieceタグを持つノードをpieceとして取得
        const pieceNodes = getNodesByTag(data.nodes, 'piece');
        
        const articles = articleNodes.map(obj => {
            const id = obj.id;
            // タイトルから#articleタグを削除
            const title = obj.content.replace(/#article/g, '').trim();
            const { date } = getMetadata(obj.note);
            const tags = getTags(obj.note); // noteからタグを取得
            const body = replaceDynalistUrls(getBody(data.nodes, obj)); // getBodyを修正
            return { id, title, date, tags, body };
        });

        const pieces = pieceNodes.map(obj => {
            const id = obj.id;
            // タイトルから#pieceタグを削除
            const title = obj.content.replace(/#piece/g, '').trim();
            const { date } = getMetadata(obj.note);
            const tags = getTags(obj.note); // noteからタグを取得
            const body = replaceDynalistUrls(getBody(data.nodes, obj)); // getBodyを修正
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
    } catch (error) {
        console.error('Error fetching data:', error);
        process.exit(1); // エラーが発生した場合は終了コード1で終了
    }
}

// main関数を実行
main();
