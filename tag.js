// tag.js
document.addEventListener('DOMContentLoaded', function() {
    // クエリパラメータからタグ名を取得
    const params = new URLSearchParams(window.location.search);
    const tagName = params.toString(); // クエリ全体を取得

    // JSONファイルのパス
    const jsonPath = './data.json';
    const tagListElement = document.getElementById('taglist');

    // JSONファイルを取得してタグに対応する記事のリストを表示
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            // タグに対応する記事のリストを作成
            const articlesWithTag = data.articles.filter(article => article.tags.includes(tagName));
            if (articlesWithTag.length > 0) {
                const tagTitleElement = document.createElement('h2');
                tagTitleElement.textContent = `タグ: ${tagName} の記事一覧`;
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
