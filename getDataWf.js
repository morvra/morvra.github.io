// getDataWorkflowy.js - WorkflowyのノードをHTMLリストとして出力

const fs = require('fs');
const fetch = globalThis.fetch || require('node-fetch').default;


// MarkdownリンクおよびHTMLリンクからテキストのみを抽出する関数
function stripMarkdownLinks(text) {
    // 1. Markdown形式 [テキスト](URL) -> テキスト
    let replaced = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    
    // 2. HTML形式 <a href="...">テキスト</a> -> テキスト
    // タグの中身($1)だけを残してタグを削除
    replaced = replaced.replace(/<a\s[^>]*>(.*?)<\/a>/gi, '$1');
    
    return replaced;
}

// HTMLデコード関数 (escapeHtmlの逆)
function unescapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
}

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
function stripParagraphTags(html) {
    const trimmedHtml = html.trim();
    if (trimmedHtml.startsWith('<p>') && trimmedHtml.endsWith('</p>')) {
        const innerContent = trimmedHtml.substring(3, trimmedHtml.length - 4);
        
        if (!innerContent.includes('<p>')) {
            return innerContent; // 外側の<p>を剥がした中身を返す
        }
    }
    // 条件に一致しない場合は、元のHTMLをそのまま返す
    return html;
}

