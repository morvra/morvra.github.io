// tag.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('tag.jsが読み込まれました'); // デバッグ用メッセージ
    
    // クエリパラメータからタグ名を取得
    const params = new URLSearchParams(window.location.search);
    const tagName = params.keys().next().value; // クエリのキーを取得しタグ名として使用
    console.log('取得したタグ名:', tagName); // 取得したタグ名をコンソールに表示

    // JSONファイルのパス
    const jsonPath = './data.json';
    const tagListElement = document.getElementById('tag-list');

    // JSONファイルを取得してタグに対応する記事のリストを表示
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            // タグに対応する記事のリストを作成
            const articlesWithTag = data.articles.filter(article => article.tags.includes(tagName));
            if (articlesWithTag.length > 0) {
                const tagTitleElement = document.createElement('h2');
                tagTitleElement.textContent = `${tagName} の記事一覧`;
                tagListElement.appendChild(tagTitleElement);

                const articleListElement = document.createElement('ul');
                articlesWithTag.forEach(article => {
                    const articleItem = document.createElement('li');
                    const articleLink = document.createElement('a');
                    articleLink.textContent = article.title;
                    articleLink.href = `article.html?id=${article.id}`;
                    articleItem.appendChild(articleLink);
                    articleListElement.appendChild(articleItem);
                });
                tagListElement.appendChild(articleListElement);
            } else {
                tagListElement.textContent = 'このタグに対応する記事が見つかりませんでした。';
            }
        })
        .catch(error => console.error('Error fetching data:', error));
});
