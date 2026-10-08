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

            // トップページ用に日付とタイトルを整形
            articleListElement.innerHTML = '';

            articleSubList.querySelectorAll(':scope > li').forEach(item => {
                const link = item.querySelector('a');
                const date = item.querySelector('.article-date');

                if (!link) {
                    return;
                }

                const li = document.createElement('li');
                li.className = 'top-article';

                const dateElement = document.createElement('span');
                dateElement.className = 'top-article-date';

                if (date) {
                    const match = date.textContent.match(/\d{4}-(\d{2})-(\d{2})/);

                    if (match) {
                        dateElement.textContent = `${match[1]}−${match[2]}`;
                    }
                }

                const titleLink = link.cloneNode(true);

                li.appendChild(dateElement);
                li.appendChild(titleLink);

                articleListElement.appendChild(li);
            });
        
        })
        .catch(error => {
            console.error('Error loading article list:', error);
        });


    // 最新ニュース
    const newsElement = document.getElementById('latest-news');

    fetch('./newslist.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `Failed to load newslist.html: ${response.status}`
                );
            }

            return response.text();
        })
        .then(html => {
            const temp = document.createElement('div');
            temp.innerHTML = html;

            // 最新のニュース記事を5件取得
            const items = temp.querySelectorAll('.news-item');

            items.forEach((item, index) => {
                if (index < 5) {
                    newsElement.appendChild(item.cloneNode(true));
                }
            });
        })
        .catch(error => {
            console.error('Error loading news list:', error);
        });

});