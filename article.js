// article.js

// ページが読み込まれた後に実行される関数
document.addEventListener('DOMContentLoaded', function() {
    // クエリパラメータから記事IDを取得
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');
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
            // data.articlesから記事IDに対応する記事を検索
            const article = data.articles.find(article => article.id === articleId);
            if (article) {
                document.title = `${article.title} - morvra lists`; // titleタグを更新
                articleTitleElement.innerHTML = `<h1>${article.title}</h1>`; // タイトルを表示
                articleDateElement.textContent = `${article.date}`; // 日付を表示
                // タグを表示
                if (article.tags.length > 0) {
                    article.tags.forEach((tag, index) => {
                        const tagLink = document.createElement('a');
                        tagLink.textContent = tag;
                        tagLink.href = `tag?tag=${tag}`; // タグページへのリンク
                        articleTagsElement.appendChild(tagLink);
                        if (index < article.tags.length - 1) {
                            articleTagsElement.appendChild(document.createTextNode(', '));
                        }
                    });
                }
                // 記事が見つかった場合はコンテンツを表示
                articleContent.innerHTML = article.body;

                // 関連記事の表示
                const currentArticleTags = article.tags;
                const relatedArticles = data.articles
                    .filter(item => item.id !== articleId && // 現在の記事を除外
                        item.tags.some(tag => currentArticleTags.includes(tag))) // 共通のタグを持つ記事を抽出
                    .sort(() => 0.5 - Math.random()) // ランダムに並び替え
                    .slice(0, 3); // 最大3件に制限

                if (relatedArticles.length > 0) {
                    // 関連記事が見つかった場合にのみセクションを作成し挿入
                    const relatedArticlesSection = document.createElement('div');
                    relatedArticlesSection.id = 'related-articles';
                    relatedArticlesSection.innerHTML = '<h2>関連記事</h2>';

                    const relatedArticlesList = document.createElement('ul');
                    relatedArticles.forEach(relatedArticle => {
                        const listItem = document.createElement('li');
                        const link = document.createElement('a');
                        link.href = `article.html?id=${relatedArticle.id}`;
                        link.textContent = relatedArticle.title;
                        listItem.appendChild(link);
                        relatedArticlesList.appendChild(listItem);
                    });
                    relatedArticlesSection.appendChild(relatedArticlesList);

                    // 広告要素の直後に挿入
                    if (adElement && adElement.parentNode) {
                        adElement.parentNode.insertBefore(relatedArticlesSection, adElement.nextSibling);
                    } else {
                        // 広告要素が見つからない場合のフォールバック（例：記事コンテンツの最後に追加）
                        articleContent.parentNode.appendChild(relatedArticlesSection);
                    }
                }

            } else {
                articleContent.textContent = '記事が見つかりませんでした。';
            }
        })
        .catch(error => console.error('Error fetching data:', error));
});
