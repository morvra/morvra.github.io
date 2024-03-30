// articlelist.js

// ページが読み込まれた後に実行される関数
document.addEventListener('DOMContentLoaded', function() {
    // JSONファイルのパス
    const jsonPath = './data.json';

    // 記事リストを表示する要素
    const articleList = document.getElementById('article-list');

    // JSONファイルを取得して記事リストを作成
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            // 日付の新しい順にソート
            data.sort((a, b) => new Date(b.date) - new Date(a.date));

            // ソートされたデータを元に記事リストを作成
            data.forEach(article => {
                // 記事のタイトルとIDを取得
                const { id, title } = article;

                // 記事のタイトルをリンクとして追加
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.textContent = title;
                link.href = `article.html?id=${id}`; // 記事ページへのリンク
                listItem.appendChild(link);
                articleList.appendChild(listItem);
            });
        })
        .catch(error => console.error('Error fetching data:', error));
});
