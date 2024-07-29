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

    // JSONファイルを取得して記事のコンテンツを表示
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            // data.articlesから記事IDに対応する記事を検索
            const article = data.articles.find(article => article.id === articleId);
            if (article) {
                document.title = `${article.title} - morvra lists`; // titleタグを更新
                articleTitleElement.innerHTML = `<h2>${article.title}</h2>`; // タイトルを表示
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
            } else {
                articleContent.textContent = '記事が見つかりませんでした。';
            }
        })
        .catch(error => console.error('Error fetching data:', error));
});
