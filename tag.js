// tag.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('tag.jsが読み込まれました'); // デバッグ用メッセージ

    // 現在のURLからクエリパラメータを取得
    const url = new URL(window.location.href);
    const tagName = url.searchParams.get('tag'); // 'tag'がキーであると仮定して取得

    if (tagName) {
        console.log('取得したタグ名:', tagName); // 取得したタグ名をコンソールに表示
    } else {
        console.error('タグ名がURLに含まれていないか、無効です。');
        return; // タグ名が取得できない場合は処理を終了
    }
    // ページタイトルを設定
    document.title = `${tagName} の記事一覧 - morvra lists`;

    // JSONファイルのパス
    const jsonPath = './data.json';
    const tagListElement = document.getElementById('tag-list');

    // JSONファイルを取得してタグに対応する記事のリストを表示
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            console.log('取得したデータ:', data); // 取得したデータをコンソールに表示

            // article と piece それぞれのIDセットを作成（フォルダ振り分け用）
            const articleIds = new Set(data.articles.map(a => a.id));

            // articles と pieces を統合したリストを作成
            const allContent = [...data.articles, ...data.pieces];

            // タグに対応するコンテンツのリストを作成
            const articlesWithTag = allContent.filter(item => {
                // tagsプロパティが存在し、かつタグ名が含まれているかをチェック
                return item.tags && item.tags.includes(tagName);
            });

            if (articlesWithTag.length > 0) {
                const tagTitleElement = document.createElement('h2');
                tagTitleElement.textContent = `${tagName} の記事一覧`;
                tagListElement.appendChild(tagTitleElement);

                const articleListElement = document.createElement('ul');
                articlesWithTag.forEach(item => {
                    const articleItem = document.createElement('li');
                    const articleLink = document.createElement('a');

                    articleLink.textContent = item.title;

                    // article か piece かでリンク先フォルダを振り分ける
                    const folder = articleIds.has(item.id) ? 'articles' : 'pieces';
                    articleLink.href = `/${folder}/${item.id}.html`;

                    articleItem.appendChild(articleLink);
                    articleListElement.appendChild(articleItem);
                });
                tagListElement.appendChild(articleListElement);
            } else {
                tagListElement.textContent = 'このタグに対応するコンテンツが見つかりませんでした。';
            }
        })
        .catch(error => console.error('Error fetching data:', error));
});
