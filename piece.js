document.addEventListener('DOMContentLoaded', function() {
    const jsonPath = './data.json';
    const articleContainer = document.getElementById('article-container');
    const navigationContainer = document.getElementById('navigation-container');

    // ページ番号を取得
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page')) || 1;

    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            // piecesを取得
            const pieces = data.pieces;

            // 日付の新しい順にソート
            pieces.sort((a, b) => new Date(b.date) - new Date(a.date));

            // 1ページあたりの記事数と記事の開始・終了インデックスを計算
            const itemsPerPage = 10;
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const totalPages = Math.ceil(pieces.length / itemsPerPage);

            // 記事を表示
            for (let i = startIndex; i < endIndex && i < pieces.length; i++) {
                const { id, title, date, body } = pieces[i];

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
                if (page > 1) {
                    const prevLink = document.createElement('a');
                    prevLink.href = `./piece?page=${page - 1}`;
                    prevLink.classList.add('prev');
                    prevLink.textContent = '<< Prev';
                    navigationDiv.appendChild(prevLink);
                }
                if (page < totalPages) {
                    const nextLink = document.createElement('a');
                    nextLink.href = `./piece?page=${page + 1}`;
                    nextLink.classList.add('next');
                    nextLink.textContent = 'Next >>';
                    navigationDiv.appendChild(nextLink);
                }
                navigationContainer.appendChild(navigationDiv);
            }
        })
        .catch(error => console.error('Error fetching data:', error));
});
