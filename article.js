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
    // 記事のコンテンツを表示する要素
    const articleContent = document.getElementById('article-content');

    // JSONファイルを取得して記事のコンテンツを表示
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            // 記事IDに対応する記事を検索
            const article = data.find(article => article.id === articleId);
            if (article) {
                document.title = `${article.title} - morvra`; // titleタグを更新
                articleTitleElement.innerHTML = `<h2>${article.title}</h2>`; // タイトルを表示
                articleDateElement.textContent = `${article.date}`; // 日付を表示
                // 記事が見つかった場合はコンテンツを表示
                articleContent.innerHTML = article.body;
            } else {
                articleContent.textContent = '記事が見つかりませんでした。';
            }
        })
        .catch(error => console.error('Error fetching data:', error));
});
