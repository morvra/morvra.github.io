document.addEventListener('DOMContentLoaded', function() {
    const jsonPath = './piece.json';
    const articleContainer = document.getElementById('article-container');
    const navigationContainer = document.getElementById('navigation-container');

    // ページ番号を取得
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page')) || 1;

    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            // 日付の新しい順にソート
            data.sort((a, b) => new Date(b.date) - new Date(a.date));

            // 1ページあたりの記事数と記事の開始・終了インデックスを計算
            const itemsPerPage = 20;
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const totalPages = Math.ceil(data.length / itemsPerPage);

            // 記事を表示
            for (let i = startIndex; i < endIndex && i < data.length; i++) {
                const { id, title, date, body } = data[i];

                // 記事のタイトル、日付、本文を表示するdiv要素を作成
                const articleDiv = document.createElement('div');
                articleDiv.classList.add('piece');
                articleDiv.innerHTML = `
                    <h2 id="piece-title">${title}</h2>
                    <div id="article-date">${date}</div>
                    <div id="article-content">${body}</div>
                `;

                // 記事を記事コンテナに追加
                articleContainer.appendChild(articleDiv);
            }

            // ページング用のリンクを表示
            if (totalPages > 1) {
                const navigationDiv = document.createElement('div');
                navigationDiv.classList.add('navigation');
                navigationDiv.innerHTML = `
                    <a href="./piece.html?page=${page - 1}" class="prev" ${page === 1 ? 'style="display: none;"' : ''}>Prev</a>
                    <a href="./piece.html?page=${page + 1}" class="next" ${page === totalPages ? 'style="display: none;"' : ''}>Next</a>
                `;
                navigationContainer.appendChild(navigationDiv);
            }
        })
        .catch(error => console.error('Error fetching data:', error));
});
