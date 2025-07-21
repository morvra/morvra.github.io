// articlelist.js

// ページが読み込まれた後に実行される関数
document.addEventListener('DOMContentLoaded', function() {
    // JSONファイルのパス
    const jsonPath = './data.json';

    // 記事リストを表示する要素
    const articleListElement = document.getElementById('article-list');

    // 現在の年を取得
    const currentYear = new Date().getFullYear();

    // JSONファイルを取得して記事リストを作成
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            // data.articlesから記事リストを取得
            const articles = data.articles;

            // 日付の新しい順にソート
            articles.sort((a, b) => new Date(b.date) - new Date(a.date));

            // 記事を年ごとにグループ化する
            const groupedArticles = {};
            articles.forEach(article => {
                const year = new Date(article.date).getFullYear();
                if (!groupedArticles[year]) {
                    groupedArticles[year] = [];
                }
                groupedArticles[year].push(article);
            });

            // 年を新しい順にソートして表示
            const sortedYears = Object.keys(groupedArticles).sort((a, b) => b - a);

            let htmlContent = '';
            sortedYears.forEach(year => {
                const isCurrentYear = (parseInt(year) === currentYear);
                // 現在の年以外は 'collapsed' クラスを付与
                const collapseClass = isCurrentYear ? '' : 'collapsed';
                // アイコンも現在の年によって初期状態を切り替える
                const iconClass = isCurrentYear ? 'fa-chevron-down' : 'fa-chevron-right';

                // 年ごとのヘッダーと記事リストのセクションを生成
                htmlContent += `
                    <li class="year-group">
                        <h3 class="year-header ${isCurrentYear ? 'active-year' : ''}" data-year="${year}">
                            ${year}年 <i class="fa ${iconClass}"></i>
                        </h3>
                        <ul class="article-sub-list ${collapseClass}">
                `;

                // その年の記事をリストに追加
                groupedArticles[year].forEach(article => {
                    // 記事のタイトルとIDを取得
                    const { id, title, date } = article;
                    htmlContent += `
                            <li>
                                <a href="article?id=${id}">${title}</a>
                                <span class="article-date">(${date})</span>
                            </li>
                    `;
                });

                htmlContent += `
                        </ul>
                    </li>
                `;
            });

            // 生成したHTMLをDOMに追加
            articleListElement.innerHTML = htmlContent;

            // 年ヘッダーのクリックイベントリスナーを追加
            document.querySelectorAll('.year-header').forEach(header => {
                header.addEventListener('click', function() {
                    const subList = this.nextElementSibling; // 次の要素（ul.article-sub-list）を取得
                    const icon = this.querySelector('i'); // ヘッダー内のアイコンを取得

                    // 'collapsed' クラスの有無で表示/非表示を切り替える
                    if (subList.classList.contains('collapsed')) {
                        subList.classList.remove('collapsed');
                        icon.classList.remove('fa-chevron-right');
                        icon.classList.add('fa-chevron-down');
                    } else {
                        subList.classList.add('collapsed');
                        icon.classList.remove('fa-chevron-down');
                        icon.classList.add('fa-chevron-right');
                    }
                });
            });
        })
        .catch(error => console.error('Error fetching data:', error));
});