// MarkdownをHTMLに変換する関数
function markdownToHTML(markdown) {
    // まずHTMLデコードを行う
    const decodedMarkdown = unescapeHtml(markdown);
    
    const lines = decodedMarkdown.split('\n'); // デコード後の文字列を分割
    let html = '';

    let inBlockquote = false;
    let inList = false;
    let listItems = [];

    // URLから <a> タグを抽出するヘルパー関数
    const extractUrl = (url) => {
        const linkMatch = url.match(/<a href="(.+?)">.+?<\/a>/);
        if (linkMatch && linkMatch[1]) {
            return linkMatch[1];
        }
        return url;
    };

    lines.forEach((line, index) => {
        if (line.startsWith('// ')) {
            return;
        }
        if (line.startsWith('> ')) { // (デコードされたので > でOK)
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

            if (line.startsWith('・')) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                
                // リスト内のリンク処理
                const listItemContent = line.replace(/^・/, '').replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
                    const finalUrl = extractUrl(url); // URLを抽出

                    if (!finalUrl.includes('https://workflowy.com/')) {
                        return `<a href="${finalUrl}" target="_blank">${text}</a>`;
                    } else {
                        return `<a href="${finalUrl}">${text}</a>`;
                    }
                });
                listItems.push(listItemContent);

                if (!lines[index + 1] || !lines[index + 1].startsWith('・')) {
                    html += '<li>' + listItems.join('</li><li>') + '</li>';
                    html += '</ul>';
                    inList = false;
                    listItems = [];
                }
            } else {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                    listItems = [];
                }

                // HTMLタグかどうかを先に判定
                if (line.trim().startsWith('<')) {
                    const finalLine = line.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
                        return url; 
                    });
                    html += `<p>${finalLine}</p>`;
                } else {
                    // HTMLタグでなかった行だけをMarkdown処理する
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
                        index = i;
                    
                    // 画像処理
                    } else if (/\!\[.*?\]\((.*?)\)/.test(line)) {
                        const replacedLine = line.replace(/\!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
                            if (!alt) alt = 'Image';
                            const finalUrl = extractUrl(url); // URLを抽出
                            return `<img src="${finalUrl}" alt="${alt}">`;
                        });
                        html += `<p>${replacedLine}</p>`;

                    // リンク処理
                    } else if (/\[.*?\]\((.*?)\)/.test(line)) {
                        html += `<p>${line.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
                            const finalUrl = extractUrl(url); // URLを抽出
                            
                            if (!finalUrl.includes('https://workflowy.com/')) {
                                return `<a href="${finalUrl}" target="_blank">${text}</a>`;
                            } else {
                                return `<a href="${finalUrl}">${text}</a>`;
                            }
                        })}</p>`;
                    } else if (/\*\*|\`|\*|_/.test(line)) {
                        html += `<p>${line
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\`(.*?)\`/g, '<code>$1</code>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`;
                    } else if (line.trim() !== '') {
                        html += `<p>${line}</p>`;
                    }
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

// WorkflowyのURLを条件に応じて変換またはテキスト化する関数
function replaceWorkflowyUrls(body, shortIdToUuidMap, publicUUIDs) {
    // <a href="https://workflowy.com/#/shortId">text</a> の形式をキャプチャ
    // markdownToHTMLの出力に合わせて、target属性などがないシンプルな形を想定しつつ柔軟にマッチ
    const linkPattern = /<a\s+href=["']https:\/\/workflowy\.com\/#\/([a-zA-Z0-9-]+)["'][^>]*>(.*?)<\/a>/g;
    const siteUrl = 'https://morvra.github.io/article?id=';

    return body.replace(linkPattern, (match, shortId, linkText) => {
        // MapからUUIDを探す
        const uuid = shortIdToUuidMap[shortId];

        // UUIDが見つかる、かつ 公開リスト(publicUUIDs)に含まれている場合
        if (uuid && publicUUIDs.has(uuid)) {
            // リンクとして出力
            return `<a href="${siteUrl}${uuid}">${linkText}</a>`;
        } else {
            // 非公開または存在しないノードへのリンクは、素のテキストのみを返す
            return linkText;
        }
    });
}

// 指定したタグを持つノードを取得する関数
function getNodesByTag(nodes, tagName) {
    return nodes.filter(node => {
        const hasTagInName = node.name && node.name.includes(`#${tagName}`);
        const hasTagInNote = node.note && node.note.includes(`#${tagName}`);
        return hasTagInName || hasTagInNote;
    });
}

// ノードのnoteからメタデータを抽出する関数
function getMetadata(node) {
    let date = '';

    // ノードのnoteプロパティのみを参照
    const rawNote = node.note;
    if (!rawNote) return { date: '' };

    // HTMLデコードを適用
    const note = unescapeHtml(rawNote);
    
    const lines = note.split('\n');

    for (const line of lines) {
        if (line.startsWith('date:')) {
            let rawDate = line.replace('date:', '').trim();

            // 1. <time>タグを抽出（note内に書かれたWorkflowy日付機能に対応）
            const timeTagMatch = rawDate.match(/<time\s+startYear="(\d{4})"\s+startMonth="(\d{1,2})"\s+startDay="(\d{1,2})">/);
            
            if (timeTagMatch) {
                const year = timeTagMatch[1];
                const month = String(timeTagMatch[2]).padStart(2, '0');
                const day = String(timeTagMatch[3]).padStart(2, '0');
                
                date = `${year}-${month}-${day}`;
                return { date }; 
            }

            // 2. [[YYYY-MM-DD]] 形式 (Workflowyの日付リンク) をチェックし、[]を除去
            const wfDateMatch = rawDate.match(/\[\[(\d{4}-\d{2}-\d{2})\]\]/);
            if (wfDateMatch) {
                date = wfDateMatch[1];
                return { date }; 
            }
            
            // 3. YYYY-MM-DD 形式をチェック (手動入力された日付)
            const plainDateMatch = rawDate.match(/(\d{4}-\d{2}-\d{2})/);
            if (plainDateMatch) {
                date = plainDateMatch[1];
                return { date }; 
            }
        }
    }

    return { date };
}

// タグを取得する関数
function getTags(note) {
    if (!note) {
        return [];
    }
    const tagLineMatch = note.match(/tag:\s*(.*)/);
    if (tagLineMatch && tagLineMatch[1]) {
        const tagString = tagLineMatch[1];
        const individualTags = [];
        const tagRegex = /#([\p{L}\p{N}\-_]+)/gu;
        let match;
        while ((match = tagRegex.exec(tagString)) !== null) {
            individualTags.push(match[1]);
        }
        return individualTags.filter(tag => tag !== 'article' && tag !== 'piece');
    } else {
        return [];
    }
}

// Workflowyのノードから子ノードを取得するヘルパー関数
function getChildren(nodeId, allNodes) {
    return allNodes
        .filter(node => node.parent_id === nodeId)
        .sort((a, b) => a.priority - b.priority);
}

// 再帰ヘルパー関数: ネストされたHTMLリストを構築
function buildNestedListHtml(node, allNodes) {
    let itemContentHtml = stripParagraphTags(markdownToHTML(node.name));
    let listItemHtml = `<li>${itemContentHtml}`;

    const children = getChildren(node.id, allNodes);
    if (children.length > 0) {
        listItemHtml += '<ul>';
        children.forEach(childNode => {
            listItemHtml += buildNestedListHtml(childNode, allNodes);
        });
        listItemHtml += '</ul>';
    }
    listItemHtml += '</li>';
    return listItemHtml;
}

// 本文を取得する関数
function getBody(allNodes, rootNode) {
    let htmlOutput = '';
    
    const children = getChildren(rootNode.id, allNodes);
    if (children.length > 0) {
        children.forEach(childNode => {
            htmlOutput += processNodeSubtree(childNode, allNodes);
        });
    }
    return htmlOutput;
}

// ヘルパー関数: 個々のノードとそのサブツリーをHTMLに変換
function processNodeSubtree(currentNode, allNodes) {
    let nodeHtml = '';

    // layoutModeを取得 (存在しない場合に備えて 'bullets' をデフォルトに)
    const layoutMode = (currentNode.data && currentNode.data.layoutMode) ? currentNode.data.layoutMode : 'bullets';

    if (layoutMode === 'h1' || layoutMode === 'h2' || layoutMode === 'h3') {
        const level = layoutMode.charAt(1);
        // nameの中身をMarkdownとして処理 (リンク、太字など) し、<p>タグを除去
        const content = stripParagraphTags(markdownToHTML(currentNode.name));
        nodeHtml += `<h${level}>${content}</h${level}>`;
        
        // Note 処理
        if (currentNode.note) {
            const noteContentToRender = currentNode.note
                .split('\n')
                .filter(line => !line.startsWith('date:') && !line.startsWith('tag:'))
                .join('\n')
                .trim();
            
            if (noteContentToRender !== '') {
                nodeHtml += markdownToHTML(noteContentToRender);
            }
        }
        
        // 子ノードの処理
        const children = getChildren(currentNode.id, allNodes);
        if (children.length > 0) {
            children.forEach(childNode => {
                nodeHtml += processNodeSubtree(childNode, allNodes);
            });
        }

    } else if (layoutMode === 'quote-block') {
        // 引用の場合
        // nameの中身をMarkdownとして処理し、<p>タグを除去
        const content = stripParagraphTags(markdownToHTML(currentNode.name));
        nodeHtml += `<blockquote><p>${content}</p></blockquote>`; // 引用は <p> があった方がセマンティック

        // Note 処理
        if (currentNode.note) {
            const noteContentToRender = currentNode.note
                .split('\n')
                .filter(line => !line.startsWith('date:') && !line.startsWith('tag:'))
                .join('\n')
                .trim();
            
            if (noteContentToRender !== '') {
                // 引用内のNoteは、そのまま引用の一部として追加する
                nodeHtml += `<blockquote>${markdownToHTML(noteContentToRender)}</blockquote>`;
            }
        }
        
        // 子ノードの処理 (子も引用として扱うか、通常のテキストとして続けるか)
        // ここでは通常のテキストとして処理
        const children = getChildren(currentNode.id, allNodes);
        if (children.length > 0) {
            children.forEach(childNode => {
                nodeHtml += processNodeSubtree(childNode, allNodes);
            });
        }

    } else if (currentNode.name.trim().toLowerCase() === 'li') {
        // 既存の 'li' 特殊処理 (layoutMode == 'bullets' のはず)
        const children = getChildren(currentNode.id, allNodes);
        if (children.length > 0) {
            nodeHtml += '<ul>';
            children.forEach(childNode => {
                nodeHtml += buildNestedListHtml(childNode, allNodes);
            });
            nodeHtml += '</ul>';
        }
    } else {
        // デフォルトの処理 (layoutMode == 'bullets' や 'todo' など)
        // この場合、markdownToHTMLが '# 見出し' などを処理する
        
        nodeHtml += markdownToHTML(currentNode.name);
        
        if (currentNode.note) {
            const noteContentToRender = currentNode.note
                .split('\n')
                .filter(line => !line.startsWith('date:') && !line.startsWith('tag:'))
                .join('\n')
                .trim();
            
            if (noteContentToRender !== '') {
                nodeHtml += markdownToHTML(noteContentToRender);
            }
        }

        const children = getChildren(currentNode.id, allNodes);
        if (children.length > 0) {
            children.forEach(childNode => {
                nodeHtml += processNodeSubtree(childNode, allNodes);
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

// Workflowyからデータを取得する部分
async function main() {
    const WORKFLOWY_API_KEY = process.env.WORKFLOWY_API_KEY;

    if (!WORKFLOWY_API_KEY) {
        console.error('Error: WORKFLOWY_API_KEY environment variable is not set.');
        process.exit(1);
    }

    try {
        const response = await fetch('https://workflowy.com/api/v1/nodes-export', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${WORKFLOWY_API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Short ID (URL末尾) と Full UUID の対応マップを作成
        const shortIdToUuidMap = {};
        data.nodes.forEach(node => {
            const shortId = node.id.replace(/-/g, '').slice(-12);
            shortIdToUuidMap[shortId] = node.id;
        });

        // #articleタグを持つノードを記事として取得
        const articleNodes = getNodesByTag(data.nodes, 'article');
        // #pieceタグを持つノードをpieceとして取得
        const pieceNodes = getNodesByTag(data.nodes, 'piece');
        
        // 公開される記事のUUIDセットを作成（高速検索用）
        const publicUUIDs = new Set([
            ...articleNodes.map(n => n.id),
            ...pieceNodes.map(n => n.id)
        ]);
        
        const articles = articleNodes.map(obj => {
            const id = obj.id;
            
            // タイトルからMarkdownリンクを除去
            let rawTitle = obj.name.replace(/#article/g, '').trim();
            const title = stripMarkdownLinks(rawTitle);
            const { date } = getMetadata(obj);
            const tags = getTags(obj.note);
            const body = replaceWorkflowyUrls(getBody(data.nodes, obj), shortIdToUuidMap, publicUUIDs);
            
            return { id, title, date, tags, body };
        });

        const pieces = pieceNodes.map(obj => {
            const id = obj.id;
            
            let rawTitle = obj.name.replace(/#piece/g, '').trim();
            const title = stripMarkdownLinks(rawTitle);
            
            const { date } = getMetadata(obj);
            const tags = getTags(obj.note);
            const body = replaceWorkflowyUrls(getBody(data.nodes, obj), shortIdToUuidMap, publicUUIDs);
            
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
    } catch (error) {
        console.error('Error fetching data:', error);
        process.exit(1);
    }
}

main();
