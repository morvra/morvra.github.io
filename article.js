// article.js

// ページが読み込まれた後に実行される関数
document.addEventListener('DOMContentLoaded', function() {
    // クエリパラメータから記事IDを取得
    const params = new URLSearchParams(window.location.search);
    const contentId = params.get('id');
    // JSONファイルのパス
    const jsonPath = './data.json';
    const articleTitleElement = document.getElementById('article-title');
    const articleDateElement = document.getElementById('article-date'); // 日付を表示する要素
    const articleTagsElement = document.getElementById('article-tags'); // タグ
    // 記事のコンテンツを表示する要素
    const articleContent = document.getElementById('article-content');
    const adElement = document.getElementById('ad'); // 広告要素を取得

    // JSONファイルを取得して記事のコンテンツを表示
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            // articles と pieces を統合したリストを作成
            const allContent = [...data.articles, ...data.pieces];

            // 統合リストからコンテンツを検索
            const content = allContent.find(item => item.id === contentId);

            if (content) {
                document.title = `${content.title} - morvra lists`; // titleタグを更新
                articleTitleElement.innerHTML = `<h1>${content.title}</h1>`; // タイトルを表示
                articleDateElement.textContent = `${content.date}`; // 日付を表示
                
                // タグを表示 (tagsプロパティが存在する場合のみ)
                if (content.tags && content.tags.length > 0) {
                    articleTagsElement.innerHTML = ''; // 既存のタグをクリア
                    content.tags.forEach((tag, index) => {
                        const tagLink = document.createElement('a');
                        tagLink.textContent = tag;
                        tagLink.href = `tag?tag=${tag}`; // タグページへのリンク
                        articleTagsElement.appendChild(tagLink);
                        if (index < content.tags.length - 1) {
                            articleTagsElement.appendChild(document.createTextNode(', '));
                        }
                    });
                } else {
                    articleTagsElement.innerHTML = ''; // タグがない場合は空にする
                }
                
                // コンテンツを表示
                articleContent.innerHTML = content.body;

                // 共通のタグを持つ関連記事（または関連piece）を検索
                const currentContentTags = content.tags;
                const relatedArticles = allContent
                    .filter(item => item.id !== contentId && // 現在のコンテンツを除外
                        item.tags && // tagsプロパティが存在する場合のみ
                        item.tags.some(tag => currentContentTags.includes(tag))) // 共通のタグを持つコンテンツを抽出
                    .sort(() => 0.5 - Math.random()); // ランダムに並び替え
                    // .slice(0, 5); // 最大5件に制限

                // 関連記事が見つかった場合にのみセクションを作成し挿入
                if (relatedArticles.length > 0) {
                    const relatedArticlesSection = document.createElement('div');
                    relatedArticlesSection.id = 'related-articles';
                    relatedArticlesSection.innerHTML = '<h2>関連記事</h2>';

                    const relatedArticlesList = document.createElement('ul');
                    relatedArticles.forEach(relatedArticle => {
                        const listItem = document.createElement('li');
                        const link = document.createElement('a');
                        link.href = `article?id=${relatedArticle.id}`; // 記事とpieceでURLを共通化
                        link.textContent = relatedArticle.title;
                        listItem.appendChild(link);
                        relatedArticlesList.appendChild(listItem);
                    });
                    relatedArticlesSection.appendChild(relatedArticlesList);

                    if (adElement && adElement.parentNode) {
                        adElement.parentNode.insertBefore(relatedArticlesSection, adElement.nextSibling);
                    } else {
                        articleContent.parentNode.appendChild(relatedArticlesSection);
                    }
                }
            } else {
                articleContent.textContent = '記事またはpieceが見つかりませんでした。';
            }
        })
        .catch(error => console.error('Error fetching data:', error));
});
