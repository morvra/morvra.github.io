// index.js

document.addEventListener('DOMContentLoaded', function () {

    const articleListElement = document.getElementById('article-list');
    const currentYear = new Date().getFullYear().toString();

    fetch('./articlelist.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `Failed to load articlelist.html: ${response.status}`
                );
            }

            return response.text();
        })
        .then(html => {

            // 一時的な要素に読み込む
            const temp = document.createElement('div');
            temp.innerHTML = html;

            // 今年の年グループを取得
            const currentYearGroup = temp.querySelector(
                `.year-header[data-year="${currentYear}"]`
            )?.closest('.year-group');

            if (!currentYearGroup) {
                articleListElement.innerHTML =
                    '<li>今年の記事はまだありません。</li>';
                return;
            }

            // 年見出しはトップページでは表示しない
            const articleSubList =
                currentYearGroup.querySelector('.article-sub-list');

            if (!articleSubList) {
                return;
            }

            // 記事部分だけを表示
            articleListElement.innerHTML = articleSubList.innerHTML;
        })
        .catch(error => {
            console.error('Error loading article list:', error);
        });


    // 最新ニュース
    const newsElement = document.getElementById('latest-news');

    fetch('./news.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `Failed to load news.html: ${response.status}`
                );
            }

            return response.text();
        })
        .then(html => {

            const temp = document.createElement('div');
            temp.innerHTML = html;

            // news.htmlの先頭部分から最新5件を取得
            const items = temp.querySelectorAll('li');

            items.forEach((item, index) => {
                if (index < 5) {
                    newsElement.appendChild(item.cloneNode(true));
                }
            });
        })
        .catch(error => {
            console.error('Error loading news:', error);
        });

});