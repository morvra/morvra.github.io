// tag.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('tag.jsが読み込まれました'); // デバッグ用メッセージ

    // クエリパラメータからタグ名を取得
    const params = new URLSearchParams(window.location.search);
    let tagName = params.get('tag'); // 'tag'がキーであると仮定して取得

    if (tagName) {
        tagName = tagName.replace(/^#/, ''); // タグ名から「#」を削除
    }

    console.log('取得したタグ名:', tagName); // 取得したタグ名をコンソールに表示

    if (!tagName) {
        console.error('タグ名がURLに含まれていないか、無効です。');
        return; // タグ名が取得できない場合は処理を終了
    }

    // JSONファイルのパス
    const jsonPath = './data.json';
    const tagListElement = document.getElementById('tag-list');

    // JSONファイルを取得してタグに対応する記事のリストを表示
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            console.log('取得したデータ:', data); // 取得したデータをコンソールに表示

            // タグに対応する記事のリストを作成
            const articlesWithTag = data.articles.filter(article => {
                console.log('記事のタグ:', article.tags); // 各記事のタグをコンソールに表示
                return article.tags.includes(tagName);
            });

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
